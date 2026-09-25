import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodePcmWav, validateSpeechWav } from './qa-speech-fixtures.mjs';

/** Deliberately omits URL, config, credentials, arguments and tool result payloads. */
export function sanitizeWireEvent(value, direction, references = new Map()) {
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
  const type = value.type;
  const allowed = new Set(['session.ready', 'session.ended', 'session.end', 'session.error', 'input.speech.started', 'input.speech.stopped', 'reply.started', 'reply.done', 'transcript.user', 'transcript.user.delta', 'transcript.agent', 'transcript.agent.delta', 'tool.call', 'tool.result', 'reply.create', 'conversation.message']);
  if (!allowed.has(type)) return null;
  const event = { direction, type };
  const reference = raw => {
    if (typeof raw !== 'string') return undefined;
    if (!references.has(raw)) references.set(raw, references.size + 1);
    return references.get(raw);
  };
  if (type.startsWith('transcript.')) {
    event.role = type.includes('.user') ? 'human' : 'robot';
    event.final = !type.endsWith('.delta');
    const text = event.final || event.role === 'human' ? value.text : value.delta;
    if (typeof text === 'string') event.text = text.slice(0, 12_000);
    event.reference = reference(event.role === 'human' ? value.item_id : value.reply_id);
    if (typeof value.interrupted === 'boolean') event.interrupted = value.interrupted;
  }
  if (type === 'tool.call' || type === 'tool.result') {
    event.callRef = reference(value.call_id);
    event.replyRef = reference(value.reply_id);
    if (['observe_room', 'inspect_object', 'interact_object', 'move_to'].includes(value.name)) event.name = value.name;
    if (typeof value.is_error === 'boolean') event.isError = value.is_error;
  }
  if (type === 'reply.started' || type === 'reply.done') {
    event.replyRef = reference(value.reply_id);
    event.itemRef = reference(value.item_id);
    // Documented fc-<call_id> relation, retained only as the same numeric alias.
    if (typeof value.reply_id === 'string' && value.reply_id.startsWith('fc-') && value.reply_id.length > 3) event.callRef = reference(value.reply_id.slice(3));
    if (['completed', 'interrupted', 'failed', 'cancelled'].includes(value.status)) event.status = value.status;
  }
  if (type === 'session.error') event.failed = true;
  // Scheduling records that typed input was sent, never arbitrary recap content.
  if (type === 'conversation.message') event.role = value.role === 'user' ? 'human' : 'other';
  if (type === 'session.ended' && Number.isFinite(value.session_duration_seconds) && value.session_duration_seconds >= 0 && value.session_duration_seconds < 3600) event.durationSeconds = value.session_duration_seconds;
  return event;
}

function browserInstrumentation(options, sanitize) {
  if (globalThis.__qaAudio) throw new Error('QA audio instrumentation already installed.');
  const events = []; const recordings = { input: [], rendered: [], postVolume: [] };
  const references = new Map(); const started = performance.now();
  const destinations = []; const contexts = []; const sources = new Set();
  const counters = { input: { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }, provider: { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }, rendered: { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }, postVolume: { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 } };
  const nativeAudioContext = globalThis.AudioContext;
  const nativeWorkletNode = globalThis.AudioWorkletNode;
  const nativeConnect = AudioNode.prototype.connect;
  const nativeAddModule = AudioWorklet.prototype.addModule;
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const localBlobs = new Map();
  URL.createObjectURL = blob => { const url = nativeCreateObjectURL(blob); localBlobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { localBlobs.delete(url); nativeRevokeObjectURL(url); };
  const playbackNodes = new WeakSet(); const observedGains = new WeakSet();
  let syntheticContext; let closed = false; let queuedInput = false; let inputDrain;
  const playbackStates = new Map();
  const timestamp = () => performance.now() - started;
  const record = value => {
    const event = { atMs: timestamp(), ...value };
    if (events.length < 100_000) events.push(event);
    if (options.lifecycle && ['end.requested', 'session.end', 'session.ended', 'socket.open', 'socket.close'].includes(event.type)) void globalThis.__qaLifecycle(event).catch(() => {});
  };
  const encode = bytes => {
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  };
  const decode = base64 => {
    const binary = atob(base64); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    if (bytes.length % 2) throw new Error('Invalid PCM length.');
    return new Int16Array(bytes.buffer);
  };
  const acceptSamples = (kind, samples, sampleRate, atMs, floating = false) => {
    if (closed) return;
    let energy = 0; let nonzeroSamples = 0;
    for (const sample of samples) { const normalized = floating ? sample : sample / 32768; energy += normalized * normalized; if (Math.abs(normalized) > 1 / 32768) nonzeroSamples++; }
    const counter = counters[kind]; counter.chunks++; counter.samples += samples.length; counter.energy += energy; counter.nonzeroSamples += nonzeroSamples;
    counter.lastChunkMs = atMs;
    if (kind === 'input' && inputDrain && !nonzeroSamples && atMs > inputDrain.endedAtMs) inputDrain.finish(atMs);
    if (!nonzeroSamples) return;
    if (kind !== 'provider') {
      const pcm = floating ? Int16Array.from(samples, sample => Math.max(-32768, Math.min(32767, Math.round(sample * 32768)))) : samples;
      recordings[kind].push({ atMs, sampleRate, data: encode(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)) });
    }
    const last = counter.lastNonzeroMs;
    counter.lastNonzeroMs = atMs;
    if (last === undefined || atMs - last > 200) record({ type: `audio.${kind}.onset`, sampleRate, nonzeroSamples, energy, audioAtMs: atMs });
  };

  // The socket remains native. Its URL and handshake/config bodies are never retained.
  const observedSockets = new WeakSet();
  const observeSocket = socket => {
      if (observedSockets.has(socket)) return socket;
      observedSockets.add(socket);
      socket.addEventListener('open', () => record({ type: 'socket.open' }));
      socket.addEventListener('close', event => record({ type: 'socket.close', code: event.code, clean: event.wasClean }));
      socket.addEventListener('message', event => {
        if (typeof event.data !== 'string') return;
        let value; try { value = JSON.parse(event.data); } catch { return; }
        if (value?.type === 'reply.audio' && typeof value.data === 'string') {
          try { acceptSamples('provider', decode(value.data), 24000, timestamp()); }
          catch { record({ type: 'audio.provider.invalid' }); }
        }
        const safe = sanitize(value, 'received', references); if (safe) record(safe);
      });
      const send = socket.send.bind(socket);
      socket.send = data => {
      // This observes the application's transport request, including automatic
      // completion shutdown; it does not infer an ACK from send() succeeding.
      if (typeof data === 'string') { try { if (JSON.parse(data)?.type === 'session.end') record({ type: 'end.requested', direction: 'sent' }); } catch {} }
      const result = send(data);
      if (typeof data !== 'string') return result;
      let value; try { value = JSON.parse(data); } catch { return result; }
      if (value?.type === 'input.audio' && typeof value.audio === 'string') {
        try { const samples = decode(value.audio); acceptSamples('input', samples, 24000, timestamp() - samples.length / 24); }
        catch { record({ type: 'audio.input.invalid' }); }
      }
      const safe = sanitize(value, 'sent', references); if (safe) record(safe);
      return result;
      };
      return socket;
  };
  let wrappedSocket;
  const wrapCurrentSocket = () => {
    if (globalThis.WebSocket === wrappedSocket) return;
    const original = globalThis.WebSocket;
    wrappedSocket = new Proxy(original, { construct(Target, args) { return observeSocket(Reflect.construct(Target, args)); } });
    globalThis.WebSocket = wrappedSocket;
  };
  wrapCurrentSocket();
  // Playwright's explicitly offline WebSocket route can install after init scripts.
  // Re-observe that peer once DOM is ready; real-provider runs keep the native peer.
  document.addEventListener('DOMContentLoaded', wrapCurrentSocket, { once: true });

  // Observe original process() output after it has rendered. Do not replace DSP.
  AudioWorklet.prototype.addModule = async function (url, ...args) {
    // Read the already supplied Blob; production CSP correctly forbids fetch(blob:).
    const blob = localBlobs.get(url);
    if (!blob) return nativeAddModule.call(this, url, ...args);
    const original = await blob.text();
    const prefix = `const registerProcessor = (name, Processor) => globalThis.registerProcessor(name, name !== 'playback' ? Processor : class extends Processor {
      constructor() {
        super(); this.qaBuffer = new Float32Array(2400); this.qaUsed = 0; this.qaStart = 0;
        this.qaSequence = 0; this.qaLastState = '';
        this.port.addEventListener('message', event => { if (Number.isInteger(event.data?.__qaSequence)) this.qaSequence = event.data.__qaSequence; });
        this.port.start();
      }
      process(inputs, outputs, parameters) {
        const result = super.process(inputs, outputs, parameters);
        // Read the original ring after DSP; never alter samples or its queue.
        const pending = this._available > 0;
        const state = this.qaSequence + ':' + pending;
        if (state !== this.qaLastState) {
          this.qaLastState = state;
          this.port.postMessage({ __qaQueueState: true, sequence: this.qaSequence, pending });
        }
        const samples = outputs[0]?.[0];
        if (samples) for (let i = 0; i < samples.length; i++) {
          if (!this.qaUsed) this.qaStart = currentTime + i / sampleRate;
          this.qaBuffer[this.qaUsed++] = samples[i];
          if (this.qaUsed === this.qaBuffer.length) {
            const copy = this.qaBuffer.slice();
            this.port.postMessage({ __qaRendered: true, samples: copy.buffer, sampleRate, start: this.qaStart }, [copy.buffer]);
            this.qaUsed = 0;
          }
        }
        return result;
      }
    });\n`;
    const observed = nativeCreateObjectURL(new Blob([prefix, original], { type: 'application/javascript' }));
    try { return await nativeAddModule.call(this, observed, ...args); }
    finally { nativeRevokeObjectURL(observed); }
  };
  globalThis.AudioWorkletNode = class extends nativeWorkletNode {
    constructor(context, name, ...args) {
      super(context, name, ...args);
      if (name !== 'playback') return;
      playbackNodes.add(this);
      const state = { generation: 0, sequence: 0, pending: false }; playbackStates.set(this, state);
      const timeOrigin = timestamp() - context.currentTime * 1000;
      this.port.addEventListener('message', event => {
        if (event.data?.__qaRendered) acceptSamples('rendered', new Float32Array(event.data.samples), event.data.sampleRate, timeOrigin + event.data.start * 1000, true);
        else if (event.data?.__qaQueueState && event.data.sequence === state.sequence) state.pending = event.data.pending;
        else if ((event.data?.type === 'started' || event.data?.type === 'drained') && event.data.generation === state.generation) {
          record({ type: `playback.${event.data.type}`, generation: state.generation });
        }
      });
      this.port.start();
      const post = this.port.postMessage.bind(this.port);
      this.port.postMessage = (message, ...rest) => {
        if (message?.type === 'stop' || message === 'stop') { state.generation = message.generation ?? state.generation; state.pending = false; record({ type: 'playback.stop', generation: state.generation }); }
        else if (message?.audio?.byteLength) { state.generation = message.generation; state.pending = true; record({ type: 'playback.queued', generation: state.generation, samples: message.audio.byteLength / 2 }); }
        // Read-only observation sequence avoids accepting a drain queued before new PCM.
        return post(typeof message === 'object' ? { ...message, __qaSequence: ++state.sequence } : message, ...rest);
      };
    }
  };
  // A read-only, silent downstream branch captures the actual post-volume signal.
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = nativeConnect.call(this, destination, ...args);
    if (playbackNodes.has(this) && destination instanceof GainNode && !observedGains.has(destination)) {
      observedGains.add(destination);
      const context = this.context; const timeOrigin = timestamp() - context.currentTime * 1000;
      const observer = context.createScriptProcessor(2048, 1, 1);
      observer.onaudioprocess = event => {
        acceptSamples('postVolume', event.inputBuffer.getChannelData(0), context.sampleRate, timeOrigin + event.playbackTime * 1000, true);
        event.outputBuffer.getChannelData(0).fill(0);
      };
      nativeConnect.call(destination, observer); nativeConnect.call(observer, context.destination);
      record({ type: 'audio.postVolume.attached', sampleRate: context.sampleRate });
    }
    return result;
  };
  // This is the sole substitution: replace physical capture with an isolated stream.
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async constraints => {
    if (closed || !constraints?.audio || constraints.video) throw new DOMException('Only isolated synthetic audio is available.', 'NotAllowedError');
    syntheticContext ??= new nativeAudioContext({ sampleRate: 48000 });
    await syntheticContext.resume();
    const destination = syntheticContext.createMediaStreamDestination();
    destinations.push(destination);
    record({ type: 'synthetic.microphone.created', sampleRate: syntheticContext.sampleRate });
    return destination.stream;
  } });
  globalThis.AudioContext = class extends nativeAudioContext {
    constructor(...args) { super(...args); contexts.push(this); }
  };
  globalThis.__qaAudio = {
    async queue({ wav, id, text }) {
      const active = destinations.filter(destination => destination.stream.getAudioTracks().some(track => track.readyState === 'live'));
      if (closed || !syntheticContext || active.length !== 1 || queuedInput || sources.size) throw new Error('Synthetic input requires exactly one active microphone and no queued speech.');
      queuedInput = true;
      try {
      await syntheticContext.resume();
      // Confirm actual capture frames before injecting the first waveform.
      const warmDeadline = performance.now() + 3000;
      while (!counters.input.chunks && performance.now() < warmDeadline) await new Promise(resolve => setTimeout(resolve, 20));
      if (!counters.input.chunks) throw new Error('Synthetic input capture did not warm up.');
      const raw = Uint8Array.from(atob(wav), c => c.charCodeAt(0));
      const buffer = await syntheticContext.decodeAudioData(raw.buffer);
      const source = syntheticContext.createBufferSource(); source.buffer = buffer;
      nativeConnect.call(source, active[0]); sources.add(source);
      const startsAt = syntheticContext.currentTime + 0.05;
      record({ type: 'synthetic.speech.queued', id, text, durationSeconds: buffer.duration });
      record({ type: 'synthetic.speech.started', id, atMs: timestamp() + 50, timeBasis: 'Scheduled AudioContext start; actual transmitted onset is audio.input.onset, not this estimate.' });
      return await new Promise((resolveSpeech, rejectSpeech) => {
        const timer = setTimeout(() => { inputDrain = undefined; rejectSpeech(new Error('Synthetic input did not drain through shipped capture.')); }, buffer.duration * 1000 + 3000);
        source.onended = () => {
          source.disconnect(); sources.delete(source);
          const endedAtMs = timestamp(); record({ type: 'synthetic.speech.ended', id, atMs: endedAtMs });
          inputDrain = { endedAtMs, finish(atMs) {
            clearTimeout(timer); inputDrain = undefined;
            record({ type: 'synthetic.speech.drained', id, captureAtMs: atMs });
            resolveSpeech({ id, durationSeconds: buffer.duration });
          } };
        };
        source.start(startsAt);
      });
      } finally { queuedInput = false; }
    },
    snapshot(includeMedia = false) {
      return { label: options.label, elapsedMs: timestamp(), counters, events: events.slice(), playbackPending: [...playbackStates.values()].some(state => state.pending), activeTracks: destinations.flatMap(destination => destination.stream.getTracks()).filter(track => track.readyState === 'live').length, activeSources: sources.size, openApplicationContexts: contexts.filter(context => context.state !== 'closed').length, ...(includeMedia ? { recordings } : {}) };
    },
    async close() {
      for (const source of sources) { try { source.stop(); } catch {} }
      for (const destination of destinations) destination.stream.getTracks().forEach(track => track.stop());
      await Promise.allSettled([...contexts, syntheticContext].filter(Boolean).map(context => context.state === 'closed' ? undefined : context.close()));
      record({ type: 'synthetic.cleanup' }); closed = true;
    },
  };
}

export async function installAudioInstrumentation(page, { label = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI', onLifecycle } = {}) {
  if (!['AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI', 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI', 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO'].includes(label)) throw new Error('Use an explicit QA evidence label.');
  if (onLifecycle) await page.exposeBinding('__qaLifecycle', (_source, event) => onLifecycle(event));
  await page.addInitScript({ content: `(${browserInstrumentation.toString()})(${JSON.stringify({ label, lifecycle: Boolean(onLifecycle) })}, ${sanitizeWireEvent.toString()});` });
}

export async function queueSpeech(page, fixture) {
  const path = typeof fixture === 'string' ? fixture : fixture.path;
  const bytes = await readFile(path); validateSpeechWav(bytes);
  return page.evaluate(input => globalThis.__qaAudio.queue(input), { wav: bytes.toString('base64'), id: typeof fixture === 'string' ? 'local-fixture' : fixture.id, text: typeof fixture === 'string' ? undefined : fixture.text });
}

export async function audioSnapshot(page) { return page.evaluate(() => globalThis.__qaAudio.snapshot()); }
export async function cleanupAudioInstrumentation(page) { return page.evaluate(() => globalThis.__qaAudio.close()); }

/** Sparse timestamped chunks retain gaps and are aligned to navigation's QA time origin. */
export function assembleRecording(chunks, durationMs, sampleRate = 24_000) {
  const output = new Int16Array(Math.ceil(durationMs * sampleRate / 1000));
  for (const chunk of chunks) {
    const bytes = Buffer.from(chunk.data, 'base64');
    const length = bytes.length / 2; const offset = Math.round(chunk.atMs * sampleRate / 1000);
    const targetLength = Math.round(length * sampleRate / chunk.sampleRate);
    for (let i = 0; i < targetLength; i++) {
      const target = offset + i; if (target < 0 || target >= output.length) continue;
      const from = Math.min(length - 1, Math.floor(i * chunk.sampleRate / sampleRate));
      output[target] = Math.max(-32768, Math.min(32767, output[target] + bytes.readInt16LE(from * 2)));
    }
  }
  return encodePcmWav(output, sampleRate);
}

export async function collectAudioEvidence(page, directory) {
  await mkdir(directory, { recursive: true });
  const { recordings, ...summary } = await page.evaluate(() => globalThis.__qaAudio.snapshot(true));
  const media = {};
  for (const [kind, chunks] of Object.entries(recordings)) {
    const file = `${kind}-digital.wav`;
    await writeFile(resolve(directory, file), assembleRecording(chunks, summary.elapsedMs));
    media[kind] = { file, chunks: chunks.length, sampleRate: 24000, channels: 1, bits: 16, durationSeconds: summary.elapsedMs / 1000 };
  }
  const evidence = { ...summary, media, boundary: 'Synthetic source and digital capture only; no physical microphone, room acoustics, loudspeaker routing, or human listening was observed.' };
  await writeFile(resolve(directory, 'audio-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  return evidence;
}
