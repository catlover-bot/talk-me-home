export interface TranscriptEntry {
  id: string;
  role: 'human' | 'robot';
  text: string;
  final: boolean;
  interrupted?: boolean;
}

export interface ToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type VoiceStatus = 'connecting' | 'listening' | 'responding' | 'speaking' | 'ended' | 'error';
export type ProviderEvent = Record<string, unknown> & { type: string };

// Deliberately excludes provider IDs, arguments, transcripts, and credentials.
export interface ProtocolDiagnostic {
  event: 'tool.queued' | 'reply.completed' | 'tool.execute.started' | 'tool.execute.finished' | 'tool.result.sent';
  pendingCalls: number;
  matchedToolReply?: boolean;
  replyAlreadyDone?: boolean;
}

export interface ProtocolHooks {
  send(event: Record<string, unknown>): void;
  executeTool(call: ToolCall, signal: AbortSignal): Promise<unknown>;
  cancelPending(): Promise<void>;
  onTranscript(entry: TranscriptEntry): void;
  onStatus(status: VoiceStatus): void;
  onError(message: string): void;
  playAudio(data: string): void;
  stopAudio(): void;
  onDiagnostic?(event: ProtocolDiagnostic): void;
}

const tools = new Set(['observe_room', 'inspect_object', 'interact_object', 'move_to']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function appendWord(previous: string, delta: string): string {
  if (!previous || !delta || /\s$/.test(previous) || /^\s/.test(delta) || /^[.,!?;:')]/.test(delta)) return previous + delta;
  return previous + ' ' + delta;
}

/** Current wire rules: user deltas replace; agent deltas append; finals win. */
export class TranscriptStore {
  readonly entries = new Map<string, TranscriptEntry>();
  accept(event: ProviderEvent): TranscriptEntry | undefined {
    const human = event.type === 'transcript.user' || event.type === 'transcript.user.delta';
    const robot = event.type === 'transcript.agent' || event.type === 'transcript.agent.delta';
    if (!human && !robot) return;
    const key = human ? event.item_id : event.reply_id;
    if (typeof key !== 'string') return;
    const id = `${human ? 'human' : 'robot'}:${key}`;
    const previous = this.entries.get(id);
    const final = !event.type.endsWith('.delta');
    if (previous?.final && !final) return;
    const chunk = human || final ? event.text : event.delta;
    if (typeof chunk !== 'string') return;
    const entry: TranscriptEntry = {
      id, role: human ? 'human' : 'robot',
      text: robot && !final ? appendWord(previous?.text ?? '', chunk) : chunk,
      final,
      ...(robot && final && event.interrupted === true ? { interrupted: true } : {}),
    };
    this.entries.set(id, entry);
    return entry;
  }
}

interface PendingTool {
  call: ToolCall;
  replyId: string;
  generation: number;
  controller: AbortController;
  replyDone: boolean;
  executing: boolean;
  result?: { result: string; is_error: boolean };
}

/** Contains no network or DOM dependencies, so protocol races can be tested. */
export class VoiceProtocol {
  readonly transcripts = new TranscriptStore();
  ready = false;
  private stopped = false;
  private generation = 0;
  private latestType = '';
  private currentReply = '';
  private interruptedReplies = new Set<string>();
  private calls = new Map<string, PendingTool>();
  private seenCalls = new Set<string>();
  private completedReplies = new Set<string>();
  private cancellation: Promise<void> = Promise.resolve();
  private stopping?: Promise<void>;
  private pendingReply = false;
  private audioPlaying = false;

  constructor(private readonly hooks: ProtocolHooks) {}

  receive(event: ProviderEvent): void {
    if (this.stopped) return;
    // The official client-side-tools example tracks turn transitions only.
    // Delayed captions/audio do not reopen a finished turn.
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools
    if (['reply.started', 'input.speech.started', 'reply.done'].includes(event.type)) this.latestType = event.type;
    if (event.type === 'session.ready') {
      this.ready = true;
      this.hooks.onStatus('listening');
      return;
    }
    if (!this.ready) return;
    if (event.type === 'input.speech.started') {
      void this.interrupt();
      this.hooks.onStatus('listening');
      return;
    }
    if (event.type === 'reply.started' && typeof event.reply_id === 'string') {
      this.currentReply = event.reply_id;
      this.pendingReply = true;
      this.hooks.onStatus('responding');
    } else if (event.type === 'reply.audio' && typeof event.data === 'string') {
      if (!this.currentReply || this.interruptedReplies.has(this.currentReply)) return;
      this.audioPlaying = true;
      this.hooks.onStatus('speaking');
      this.hooks.playAudio(event.data);
    } else if (event.type === 'tool.call') {
      this.queueTool(event);
    } else if (event.type === 'reply.done') {
      if (event.status === 'interrupted') {
        if (typeof event.reply_id === 'string') this.interruptedReplies.add(event.reply_id);
        void this.interrupt();
      } else if (typeof event.reply_id === 'string') {
        if (!this.interruptedReplies.has(event.reply_id)) this.completedReplies.add(event.reply_id);
        let matchedToolReply = false;
        for (const pending of this.calls.values()) {
          if (pending.replyId === event.reply_id || `fc-${pending.call.callId}` === event.reply_id) {
            pending.replyDone = true;
            matchedToolReply = true;
          }
        }
        this.hooks.onDiagnostic?.({ event: 'reply.completed', pendingCalls: this.calls.size, matchedToolReply });
        this.flush();
      }
      if (event.reply_id === this.currentReply) this.pendingReply = false;
      if (!this.audioPlaying && !this.pendingReply) this.hooks.onStatus('listening');
    }
    if (typeof event.reply_id === 'string' && this.interruptedReplies.has(event.reply_id) && event.type === 'transcript.agent.delta') return;
    const entry = this.transcripts.accept(event);
    if (entry) this.hooks.onTranscript(entry);
  }

  playbackDrained(): void {
    this.audioPlaying = false;
    if (!this.stopped && this.ready && !this.pendingReply) this.hooks.onStatus('listening');
  }

  /** Epoch invalidation races with commits on the server; committed work stays. */
  interrupt(): Promise<void> {
    this.generation++;
    this.latestType = 'interruption';
    if (this.currentReply) this.interruptedReplies.add(this.currentReply);
    this.hooks.stopAudio();
    this.audioPlaying = false;
    this.pendingReply = false;
    for (const pending of this.calls.values()) pending.controller.abort();
    this.calls.clear();
    this.completedReplies.clear();
    // Serialize cancellation requests so an older response cannot replace a new epoch.
    this.cancellation = this.cancellation.then(() => this.hooks.cancelPending()).catch(() => {
      this.stopped = true;
      this.ready = false;
      this.hooks.onError('Could not confirm that pending actions stopped. End the call and reconnect.');
    });
    return this.cancellation;
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopped = true;
    this.ready = false;
    this.stopping = this.interrupt();
    return this.stopping;
  }

  private queueTool(event: ProviderEvent): void {
    if (typeof event.call_id !== 'string' || typeof event.name !== 'string' || !isRecord(event.arguments)) {
      this.hooks.onError('The voice service sent an invalid tool request. End the call and reconnect.');
      return;
    }
    if (this.seenCalls.has(event.call_id)) return;
    this.seenCalls.add(event.call_id);
    if (this.interruptedReplies.has(`fc-${event.call_id}`) || this.interruptedReplies.has(this.currentReply)) return;
    const call = { callId: event.call_id, name: event.name, arguments: event.arguments };
    // Live validation also observed ordinary reply IDs for tool-call replies.
    // Bind to the active reply, retaining the documented fc-<call_id> fallback.
    const replyId = this.currentReply || `fc-${call.callId}`;
    const replyDone = this.completedReplies.has(replyId) || this.completedReplies.has(`fc-${call.callId}`);
    this.calls.set(call.callId, {
      call, replyId, generation: this.generation, controller: new AbortController(), replyDone, executing: false,
    });
    this.hooks.onDiagnostic?.({ event: 'tool.queued', pendingCalls: this.calls.size, replyAlreadyDone: replyDone });
    // The documented sequence allows reply.done before tool.call; drain here too.
    this.flush();
  }

  private flush(): void {
    if (this.stopped || this.latestType !== 'reply.done') return;
    for (const [id, pending] of this.calls) {
      if (!pending.replyDone) continue;
      if (pending.result) {
        this.hooks.send({ type: 'tool.result', call_id: id, ...pending.result });
        this.calls.delete(id);
        this.hooks.onDiagnostic?.({ event: 'tool.result.sent', pendingCalls: this.calls.size });
      } else if (!pending.executing) {
        pending.executing = true;
        void this.execute(pending);
      }
    }
  }

  private async execute(pending: PendingTool): Promise<void> {
    await this.cancellation;
    if (!this.valid(pending)) return;
    this.hooks.onDiagnostic?.({ event: 'tool.execute.started', pendingCalls: this.calls.size });
    try {
      const result = tools.has(pending.call.name)
        ? await this.hooks.executeTool(pending.call, pending.controller.signal)
        : { ok: false, message: 'That local tool is not available.' };
      if (!this.valid(pending)) return;
      // Never forward HumanView or arbitrary transport diagnostics into the model.
      const safe = isRecord(result) && typeof result.ok === 'boolean' && typeof result.message === 'string'
        ? { ok: result.ok, message: result.message }
        : { ok: false, message: 'The local action result could not be verified. Observe again before acting.' };
      pending.result = { result: JSON.stringify(safe), is_error: !safe.ok };
    } catch {
      if (!this.valid(pending)) return;
      pending.result = { result: JSON.stringify({ ok: false, message: 'The action result could not be confirmed. Observe again before acting.' }), is_error: true };
    }
    this.hooks.onDiagnostic?.({ event: 'tool.execute.finished', pendingCalls: this.calls.size });
    this.flush();
  }

  private valid(pending: PendingTool): boolean {
    return !this.stopped && !pending.controller.signal.aborted && pending.generation === this.generation;
  }
}
