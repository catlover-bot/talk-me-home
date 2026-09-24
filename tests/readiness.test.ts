import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAudioCheck } from '../game/client/audio.ts';

test('local readiness measures actual local samples, releases resources, and disposes late permission', async () => {
  const descriptors = new Map(['AudioContext', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let tracksStopped = 0;
  let contextsClosed = 0;
  let permissionRequests = 0;
  let samplesRead = 0;
  const stream = { getTracks: () => [{ stop() { tracksStopped++; } }] };
  let media: () => Promise<unknown> = async () => stream;
  class Context {
    state = 'running';
    async resume() {}
    async close() { this.state = 'closed'; contextsClosed++; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 256, getFloatTimeDomainData(samples: Float32Array) { samplesRead++; samples.fill(0.08); }, disconnect() {} }; }
  }
  try {
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia() { permissionRequests++; return media(); } } } });
    const local = new LocalAudioCheck();
    assert.equal(permissionRequests, 0, 'Construction never asks for microphone permission.');
    const levels: number[] = [];
    await local.microphone(level => levels.push(level));
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.ok(levels.length > 0);
    assert.ok(Math.abs(levels[0]! - 0.4) < 0.001);
    local.close(); local.close();
    assert.equal(tracksStopped, 1, 'Close must be idempotent for acquired tracks.');
    assert.equal(contextsClosed, 1);
    const afterClose = samplesRead;
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(samplesRead, afterClose, 'Closing stops the level meter.');
    let resolvePermission!: (value: unknown) => void;
    media = () => new Promise(resolve => { resolvePermission = resolve; });
    const delayed = new LocalAudioCheck();
    const preparing = delayed.microphone(() => assert.fail('Closed meter cannot run.'));
    await new Promise(resolve => setImmediate(resolve));
    delayed.close(); resolvePermission(stream); await preparing;
    assert.equal(tracksStopped, 2);
    assert.equal(contextsClosed, 2);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
