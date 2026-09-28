import { test, expect, type Page } from '@playwright/test';
import { fakeProvider, confirmLocalReadiness, fixtureScreenshot } from './fake-provider';

type Provider = Awaited<ReturnType<typeof fakeProvider>>;
const acknowledgements = (provider: Provider) => provider.sent.filter(event => event.type === 'reply.create' && typeof event.instructions === 'string');
const receipts = (provider: Provider) => provider.sent.filter(event => event.type === 'conversation.message' && event.role === 'system' && String(event.content).startsWith('Verified game decision receipt.'));

async function pendingLatch(page: Page, voice = false) {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.getByRole('radio', { name: voice ? /Live Voice/ : /Live Text/ }).check();
  await page.getByRole('button', { name: voice ? 'Start with Voice' : 'Start with Text', exact: true }).click();
  await confirmLocalReadiness(page, voice ? 'Voice' : 'Text');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  const result = await provider.tool('propose_interaction', { object: 'latch', action: 'latch_open' }, 'continuity-latch');
  expect(result.code).toBe('awaiting_confirmation');
  provider.emit({ type: 'reply.started', reply_id: 'proposal-explanation' });
  provider.emit({ type: 'transcript.agent', reply_id: 'proposal-explanation', text: 'Please confirm the proposed Latch action on your console.' });
  provider.emit({ type: 'reply.done', reply_id: 'proposal-explanation', status: 'completed' });
  await expect(page.getByTestId('caption')).toHaveText('Please confirm the proposed Latch action on your console.');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  return provider;
}

test('compiled app queues immediate typed input behind the real confirmation receipt and preserves the next proposal', async ({ page }, info) => {
  const provider = await pendingLatch(page);
  await fixtureScreenshot(page, info.outputPath('pending.png'));
  let release!: () => void;
  let committed = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sessions/*/proposal-decision', async route => {
    const response = await route.fetch();
    expect((await response.json()).proposal.status).toBe('committed');
    committed = true;
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    await page.getByLabel('Type a message').fill('Please check that confirmed result.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    expect(provider.sent.some(event => event.role === 'user' && event.content === 'Please check that confirmed result.')).toBe(false);
    release();
    await expect.poll(() => provider.sent.some(event => event.role === 'user' && event.content === 'Please check that confirmed result.')).toBe(true);
    const contextIndex = provider.sent.findIndex(event => event === receipts(provider)[0]);
    const inputIndex = provider.sent.findIndex(event => event.role === 'user' && event.content === 'Please check that confirmed result.');
    expect(contextIndex).toBeGreaterThan(-1); expect(contextIndex).toBeLessThan(inputIndex);
    expect(receipts(provider)).toHaveLength(1);
    await page.clock.fastForward(500);
    expect(acknowledgements(provider)).toHaveLength(0);
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    await fixtureScreenshot(page, info.outputPath('committed.png'));
    provider.emit({ type: 'reply.started', reply_id: 'read-result' });
    provider.emit({ type: 'transcript.agent', reply_id: 'read-result', text: 'The confirmed Latch action is complete.' });
    provider.emit({ type: 'reply.done', reply_id: 'read-result', status: 'completed' });
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
    const next = await provider.tool('propose_move', { target: 'far_side' }, 'continuity-next');
    expect(next.code).toBe('awaiting_confirmation');
    await expect(page.getByTestId('proposal-label')).toHaveText('Move to the far-side platform');
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', next.proposal!.id);
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Conversation history', exact: true })).toContainText('Please check that confirmed result.');
    await page.locator('.history-message').filter({ hasText: 'Engage the Latch: completed after your confirmation.' }).scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await fixtureScreenshot(page, info.outputPath('next-proposal-history.png'));
    expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'continuity-latch')).toHaveLength(1);
    expect(provider.connections).toBe(1); expect(provider.tokenRequests).toBe(1);
  } finally {
    release();
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});

test('compiled Voice acknowledgement waits for drained playback and yields to new speech without another action', async ({ page }) => {
  const provider = await pendingLatch(page, true);
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  // Audio starts after the decision but before the pending idle-dispatch timer.
  provider.emit({ type: 'reply.started', reply_id: 'still-speaking' });
  provider.emit({ type: 'reply.audio', data: Buffer.alloc(480).toString('base64') });
  await expect.poll(async () => (await provider.audioState()).queuedChunks).toBeGreaterThan(0);
  await provider.render();
  provider.emit({ type: 'reply.done', reply_id: 'still-speaking', status: 'completed' });
  await page.clock.fastForward(300);
  expect(acknowledgements(provider)).toHaveLength(0);
  await provider.drain();
  await page.clock.fastForward(151);
  await expect.poll(() => acknowledgements(provider).length).toBe(1);
  provider.emit({ type: 'reply.started', reply_id: 'decision-ack' });
  provider.emit({ type: 'transcript.agent.delta', reply_id: 'decision-ack', delta: 'The Latch action' });
  provider.emit({ type: 'reply.audio', data: Buffer.alloc(480).toString('base64') });
  await provider.render();
  const canceled = page.waitForResponse(response => response.url().endsWith('/cancel'));
  provider.emit({ type: 'input.speech.started' });
  await canceled;
  provider.emit({ type: 'input.speech.stopped' });
  provider.emit({ type: 'transcript.user', item_id: 'interrupt-ack', text: 'Please wait while I check my document.' });
  provider.emit({ type: 'reply.done', reply_id: 'decision-ack', status: 'interrupted' });
  await expect(page.getByTestId('caption')).toHaveText('Please wait while I check my document.');
  await page.clock.fastForward(5000);
  expect(acknowledgements(provider)).toHaveLength(1); expect(receipts(provider)).toHaveLength(1);
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  expect(provider.sent.filter(event => event.type === 'tool.result')).toHaveLength(1);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(() => provider.activeSockets).toBe(0);
  expect((await provider.audioState()).activeTracks).toBe(0);
  expect(provider.connections).toBe(1);
});

for (const action of ['Pause', 'Restart'] as const) {
  test(`compiled app ${action} cancels an undispatched acknowledgement and never opens a replacement connection`, async ({ page }) => {
    const provider = await pendingLatch(page);
    await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    expect(receipts(provider)).toHaveLength(1);
    if (action === 'Pause') await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    else {
      await page.getByRole('button', { name: 'Restart', exact: true }).click();
      await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
    }
    await expect.poll(() => provider.activeSockets).toBe(0);
    await page.clock.fastForward(5000);
    expect(acknowledgements(provider)).toHaveLength(0);
    expect(provider.connections).toBe(1); expect(provider.tokenRequests).toBe(1);
    if (action === 'Pause') await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    else await expect(page.getByTestId('action-proposal')).toHaveCount(0);
  });
}
