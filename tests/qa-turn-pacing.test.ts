import test from 'node:test';
import assert from 'node:assert/strict';
import { turnCycleStatus } from '../scripts/qa-turn-pacing.mjs';
import type { AudioSnapshot, QaAudioEvent } from '../scripts/qa-browser-instrumentation.mjs';

const event = (atMs: number, type: string, extra = {}): QaAudioEvent => ({ atMs, type, ...extra });
const snapshot = (events: QaAudioEvent[], extra = {}): AudioSnapshot => ({ label: 'synthetic adversarial scheduling fixture', elapsedMs: 5000, events, activeSources: 0, activeTracks: 1, openApplicationContexts: 2, playbackPending: false, counters: Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(kind => [kind, { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }])) as AudioSnapshot['counters'], ...extra });
const completed = [event(100, 'synthetic.speech.queued', { id: 'split' }), event(200, 'input.speech.started'), event(300, 'input.speech.stopped'), event(310, 'transcript.user', { reference: 1 }), event(320, 'reply.started', { replyRef: 2 }), event(350, 'transcript.agent', { reference: 2, final: true }), event(360, 'reply.done', { replyRef: 2, status: 'completed' })];
const drained = [...completed, event(900, 'synthetic.speech.ended', { id: 'split' }), event(920, 'synthetic.speech.drained', { id: 'split' })];

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
  const events = [event(100, 'conversation.message', { direction: 'sent' }), event(110, 'reply.create'), event(200, 'reply.started', { replyRef: 1 }), event(300, 'transcript.agent', { final: true, reference: 1 }), event(320, 'reply.done', { replyRef: 1 })];
  assert.equal(turnCycleStatus(snapshot(events, { activeTracks: 0 }), { mode: 'text', afterMs: 0 }).settled, true);
  assert.equal(turnCycleStatus(snapshot(events, { activeTracks: 0 }), { mode: 'voice', afterMs: 0 }).reason, 'input_not_observed');
});

test('legitimate wait needs drained recognized input, but no invented reply requirement', () => {
  const events = drained.filter(e => !/^(reply|transcript.agent)/.test(e.type));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, requireReply: false }).settled, true);
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0 }).settled, false);
});

test('canonical fc call completion and late call settle only after actual delivery and fresh continuation', () => {
  const events = [event(100, 'conversation.message'), event(200, 'reply.started', { replyRef: 1 }), event(300, 'reply.done', { replyRef: 2, callRef: 3, status: 'completed' }), event(310, 'tool.call', { callRef: 3 })];
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, mode: 'text' }).reason, 'tool_result_pending');
  events.push(event(350, 'tool.result', { callRef: 3 }), event(400, 'reply.started', { replyRef: 4 }), event(450, 'transcript.agent', { reference: 4, final: true }), event(460, 'reply.done', { replyRef: 4, status: 'completed' }));
  assert.equal(turnCycleStatus(snapshot(events), { afterMs: 0, mode: 'text' }).settled, true);
  const ambiguous = [...events.slice(0, 2), event(250, 'reply.started', { replyRef: 99 }), ...events.slice(2)];
  assert.equal(turnCycleStatus(snapshot(ambiguous), { afterMs: 0, mode: 'text' }).reason, 'reply_pending');
});
