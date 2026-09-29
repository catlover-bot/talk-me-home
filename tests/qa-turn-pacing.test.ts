import test from 'node:test';
import assert from 'node:assert/strict';
import { preSubmitStatus, turnCycleStatus } from '../scripts/qa-turn-pacing.mjs';
import { acquirePlayerReport, passageRequests } from '../scripts/qa-player-recovery.mjs';
import type { AudioSnapshot, QaAudioEvent } from '../scripts/qa-browser-instrumentation.mjs';

const event = (atMs: number, type: string, extra = {}): QaAudioEvent => ({ atMs, type, ...extra });
const snapshot = (events: QaAudioEvent[], extra = {}): AudioSnapshot => ({ label: 'synthetic adversarial scheduling fixture', elapsedMs: 5000, events, activeSources: 0, activeTracks: 1, openApplicationContexts: 2, playbackPending: false, counters: Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(kind => [kind, { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }])) as AudioSnapshot['counters'], ...extra });
const completed = [event(100, 'synthetic.speech.queued', { id: 'split' }), event(200, 'input.speech.started'), event(300, 'input.speech.stopped'), event(310, 'transcript.user', { reference: 1 }), event(320, 'reply.started', { replyRef: 2 }), event(350, 'transcript.agent', { reference: 2, final: true }), event(360, 'reply.done', { replyRef: 2, status: 'completed' })];
const drained = [...completed, event(900, 'synthetic.speech.ended', { id: 'split' }), event(920, 'synthetic.speech.drained', { id: 'split' })];

// Exact retained attempt-eight scheduling metadata, with the input identifier
// replaced by a local alias. No tool arguments, hidden state or invented reply.
const observedEmpty = [
  event(162737.7, 'synthetic.speech.queued', { id: 'attempt-eight-turn-ten' }),
  event(162787.7, 'synthetic.speech.started', { id: 'attempt-eight-turn-ten' }),
  event(164574.4, 'input.speech.started'),
  event(167550.3, 'synthetic.speech.ended', { id: 'attempt-eight-turn-ten' }),
  event(167555.8, 'synthetic.speech.drained', { id: 'attempt-eight-turn-ten' }),
  event(167657.7, 'input.speech.stopped'),
  event(167661.9, 'transcript.user', { reference: 62 }),
  event(167663.6, 'reply.started', { replyRef: 63, itemRef: 64 }),
  event(172057.3, 'reply.done', { replyRef: 63, status: 'completed' }),
];

test('observed completed empty response is explicit non-information after capture and quiet drain', async () => {
  const status = turnCycleStatus(snapshot(observedEmpty, { elapsedMs: 172508 }), { afterMs: 162418.2 });
  assert.deepEqual(status, { settled: true, reason: 'empty_completed_response', usefulReply: false, asrItems: 1 });
  const report: Record<string, any> = {}; const requests: string[] = []; let value: 'clear' | null = null;
  const acquired = await acquirePlayerReport({ subject: 'northeast passage', requests: passageRequests('northeast'), read: () => value, report,
    exchange: async text => {
      requests.push(text);
      if (requests.length === 1) { assert.equal(status.usefulReply, false); return ''; }
      value = 'clear'; return 'The northeast opening is physically clear.';
    } });
  assert.equal(acquired, 'clear'); assert.equal(requests.length, 2);
  assert.match(requests[1]!, /physically clear or blocked/);
  assert.equal(report.acquisitions[0].exchanges[0].reply, '');
  assert.equal(report.acquisitions[0].strictFirstResponse, false); assert.equal(report.acquisitions[0].recovered, true);
});

test('empty completion never excuses partial, interrupted, unrelated, open, tool or audio work', () => {
  const options = { afterMs: 162418.2 };
  const checked = (events: QaAudioEvent[], extra = {}) => turnCycleStatus(snapshot(events, { elapsedMs: 180000, ...extra }), options);
  for (const status of ['interrupted', 'cancelled', 'failed', undefined]) {
    assert.equal(checked(observedEmpty.map(e => e.type === 'reply.done' ? { ...e, status } : e)).settled, false);
  }
  for (const inserted of [
    event(170000, 'transcript.agent.delta', { reference: 63, text: 'Checking' }),
    event(170000, 'transcript.agent', { reference: 63, final: false }),
    event(170000, 'transcript.agent', { reference: 63, final: true, interrupted: true }),
    event(170000, 'tool.call', { callRef: 90 }),
    event(170000, 'tool.result', { callRef: 90 }),
    event(170000, 'reply.started', { replyRef: 90 }),
    event(170000, 'audio.provider.onset'),
    event(170000, 'playback.queued'),
    event(170000, 'session.error'),
  ]) assert.equal(checked([...observedEmpty.slice(0, -1), inserted, observedEmpty.at(-1)!]).settled, false, inserted.type);
  assert.equal(checked(observedEmpty.map(e => e.type === 'reply.done' ? { ...e, replyRef: 90 } : e)).settled, false);
  assert.equal(checked(observedEmpty.map(e => e.type.startsWith('reply.') ? { ...e, replyRef: undefined } : e)).settled, false);
  assert.equal(checked(observedEmpty, { playbackPending: true }).settled, false);
  assert.equal(checked(observedEmpty, { activeSources: 1 }).settled, false);
  assert.equal(checked(observedEmpty, { elapsedMs: 172507.2 }).reason, 'late_event_observation_window');
  assert.equal(checked([...observedEmpty, event(172100, 'input.speech.started')]).reason, 'asr_turn_open');
  assert.equal(checked([...observedEmpty, event(172100, 'transcript.user.delta')]).reason, 'asr_final_pending');
  assert.equal(checked([...observedEmpty, event(172100, 'transcript.user', { reference: 70 })]).settled, false, 'an old completion cannot answer a newer user');
});

test('a prior decision ACK does not trap a subsequent empty response or replace its missing information', () => {
  const prior = [event(900, 'tool.result', { callRef: 1 }), event(1000, 'reply.create', { purpose: 'decision_acknowledgement', proposalRef: 1 }),
    event(1100, 'reply.started', { replyRef: 2 }), event(1200, 'transcript.agent', { reference: 2, final: true, text: 'I am at the Fork emblem.' }), event(1250, 'reply.done', { replyRef: 2, status: 'completed' })];
  const result = preSubmitStatus(snapshot([...prior, ...observedEmpty], { elapsedMs: 180000 }));
  assert.equal(result.settled, true); assert.equal(result.usefulReply, false);
  const pending = preSubmitStatus(snapshot([...prior, ...observedEmpty, event(173000, 'tool.result', { callRef: 99 })], { elapsedMs: 180000 }));
  assert.equal(pending.settled, false); assert.equal(pending.reason, 'tool_continuation_pending');
});

test('an empty completed decision ACK allows the next request but cannot satisfy a later user turn', () => {
  const events = [event(1000, 'reply.create', { purpose: 'decision_acknowledgement', proposalRef: 1 }),
    event(1100, 'reply.started', { replyRef: 2 }), event(1200, 'reply.done', { replyRef: 2, status: 'completed' })];
  const result = preSubmitStatus(snapshot(events));
  assert.equal(result.settled, true); assert.equal(result.usefulReply, false); assert.equal(result.reason, 'empty_completed_response');
  assert.equal(turnCycleStatus(snapshot([...events, event(1500, 'transcript.user', { reference: 3 })]), { afterMs: 1250 }).settled, false);
});

test('one completed ASR/reply pair cannot finish a fixture still playing or awaiting capture drain', () => {
  assert.equal(turnCycleStatus(snapshot(completed), { afterMs: 0 }).reason, 'input_waveform_not_drained');
  assert.equal(turnCycleStatus(snapshot([...completed, event(900, 'synthetic.speech.ended', { id: 'split' })]), { afterMs: 0 }).settled, false);
  assert.equal(turnCycleStatus(snapshot(drained, { activeSources: 1 }), { afterMs: 0 }).settled, false);
  assert.equal(turnCycleStatus(snapshot(drained), { afterMs: 0 }).settled, true);
});

test('split ASR second turn and late tool/result continuation must all settle', () => {
  const events = [...drained, event(1000, 'input.speech.started'), event(1010, 'transcript.user.delta', { reference: 3 })];
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).reason, 'asr_turn_open');
  events.push(event(1020, 'input.speech.stopped'));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).reason, 'asr_final_pending');
  events.push(event(1030, 'transcript.user', { reference: 3 }), event(1040, 'reply.started', { replyRef: 2 }), event(1050, 'reply.done', { replyRef: 2, status: 'completed' }), event(1060, 'tool.call', { callRef: 4 }));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).reason, 'tool_result_pending');
  events.push(event(1070, 'tool.result', { callRef: 4 }));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).reason, 'final_response_pending');
  events.push(event(1080, 'reply.started', { replyRef: 5 }), event(1090, 'transcript.agent', { reference: 5, final: true }), event(1100, 'reply.done', { replyRef: 5, status: 'completed' }));
  assert.deepEqual(turnCycleStatus(snapshot(events), { afterMs: 0 }), { settled: true, reason: 'response_and_playback_drained', asrItems: 2 });
});

test('queued playback, interrupted finals, and newly arriving late events prevent next input', () => {
  assert.equal(turnCycleStatus(snapshot(drained, { playbackPending: true }), { afterMs: 0 }).reason, 'playback_not_drained');
  assert.equal(turnCycleStatus(snapshot(drained.map(e => e.type === 'transcript.agent' ? { ...e, interrupted: true } : e)), { afterMs: 0 }).reason, 'final_response_pending');
  assert.equal(turnCycleStatus(snapshot(drained, { elapsedMs: 1000 }), { afterMs: 0 }).reason, 'late_event_observation_window');
  assert.equal(turnCycleStatus(snapshot([...drained, event(4800, 'tool.call', { callRef: 9 })]), { afterMs: 0 }).reason, 'tool_result_pending');
  assert.equal(turnCycleStatus(snapshot([...drained, event(1000, 'reply.started', { replyRef: 7 }), event(1100, 'reply.started', { replyRef: 8 }), event(1200, 'reply.done', { replyRef: 8 })]), { afterMs: 0 }).reason, 'reply_pending');
});

test('UI text input needs its new reply but no microphone or fabricated ASR final', () => {
  const events = [event(100, 'conversation.message', { direction: 'sent', role: 'human' }), event(110, 'reply.create'), event(200, 'reply.started', { replyRef: 1 }), event(300, 'transcript.agent', { final: true, reference: 1 }), event(320, 'reply.done', { replyRef: 1 })];
  assert.equal(turnCycleStatus(snapshot(events, { activeTracks: 0 }), { mode: 'text', afterMs: 0 }).settled, true);
  assert.equal(turnCycleStatus(snapshot(events, { activeTracks: 0 }), { mode: 'voice', afterMs: 0 }).reason, 'input_not_observed');
});

test('legitimate wait needs drained recognized input, but no invented reply requirement', () => {
  const events = drained.filter(e => !/^(reply|transcript.agent)/.test(e.type));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, requireReply: false }).settled, true);
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).settled, false);
});

test('canonical fc call completion and late call settle only after actual delivery and fresh continuation', () => {
  const events = [event(100, 'conversation.message', { role: 'human' }), event(200, 'reply.started', { replyRef: 1 }), event(300, 'reply.done', { replyRef: 2, callRef: 3, status: 'completed' }), event(310, 'tool.call', { callRef: 3 })];
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, mode: 'text' }).reason, 'tool_result_pending');
  events.push(event(350, 'tool.result', { callRef: 3 }), event(400, 'reply.started', { replyRef: 4 }), event(450, 'transcript.agent', { reference: 4, final: true }), event(460, 'reply.done', { replyRef: 4, status: 'completed' }));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, mode: 'text' }).settled, true);
  const ambiguous = [...events.slice(0, 2), event(250, 'reply.started', { replyRef: 99 }), ...events.slice(2)];
  assert.equal(turnCycleStatus(snapshot(ambiguous), { afterMs: 0, mode: 'text' }).reason, 'reply_pending');
});
