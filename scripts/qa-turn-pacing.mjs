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
  const user = mode === 'text' ? last('conversation.message') : last('transcript.user');
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

/** The exact UI input path shared by offline replay and the future gated player. */
export async function submitPlayerTurn(page, { mode, text, fixture }) {
  if (mode === 'text') {
    if ((await audioSnapshot(page)).activeTracks) throw new Error('Live Text unexpectedly acquired a microphone.');
    await page.getByLabel('Type a message', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
  } else if (mode === 'voice' && fixture) await queueSpeech(page, fixture);
  else throw new Error('A voice turn requires a validated local fixture.');
}
