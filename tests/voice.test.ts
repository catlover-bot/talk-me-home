import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { LiveVoice, type VoiceSocket, type VoiceStartOptions } from '../game/client/voice.ts';
import { TranscriptStore, VoiceProtocol, type ProtocolHooks, type ProviderEvent, type ToolCall, type TranscriptEntry, type VoiceStatus } from '../game/client/voice-protocol.ts';
import { BrowserAudio, microphoneError, bytesToBase64, type VoiceAudio } from '../game/client/audio.ts';
import { CAPTURE_WORKLET, PLAYBACK_WORKLET } from '../game/client/audio-worklets.ts';
import { sessionConfig, robotTools } from '../game/agent/config.ts';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides: Partial<ProtocolHooks> = {}) {
  const sent: Record<string, unknown>[] = [];
  const executed: ToolCall[] = [];
  const captions: TranscriptEntry[] = [];
  const audio: string[] = [];
  const errors: string[] = [];
  let stops = 0;
  let cancellations = 0;
  const protocol = new VoiceProtocol({
    send: (event) => sent.push(event),
    executeTool: async (call) => { executed.push(call); return { ok: true, message: 'A verified observation.', view: { powerCommand: 'secret to robot' } }; },
    cancelPending: async () => { cancellations++; },
    onTranscript: (entry) => captions.push(entry), onStatus: () => {},
    onError: (message) => errors.push(message), playAudio: (data) => audio.push(data),
    stopAudio: () => { stops++; }, ...overrides,
  });
  protocol.receive({ type: 'session.ready' });
  return { protocol, sent, executed, captions, audio, errors, get stops() { return stops; }, get cancellations() { return cancellations; } };
}

function call(protocol: VoiceProtocol, callId = 'one', name = 'observe_room') {
  protocol.receive({ type: 'reply.started', reply_id: `fc-${callId}`, item_id: `item-${callId}` });
  protocol.receive({ type: 'tool.call', call_id: callId, name, arguments: {} });
}
function done(protocol: VoiceProtocol, callId = 'one') {
  protocol.receive({ type: 'reply.done', reply_id: `fc-${callId}`, status: 'completed' });
}

test('voice transcripts: user partials replace, robot words append, final text wins, and raw language is preserved', () => {
  const store = new TranscriptStore();
  store.accept({ type: 'transcript.user.delta', item_id: 'u1', text: 'Check' });
  assert.equal(store.accept({ type: 'transcript.user.delta', item_id: 'u1', text: 'Check it' })?.text, 'Check it');
  assert.equal(store.accept({ type: 'transcript.user', item_id: 'u1', text: 'Check it, please.' })?.final, true);
  assert.equal(store.accept({ type: 'transcript.user.delta', item_id: 'u1', text: 'late' }), undefined);
  // This is preserved user input, not application-authored Japanese copy.
  assert.equal(store.accept({ type: 'transcript.user', item_id: 'u2', text: '\u5f85\u3063\u3066' })?.text, '\u5f85\u3063\u3066');
  store.accept({ type: 'transcript.agent.delta', reply_id: 'r1', delta: 'I' });
  store.accept({ type: 'transcript.agent.delta', reply_id: 'r1', delta: 'can' });
  assert.equal(store.accept({ type: 'transcript.agent.delta', reply_id: 'r1', delta: '.' })?.text, 'I can.');
  assert.equal(store.accept({ type: 'transcript.agent', reply_id: 'r1', text: 'I can', interrupted: true })?.text, 'I can');
  assert.equal(store.accept({ type: 'transcript.agent.delta', reply_id: 'r1', delta: 'stale' }), undefined);
});

test('voice tools: wait for the correlated reply.done, deduplicate calls, and strip human projections from results', async () => {
  const h = harness();
  call(h.protocol);
  await tick();
  assert.equal(h.executed.length, 0);
  done(h.protocol, 'other');
  await tick();
  assert.equal(h.executed.length, 0);
  done(h.protocol);
  await tick();
  assert.equal(h.executed.length, 1);
  assert.deepEqual(h.sent, [{ type: 'tool.result', call_id: 'one', result: JSON.stringify({ ok: true, message: 'A verified observation.' }), is_error: false }]);
  call(h.protocol);
  done(h.protocol);
  await tick();
  assert.equal(h.executed.length, 1);
  assert.equal(h.sent.length, 1);
  await h.protocol.stop();
});

test('voice tools: asynchronous results wait if another reply started after reply.done', async () => {
  const result = deferred<unknown>();
  const h = harness({ executeTool: () => result.promise });
  call(h.protocol);
  done(h.protocol);
  await tick();
  h.protocol.receive({ type: 'reply.started', reply_id: 'later', item_id: 'next' });
  result.resolve({ ok: true, message: 'Done.' });
  await tick();
  assert.equal(h.sent.length, 0);
  done(h.protocol, 'later');
  assert.equal(h.sent.length, 1);
  await h.protocol.stop();
});

test('voice tools: delayed captions and audio after reply.done do not block a validated asynchronous result', async () => {
  const result = deferred<unknown>();
  const h = harness({ executeTool: () => result.promise });
  call(h.protocol);
  done(h.protocol);
  await tick();
  h.protocol.receive({ type: 'transcript.agent.delta', reply_id: 'fc-one', item_id: 'item-one', delta: 'Checking' });
  h.protocol.receive({ type: 'reply.audio', data: 'delayed-audio' });
  h.protocol.receive({ type: 'transcript.agent', reply_id: 'fc-one', item_id: 'item-one', text: 'Checking.' });
  result.resolve({ ok: true, message: 'A verified observation.' });
  await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'one');
  await h.protocol.stop();
});

test('voice tools: correlated reply.done before tool.call still executes exactly once', async () => {
  const h = harness();
  h.protocol.receive({ type: 'reply.started', reply_id: 'fc-late', item_id: 'item-late' });
  done(h.protocol, 'late');
  h.protocol.receive({ type: 'transcript.agent.delta', reply_id: 'fc-late', item_id: 'item-late', delta: 'Checking' });
  h.protocol.receive({ type: 'tool.call', call_id: 'late', name: 'observe_room', arguments: {} });
  await tick();
  assert.equal(h.executed.length, 1);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'late');
  h.protocol.receive({ type: 'tool.call', call_id: 'late', name: 'observe_room', arguments: {} });
  await tick();
  assert.equal(h.executed.length, 1);
  await h.protocol.stop();
});

test('voice tools: interruption invalidates a completed reply before its delayed tool.call arrives', async () => {
  const h = harness();
  h.protocol.receive({ type: 'reply.started', reply_id: 'fc-stale', item_id: 'item-stale' });
  done(h.protocol, 'stale');
  await h.protocol.interrupt();
  h.protocol.receive({ type: 'tool.call', call_id: 'stale', name: 'observe_room', arguments: {} });
  done(h.protocol, 'stale');
  await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 0);
  await h.protocol.stop();
});

test('voice tools: replay observed provider sequence with an ordinary active reply ID', async () => {
  const h = harness();
  // Sanitized real probe ordering from 2026-09-07; aliases are synthetic.
  // The provider used a normal reply ID instead of the documented fc-call shape.
  const observed: ProviderEvent[] = [
    { type: 'reply.started', reply_id: 'greeting-reply', item_id: 'greeting-item' },
    { type: 'reply.done', reply_id: 'greeting-reply', status: 'completed' },
    { type: 'reply.started', reply_id: 'ordinary-reply', item_id: 'ordinary-item' },
    { type: 'tool.call', call_id: 'observed-call', name: 'observe_room', arguments: {} },
    { type: 'reply.done', reply_id: 'ordinary-reply', status: 'completed' },
  ];
  observed.forEach((event) => h.protocol.receive(event));
  await tick();
  assert.equal(h.executed.length, 1);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'observed-call');
  assert.equal(h.sent[0]?.is_error, false);
  await h.protocol.stop();
});

test('voice tools: ordinary reply ID supports delayed calls and rejects unrelated completion events', async () => {
  const h = harness();
  h.protocol.receive({ type: 'reply.started', reply_id: 'ordinary-delayed', item_id: 'item-delayed' });
  h.protocol.receive({ type: 'reply.done', reply_id: 'ordinary-delayed', status: 'completed' });
  h.protocol.receive({ type: 'tool.call', call_id: 'call-delayed', name: 'observe_room', arguments: {} });
  await tick();
  assert.equal(h.executed.length, 1);
  h.protocol.receive({ type: 'reply.started', reply_id: 'ordinary-next', item_id: 'item-next' });
  h.protocol.receive({ type: 'tool.call', call_id: 'call-next', name: 'observe_room', arguments: {} });
  h.protocol.receive({ type: 'reply.done', reply_id: 'unrelated-reply', status: 'completed' });
  await tick();
  assert.equal(h.executed.length, 1);
  h.protocol.receive({ type: 'reply.done', reply_id: 'ordinary-next', status: 'completed' });
  await tick();
  assert.equal(h.executed.length, 2);
  assert.deepEqual(h.sent.map((event) => event.call_id), ['call-delayed', 'call-next']);
  await h.protocol.stop();
});

test('voice interruption: discard queued tools, stop stale audio, and never replay canceled call IDs', async () => {
  const h = harness();
  call(h.protocol);
  h.protocol.receive({ type: 'reply.audio', data: 'audio-before' });
  h.protocol.receive({ type: 'input.speech.started' });
  h.protocol.receive({ type: 'reply.audio', data: 'audio-after' });
  done(h.protocol);
  call(h.protocol);
  done(h.protocol);
  await tick();
  assert.deepEqual(h.audio, ['audio-before']);
  assert.equal(h.stops, 1);
  assert.equal(h.cancellations, 1);
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent.length, 0);
  await h.protocol.stop();
});

test('voice interruption: abort in-flight actions and suppress delayed results without claiming rollback', async () => {
  const result = deferred<unknown>();
  let signal: AbortSignal | undefined;
  const h = harness({ executeTool: async (_call, value) => { signal = value; return result.promise; } });
  call(h.protocol);
  done(h.protocol);
  await tick();
  await h.protocol.interrupt();
  assert.equal(signal?.aborted, true);
  result.resolve({ ok: true, message: 'The action was committed before cancellation.' });
  await tick();
  assert.equal(h.sent.length, 0);
  assert.equal(h.captions.length, 0);
  await h.protocol.stop();
});

test('voice interruption: subsequent actions await confirmed server epoch invalidation', async () => {
  const cancellation = deferred<void>();
  const h = harness({ cancelPending: () => cancellation.promise });
  void h.protocol.interrupt();
  call(h.protocol, 'new');
  done(h.protocol, 'new');
  await tick();
  assert.equal(h.executed.length, 0);
  cancellation.resolve();
  await tick();
  assert.equal(h.executed.length, 1);
  await h.protocol.stop();
});

test('voice tools: unknown tools and failed requests produce safe English results', async () => {
  const h = harness();
  call(h.protocol, 'unknown', 'set_power');
  done(h.protocol, 'unknown');
  await tick();
  assert.equal(h.executed.length, 0);
  assert.equal(h.sent[0]?.is_error, true);
  assert.match(String(h.sent[0]?.result), /not available/);
  await h.protocol.stop();
  const failure = harness({ executeTool: async () => { throw new Error('Authorization: private-test-fixture'); } });
  call(failure.protocol);
  done(failure.protocol);
  await tick();
  assert.doesNotMatch(JSON.stringify(failure.sent), /Authorization|private-test-fixture/);
  await failure.protocol.stop();
});

test('voice reset/stop: late events, audio, and tool requests cannot affect a closed adapter', async () => {
  const h = harness();
  await h.protocol.stop();
  h.protocol.receive({ type: 'session.ready' });
  call(h.protocol);
  done(h.protocol);
  h.protocol.receive({ type: 'transcript.agent', reply_id: 'old', text: 'Stale arrival.' });
  h.protocol.receive({ type: 'reply.audio', data: 'old' });
  await tick();
  assert.equal(h.protocol.ready, false);
  assert.equal(h.executed.length, 0);
  assert.equal(h.captions.length, 0);
  assert.equal(h.audio.length, 0);
});

test('voice interruption: a delayed tool.call from an interrupted reply cannot start a new action', async () => {
  const h = harness();
  h.protocol.receive({ type: 'reply.started', reply_id: 'fc-delayed', item_id: 'item-delayed' });
  await h.protocol.interrupt();
  h.protocol.receive({ type: 'tool.call', call_id: 'delayed', name: 'observe_room', arguments: {} });
  done(h.protocol, 'delayed');
  await tick();
  assert.equal(h.executed.length, 0);
  await h.protocol.stop();
});

test('voice stop: repeated stop waits for the same pending server cancellation', async () => {
  const cancellation = deferred<void>();
  const h = harness({ cancelPending: () => cancellation.promise });
  const first = h.protocol.stop();
  const second = h.protocol.stop();
  assert.equal(first, second);
  let settled = false;
  void second.then(() => { settled = true; });
  await tick();
  assert.equal(settled, false);
  cancellation.resolve();
  await second;
  assert.equal(settled, true);
});

class FakeAudio implements VoiceAudio {
  closed = 0;
  stops = 0;
  microphone?: boolean;
  chunk?: (value: string) => void;
  failure?: Error;
  async prepare(microphone: boolean, onChunk: (value: string) => void): Promise<void> {
    this.microphone = microphone;
    this.chunk = onChunk;
    if (this.failure) throw this.failure;
  }
  play(): void {}
  stopPlayback(): void { this.stops++; }
  async close(): Promise<void> { this.closed++; }
}
class FakeSocket implements VoiceSocket {
  readyState = 0;
  onopen: VoiceSocket['onopen'] = null;
  onmessage: VoiceSocket['onmessage'] = null;
  onclose: VoiceSocket['onclose'] = null;
  onerror: VoiceSocket['onerror'] = null;
  sent: ProviderEvent[] = [];
  send(data: string): void {
    const event = JSON.parse(data) as ProviderEvent;
    this.sent.push(event);
    if (event.type === 'session.end') queueMicrotask(() => this.emit({ type: 'session.ended' }));
  }
  open(): void { this.readyState = 1; this.onopen?.(new Event('open')); }
  emit(event: ProviderEvent): void { this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent); }
  close(): void { this.readyState = 3; }
  drop(): void { this.readyState = 3; this.onclose?.({} as CloseEvent); }
}
function liveHarness() {
  const audio = new FakeAudio();
  const socket = new FakeSocket();
  const errors: string[] = [];
  const statuses: VoiceStatus[] = [];
  const captions: TranscriptEntry[] = [];
  let cancellations = 0;
  let sockets = 0;
  const live = new LiveVoice({ onError: (value) => errors.push(value), onStatus: (value) => statuses.push(value), onTranscript: (value) => captions.push(value) }, {
    createAudio: () => audio, createSocket: () => { sockets++; return socket; }, handshakeMs: 100, endGraceMs: 5,
  });
  const options: VoiceStartOptions = {
    token: 'test-temporary-token', config: sessionConfig, microphone: true,
    executeTool: async () => ({ ok: true, message: 'Done.' }), cancelPending: async () => { cancellations++; },
  };
  return { live, socket, audio, errors, statuses, captions, options, get sockets() { return sockets; }, get cancellations() { return cancellations; } };
}

test('live adapter fake: configure first, gate microphone on readiness, text fallback, and explicit clean end', async () => {
  const h = liveHarness();
  const starting = h.live.start(h.options);
  await tick();
  h.audio.chunk?.('before-ready');
  h.socket.open();
  assert.deepEqual(h.socket.sent.map((event) => event.type), ['session.update']);
  h.socket.emit({ type: 'session.ready', resume_token: 'do-not-display' });
  await starting;
  h.audio.chunk?.('after-ready');
  assert.equal(h.socket.sent[1]?.type, 'input.audio');
  assert.equal(h.live.sendText('Could you take a look around?'), true);
  await tick();
  assert.deepEqual(h.socket.sent.slice(-2).map((event) => event.type), ['conversation.message', 'reply.create']);
  assert.equal(h.cancellations, 1);
  await h.live.end();
  assert.equal(h.socket.sent.at(-1)?.type, 'session.end');
  assert.equal(h.socket.readyState, 3);
  assert.equal(h.audio.closed, 1);
  assert.equal(h.socket.onmessage, null);
  assert.equal(h.live.sendText('late'), false);
  assert.doesNotMatch(JSON.stringify([h.errors, h.statuses, h.captions]), /do-not-display|test-temporary-token/);
});

test('live adapter fake: permission denial closes audio without minting a token or starting a session', async () => {
  const h = liveHarness();
  h.audio.failure = new DOMException('private browser diagnostics', 'NotAllowedError');
  let tokens = 0;
  h.options.token = async () => { tokens++; return { token: 'unused', config: sessionConfig }; };
  await assert.rejects(h.live.start(h.options), /Microphone access was denied/);
  assert.equal(tokens, 0);
  assert.equal(h.sockets, 0);
  assert.equal(h.audio.closed, 1);
  assert.doesNotMatch(h.errors.join(' '), /private browser diagnostics/);
});

test('live adapter fake: token failure closes audio and never exposes the upstream error', async () => {
  const h = liveHarness();
  h.options.token = async () => { throw new Error('Authorization: private-test-fixture'); };
  await assert.rejects(h.live.start(h.options), /Live voice is unavailable/);
  assert.equal(h.audio.closed, 1);
  assert.equal(h.sockets, 0);
  assert.doesNotMatch(h.errors.join(' '), /Authorization|private-test-fixture/);
});

test('live adapter fake: microphone-off connection is real text transport and network drop stops pending actions', async () => {
  const h = liveHarness();
  h.options.microphone = false;
  const starting = h.live.start(h.options);
  await tick();
  h.socket.open();
  h.socket.emit({ type: 'session.ready' });
  await starting;
  assert.equal(h.audio.microphone, false);
  h.socket.drop();
  await h.live.stop();
  assert.match(h.errors.join(' '), /connection was lost/);
  assert.equal(h.audio.closed, 1);
  assert.equal(h.cancellations, 1);
});

test('live adapter fake: configuration rejection is sanitized and connection timeout terminates the socket', async () => {
  const h = liveHarness();
  const starting = h.live.start(h.options);
  const failed = assert.rejects(starting);
  await tick();
  h.socket.open();
  h.socket.emit({ type: 'session.error', message: 'private-test-fixture', code: 'invalid_config' });
  await failed;
  await h.live.stop();
  assert.match(h.errors.join(' '), /rejected this session/);
  assert.doesNotMatch(h.errors.join(' '), /private-test-fixture/);
  const timeout = liveHarness();
  await assert.rejects(timeout.live.start(timeout.options));
  await timeout.live.stop();
  assert.match(timeout.errors.join(' '), /timed out/);
  assert.equal(timeout.socket.readyState, 3);
});

test('audio helpers: English permission/device errors and PCM base64 preserve bytes', () => {
  assert.match(microphoneError({ name: 'NotFoundError' }), /No microphone/);
  assert.match(microphoneError({ name: 'NotReadableError' }), /unavailable/);
  assert.equal(bytesToBase64(Uint8Array.from([0, 255, 128, 7]).buffer), 'AP+ABw==');
});

test('browser audio with fake devices: close releases tracks and contexts, including permission resolved after stop', async () => {
  const descriptors = new Map(['AudioContext', 'AudioWorkletNode', 'navigator'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let stoppedTracks = 0;
  let closedContexts = 0;
  const track = { onended: null as (() => void) | null, stop() { stoppedTracks++; } };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
  let media: () => Promise<unknown> = async () => stream;
  class Context {
    destination = {};
    audioWorklet = { addModule: async () => {} };
    async resume() {}
    async close() { closedContexts++; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  class Worklet {
    port = { onmessage: null, postMessage() {} };
    connect() {}
    disconnect() {}
  }
  try {
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
    Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: Worklet });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => media() } } });
    const audio = new BrowserAudio();
    const microphoneStates: boolean[] = [];
    const warnings: string[] = [];
    await audio.prepare(true, () => {}, (message) => warnings.push(message), () => {}, (active) => microphoneStates.push(active));
    assert.deepEqual(microphoneStates, [false, true]);
    track.onended?.();
    assert.deepEqual(microphoneStates, [false, true, false]);
    assert.match(warnings[0] ?? '', /microphone disconnected/);
    await audio.close();
    await audio.close();
    assert.equal(stoppedTracks, 1);
    assert.equal(closedContexts, 2);
    const permission = deferred<unknown>();
    media = () => permission.promise;
    const delayed = new BrowserAudio();
    const preparing = delayed.prepare(true, () => {}, () => {}, () => {});
    await tick();
    await delayed.close();
    permission.resolve(stream);
    await preparing;
    assert.equal(stoppedTracks, 2);
    assert.equal(closedContexts, 4);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

interface TestProcessor {
  port: { onmessage: (event: { data: unknown }) => void };
  process(inputs: Float32Array[][], outputs?: Float32Array[][]): boolean;
}
function worklet(source: string, sampleRate: number) {
  let Processor!: new () => TestProcessor;
  const posted: unknown[] = [];
  class Base { port = { onmessage: () => {}, postMessage: (value: unknown) => posted.push(value) }; }
  vm.runInNewContext(source, { AudioWorkletProcessor: Base, sampleRate, Float32Array, Int16Array,
    registerProcessor: (_name: string, value: new () => TestProcessor) => { Processor = value; } });
  return { processor: new Processor(), posted };
}

test('audio worklets: actual 48 kHz capture is resampled to 24 kHz and interruption empties queued playback', () => {
  const capture = worklet(CAPTURE_WORKLET, 48_000);
  capture.processor.process([[new Float32Array(128).fill(0.5)]]);
  assert.equal(new Int16Array(capture.posted[0] as ArrayBuffer).length, 64);
  const playback = worklet(PLAYBACK_WORKLET, 48_000);
  playback.processor.port.onmessage({ data: new Int16Array(2400).fill(16000).buffer });
  const audible = new Float32Array(128);
  playback.processor.process([], [[audible]]);
  assert.ok(audible.some((value) => value > 0));
  playback.processor.port.onmessage({ data: 'stop' });
  const silence = new Float32Array(128).fill(1);
  playback.processor.process([], [[silence]]);
  assert.ok(silence.every((value) => value === 0));
  assert.ok(playback.posted.includes('drained'));
});

test('agent boundaries: compact English configuration contains no answer key, hidden objects, or alternate providers', () => {
  const config = JSON.stringify(sessionConfig);
  assert.doesNotMatch(config, /latch|conveyor|door|shared power|latch_open|far_side|powerOn|doorLatched|Goal 001|\u30e9\u30c3\u30c1/i);
  assert.match(sessionConfig.system_prompt, /Do not offer calendars/);
  assert.match(sessionConfig.system_prompt, /Wait for a valid tool result/);
  assert.equal(sessionConfig.output.voice, 'anna');
  assert.deepEqual(sessionConfig.input.language_codes, ['en']);
  assert.equal('agent_id' in sessionConfig, false);
  assert.deepEqual(robotTools.map((tool) => tool.name), ['observe_room', 'inspect_object', 'interact_object', 'move_to']);
});
