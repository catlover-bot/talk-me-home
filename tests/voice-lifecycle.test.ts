import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveVoice, type VoiceSocket, type VoiceStatus } from '../game/client/voice.ts';
import type { VoiceAudio } from '../game/client/audio.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

class LifecycleSocket implements VoiceSocket {
  readyState = 0;
  onopen: VoiceSocket['onopen'] = null;
  onmessage: VoiceSocket['onmessage'] = null;
  onclose: VoiceSocket['onclose'] = null;
  onerror: VoiceSocket['onerror'] = null;
  sent: Record<string, unknown>[] = [];
  closeCount = 0;
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  open(): void { this.readyState = 1; this.onopen?.(new Event('open')); }
  emit(event: Record<string, unknown>): void { this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent); }
  close(): void { this.closeCount++; this.readyState = 3; }
  peerClose(): void { this.readyState = 3; this.onclose?.({ code: 1005, wasClean: true } as CloseEvent); }
}

class LifecycleAudio implements VoiceAudio {
  closed = false;
  stopped = false;
  input?: (data: string) => void;
  async prepare(_microphone: boolean, onChunk: (data: string) => void): Promise<void> { this.input = onChunk; }
  play(): void {}
  stopPlayback(): void { this.stopped = true; }
  async close(): Promise<void> { this.closed = true; }
}

async function pendingWorkFixture(maxSessionSeconds: 600 | 900 = 600, endGraceMs?: number) {
  const socket = new LifecycleSocket();
  const audio = new LifecycleAudio();
  const cancellation = deferred<void>();
  const physicalWork = deferred<unknown>();
  const statuses: VoiceStatus[] = [];
  const captions: string[] = [];
  const microphone: boolean[] = [];
  let actionSignal: AbortSignal | undefined;
  let socketCount = 0;
  const live = new LiveVoice({
    onError: () => {}, onStatus: status => statuses.push(status),
    onTranscript: entry => captions.push(entry.text), onMicrophone: active => microphone.push(active),
  }, { createAudio: () => audio, createSocket: () => { socketCount++; return socket; }, endGraceMs });
  const starting = live.start({
    token: async () => ({ token: 'offline-temporary-placeholder', config: {}, maxSessionSeconds }), microphone: true,
    executeTool: (_call, signal) => { actionSignal = signal; return physicalWork.promise; },
    cancelPending: () => cancellation.promise,
  });
  await tick(); socket.open(); socket.emit({ type: 'session.ready' }); await starting;
  socket.emit({ type: 'reply.started', reply_id: 'pending-reply' });
  socket.emit({ type: 'tool.call', call_id: 'pending-call', name: 'observe_room', arguments: {} });
  socket.emit({ type: 'reply.done', reply_id: 'pending-reply', status: 'completed' });
  await tick();
  assert.ok(actionSignal);
  return { live, socket, audio, cancellation, physicalWork, statuses, captions, microphone, actionSignal, get socketCount() { return socketCount; } };
}

for (const acknowledgement of ['delayed', 'absent'] as const) {
  test(`synthetic adversarial shutdown: ${acknowledgement} ACK and hung cancellation cannot extend the ten-second end deadline`, async t => {
    // The new bounded policy does not establish the historical missing-ACK cause.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = await pendingWorkFixture();
    let settled = false;
    const ending = h.live.end().then(() => { settled = true; });
    try {
      assert.equal(h.live.end(), h.live.stop());
      assert.equal(h.audio.closed, true);
      assert.equal(h.audio.stopped, true);
      assert.equal(h.actionSignal.aborted, true);
      assert.equal(h.microphone.at(-1), false);
      assert.equal(h.socket.sent.filter(event => event.type === 'session.end').length, 1);
      h.audio.input?.('must-not-send-after-end');
      h.socket.emit({ type: 'transcript.agent', reply_id: 'late', text: 'Undelivered response.' });
      assert.equal(h.socket.sent.some(event => event.type === 'input.audio'), false);
      assert.equal(h.captions.length, 0);
      t.mock.timers.tick(2000); await tick();
      assert.equal(settled, false);
      if (acknowledgement === 'delayed') {
        h.socket.emit({ type: 'session.ended', session_duration_seconds: 2.1 });
        assert.equal(h.live.endAcknowledged, true);
        await tick();
      }
      t.mock.timers.tick(7999); await tick();
      assert.equal(settled, false, 'The hung cleanup shares the finite observation deadline.');
      t.mock.timers.tick(1); await tick();
      assert.equal(settled, true, 'A hung action-cancellation hook must not hold End beyond the ten-second local deadline.');
      await ending;
      assert.equal(h.live.endAcknowledged, acknowledgement === 'delayed');
      assert.equal(h.socket.readyState, 3);
      assert.equal(h.socket.onmessage, null);
      assert.equal(h.statuses.filter(status => status === 'ended').length, 1);
      assert.equal(h.socketCount, 1);
      h.physicalWork.resolve({ ok: true, message: 'Late physical result.' });
      await tick();
      assert.equal(h.socket.sent.some(event => event.type === 'tool.result'), false);
    } finally {
      h.physicalWork.resolve({ ok: false, message: 'Offline fixture cleanup.' });
      h.cancellation.resolve();
      await tick(); await ending;
    }
  });
}

test('ending policy: a six-second ACK remains receivable after immediate local teardown', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = await pendingWorkFixture();
  let settled = false;
  const ending = h.live.end().then(() => { settled = true; });
  h.cancellation.resolve();
  try {
    assert.equal(h.audio.closed, true);
    assert.equal(h.audio.stopped, true);
    assert.equal(h.actionSignal.aborted, true);
    assert.equal(h.microphone.at(-1), false);
    t.mock.timers.tick(6000); await tick();
    assert.equal(settled, false);
    assert.equal(h.socket.readyState, 1);
    h.socket.emit({ type: 'session.ended', session_duration_seconds: 6 });
    await ending;
    assert.equal(h.live.endAcknowledged, true);
    assert.equal(h.socket.readyState, 3);
    assert.equal(h.socket.sent.filter(event => event.type === 'session.end').length, 1);
    assert.equal(h.socketCount, 1);
  } finally {
    h.physicalWork.resolve({ ok: false, message: 'Offline fixture cleanup.' });
    h.cancellation.resolve();
    t.mock.timers.tick(10_000); await tick(); await ending;
  }
});

for (const cap of [600, 900] as const) {
  for (const manualEnd of [true, false]) {
    test(`ending policy: ${manualEnd ? 'manual End near' : 'automatic End at'} the ${cap}-second socket deadline cannot extend it`, async t => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      let clock = 123_456;
      t.mock.method(performance, 'now', () => clock);
      const h = await pendingWorkFixture(cap);
      let settled = false;
      const advance = async (ms: number) => { clock += ms; t.mock.timers.tick(ms); await tick(); };
      await advance(cap * 1000 - 3000);
      const ending = manualEnd ? h.live.end().then(() => { settled = true; }) : undefined;
      try {
        await advance(2999);
        assert.equal(settled, false);
        assert.equal(h.socket.readyState, 1);
        await advance(1);
        const capEnding = h.live.end().then(() => { settled = true; });
        await tick();
        assert.equal(settled, true, 'The ending handshake and hung cleanup must finish by the original socket deadline.');
        await capEnding;
        assert.equal(h.socket.readyState, 3);
        assert.equal(h.live.endAcknowledged, false);
        assert.equal(h.audio.closed, true);
        assert.equal(h.actionSignal.aborted, true);
        assert.equal(h.socket.sent.filter(event => event.type === 'session.end').length, 1);
        assert.equal(h.statuses.filter(status => status === 'ended').length, 1);
        await advance(10_000);
        assert.equal(h.socketCount, 1);
        assert.equal(h.socket.sent.filter(event => event.type === 'session.end').length, 1);
      } finally {
        h.physicalWork.resolve({ ok: false, message: 'Offline fixture cleanup.' });
        h.cancellation.resolve();
        await advance(10_000); await h.live.end(); await ending;
      }
    });
  }
}

test('ending policy: an injected longer grace cannot exceed the ten-second maximum', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = await pendingWorkFixture(600, 30_000);
  let settled = false;
  const ending = h.live.end().then(() => { settled = true; });
  try {
    t.mock.timers.tick(9999); await tick();
    assert.equal(settled, false);
    t.mock.timers.tick(1); await tick();
    assert.equal(settled, true);
    assert.equal(h.live.endAcknowledged, false);
    assert.equal(h.socket.readyState, 3);
  } finally {
    h.physicalWork.resolve({ ok: false, message: 'Offline fixture cleanup.' });
    h.cancellation.resolve();
    t.mock.timers.tick(30_000); await tick(); await ending;
  }
});

test('historical end boundary retained: clean socket closure is not session.ended confirmation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = await pendingWorkFixture();
  const ending = h.live.end();
  h.socket.peerClose();
  h.cancellation.resolve();
  await ending;
  assert.equal(h.live.endAcknowledged, false);
  assert.equal(h.audio.closed, true);
  assert.equal(h.socket.sent.filter(event => event.type === 'session.end').length, 1);
  h.physicalWork.resolve({ ok: false, message: 'Offline fixture cleanup.' });
  await tick();
});
