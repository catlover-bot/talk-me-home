import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VoiceProtocol, type ProtocolHooks, type ToolCall, type ProviderEvent } from '../game/client/voice-protocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function replay(overrides: Partial<ProtocolHooks> = {}) {
  const sent: Record<string, unknown>[] = [], reasons: string[] = [], executed: ToolCall[] = [], errors: string[] = [];
  const protocol = new VoiceProtocol({
    send: event => { sent.push(event); },
    executeTool: async call => { executed.push(call); return { ok: true, message: 'A validated local observation.' }; },
    cancelPending: async reason => { reasons.push(reason); },
    onTranscript: () => {}, onStatus: () => {}, onError: error => { errors.push(error); },
    playAudio: () => {}, stopAudio: () => {}, ...overrides,
  });
  protocol.receive({ type: 'session.ready' });
  const start = (id: string) => protocol.receive({ type: 'reply.started', reply_id: id });
  const tool = (id: string) => protocol.receive({ type: 'tool.call', call_id: id, name: 'interact_object', arguments: {} });
  const done = (id: string, status = 'completed') => protocol.receive({ type: 'reply.done', reply_id: id, status });
  return { protocol, sent, reasons, executed, errors, start, tool, done };
}

test('observed 004B replay: one WAV produced two turns and a retained completed tool reply; the prior safe rejection remains', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const trace = JSON.parse(readFileSync(new URL('../artifacts/goal-004c/observed-split-turn.json', import.meta.url), 'utf8')) as {
    events: { atMs: number; event: ProviderEvent }[];
  };
  const recognized: string[] = [];
  const h = replay({ onTranscript: entry => { if (entry.role === 'human' && entry.final) recognized.push(entry.text); } });
  t.after(() => h.protocol.stop());
  let clock = trace.events[0]!.atMs;
  for (const row of trace.events) {
    t.mock.timers.tick(row.atMs - clock); clock = row.atMs;
    if (row.event.type.startsWith('synthetic.')) continue;
    // Original evidence excludes tool arguments. These deliberately invalid
    // substitutes can never become a physical request or a claimed observation.
    h.protocol.receive(row.event.type === 'tool.call' ? { ...row.event, arguments: { target: 'synthetic-unobserved-sentinel' } } : row.event);
    await tick();
  }
  assert.deepEqual(recognized, [
    'My diagram says the door and conveyor share one power supply.',
    'So please engage the latch to hold the door open.',
  ]);
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]!.call_id, 'call-1');
  assert.equal(JSON.parse(String(h.sent[0]!.result)).code, 'cancelled_before_execution');
  assert.doesNotMatch(JSON.stringify(h.sent), /synthetic-unobserved-sentinel/);
});

// These adversarial schedules isolate uncertainties from Goal 004B. They are
// reconstructed tests, not claims that every event occurred in a real trace.
test('recovery: speech-start defers work without treating an unfinished reply as a revocation signal', async () => {
  const h = replay();
  h.start('unfinished');
  h.protocol.receive({ type: 'input.speech.started' });
  await tick();
  assert.deepEqual(h.reasons, ['supersede']);
  h.done('unfinished', 'interrupted');
  await tick();
  assert.equal(h.reasons.at(-1), 'interrupt');
  await h.protocol.stop();
});

test('recovery: a known queued call is canceled once, not silently forgotten between split turns', async () => {
  const h = replay();
  h.start('split'); h.tool('queued');
  h.protocol.receive({ type: 'input.speech.started' });
  await tick();
  assert.equal(h.sent.length, 0);
  h.protocol.receive({ type: 'input.speech.stopped' });
  h.done('split'); await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(JSON.parse(String(h.sent[0]!.result)).code, 'cancelled_before_execution');
  h.tool('queued'); h.done('split'); await tick();
  assert.equal(h.sent.length, 1);
  await h.protocol.stop();
});

test('recovery: committed success survives speech-start cancellation and waits for the new turn to settle', async () => {
  const completion = deferred<unknown>();
  let calls = 0;
  const h = replay({ executeTool: async () => { calls++; return completion.promise; } });
  h.start('physical'); h.tool('committed'); h.done('physical'); await tick();
  h.protocol.receive({ type: 'input.speech.started' });
  completion.resolve({ ok: true, message: 'The physical action already committed.', view: { privateState: 'never-forward' } });
  await tick();
  assert.equal(h.sent.length, 0, 'Never deliver a result during a user turn.');
  h.done('physical'); await tick();
  assert.equal(h.sent.length, 0, 'A late old done cannot close the active user turn.');
  h.protocol.receive({ type: 'input.speech.stopped' });
  h.start('next'); h.done('next'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]!.call_id, 'committed');
  assert.deepEqual(JSON.parse(String(h.sent[0]!.result)), { ok: true, message: 'The physical action already committed.' });
  assert.equal(calls, 1);
  h.tool('committed'); h.done('next'); await tick();
  assert.equal(h.sent.length, 1);
  await h.protocol.stop();
});

test('recovery: an aborted in-flight request reports outcome unknown instead of claiming it never executed', async () => {
  const completion = deferred<unknown>();
  const h = replay({ executeTool: () => completion.promise });
  h.start('physical'); h.tool('uncertain'); h.done('physical'); await tick();
  h.protocol.receive({ type: 'input.speech.started' });
  completion.reject(new DOMException('Aborted', 'AbortError')); await tick();
  h.protocol.receive({ type: 'input.speech.stopped' });
  h.done('physical'); await tick();
  assert.equal(h.sent.length, 1);
  const result = JSON.parse(String(h.sent[0]!.result));
  assert.equal(result.code, 'outcome_unknown');
  assert.doesNotMatch(result.message, /not executed|broken|sensor failure/i);
  await h.protocol.stop();
});

test('recovery: an execution waiting for cancellation is still known not to have started', async () => {
  const cancellation = deferred<void>();
  const h = replay({ cancelPending: () => cancellation.promise });
  void h.protocol.beginInput();
  h.start('waiting'); h.tool('not-dispatched'); h.done('waiting');
  await tick();
  void h.protocol.beginInput();
  cancellation.resolve(); await tick();
  h.done('waiting'); await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(JSON.parse(String(h.sent[0]!.result)).code, 'cancelled_before_execution');
  await h.protocol.stop();
});

test('recovery: genuine Interrupt keeps canceled arguments inert and bounds an unresolved provider call', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = replay();
  h.start('held'); h.tool('pending');
  await h.protocol.interrupt(true);
  h.done('held'); await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 0);
  t.mock.timers.tick(15_001); await tick();
  assert.equal(h.errors.length, 1);
  assert.equal(h.protocol.ready, false);
  await h.protocol.stop();
});

test('recovery: late provider interruption for an older reply cannot cancel a fresh action', async () => {
  const h = replay();
  h.start('older'); h.done('older');
  h.start('fresh'); h.tool('current');
  h.done('older', 'interrupted');
  h.done('fresh'); await tick();
  assert.equal(h.executed.length, 1);
  assert.equal(h.sent[0]?.call_id, 'current');
  assert.equal(h.reasons.length, 0);
  await h.protocol.stop();
});

test('recovery: a late old completion cannot release a result while a newer response is still speaking', async () => {
  const completion = deferred<unknown>();
  const h = replay({ executeTool: () => completion.promise });
  h.start('old'); h.tool('committed'); h.done('old'); await tick();
  h.start('fresh');
  h.done('old');
  completion.resolve({ ok: true, message: 'A committed result.' }); await tick();
  assert.equal(h.sent.length, 0);
  h.done('fresh'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]!.call_id, 'committed');
  await h.protocol.stop();
});

test('recovery: ambiguous old-call correlation fails safely within a finite deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = replay();
  h.start('fc-old'); await h.protocol.interrupt(); h.done('fc-old');
  h.start('new'); h.tool('old'); h.done('new'); await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 0);
  t.mock.timers.tick(15_001); await tick();
  assert.equal(h.errors.length, 1);
  assert.equal(h.protocol.ready, false);
  await h.protocol.stop();
});
