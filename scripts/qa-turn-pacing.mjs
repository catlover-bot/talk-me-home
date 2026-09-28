import { audioSnapshot, queueSpeech } from './qa-browser-instrumentation.mjs';

// Scheduling only: no tool arguments/results or game state enter this predicate.
// The finite quiet window observes late events; it is not a protocol guarantee
// that an arbitrarily delayed future event can never arrive.
export function turnCycleStatus(snapshot, { afterMs = -1, mode = 'voice', requireReply = true, quietMs = 450 } = {}) {
  const events = snapshot.events.filter(event => event.atMs > afterMs);
  const pending = reason => ({ settled: false, reason });
  const last = type => events.findLast(event => event.type === type);
  const fixture = last('synthetic.speech.queued');
  if (mode === 'voice' && fixture) {
    if (snapshot.activeSources || !events.some(event => event.type === 'synthetic.speech.drained' && event.id === fixture.id && event.atMs >= fixture.atMs)) return pending('input_waveform_not_drained');
  }
  const user = mode === 'text' ? events.findLast(event => event.type === 'conversation.message' && event.role === 'human') : last('transcript.user');
  if (afterMs >= 0 && !user) return pending('input_not_observed');
  const started = last('input.speech.started');
  if (started && (!last('input.speech.stopped') || last('input.speech.stopped').atMs < started.atMs)) return pending('asr_turn_open');
  const partial = last('transcript.user.delta');
  if (partial && (!user || partial.atMs > user.atMs)) return pending('asr_final_pending');
  const calls = events.filter(event => event.type === 'tool.call');
  if (calls.some(call => !events.some(event => event.type === 'tool.result' && event.callRef === call.callRef && event.atMs >= call.atMs))) return pending('tool_result_pending');
  const openReplies = new Map();
  for (const event of events) {
    if (event.type === 'reply.started') openReplies.set(event.replyRef ?? 'unidentified', event);
    if (event.type === 'reply.done') {
      if (event.replyRef !== undefined) openReplies.delete(event.replyRef);
      else if (openReplies.size === 1) openReplies.clear();
      // Observed provider variant: ordinary reply.started R, canonical fc-C
      // completion, late tool.call C. Treat a sole open reply as finished only
      // after the shipped protocol has actually delivered that C result.
      if (openReplies.size === 1 && event.callRef !== undefined && calls.some(call => call.callRef === event.callRef) && events.some(result => result.type === 'tool.result' && result.callRef === event.callRef && result.atMs >= event.atMs)) openReplies.clear();
    }
  }
  if (openReplies.size) return pending('reply_pending');
  // The last occurrence matters when the provider reuses a reply ID.
  const reply = last('reply.started');
  const done = last('reply.done');
  if (reply && (!done || done.atMs < reply.atMs || reply.replyRef !== undefined && done.replyRef !== undefined && done.replyRef !== reply.replyRef)) return pending('reply_pending');
  const boundary = Math.max(user?.atMs ?? afterMs, last('tool.result')?.atMs ?? afterMs);
  const final = events.findLast(event => event.type === 'transcript.agent' && event.final && !event.interrupted && event.atMs > boundary);
  if (requireReply && (!final || !done || done.atMs < final.atMs || ['interrupted', 'cancelled', 'failed'].includes(done.status) || final.reference !== undefined && done.replyRef !== undefined && final.reference !== done.replyRef)) return pending('final_response_pending');
  if (snapshot.playbackPending) return pending('playback_not_drained');
  if (events.some(event => event.type === 'session.error')) return pending('provider_error');
  const relevant = events.filter(event => /^(?:input\.speech|transcript\.|reply\.|tool\.|playback\.|synthetic\.speech\.|conversation\.message)/.test(event.type));
  const latest = Math.max(afterMs, ...relevant.map(event => event.atMs));
  if (snapshot.elapsedMs - latest < quietMs) return pending('late_event_observation_window');
  return { settled: true, reason: requireReply ? 'response_and_playback_drained' : 'wait_input_drained', asrItems: events.filter(event => event.type === 'transcript.user').length };
}

export async function waitForTurn(page, options = {}) {
  const { timeoutMs = 40_000, ...cycle } = options;
  const deadline = performance.now() + timeoutMs;
  let status;
  do {
    status = turnCycleStatus(await audioSnapshot(page), cycle);
    if (status.settled) return status;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (performance.now() < deadline);
  throw new Error(`QA turn stalled: ${status.reason}`);
}

/** Read-only scheduling before the next user input. */
export function preSubmitStatus(snapshot, { mode = 'voice', confirmation } = {}) {
  if (snapshot.events.some(event => event.type === 'session.error')) return { settled: false, reason: 'provider_error', fatal: true };
  if (snapshot.events.some(event => ['session.end', 'session.ended', 'socket.close'].includes(event.type))) return { settled: false, reason: 'session_ended', fatal: true };
  const status = turnCycleStatus(snapshot, { mode, requireReply: false });
  if (!status.settled) return status;
  const result = snapshot.events.findLast(event => event.type === 'tool.result');
  if (result) {
    const final = snapshot.events.findLast(event => event.type === 'transcript.agent' && event.final && !event.interrupted && event.atMs > result.atMs);
    const done = final && snapshot.events.findLast(event => event.type === 'reply.done' && event.atMs >= final.atMs && !['interrupted', 'cancelled', 'failed'].includes(event.status) && (final.reference === undefined || event.replyRef === undefined || final.reference === event.replyRef));
    if (!done) return { settled: false, reason: 'tool_continuation_pending' };
  }
  const acknowledgements = snapshot.events.filter(event => event.type === 'reply.create' && event.purpose === 'decision_acknowledgement');
  const acknowledgement = acknowledgements.at(-1);
  let cancelled = false; let expired = false;
  if (acknowledgement) {
    const events = snapshot.events.filter(event => event.atMs > acknowledgement.atMs);
    const started = events.findLast(event => event.type === 'reply.started');
    if (!started) return { settled: false, reason: 'acknowledgement_response_pending' };
    const done = events.findLast(event => event.type === 'reply.done' && event.atMs >= started.atMs && event.replyRef !== undefined && event.replyRef === started.replyRef);
    cancelled = Boolean(done && ['cancelled', 'interrupted'].includes(done.status));
    if (done?.status === 'failed') return { settled: false, reason: 'acknowledgement_failed', fatal: true };
    // A sent request is not a completed reply. This also includes subsequent
    // tool continuations and actual playback, without inventing provider ACKs.
    const response = turnCycleStatus({ ...snapshot, events }, { mode, requireReply: !cancelled });
    if (!response.settled) return response;
  }
  if (confirmation) {
    const receipt = snapshot.events.findLast(event => event.type === 'conversation.message' && event.purpose === 'decision_receipt' && event.atMs >= confirmation.confirmationRequestedAtMs);
    const requested = acknowledgements.some(event => event.atMs >= confirmation.confirmationRequestedAtMs && (!receipt || event.proposalRef === receipt.proposalRef));
    if (!requested && snapshot.elapsedMs < confirmation.confirmedAtMs + 4000) return { settled: false, reason: 'acknowledgement_opportunity_pending' };
    expired = !requested;
  }
  return { ...status, reason: expired ? 'acknowledgement_opportunity_expired' : acknowledgement ? cancelled ? 'acknowledgement_cancelled_and_drained' : 'acknowledgement_and_playback_drained' : status.reason };
}

export async function waitBeforePlayerTurn(page, { timeoutMs = 40_000, ...options } = {}) {
  const deadline = performance.now() + timeoutMs;
  let status; let startedAtMs; let endedAtMs;
  const observation = () => ({ ...status, startedAtMs, endedAtMs, waitedMs: endedAtMs - startedAtMs });
  do {
    const snapshot = await audioSnapshot(page); startedAtMs ??= snapshot.elapsedMs; endedAtMs = snapshot.elapsedMs;
    status = preSubmitStatus(snapshot, options);
    if (status.fatal) throw Object.assign(new Error(`QA pre-submit stopped: ${status.reason}`), { preSubmit: observation() });
    if (status.settled) return observation();
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (performance.now() < deadline);
  throw Object.assign(new Error(`QA pre-submit stalled: ${status.reason}`), { preSubmit: observation() });
}

/** The exact UI input path shared by offline replay and the future gated player. */
export async function submitPlayerTurn(page, { mode, text, fixture }) {
  if (mode === 'text') {
    if ((await audioSnapshot(page)).activeTracks) throw new Error('Live Text unexpectedly acquired a microphone.');
    await page.getByLabel('Type a message', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
  } else if (mode === 'voice' && fixture) await queueSpeech(page, fixture);
  else throw new Error('A voice turn requires a validated local fixture.');
}
