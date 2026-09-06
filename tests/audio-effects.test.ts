import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { BrowserAudio } from '../game/client/audio.ts';
import { PLAYBACK_WORKLET } from '../game/client/audio-worklets.ts';
import { LocalEffects } from '../game/client/effects.ts';

function fakeAudioGlobals() {
  const names = ['AudioContext', 'AudioWorkletNode'];
  const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const contexts: Context[] = [];
  const worklets: Worklet[] = [];
  let oscillatorCount = 0;
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    onstatechange: (() => void) | null = null;
    audioWorklet = { addModule: async () => {} };
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() {
      oscillatorCount++;
      return { type: 'sine', frequency: { value: 0 }, onended: null as (() => void) | null, connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } };
    }
  }
  class Worklet {
    sent: unknown[] = [];
    port = { onmessage: null as ((event: { data: unknown }) => void) | null, postMessage: (data: unknown) => this.sent.push(data) };
    constructor() { worklets.push(this); }
    connect() {}
    disconnect() {}
    emit(data: unknown) { this.port.onmessage?.({ data }); }
  }
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: Worklet });
  return {
    contexts, worklets, get oscillatorCount() { return oscillatorCount; },
    restore() { names.forEach((name, index) => { const value = previous[index]; if (value) Object.defineProperty(globalThis, name, value); else Reflect.deleteProperty(globalThis, name); }); },
  };
}

test('browser output: received bytes, muted gain, and suspended context cannot imply speaking', async () => {
  const fakes = fakeAudioGlobals();
  const audio = new BrowserAudio();
  const playing: boolean[] = [];
  const warnings: string[] = [];
  try {
    assert.equal(fakes.contexts.length, 0);
    await audio.prepare(false, () => {}, (text) => warnings.push(text), () => {}, undefined, (active) => playing.push(active));
    audio.play('AEAAQA==');
    assert.deepEqual(playing, [false]);
    const output = fakes.worklets[0]!;
    output.emit({ type: 'started', generation: 0 });
    assert.equal(playing.at(-1), true);
    audio.setVolume(0);
    assert.equal(playing.at(-1), false);
    audio.setVolume(0.5);
    assert.equal(playing.at(-1), true);
    const context = fakes.contexts[0]!;
    context.state = 'suspended'; context.onstatechange?.();
    assert.equal(playing.at(-1), false);
    const queued = output.sent.length;
    audio.play('AEAAQA==');
    assert.equal(output.sent.length, queued);
    assert.match(warnings.join(' '), /suspended/);
    assert.match(warnings.join(' '), /output is unavailable/);
    output.emit({ type: 'started', generation: 0 });
    assert.equal(playing.at(-1), false);
  } finally { await audio.close(); fakes.restore(); }
});

test('browser output: interruption invalidates worklet callbacks and prepare cannot capture twice', async () => {
  const fakes = fakeAudioGlobals();
  const audio = new BrowserAudio();
  const playing: boolean[] = [];
  try {
    await audio.prepare(false, () => {}, () => {}, () => {}, undefined, (active) => playing.push(active));
    await assert.rejects(audio.prepare(false, () => {}, () => {}, () => {}), /already started/);
    assert.equal(fakes.contexts.length, 1);
    const output = fakes.worklets[0]!;
    output.emit({ type: 'started', generation: 0 });
    assert.equal(playing.at(-1), true);
    audio.stopPlayback();
    assert.equal(playing.at(-1), false);
    output.emit({ type: 'started', generation: 0 });
    assert.equal(playing.at(-1), false);
    audio.play('AEAAQA==');
    output.emit({ type: 'started', generation: 1 });
    assert.equal(playing.at(-1), true);
    output.emit({ type: 'drained', generation: 1 });
    assert.equal(playing.at(-1), false);
    await audio.close();
    assert.equal(output.port.onmessage, null);
    assert.equal(fakes.contexts[0]?.state, 'closed');
    assert.equal(fakes.contexts[0]?.onstatechange, null);
  } finally { await audio.close(); fakes.restore(); }
});

test('playback worklet: started means nonzero PCM rendered, not queued or silent frames', () => {
  const events: { type: string; generation: number }[] = [];
  interface Processor {
    port: { onmessage(event: { data: unknown }): void };
    process(inputs: unknown[], outputs: Float32Array[][]): void;
  }
  let Factory!: new () => Processor;
  vm.runInNewContext(PLAYBACK_WORKLET, {
    AudioWorkletProcessor: class { port = { postMessage: (value: { type: string; generation: number }) => events.push(value) }; },
    sampleRate: 24_000, Float32Array, Int16Array,
    registerProcessor: (_name: string, value: new () => Processor) => { Factory = value; },
  });
  const processor = new Factory();
  processor.port.onmessage({ data: { audio: new Int16Array(128).buffer, generation: 0 } });
  assert.equal(events.length, 0);
  processor.process([], [[new Float32Array(128)]]);
  assert.equal(events.some((event) => event.type === 'started'), false);
  processor.port.onmessage({ data: { audio: new Int16Array(128).fill(12000).buffer, generation: 0 } });
  assert.equal(events.some((event) => event.type === 'started'), false);
  processor.process([], [[new Float32Array(128)]]);
  assert.equal(events.at(-1)?.type, 'started');
  assert.equal(events.at(-1)?.generation, 0);
  processor.port.onmessage({ data: { type: 'stop', generation: 1 } });
  processor.process([], [[new Float32Array(128)]]);
  assert.equal(events.at(-1)?.type, 'drained');
  assert.equal(events.at(-1)?.generation, 1);
});

test('local effects: no automatic initialization, no competing speech, mute, and finite cleanup', async () => {
  const fakes = fakeAudioGlobals();
  const effects = new LocalEffects();
  try {
    effects.play('complete');
    assert.equal(fakes.contexts.length, 0);
    assert.equal(fakes.oscillatorCount, 0);
    await effects.unlock();
    effects.play('acknowledge');
    assert.equal(fakes.oscillatorCount, 1);
    effects.setVoiceActive(true);
    effects.play('connect');
    assert.equal(fakes.oscillatorCount, 1);
    effects.setVoiceActive(false);
    effects.setVolume(0);
    effects.play('disconnect');
    assert.equal(fakes.oscillatorCount, 1);
    effects.setVolume(0.2);
    effects.play('complete');
    assert.equal(fakes.oscillatorCount, 4);
    await effects.close();
    assert.equal(fakes.contexts[0]?.state, 'closed');
    effects.play('connect');
    assert.equal(fakes.contexts.length, 1);
    assert.equal(fakes.oscillatorCount, 4);
  } finally { await effects.close(); fakes.restore(); }
});
