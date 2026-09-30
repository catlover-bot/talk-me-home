import { test, expect } from './switchyard-fixture';
import { fakeProvider, confirmLocalReadiness } from './fake-provider';

test('simulated non-Practice guidance invites a report and preserves raw replies without commanding Pip', async ({ page, baseURL, switchyardServer }) => {
  const escaped: string[] = [];
  const writes: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', error => { throw error; });
  page.on('request', request => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  // These guards catch any request not consumed by the exact browser-only fixtures below.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || /\/voice-token$/.test(url.pathname)) {
      escaped.push(`${url.origin}${url.pathname}`); await route.abort(); return;
    }
    await route.fallback();
  });
  await page.routeWebSocket('**', socket => { escaped.push('Unstubbed WebSocket'); socket.close(); });
  // One simulated token request and one Playwright-owned socket are expected.
  // The helper fulfills token/access locally and never connects its socket to a server:
  // no production token issuance, allowance, real provider or hardware audio is used.
  const provider = await fakeProvider(page);
  try {
    await page.goto('/');
    await page.getByRole('radio', { name: /^The Switchyard/ }).check();
    await page.getByRole('radio', { name: /Live Text/ }).check();
    await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
    await confirmLocalReadiness(page, 'Text');
    await provider.waitForSent(event => event.type === 'session.update');
    const cue = page.getByTestId('switchyard-guide-radio');
    const guide = page.getByTestId('switchyard-guidance');
    await expect(cue).toHaveText('Ask Pip for a local look, then an inspection. Your documents supply the circuit rules Pip cannot see.');
    await expect(page.getByRole('region', { name: 'Local companion requests' })).toHaveCount(0);
    await expect(guide).toHaveAttribute('data-stage', 'observe');

    const reply = (replyId: string, text: string) => {
      provider.emit({ type: 'reply.started', reply_id: replyId });
      provider.emit({ type: 'transcript.agent', reply_id: replyId, text });
      provider.emit({ type: 'reply.done', reply_id: replyId, status: 'completed' });
    };
    const greeting = 'Fixture greeting: I am ready; this is not an equipment report.';
    reply('guide-greeting', greeting);
    await expect(page.getByTestId('caption')).toHaveText(greeting);
    await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
    await expect(guide).toHaveAttribute('data-stage', 'observe');
    const before = provider.sent.length;
    await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
    await expect(cue).toHaveCount(0);
    await page.getByRole('button', { name: 'Replay guidance', exact: true }).click();
    await expect(cue).toBeVisible();
    await expect(guide).toHaveAttribute('data-stage', 'observe');
    expect(provider.sent).toHaveLength(before);

    const input = 'Please look around and report what you can inspect.';
    await page.getByLabel('Type a message', { exact: true }).fill(input);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await provider.waitForSent(event => event.type === 'conversation.message' && event.role === 'user' && event.content === input, before);
    await expect(guide).toHaveAttribute('data-stage', 'observe');
    const raw = 'Fixture reply — I can inspect the equipment within reach. What information do you need?';
    reply('guide-requested-reply', raw);
    await expect(page.getByTestId('caption')).toHaveText(raw);
    await expect(guide).toHaveAttribute('data-stage', 'draft');
    await expect(cue).toHaveCount(0);
    await expect(page.getByTestId('switchyard-guide-document')).toBeVisible();
    expect(writes.filter(path => /\/(tools|routing-panel|proposal-decision|hint)$/.test(path))).toEqual([]);
    expect(switchyardServer.commits).toHaveLength(0);
    expect(provider.tokenRequests).toBe(1);
    expect(provider.connections).toBe(1);
    expect((await provider.audioState()).captures).toBe(0);
  } finally {
    if (await page.getByRole('button', { name: 'Pause / End call', exact: true }).count()) {
      await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    }
    await expect.poll(() => provider.activeSockets).toBe(0);
    expect((await provider.audioState()).activeTracks).toBe(0);
    expect(escaped).toEqual([]);
  }
});
