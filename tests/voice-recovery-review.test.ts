import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProtocol, type ProtocolHooks } from '../game/client/voice-protocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function reviewedProtocol(t: TestContext, overrides: Partial<ProtocolHooks> = {}) {
  const sent: Record<string, unknown>[] = [];
  const executed: string[] = [];
  const errors: string[] = [];
  const protocol = new VoiceProtocol({
    send: event => sent.push(event),
    executeTool: async call => { executed.push(call.callId); return { ok: true, message: 'Validated observation.' }; },
    cancelPending: async () => {}, onTranscript: () => {}, onStatus: () => {},
    onError: error => errors.push(error), playAudio: () => {}, stopAudio: () => {}, ...overrides,
  });
  t.after(async () => { await protocol.stop(); }, { timeout: 1000 });
  protocol.receive({ type: 'session.ready' });
  return {
    protocol, sent, executed, errors,
    start: (id: string) => protocol.receive({ type: 'reply.started', reply_id: id }),
    done: (id: string, status = 'completed') => protocol.receive({ type: 'reply.done', reply_id: id, status }),
    tool: (id: string) => protocol.receive({ type: 'tool.call', call_id: id, name: 'observe_room', arguments: {} }),
  };
}

// Synthetic schedules combine documented correlation/order variants. They are
// adversarial regressions, not additional real-provider observations.
test('review correlation: canonical completion before a late call still resolves under an ordinary active reply ID', { timeout: 2000 }, async t => {
  const h = reviewedProtocol(t);
  h.start('ordinary-reply');
  h.done('fc-late-call');
  h.tool('late-call');
  await tick();
  assert.deepEqual(h.executed, ['late-call']);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'late-call');
  h.tool('late-call'); h.done('fc-late-call'); await tick();
  assert.equal(h.executed.length, 1);
  assert.equal(h.sent.length, 1);
});

test('review input ordering: a correlated completion during speech defers its rejection until speech stops', { timeout: 2000 }, async t => {
  const h = reviewedProtocol(t);
  h.start('retained-reply'); h.tool('retained-call');
  h.protocol.receive({ type: 'input.speech.started' });
  h.done('retained-reply'); await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 0);
  h.protocol.receive({ type: 'input.speech.stopped' }); await tick();
  assert.equal(h.sent.length, 1, 'The matching provider reply completed; ending the user waveform should release its deferred rejection.');
  assert.equal(h.sent[0]?.call_id, 'retained-call');
  assert.equal(JSON.parse(String(h.sent[0]?.result)).code, 'cancelled_before_execution');
});

for (const transition of ['reply', 'input'] as const) {
  test(`review completion window: a canonical completion cannot authorize a late call across newer ${transition}`, { timeout: 2000 }, async t => {
    const h = reviewedProtocol(t);
    h.start('old-reply'); h.done('fc-old-call');
    if (transition === 'reply') h.start('fresh-reply');
    else h.protocol.receive({ type: 'input.speech.started' });
    h.tool('old-call'); await tick();
    if (transition === 'reply') h.done('fresh-reply');
    else h.protocol.receive({ type: 'input.speech.stopped' });
    await tick();
    assert.equal(h.executed.length, 0, 'An old completion cannot grant the late request fresh execution authority.');
    assert.equal(h.sent.length, 0, 'Ambiguous old work cannot send a result in a newer response window.');
  });
}

test('review input ordering: a newer active response still blocks a completion received during speech', { timeout: 2000 }, async t => {
  const h = reviewedProtocol(t);
  h.start('old-reply'); h.tool('old-call');
  h.protocol.receive({ type: 'input.speech.started' }); h.done('old-reply');
  h.start('fresh-reply'); h.protocol.receive({ type: 'input.speech.stopped' }); await tick();
  assert.equal(h.sent.length, 0);
  h.done('fresh-reply'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'old-call');
  assert.equal(h.executed.length, 0);
});

test('review cancellation ordering: a replaced cancellation barrier cannot release a rejection early or twice', { timeout: 2000 }, async t => {
  const first = deferred<void>(); const second = deferred<void>();
  t.after(() => { first.resolve(); second.resolve(); }, { timeout: 1000 });
  let cancellations = 0;
  const h = reviewedProtocol(t, { cancelPending: () => ++cancellations === 1 ? first.promise : cancellations === 2 ? second.promise : Promise.resolve() });
  h.start('reply');
  h.protocol.receive({ type: 'input.speech.started' });
  h.tool('canceled-call');
  h.protocol.receive({ type: 'input.speech.stopped' });
  h.done('reply'); await tick();
  void h.protocol.beginInput();
  h.done('reply');
  first.resolve(); await tick();
  assert.equal(cancellations, 2);
  assert.equal(h.sent.length, 0);
  second.resolve(); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.executed.length, 0);
  h.done('reply'); h.tool('canceled-call'); await tick();
  assert.equal(h.sent.length, 1);
});

test('review active response: late canonical old completion cannot release an actual result mid-response', { timeout: 2000 }, async t => {
  const result = deferred<unknown>();
  t.after(() => result.resolve({ ok: false, message: 'Fixture cleanup.' }), { timeout: 1000 });
  const h = reviewedProtocol(t, { executeTool: () => result.promise });
  h.start('ordinary-old'); h.tool('physical'); h.done('ordinary-old'); await tick();
  h.start('ordinary-new');
  h.done('fc-physical');
  result.resolve({ ok: true, message: 'Authoritative original result.' }); await tick();
  assert.equal(h.sent.length, 0);
  h.done('ordinary-new'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'physical');
});
