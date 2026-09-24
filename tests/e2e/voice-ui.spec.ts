import { test, expect, type Page } from '@playwright/test';
import { fakeProvider, fixtureScreenshot, confirmLocalReadiness } from './fake-provider';

async function startLive(page: Page, kind: 'Voice' | 'Text' = 'Text') {
  await page.goto('/');
  await page.getByRole('radio', { name: /Training/ }).check();
  await page.getByRole('radio', { name: new RegExp(`Live ${kind}`) }).check();
  await page.getByRole('button', { name: `Start with ${kind}` }).click();
  await confirmLocalReadiness(page, kind);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
}
function reply(provider: Awaited<ReturnType<typeof fakeProvider>>, id: string, text: string) {
  provider.emit({ type: 'reply.started', reply_id: id });
  provider.emit({ type: 'transcript.agent', reply_id: id, text });
  provider.emit({ type: 'reply.done', reply_id: id, status: 'completed' });
}

test('simulated Live Voice: one capture path, honest playback state, local mute, reliable interrupt, and pause cleanup', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await page.goto('/');
  expect(await provider.audioState()).toEqual({ captures: 0, activeTracks: 0, contexts: 0, closedContexts: 0, queuedChunks: 0 });
  expect(provider.tokenRequests).toBe(0);
  await page.getByRole('radio', { name: /Training/ }).check();
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  expect(provider.tokenRequests).toBe(0);
  await confirmLocalReadiness(page, 'Voice');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(1);
  expect((await provider.audioState()).captures).toBe(2);
  expect((await provider.audioState()).activeTracks).toBe(1);
  provider.emit({ type: 'input.speech.started' });
  provider.emit({ type: 'transcript.user.delta', item_id: 'human-one', text: 'Could you look' });
  provider.emit({ type: 'transcript.user.delta', item_id: 'human-one', text: 'Could you look around?' });
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'listening');
  await expect(page.getByTestId('caption')).toHaveText('Could you look around?');
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-listening-${info.project.name}.png`);
  provider.emit({ type: 'input.speech.stopped' });
  provider.emit({ type: 'transcript.user', item_id: 'human-one', text: 'Could you look around?' });
  provider.emit({ type: 'reply.started', reply_id: 'spoken' });
  provider.emit({ type: 'reply.audio', data: 'AEAAQA==' });
  provider.emit({ type: 'transcript.agent.delta', reply_id: 'spoken', delta: 'I am checking' });
  await expect.poll(async () => (await provider.audioState()).queuedChunks).toBe(1);
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'considering');
  await provider.render();
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'speaking');
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-speaking-${info.project.name}.png`);
  await page.getByText('Connection & sound', { exact: true }).click();
  await expect(page.getByLabel('Next connection')).toBeDisabled();
  await page.getByRole('button', { name: 'Mute all audio' }).click();
  await expect(page.locator('.pip-portrait')).not.toHaveAttribute('data-state', 'speaking');
  await expect(page.locator('body')).toContainText('Muting does not end the call.');
  expect(provider.ended).toBe(0);
  await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'interrupted');
  provider.emit({ type: 'transcript.agent', reply_id: 'spoken', text: 'I am checking and an undelivered completion claim.' });
  await expect(page.getByTestId('caption')).toHaveText('I am checking');
  await expect(page.locator('body')).toContainText('Interrupted / incomplete speech');
  expect(provider.activeSockets).toBe(1);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Live Voice' })).toBeEnabled();
  expect(provider.ended).toBe(1);
  expect(provider.activeSockets).toBe(0);
  expect((await provider.audioState()).activeTracks).toBe(0);
  await expect(page.locator('.pip-portrait')).not.toHaveAttribute('data-state', 'listening');
});

test('simulated Live Voice to Practice to Live Text: provenance and private notes survive with only historical recap', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await startLive(page, 'Voice');
  const observation = await provider.tool('observe_room', {}, 'record-observe');
  expect(observation.ok).toBe(true);
  expect(observation.message).toMatch(/Latch/);
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  reply(provider, 'disclosed', 'The Latch is reachable from this safe platform.');
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Pin report', exact: true }).click();
  await expect(page.locator('.notebook-list')).toContainText('Robot report');
  await page.locator('.desk-extras > summary').click();
  await page.getByLabel('My note', { exact: true }).fill('Private notebook marker. Do not communicate this.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByLabel('Type a message').fill('The manual says these machines share Power.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => provider.sent.some(event => event.type === 'conversation.message' && String(event.content).includes('manual says'))).toBe(true);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Live Voice' })).toBeEnabled();
  await page.getByText('Connection & sound', { exact: true }).click();
  await page.getByLabel('Next connection').selectOption('practice');
  await expect(page.getByTestId('caption')).toContainText('Earlier conversations are in history.');
  await page.getByRole('button', { name: 'Open transcript history' }).click();
  const history = page.getByRole('region', { name: 'Conversation history', exact: true });
  await expect(history).toContainText('Live Voice');
  await expect(history).toContainText('Previous call');
  await expect(history).toContainText('Typed');
  const pinContrast = await history.getByRole('button', { name: 'Pin report' }).evaluate(button => {
    const style = getComputedStyle(button);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const levels = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return (levels[0]! + 0.05) / (levels[1]! + 0.05);
  });
  expect(pinContrast).toBeGreaterThanOrEqual(4.5);
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-history-transition-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Close history' }).click();
  await page.getByRole('button', { name: 'Resume Practice' }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(1);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice' })).toBeEnabled();
  await page.getByLabel('Next connection').selectOption('live_text');
  await page.getByRole('button', { name: 'Resume Live Text' }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(2);
  const recap = provider.sent.find(event => event.type === 'conversation.message' && String(event.content).startsWith('Historical mission record'));
  expect(recap?.role).toBe('user');
  expect(String(recap?.content)).toContain('manual says these machines share Power');
  expect(String(recap?.content)).toContain('observation');
  expect(String(recap?.content)).not.toContain('Private notebook marker');
  expect(provider.sent.filter(event => event.type === 'tool.result')).toHaveLength(1);
  // A fresh provider can reuse its own IDs; the local session must not replay old results.
  const newObservation = await provider.tool('observe_room', {}, 'record-observe');
  expect(newObservation.ok).toBe(true);
  expect(newObservation.message).toMatch(/Conveyor \(conveyor\) is stopped/);
  expect(newObservation.message).not.toBe(observation.message);
  await expect(page.locator('.notebook-list')).toContainText('Earlier report');
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-recap-${info.project.name}.png`);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
});

test('simulated tool lifecycle: checking reflects a pending real server request, and interrupt rejects its stale commit', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await startLive(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sessions/*/tools', async route => { await gate; await route.continue(); });
  provider.emit({ type: 'reply.started', reply_id: 'pending-action' });
  provider.emit({ type: 'tool.call', call_id: 'held-action', name: 'interact_object', arguments: { object: 'latch', action: 'latch_open' } });
  provider.emit({ type: 'reply.done', reply_id: 'pending-action', status: 'completed' });
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'checking');
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-checking-${info.project.name}.png`);
  const cancellation = page.waitForResponse(response => response.url().endsWith('/cancel'));
  await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
  expect((await cancellation).ok()).toBe(true);
  release();
  await page.unroute('**/api/sessions/*/tools');
  await page.getByLabel('Type a message').fill('Please check the local mechanism now.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => provider.sent.filter(event => event.type === 'reply.create').length).toBe(1);
  const inspected = await provider.tool('inspect_object', { object: 'latch' }, 'verify-after-interrupt');
  expect(inspected.message).toMatch(/not engaged|not holding|disengaged/i);
  expect(provider.sent.some(event => event.type === 'tool.result' && event.call_id === 'held-action')).toBe(false);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
});

test('simulated success: authoritative cooperation permits one closing response then ends the call', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await startLive(page);
  expect((await provider.tool('observe_room', {}, 'completion-observe')).ok).toBe(true);
  expect((await provider.tool('interact_object', { object: 'latch', action: 'latch_open' }, 'completion-latch')).ok).toBe(true);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  expect((await provider.tool('move_to', { target: 'far_side' }, 'completion-cross')).ok).toBe(true);
  await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toBeVisible();
  provider.emit({ type: 'reply.started', reply_id: 'closing-response' });
  provider.emit({ type: 'reply.audio', data: 'AEAAQA==' });
  provider.emit({ type: 'transcript.agent', reply_id: 'closing-response', text: 'I am through. Good work, partner.' });
  await provider.render();
  provider.emit({ type: 'reply.done', reply_id: 'closing-response', status: 'completed' });
  provider.emit({ type: 'reply.started', reply_id: 'unwanted-second-response' });
  provider.emit({ type: 'transcript.agent', reply_id: 'unwanted-second-response', text: 'This extra response must not appear.' });
  await provider.drain();
  await expect.poll(() => provider.ended).toBe(1);
  await expect(page.locator('body')).toContainText('Call ended');
  await expect(page.getByTestId('caption')).toHaveText('I am through. Good work, partner.');
  await expect(page.locator('body')).not.toContainText('This extra response must not appear.');
  expect(provider.activeSockets).toBe(0);
  const audio = await provider.audioState();
  expect(audio.activeTracks).toBe(0);
  expect(audio.closedContexts).toBe(audio.contexts);
  await expect(page.locator('.collaboration-timeline li').last()).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Play Classic again' })).toBeInViewport({ ratio: 1 });
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-completion-${info.project.name}.png`);
});

test('simulated permission failure: no token or connection is minted and the recovery message is visible', async ({ page }, info) => {
  const provider = await fakeProvider(page, { permissionDenied: true });
  await page.goto('/');
  await page.getByRole('radio', { name: /Training/ }).check();
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice' }).click();
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied');
  expect(provider.tokenRequests).toBe(0);
  expect(provider.connections).toBe(0);
  expect((await provider.audioState()).activeTracks).toBe(0);
  await expect(page.getByRole('radio', { name: /Live Voice/ })).toBeChecked();
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-permission-error-${info.project.name}.png`);
});

test('simulated rejection: sanitizes diagnostics, shows connection error, and releases the capture', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await startLive(page, 'Voice');
  const voiceContexts = (await provider.audioState()).contexts;
  await page.getByText('Connection & sound', { exact: true }).click();
  await page.locator('.call-settings').getByLabel('Effects volume').focus();
  await page.locator('.call-settings').getByLabel('Effects volume').press('ArrowRight');
  await expect.poll(async () => (await provider.audioState()).contexts).toBe(voiceContexts + 1);
  provider.emit({ type: 'session.error', code: 'invalid_config', message: 'private-provider-diagnostic' });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('body')).not.toContainText('private-provider-diagnostic');
  await expect.poll(() => provider.ended).toBe(1);
  expect((await provider.audioState()).activeTracks).toBe(0);
  await expect.poll(async () => (await provider.audioState()).closedContexts).toBe(voiceContexts + 1);
  await fixtureScreenshot(page, `test-results/goal-003-training-simulated-connection-error-${info.project.name}.png`);
});

test('simulated success watchdog: an absent closing response cannot keep the call open', async ({ page }) => {
  const provider = await fakeProvider(page);
  await startLive(page);
  expect((await provider.tool('interact_object', { object: 'latch', action: 'latch_open' }, 'watchdog-latch')).ok).toBe(true);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  expect((await provider.tool('move_to', { target: 'far_side' }, 'watchdog-cross')).ok).toBe(true);
  await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toBeVisible();
  await expect.poll(() => provider.ended, { timeout: 10_000 }).toBe(1);
  expect(provider.activeSockets).toBe(0);
  await expect(page.locator('body')).toContainText('Call ended');
});
