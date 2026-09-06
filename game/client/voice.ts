import { BrowserAudio, microphoneError, type VoiceAudio } from './audio.ts';
import { VoiceProtocol, type ProviderEvent, type ToolCall, type TranscriptEntry, type VoiceStatus } from './voice-protocol.ts';
export type { ToolCall, TranscriptEntry, VoiceStatus } from './voice-protocol.ts';

export interface VoiceCallbacks {
  onTranscript(entry: TranscriptEntry): void;
  onStatus(status: VoiceStatus): void;
  onError(message: string): void;
  onWarning?(message: string): void;
  onMicrophone?(active: boolean): void;
}

export interface VoiceStartOptions {
  token: string | (() => Promise<{ token: string; config: Record<string, unknown> }>);
  config?: Record<string, unknown>;
  microphone: boolean;
  executeTool(call: ToolCall, signal: AbortSignal): Promise<unknown>;
  cancelPending(): Promise<void>;
  maxSessionSeconds?: number;
}

export interface VoiceSocket {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface VoiceDependencies {
  createAudio(): VoiceAudio;
  createSocket(url: URL): VoiceSocket;
  handshakeMs?: number;
  endGraceMs?: number;
}

/** One instance owns one provider connection. Reconnect creates a fresh instance. */
export class LiveVoice {
  private socket?: VoiceSocket;
  private audio?: VoiceAudio;
  private protocol?: VoiceProtocol;
  private stopping?: Promise<void>;
  private ended = false;
  private started = false;
  private ready = false;
  private cleanEnd = false;
  private handshakeTimer?: ReturnType<typeof setTimeout>;
  private durationTimer?: ReturnType<typeof setTimeout>;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private resolveClosed?: () => void;
  private textSequence = 0;

  constructor(private readonly callbacks: VoiceCallbacks, private readonly dependencies: VoiceDependencies = {
    createAudio: () => new BrowserAudio(),
    createSocket: (url) => new WebSocket(url),
  }) {}

  async start(options: VoiceStartOptions): Promise<void> {
    if (this.started || this.ended) throw new Error('This call has already started. Create a new connection.');
    this.started = true;
    this.callbacks.onStatus('connecting');
    this.audio = this.dependencies.createAudio();
    this.protocol = new VoiceProtocol({
      ...this.callbacks,
      send: (event) => this.send(event),
      executeTool: options.executeTool,
      cancelPending: options.cancelPending,
      playAudio: (data) => this.audio?.play(data),
      stopAudio: () => this.audio?.stopPlayback(),
      onError: (message) => this.fail(message),
    });
    let stage: 'audio' | 'token' | 'connection' = 'audio';
    try {
      await this.audio.prepare(options.microphone, (audio) => {
        // Media may be acquired before connect; no samples leave before readiness.
        if (this.ready && !this.ended) this.send({ type: 'input.audio', audio });
      }, (message) => this.callbacks.onWarning?.(message), () => this.protocol?.playbackDrained(), (active) => this.callbacks.onMicrophone?.(active));
      if (this.ended) return;
      stage = 'token';
      const credentials = typeof options.token === 'function'
        ? await options.token()
        : { token: options.token, config: options.config };
      if (this.ended) return;
      if (!credentials.token || !credentials.config || 'agent_id' in credentials.config) throw new Error('Invalid connection configuration.');
      stage = 'connection';
      const url = new URL('wss://agents.assemblyai.com/v1/ws');
      url.searchParams.set('token', credentials.token);
      const socket = this.dependencies.createSocket(url);
      this.socket = socket;
      const established = new Promise<void>((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
      this.handshakeTimer = setTimeout(() => this.fail('The voice connection timed out. End the call and try again.'), this.dependencies.handshakeMs ?? 15_000);
      // Also cap startup: the watchdog starts when the socket is created.
      const cap = Math.max(1, Math.min(600, options.maxSessionSeconds ?? 600));
      this.durationTimer = setTimeout(() => {
        this.callbacks.onWarning?.('The development call time limit was reached. Reconnect to continue.');
        void this.stop();
      }, cap * 1000);
      socket.onopen = () => {
        if (this.ended) { socket.send(JSON.stringify({ type: 'session.end' })); socket.close(); return; }
        this.send({ type: 'session.update', session: credentials.config });
      };
      socket.onmessage = ({ data }) => this.receive(data);
      socket.onerror = () => this.fail('The voice connection failed. Check your network and reconnect.');
      socket.onclose = () => {
        this.resolveClosed?.();
        if (!this.ended && !this.cleanEnd) this.fail('The voice connection was lost. Actions stopped. Reconnect to continue.');
        else void this.stop();
      };
      await established;
    } catch (error) {
      if (this.ended) throw new Error('The voice connection did not start.');
      const message = stage === 'audio' ? microphoneError(error)
        : stage === 'token' ? 'Live voice is unavailable. Check the server API key and network connection, then reconnect.'
          : 'The voice connection could not start. Check your network and configuration.';
      this.fail(message);
      await this.stop();
      throw new Error(message);
    }
  }

  sendText(text: string): boolean {
    const content = text.trim();
    if (!this.ready || this.ended || !content || content.length > 2000 || !this.protocol) return false;
    const protocol = this.protocol;
    const sequence = ++this.textSequence;
    this.callbacks.onTranscript({ id: `typed:${sequence}`, role: 'human', text, final: true });
    void protocol.interrupt().then(() => {
      if (!this.ready || this.ended || !protocol.ready) return;
      // Current reference documents these messages, not an input.text event.
      // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference
      this.send({ type: 'conversation.message', role: 'user', content });
      this.send({ type: 'reply.create' });
      this.callbacks.onStatus('responding');
    });
    return true;
  }

  end(): Promise<void> { return this.stop(); }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.ended = true;
    this.ready = false;
    clearTimeout(this.handshakeTimer);
    clearTimeout(this.durationTimer);
    this.rejectReady?.(new Error('The call ended before it was ready.'));
    this.rejectReady = undefined;
    this.audio?.stopPlayback();
    this.callbacks.onMicrophone?.(false);
    const socket = this.socket;
    this.stopping = (async () => {
      const cleanup = [this.protocol?.stop(), this.audio?.close()];
      if (socket?.readyState === 1) {
        // session.end terminates billing without the ordinary 30-second resume grace.
        // Bounded fallback is needed when the network can no longer acknowledge it.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const closed = new Promise<void>((resolve) => {
          this.resolveClosed = resolve;
          timer = setTimeout(resolve, this.dependencies.endGraceMs ?? 1500);
        });
        try { socket.send(JSON.stringify({ type: 'session.end' })); } catch { /* Best effort after a network drop. */ }
        await closed;
        clearTimeout(timer);
      }
      try { socket?.close(); } catch { /* Already closed. */ }
      if (socket) socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      await Promise.allSettled(cleanup);
      this.callbacks.onStatus('ended');
    })();
    return this.stopping;
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') return;
    let event: ProviderEvent;
    try { event = JSON.parse(data) as ProviderEvent; }
    catch { this.fail('The voice service sent an unreadable response. Reconnect to continue.'); return; }
    if (!event || typeof event.type !== 'string') return;
    if (event.type === 'session.ended') {
      this.cleanEnd = true;
      this.resolveClosed?.();
      void this.stop();
      return;
    }
    if (this.ended) return;
    if (event.type === 'session.error') {
      // Provider messages/config echoes can contain credentials or private details.
      this.fail('The voice service rejected this session. Check the server API key and session configuration.');
      return;
    }
    if (event.type === 'session.ready') {
      this.ready = true;
      clearTimeout(this.handshakeTimer);
      this.resolveReady?.();
      this.rejectReady = undefined;
    }
    try { this.protocol?.receive(event); }
    catch { this.fail('Voice playback or event processing failed. End the call and reconnect.'); }
  }

  private send(event: Record<string, unknown>): void {
    if (!this.ended && this.socket?.readyState === 1) this.socket.send(JSON.stringify(event));
  }

  private fail(message: string): void {
    if (this.ended) return;
    this.callbacks.onError(message);
    this.callbacks.onStatus('error');
    void this.stop();
  }
}
