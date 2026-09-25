import { test, expect } from './rescue-fixture';
import { fakeProvider, confirmLocalReadiness, fixtureScreenshot } from './fake-provider';
import type { HumanView } from '../../game/shared/contracts';
import type { SessionStore } from '../../game/server/sessions';

/** An authoritative checkpoint fixture, never a prompt or model walkthrough. */
async function prepareAuthorizedDock(store: SessionStore, initial: HumanView) {
  let view = initial;
  let sequence = 0;
  const envelope = () => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: `completion-setup-${++sequence}` });
  const tool = async (name: string, args: Record<string, unknown>) => {
    const result = await store.tool(view.sessionId, {
      roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch,
      callId: `completion-setup-${++sequence}`, name, arguments: args,
    });
    expect(result.ok, result.message).toBe(true);
    view = result.view;
  };
  await tool('interact_object', { object: 'latch', action: 'latch_open' });
  view = await store.power(view.sessionId, { ...envelope(), revision: view.revision, powerOn: false });
  await tool('move_to', { target: 'far_side' });
  view = await store.control(view.sessionId, 'relay', { ...envelope(), revision: view.revision, relay: 'beacon' });
  for (const target of ['gallery.g1', 'gallery.g4']) await tool('move_to', { target });
  view = await store.control(view.sessionId, 'relay', { ...envelope(), revision: view.revision, relay: 'harbor' });
  await tool('move_to', { target: 'gallery.g5' });
  await tool('interact_object', { object: 'return.contact', action: 'hold_contact' });
  for (const action of ['charge', 'store']) view = await store.control(view.sessionId, 'dock', { ...envelope(), revision: view.revision, action });
  await tool('interact_object', { object: 'return.contact', action: 'release_contact' });
  await tool('move_to', { target: 'return.aboard' });
  return store.control(view.sessionId, 'dock', { ...envelope(), revision: view.revision, action: 'authorize_return' });
}

test('simulated completion recovery: a cancel response revealing committed home arms the closing watchdog', async ({ page, rescueServer }, info) => {
  const provider = await fakeProvider(page);
  let sessionId = '';
  let roundId = '';
  await page.route('**/api/sessions', async route => {
    const response = await route.fetch({ url: `${rescueServer.origin}/api/sessions` });
    const view = await prepareAuthorizedDock(rescueServer.store, await response.json());
    sessionId = view.sessionId; roundId = view.roundId;
    await route.fulfill({ response, json: view });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text' }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await page.clock.install();
  await page.clock.pauseAt(new Date());

  let committed = false;
  let release!: () => void;
  const delivery = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sessions/*/tools', async route => {
    const source = new URL(route.request().url());
    const response = await route.fetch({ url: rescueServer.origin + source.pathname });
    expect((await response.json()).view.completed).toBe(true);
    committed = true;
    await delivery;
    await route.fulfill({ response });
  });
  try {
    provider.emit({ type: 'reply.started', reply_id: 'return-reply' });
    provider.emit({ type: 'tool.call', call_id: 'return-once', name: 'interact_object', arguments: { object: 'return.capsule', action: 'confirm_return' } });
    provider.emit({ type: 'reply.done', reply_id: 'return-reply', status: 'completed' });
    await expect.poll(() => committed).toBe(true);
    expect(rescueServer.store.get(sessionId).completed).toBe(true);
    await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toHaveCount(0);
    const cancellation = page.waitForResponse(response => response.url().endsWith('/cancel'));
    provider.emit({ type: 'input.speech.started' });
    const canceledView = await (await cancellation).json();
    expect(canceledView.completed).toBe(true);
    release();
    await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
    expect(provider.sent.filter(event => event.type === 'tool.result')).toHaveLength(0);
    expect(provider.ended).toBe(0);

    // No closing reply is injected. The confirmed physical result alone must
    // bound the call; duplicate cancellation views must not reset that deadline.
    await page.clock.fastForward(4000);
    const repeatedCancellation = page.waitForResponse(response => response.url().endsWith('/cancel'));
    provider.emit({ type: 'input.speech.started' });
    expect((await (await repeatedCancellation).json()).completed).toBe(true);
    await page.clock.fastForward(3999);
    expect(provider.ended).toBe(0);
    await page.clock.fastForward(1);
    await expect.poll(() => provider.ended).toBe(1);
    await expect(page.locator('body')).toContainText('Call ended');
    expect(provider.connections).toBe(1);
    expect(provider.activeSockets).toBe(0);
    const audio = await provider.audioState();
    expect(audio.activeTracks).toBe(0);
    expect(audio.closedContexts).toBe(audio.contexts);
    expect(rescueServer.store.record(sessionId, roundId).debrief?.timeline.filter(event => event.kind === 'completion')).toHaveLength(1);
    await fixtureScreenshot(page, `test-results/goal-004c-cancel-confirmed-home-${info.project.name}.png`);
  } finally {
    release();
    await page.unroute('**/api/sessions/*/tools');
  }
});
