import { CAPTURE_WORKLET, PLAYBACK_WORKLET } from './audio-worklets.ts';

export const WIRE_RATE = 24_000;

export interface VoiceAudio {
  prepare(microphone: boolean, onChunk: (base64: string) => void, onWarning: (message: string) => void, onDrain: () => void, onMicrophone?: (active: boolean) => void): Promise<void>;
  play(base64: string): void;
  stopPlayback(): void;
  close(): Promise<void>;
}

export function microphoneError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access was denied. Allow it in your browser, or connect with the microphone off and type a message.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No microphone was found. Connect a microphone, or connect with the microphone off and type a message.';
  if (name === 'NotReadableError') return 'The microphone is unavailable or in use. Check your input device, or connect with the microphone off.';
  return 'Audio could not start. Check browser audio permissions and your input device.';
}

export function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export class BrowserAudio implements VoiceAudio {
  private captureContext?: AudioContext;
  private playbackContext?: AudioContext;
  private capture?: AudioWorkletNode;
  private playback?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private stream?: MediaStream;
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private heardInput = false;

  async prepare(microphone: boolean, onChunk: (base64: string) => void, onWarning: (message: string) => void, onDrain: () => void, onMicrophone?: (active: boolean) => void): Promise<void> {
    onMicrophone?.(false);
    // These constructors and resume calls happen synchronously inside the click.
    this.playbackContext = new AudioContext({ sampleRate: WIRE_RATE });
    const resumes = [this.playbackContext.resume()];
    if (microphone) {
      this.captureContext = new AudioContext({ sampleRate: WIRE_RATE });
      resumes.push(this.captureContext.resume());
    }
    await Promise.all(resumes);
    if (this.closed) return;
    this.playback = await this.addWorklet(this.playbackContext, PLAYBACK_WORKLET, 'playback');
    if (this.closed) { this.playback.disconnect(); return; }
    this.playback.port.onmessage = ({ data }) => { if (data === 'drained') onDrain(); };
    this.playback.connect(this.playbackContext.destination);
    if (!microphone) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Unavailable', 'NotFoundError');
    // Capture is initialized before a token is minted, avoiding paid permission waits.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false,
    } });
    if (this.closed) { stream.getTracks().forEach((track) => track.stop()); return; }
    this.stream = stream;
    const context = this.captureContext!;
    this.capture = await this.addWorklet(context, CAPTURE_WORKLET, 'capture');
    if (this.closed) { this.capture.disconnect(); return; }
    this.capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
      if (this.closed) return;
      if (!this.heardInput) {
        const samples = new Int16Array(data);
        this.heardInput = samples.some((sample) => Math.abs(sample) > 150);
      }
      onChunk(bytesToBase64(data));
    };
    this.source = context.createMediaStreamSource(stream);
    this.source.connect(this.capture);
    onMicrophone?.(true);
    this.silenceTimer = setTimeout(() => {
      if (!this.closed && !this.heardInput) onWarning('No microphone audio has been detected. Check your input device, or type a message.');
    }, 12_000);
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (this.closed) return;
        onMicrophone?.(false);
        onWarning('The microphone disconnected. You can still type a message, or end the call and reconnect.');
      };
    });
  }

  play(base64: string): void {
    if (this.closed || !this.playback) return;
    const raw = atob(base64);
    if (raw.length % 2 !== 0) throw new Error('Invalid PCM audio.');
    const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
    this.playback.port.postMessage(bytes.buffer, [bytes.buffer]);
  }

  stopPlayback(): void { this.playback?.port.postMessage('stop'); }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.silenceTimer);
    this.stopPlayback();
    this.stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    this.source?.disconnect();
    this.capture?.disconnect();
    this.playback?.disconnect();
    if (this.capture) this.capture.port.onmessage = null;
    if (this.playback) this.playback.port.onmessage = null;
    await Promise.allSettled([this.captureContext?.close(), this.playbackContext?.close()]);
  }

  private async addWorklet(context: AudioContext, code: string, name: string): Promise<AudioWorkletNode> {
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    try { await context.audioWorklet.addModule(url); }
    finally { URL.revokeObjectURL(url); }
    return new AudioWorkletNode(context, name);
  }
}
