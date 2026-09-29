import type { HumanView, RobotLocalPerception } from '../shared/contracts';
import { currentRobotPerception } from './robot-perception';

export interface TranscriptEntry {
  id: string;
  role: 'human' | 'robot' | 'game';
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
export type VoiceInputState = 'inactive' | 'ready' | 'receiving';
export type CancellationReason = 'interrupt' | 'supersede' | 'stop';
export interface ReplyCompletion { id: string; status: string; hasTools: boolean }
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
  /** Capture trusted app context when the provider request arrives, not at execution. */
  captureToolContext?(): unknown;
  executeTool(call: ToolCall, signal: AbortSignal, context?: unknown): Promise<unknown>;
  cancelPending(reason: CancellationReason): Promise<void>;
  onTranscript(entry: TranscriptEntry, context?: unknown): void;
  onStatus(status: VoiceStatus): void;
  onError(message: string): void;
  playAudio(data: string): void;
  stopAudio(): void;
  onPlayback?(active: boolean): void;
  onInputState?(state: VoiceInputState): void;
  onToolState?(active: boolean): void;
  onReplyDone?(reply: ReplyCompletion): void;
  onDiagnostic?(event: ProtocolDiagnostic): void;
  onBoundaryChange?(): void;
}

const tools = new Set(['observe_room', 'inspect_object', 'propose_interaction', 'propose_move', 'get_action_status', 'interact_object', 'move_to']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function appendWord(previous: string, delta: string): string {
  if (!previous || !delta || /\s$/.test(previous) || /^\s/.test(delta) || /^[.,!?;:')]/.test(delta)) return previous + delta;
  return previous + ' ' + delta;
}

/** Current wire rules: user deltas replace; agent deltas append; finals win. */
export class TranscriptStore {
  readonly entries = new Map<string, TranscriptEntry>();
  private locallyInterrupted = new Set<string>();
  interrupt(replyId: string): TranscriptEntry | undefined {
    const id = `robot:${replyId}`;
    this.locallyInterrupted.add(id);
    const previous = this.entries.get(id);
    if (!previous) return;
    const entry = { ...previous, final: true, interrupted: true };
    this.entries.set(id, entry);
    return entry;
  }
  accept(event: ProviderEvent): TranscriptEntry | undefined {
    const human = event.type === 'transcript.user' || event.type === 'transcript.user.delta';
    const robot = event.type === 'transcript.agent' || event.type === 'transcript.agent.delta';
    if (!human && !robot) return;
    const key = human ? event.item_id : event.reply_id;
    if (typeof key !== 'string') return;
    const id = `${human ? 'human' : 'robot'}:${key}`;
    // Local interruption cannot use later provider text to invent delivered words.
    if (this.locallyInterrupted.has(id)) return;
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
  context?: unknown;
  replyId: string;
  generation: number;
  controller: AbortController;
  replyDone: boolean;
  executing: boolean;
  started?: boolean;
  result?: { result: string; is_error: boolean };
}

interface InterruptedTool {
  replyId: string;
  replyDone: boolean;
  waiting: boolean;
  /** A call known before input may finish; its original call ID stays attached. */
  retained?: PendingTool;
  result?: { result: string; is_error: boolean };
  outcomePending?: boolean;
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
  private completedInterruptedReplies = new Set<string>();
  private completedWindows = new Map<string, { replyId: string; generation: number; transition: number }>();
  private transition = 0;
  // Canceled call references retain identity/outcomes, never execution authority.
  private interruptedCalls = new Map<string, InterruptedTool>();
  private recoveryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private cancellation: Promise<void> = Promise.resolve();
  private stopping?: Promise<void>;
  private pendingReply = false;
  private audioPlaying = false;
  private held = false;
  private toolReplies = new Set<string>();
  private executingCount = 0;
  private closingReply?: string;
  private transcriptContexts = new Map<string, unknown>();
  private speechContext?: unknown;
  private inputActive = false;
  private awaitingToolContinuation = false;
  private cancellationPending = 0;

  constructor(private readonly hooks: ProtocolHooks) {}

  /** Application replies share the existing turn/tool/playback boundary. */
  get acknowledgementReady(): boolean {
    return this.ready && !this.stopped && !this.held && !this.closingReply && !this.inputActive && this.latestType === 'reply.done'
      && !this.pendingReply && !this.audioPlaying && !this.awaitingToolContinuation
      && this.cancellationPending === 0 && this.calls.size === 0 && this.interruptedCalls.size === 0;
  }

  applicationReplyRequested(): void {
    this.pendingReply = true;
    this.hooks.onStatus('responding');
  }

  receive(event: ProviderEvent): void {
    if (this.stopped) return;
    if (event.type === 'reply.started' || event.type === 'input.speech.started') this.transition++;
    const currentCompletion = event.type === 'reply.done' && typeof event.reply_id === 'string'
      && (event.reply_id === this.currentReply || [...this.calls, ...this.interruptedCalls].some(([id, pending]) =>
        pending.replyId === this.currentReply && `fc-${id}` === event.reply_id)
        || (!this.currentReply && [...this.calls.values()].some(pending => pending.replyId === event.reply_id)));
    // The official client-side-tools example tracks turn transitions only.
    // Delayed captions/audio do not reopen a finished turn.
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools
    if (event.type === 'reply.started' || event.type === 'input.speech.started'
      || currentCompletion) this.latestType = event.type;
    if (event.type === 'session.ready') {
      this.ready = true;
      this.hooks.onStatus('listening');
      return;
    }
    if (!this.ready) return;
    if (this.closingReply) {
      if (event.type === 'tool.call') return;
      if (event.type === 'reply.started' && event.reply_id !== this.closingReply) {
        // Audio has no reply ID: a later rejected reply also closes its audio gate.
        this.currentReply = '';
        return;
      }
      if (typeof event.reply_id === 'string' && event.reply_id !== this.closingReply && (event.type.startsWith('reply.') || event.type.startsWith('transcript.agent'))) return;
    }
    if (event.type === 'input.speech.started') {
      this.held = false;
      this.inputActive = true;
      this.speechContext = this.hooks.captureToolContext?.();
      void this.beginInput();
      this.hooks.onInputState?.('receiving');
      this.hooks.onStatus('listening');
      return;
    }
    if (event.type === 'input.speech.stopped') {
      this.inputActive = false;
      this.hooks.onInputState?.('ready');
      this.flush();
    }
    if (this.held && ['reply.started', 'reply.audio', 'transcript.agent.delta', 'transcript.agent'].includes(event.type)) return;
    if (event.type === 'reply.started' && typeof event.reply_id === 'string') {
      this.awaitingToolContinuation = false;
      this.currentReply = event.reply_id;
      this.rememberTranscriptContext(`robot:${event.reply_id}`, this.hooks.captureToolContext?.());
      this.pendingReply = true;
      this.hooks.onStatus('responding');
    } else if (event.type === 'reply.audio' && typeof event.data === 'string') {
      if (!this.currentReply || this.interruptedReplies.has(this.currentReply)) return;
      // Receiving bytes is not evidence that the output device rendered them.
      this.hooks.playAudio(event.data);
    } else if (event.type === 'tool.call') {
      this.queueTool(event);
    } else if (event.type === 'reply.done') {
      if (event.status === 'interrupted') {
        if (typeof event.reply_id === 'string') {
          this.interruptedReplies.add(event.reply_id);
          // A delayed old completion cannot invalidate a newer response's work.
          if (currentCompletion) void this.interrupt(this.held, false);
          this.discardReply(event.reply_id);
        }
      } else if (typeof event.reply_id === 'string') {
        if (event.status === 'completed') {
          this.completedWindows.set(event.reply_id, { replyId: this.currentReply, generation: this.generation, transition: this.transition });
          if (this.completedWindows.size > 200) this.completedWindows.delete(this.completedWindows.keys().next().value!);
        }
        if (!this.interruptedReplies.has(event.reply_id)) this.completedReplies.add(event.reply_id);
        else if (event.status === 'completed') this.completedInterruptedReplies.add(event.reply_id);
        let matchedToolReply = false;
        for (const pending of this.calls.values()) {
          if (pending.replyId === event.reply_id || `fc-${pending.call.callId}` === event.reply_id) {
            pending.replyDone = true;
            matchedToolReply = true;
          }
        }
        if (event.status === 'completed') for (const [id, pending] of this.interruptedCalls) {
          if (pending.replyId === event.reply_id || `fc-${id}` === event.reply_id) pending.replyDone = true;
        }
        this.hooks.onDiagnostic?.({ event: 'reply.completed', pendingCalls: this.calls.size, matchedToolReply });
        this.flush();
      }
      if (currentCompletion) this.pendingReply = false;
      if (!this.audioPlaying && !this.pendingReply) this.hooks.onStatus('listening');
      if (typeof event.reply_id === 'string') this.hooks.onReplyDone?.({ id: event.reply_id, status: String(event.status ?? ''), hasTools: this.toolReplies.has(event.reply_id) });
    }
    if (typeof event.reply_id === 'string' && this.interruptedReplies.has(event.reply_id) && event.type === 'transcript.agent.delta') return;
    const entry = this.transcripts.accept(event);
    if (entry) {
      if (!this.transcriptContexts.has(entry.id)) this.rememberTranscriptContext(entry.id,
        entry.role === 'human' ? this.speechContext ?? this.hooks.captureToolContext?.() : this.hooks.captureToolContext?.());
      this.hooks.onTranscript(entry, this.transcriptContexts.get(entry.id));
    }
    this.hooks.onBoundaryChange?.();
  }

  playbackChanged(active: boolean): void {
    this.audioPlaying = active && !this.stopped && !this.held;
    this.hooks.onPlayback?.(this.audioPlaying);
    if (this.audioPlaying) this.hooks.onStatus('speaking');
    else if (!this.stopped && this.ready) this.hooks.onStatus(this.pendingReply ? 'responding' : 'listening');
    this.hooks.onBoundaryChange?.();
  }

  playbackDrained(): void {
    this.playbackChanged(false);
    if (!this.stopped && this.ready && !this.pendingReply) this.hooks.onStatus('listening');
  }

  resumeInput(): void { this.held = false; }

  /** An ordinary new turn cancels uncertain work without revoking a ready grant. */
  beginInput(): Promise<void> {
    // Early playback flush is not the provider's semantic interruption signal.
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions
    return this.interrupt(false, true, 'supersede');
  }

  /** Preserve only the closing reply while its already queued playback drains. */
  finishReply(replyId: string): void { this.closingReply ??= replyId; }

  /** Epoch invalidation races with commits on the server; committed work stays. */
  interrupt(hold = false, truncate = true, reason: CancellationReason = 'interrupt'): Promise<void> {
    this.held = hold;
    this.generation++;
    this.latestType = 'interruption';
    if (this.currentReply) this.interruptedReplies.add(this.currentReply);
    const currentTranscript = this.transcripts.entries.get(`robot:${this.currentReply}`);
    if (truncate && this.currentReply && (this.pendingReply || this.audioPlaying || currentTranscript?.final === false)) {
      const entry = this.transcripts.interrupt(this.currentReply);
      if (entry) this.hooks.onTranscript(entry, this.transcriptContexts.get(entry.id));
    }
    this.hooks.stopAudio();
    this.audioPlaying = false;
    this.hooks.onPlayback?.(false);
    this.hooks.onToolState?.(false);
    this.executingCount = 0;
    this.pendingReply = false;
    this.awaitingToolContinuation = false;
    for (const [id, pending] of this.calls) {
      // Speech can race the HTTP response after a physical commit. Preserve its
      // eventual outcome, not its permission to execute, until safe delivery.
      if (reason !== 'stop') this.interruptedCalls.set(id, {
        replyId: pending.replyId, replyDone: pending.replyDone, waiting: false,
        retained: pending, result: pending.result,
        outcomePending: !!pending.started && !pending.result,
      });
      pending.controller.abort();
    }
    this.calls.clear();
    this.completedReplies.clear();
    if (reason === 'stop') {
      this.interruptedCalls.clear();
      for (const timer of this.recoveryTimers.values()) clearTimeout(timer);
      this.recoveryTimers.clear();
    }
    this.completedInterruptedReplies.clear();
    // Serialize cancellation requests so an older response cannot replace a new epoch.
    this.cancellationPending++;
    this.cancellation = this.cancellation.then(() => this.hooks.cancelPending(reason)).catch(() => {
      this.stopped = true;
      this.ready = false;
      this.hooks.onError('Could not confirm that pending actions stopped. End the call and reconnect.');
    }).finally(() => {
      this.cancellationPending--;
      this.hooks.onBoundaryChange?.();
    });
    return this.cancellation;
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopped = true;
    this.ready = false;
    this.hooks.onInputState?.('inactive');
    this.stopping = this.interrupt(false, true, 'stop');
    return this.stopping;
  }

  private queueTool(event: ProviderEvent): void {
    if (typeof event.call_id !== 'string' || typeof event.name !== 'string' || !isRecord(event.arguments)) {
      this.hooks.onError('The voice service sent an invalid tool request. End the call and reconnect.');
      return;
    }
    if (this.seenCalls.has(event.call_id)) return;
    this.seenCalls.add(event.call_id);
    this.watchRecovery(event.call_id);
    const canonical = this.completedWindows.get(`fc-${event.call_id}`);
    const canonicalCurrent = canonical?.replyId === this.currentReply && canonical.generation === this.generation && canonical.transition === this.transition;
    if (canonical && !canonicalCurrent) {
      this.interruptedCalls.set(event.call_id, { replyId: canonical.replyId, replyDone: true, waiting: false });
      return;
    }
    if (canonicalCurrent) {
      // Only the arriving call proves this documented fc-ID association. A new
      // speech/reply transition invalidates the window; never guess across it.
      this.latestType = 'reply.done';
      this.pendingReply = false;
    }
    if (this.held || this.interruptedReplies.has(`fc-${event.call_id}`) || this.interruptedReplies.has(this.currentReply)) {
      // Real speech can split one sentence into two input turns while the
      // provider keeps the first reply ID. A later completed tool call still
      // needs a result, but executing that interrupted request is unsafe.
      // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools
      const replyId = this.interruptedReplies.has(`fc-${event.call_id}`) ? `fc-${event.call_id}` : this.currentReply || `fc-${event.call_id}`;
      // If the old fc-ID arrives during a different reply, never attach it to
      // the new response. The finite recovery deadline ends ambiguous waits.
      this.interruptedCalls.set(event.call_id, { replyId, replyDone: this.completedInterruptedReplies.has(replyId) || canonicalCurrent, waiting: false });
      this.toolReplies.add(replyId);
      this.flush();
      return;
    }
    const call = { callId: event.call_id, name: event.name, arguments: event.arguments };
    // Live validation also observed ordinary reply IDs for tool-call replies.
    // Bind to the active reply, retaining the documented fc-<call_id> fallback.
    const replyId = this.currentReply || `fc-${call.callId}`;
    this.toolReplies.add(replyId);
    const replyDone = this.completedReplies.has(replyId) || canonicalCurrent;
    this.calls.set(call.callId, {
      call, context: this.hooks.captureToolContext?.(), replyId, generation: this.generation, controller: new AbortController(), replyDone, executing: false,
    });
    this.hooks.onDiagnostic?.({ event: 'tool.queued', pendingCalls: this.calls.size, replyAlreadyDone: replyDone });
    // The documented sequence allows reply.done before tool.call; drain here too.
    this.flush();
  }

  private flush(): void {
    if (this.stopped || this.inputActive || this.latestType !== 'reply.done') return;
    if (!this.held && !this.closingReply) for (const [id, pending] of this.interruptedCalls) {
      if (pending.replyDone && !pending.waiting && !pending.outcomePending) {
        pending.waiting = true;
        void this.rejectInterruptedTool(id, pending);
      }
    }
    for (const [id, pending] of this.calls) {
      if (!pending.replyDone) continue;
      if (pending.result) {
        this.awaitingToolContinuation = true;
        this.hooks.send({ type: 'tool.result', call_id: id, ...pending.result });
        this.calls.delete(id);
        this.clearRecovery(id);
        this.hooks.onDiagnostic?.({ event: 'tool.result.sent', pendingCalls: this.calls.size });
      } else if (!pending.executing) {
        // Local actions are atomic and sequential even if a model batches calls.
        if ([...this.calls.values()].some((call) => call.executing && !call.result)) break;
        pending.executing = true;
        void this.execute(pending);
      }
    }
  }

  private async rejectInterruptedTool(id: string, pending: InterruptedTool): Promise<void> {
    const barrier = this.cancellation;
    await barrier;
    pending.waiting = false;
    if (barrier !== this.cancellation) { this.flush(); return; }
    if (this.stopped || this.inputActive || this.held || this.closingReply || (!pending.retained && this.currentReply !== pending.replyId) || this.latestType !== 'reply.done' || this.interruptedCalls.get(id) !== pending) return;
    this.interruptedCalls.delete(id);
    this.clearRecovery(id);
    this.awaitingToolContinuation = true;
    this.hooks.send({ type: 'tool.result', call_id: id, ...(pending.result ?? { is_error: true, result: JSON.stringify({
      ok: false, code: 'cancelled_before_execution',
      message: 'This request belongs to an interrupted reply and was not executed. Respond to the latest player request. If it still requires an action, use a new tool call.',
    }) }) });
    this.hooks.onDiagnostic?.({ event: 'tool.result.sent', pendingCalls: this.calls.size + this.interruptedCalls.size });
  }

  private async execute(pending: PendingTool): Promise<void> {
    await this.cancellation;
    if (!this.valid(pending)) return;
    pending.started = true;
    this.hooks.onDiagnostic?.({ event: 'tool.execute.started', pendingCalls: this.calls.size });
    this.executingCount++;
    this.hooks.onToolState?.(true);
    try {
      const result = tools.has(pending.call.name)
        ? await this.hooks.executeTool(pending.call, pending.controller.signal, pending.context)
        : { ok: false, message: 'That local tool is not available.' };
      // Never forward HumanView or arbitrary transport diagnostics into the model.
      const safe = isRecord(result) && typeof result.ok === 'boolean' && typeof result.message === 'string'
        ? { ok: result.ok, message: result.message,
          ...(result.ok && result.perception ? { perception: currentRobotPerception(result.perception as RobotLocalPerception,
            this.hooks.captureToolContext?.() as Partial<HumanView> | undefined) } : {}),
          ...(result.code === 'awaiting_confirmation' ? { code: 'awaiting_confirmation' } : {}),
          ...(isRecord(result.proposal) && typeof result.proposal.id === 'string'
            && typeof result.proposal.label === 'string' && typeof result.proposal.expiresAt === 'number'
            && ['awaiting_confirmation', 'committed', 'declined', 'expired', 'invalidated', 'failed'].includes(String(result.proposal.status))
            ? { proposal: { id: result.proposal.id, status: result.proposal.status, label: result.proposal.label, expiresAt: result.proposal.expiresAt } } : {}),
          ...(!result.ok ? {
          code: result.code === 'cancelled_before_execution' || result.code === 'outcome_unknown' || result.code === 'not_executed' ? result.code : 'precondition_failed',
        } : {}) }
        : { ok: false, code: 'outcome_unknown', message: 'The local action result could not be verified. Observe again before acting.' };
      this.retainOutcome(pending, { result: JSON.stringify(safe), is_error: !safe.ok });
    } catch {
      const readOnly = ['observe_room', 'inspect_object', 'get_action_status'].includes(pending.call.name);
      this.retainOutcome(pending, { result: JSON.stringify({ ok: false, code: 'outcome_unknown', message: readOnly
        ? 'The read-only check did not return a verified report. This check changed nothing. Explain that the information is unavailable and let the player ask again.'
        : 'The action result could not be confirmed. It may already have committed. Observe current conditions before requesting another action.' }), is_error: true });
    }
    // Superseded executions must not change a newer action's busy indicator.
    if (!this.valid(pending)) { this.flush(); return; }
    this.hooks.onDiagnostic?.({ event: 'tool.execute.finished', pendingCalls: this.calls.size });
    this.executingCount = Math.max(0, this.executingCount - 1);
    this.hooks.onToolState?.(this.executingCount > 0);
    this.flush();
  }

  private valid(pending: PendingTool): boolean {
    return !this.stopped && !pending.controller.signal.aborted && pending.generation === this.generation;
  }

  private retainOutcome(pending: PendingTool, result: { result: string; is_error: boolean }): void {
    if (this.valid(pending)) pending.result = result;
    else {
      const retained = this.interruptedCalls.get(pending.call.callId);
      if (retained?.retained !== pending || this.stopped) return;
      retained.result = result;
      retained.outcomePending = false;
    }
  }

  private clearRecovery(id: string): void {
    clearTimeout(this.recoveryTimers.get(id));
    this.recoveryTimers.delete(id);
  }

  private discardReply(replyId: string): void {
    for (const [id, pending] of this.calls) if (pending.replyId === replyId || `fc-${id}` === replyId) {
      pending.controller.abort(); this.calls.delete(id); this.clearRecovery(id);
    }
    for (const [id, pending] of this.interruptedCalls) if (pending.replyId === replyId || `fc-${id}` === replyId) {
      this.interruptedCalls.delete(id); this.clearRecovery(id);
    }
  }

  private watchRecovery(id: string): void {
    this.recoveryTimers.set(id, setTimeout(() => {
      if (this.stopped) return;
      // Never guess correlation or send a result during a new user turn.
      void this.stop();
      this.hooks.onError('A pending voice action could not be safely resolved. The call has ended; reconnect explicitly to continue.');
    }, 15_000));
  }

  private rememberTranscriptContext(id: string, context: unknown): void {
    if (this.transcriptContexts.has(id)) return;
    this.transcriptContexts.set(id, context);
    if (this.transcriptContexts.size > 200) this.transcriptContexts.delete(this.transcriptContexts.keys().next().value!);
  }
}
