// Reproduce the retained attempt-13 timing audit without provider access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const base = '.validation/goal-004c-live/2026-09-29T11-21-06-378Z-voice-mission/';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = read(`${base}report.json`);
const audio = read(`${base}audio-evidence.json`);
const events = audio.events;
const rounded = value => Number.isFinite(value) ? Number(value.toFixed(4)) : null;
const at = event => event ? rounded(event.atMs) : null;
const delta = (later, earlier) => later && earlier ? rounded(later.atMs - earlier.atMs) : null;
const ended = events.find(e => e.type === 'session.end');
const closed = events.find(e => e.type === 'socket.close');
const turns = report.steps.map((step, index) => {
  const next = report.steps[index + 1]?.startedAtMs ?? Infinity;
  const window = events.filter(e => e.atMs >= step.startedAtMs && e.atMs < next);
  const queued = window.find(e => e.type === 'synthetic.speech.queued' && e.id === step.fixture);
  assert(queued, `Missing recorded fixture for turn ${step.turnId}`);
  const sourceStart = window.find(e => e.type === 'synthetic.speech.started' && e.id === step.fixture);
  const sourceEnd = window.find(e => e.type === 'synthetic.speech.ended' && e.id === step.fixture);
  const sourceDrain = window.find(e => e.type === 'synthetic.speech.drained' && e.id === step.fixture);
  const asr = window.find(e => e.type === 'transcript.user' && e.final && e.atMs >= queued.atMs);
  const toolCalls = window.filter(e => e.type === 'tool.call').map(call => {
    const result = window.find(e => e.type === 'tool.result' && e.callRef === call.callRef);
    const toolReplyDone = result && window.findLast(e => e.type === 'reply.done' && e.atMs >= call.atMs && e.atMs <= result.atMs);
    const continuation = result && window.find(e => e.type === 'reply.started' && e.atMs > result.atMs);
    const final = continuation && window.find(e => e.type === 'transcript.agent' && e.final && e.reference === continuation.replyRef && e.atMs >= continuation.atMs);
    const done = continuation && window.find(e => e.type === 'reply.done' && e.replyRef === continuation.replyRef && e.atMs >= continuation.atMs);
    const drained = done && window.find(e => e.type === 'playback.drained' && e.atMs >= done.atMs);
    return { callRef: call.callRef, name: call.name, callReceivedAtMs: at(call), serverValidationAtMs: null, serverResponseReceivedAtMs: null, toolReplyDoneAtMs: at(toolReplyDone), resultSentAtMs: at(result), isError: result?.isError ?? null, outcomeCode: result?.outcomeCode ?? null, callToSentResultMs: delta(result, call), replyDoneToSentResultMs: delta(result, toolReplyDone), continuationReplyRef: continuation?.replyRef ?? null, continuationStartedAtMs: at(continuation), resultToContinuationMs: delta(continuation, result), finalTranscriptAtMs: at(final), continuationDoneAtMs: at(done), playbackDrainedAtMs: at(drained), continuationAfterEnd: Boolean(continuation && continuation.atMs > ended.atMs), finalTranscriptAfterEnd: Boolean(final && final.atMs > ended.atMs) };
  });
  return { turnId: step.turnId, fixture: step.fixture, input: step.utterance, browserClock: { queuedAtMs: at(queued), scheduledSourceStartAtMs: at(sourceStart), sourceEndedAtMs: at(sourceEnd), inputCaptureDrainedAtMs: at(sourceDrain), captureSampleClockAtDrainMs: rounded(sourceDrain?.captureAtMs), asrFinalAtMs: at(asr), finalInputToAsrMs: delta(asr, sourceEnd), captureDrainToAsrMs: delta(asr, sourceDrain) }, audioComparison: { decodedFixtureSeconds: queued.durationSeconds, scheduledStartToOnendedSeconds: rounded((sourceEnd.atMs - sourceStart.atMs) / 1000), differenceFromDecodedFixtureMs: rounded(sourceEnd.atMs - sourceStart.atMs - queued.durationSeconds * 1000), boundary: 'Source start is scheduled, source end is a main-thread callback, and the fixture includes padding. This is not a transport delay or measured event-loop lag.' }, toolCalls, driverObservedTurnSettled: step.settled };
});
const calls = events.filter(e => e.type === 'tool.call');
const results = events.filter(e => e.type === 'tool.result');
assert.equal(calls.length, 21); assert.equal(results.length, 21);
const pending = new Set(); let maximumUnmatchedCalls = 0;
for (const event of events) {
  if (event.type === 'tool.call') pending.add(event.callRef);
  if (event.type === 'tool.result') pending.delete(event.callRef);
  maximumUnmatchedCalls = Math.max(maximumUnmatchedCalls, pending.size);
}
const finalAcquisition = report.acquisitions.at(-1);
const finalCalls = turns.slice(-3).flatMap(t => t.toolCalls);
assert.deepEqual(finalCalls.map(t => t.callRef), [142, 148, 154]);
assert(finalCalls.at(-1).continuationAfterEnd);
assert.equal(finalCalls.at(-1).playbackDrainedAtMs, null);
const afterEnd = events.filter(e => e.atMs > ended.atMs);
const samples = Object.fromEntries(Object.entries(audio.counters).map(([kind, value]) => [kind, { samples: value.samples, sampleDurationSecondsAt24kHz: rounded(value.samples / 24000), lastChunkAtMs: rounded(value.lastChunkMs), lastNonzeroAtMs: rounded(value.lastNonzeroMs) }]));
const baseline = {
  schema: 1, generatedAt: new Date().toISOString(), sourceKind: 'Retained actual attempt, not a constructed reproduction',
  sources: ['report.json', 'audio-evidence.json', 'lifecycle.jsonl'].map(name => ({ path: base + name, sha256: hash(base + name) })),
  identity: Object.fromEntries(['commit', 'runtimeSha256', 'harnessSha256', 'fixtureSha256'].map(k => [k, report.identity[k]])),
  outcome: { completion: report.completion, failure: report.failure, endAcknowledged: report.endAcknowledged, providerDurationSeconds: report.providerDurationSeconds, localConnectedSeconds: report.connectedSeconds },
  clocks: { browser: 'events.atMs = browser performance.now minus instrumentation installation. All turn-stage deltas use this clock only.', acquisition: 'report.acquisitions uses driver Node performance.now. It has a different origin and is not directly subtracted from browser timestamps.', receipt: 'lifecycle driver elapsed and UTC fields timestamp receipt across browser/driver transport; they are not exact clock synchronization.', server: 'Not recorded independently in this attempt.' },
  finalSubgoal: { subject: finalAcquisition.subject, nodeStartedAtMs: finalAcquisition.startedAt, nodeDeadlineAtMs: finalAcquisition.deadlineAt, nodeStoppedAtMs: finalAcquisition.endedAt, observedElapsedMs: rounded(finalAcquisition.endedAt - finalAcquisition.startedAt), deadlineOverrunMs: rounded(finalAcquisition.endedAt - finalAcquisition.deadlineAt), outcome: finalAcquisition.outcome, retroactiveSuccess: false },
  turns,
  finalBrowserEvents: events.filter(e => e.atMs >= turns.at(-3).browserClock.queuedAtMs && ['synthetic.speech.ended', 'synthetic.speech.drained', 'transcript.user', 'tool.call', 'tool.result', 'reply.started', 'reply.done', 'transcript.agent', 'playback.drained', 'playback.stop', 'session.end', 'socket.close'].includes(e.type)).map(e => ({ ...e, atMs: rounded(e.atMs) })),
  ending: { endSentAtMs: at(ended), closeAtMs: at(closed), endToLocalCloseMs: delta(closed, ended), closeCode: closed.code, closeClean: closed.clean, peerAckObserved: false, lateProviderAudioOnsets: afterEnd.filter(e => e.type === 'audio.provider.onset').length, queuedPlaybackEventsAfterEnd: afterEnd.filter(e => e.type === 'playback.queued').length, renderedAudioOnsetsAfterEnd: afterEnd.filter(e => e.type === 'audio.rendered.onset').length, toolCallsAfterEnd: afterEnd.filter(e => e.type === 'tool.call').length, boundary: 'Late ordinary reply/audio was received but not played. No ACK is inferred from local close or cleanup.' },
  measuredLoad: { toolCalls: calls.length, sentResults: results.length, maximumUnmatchedToolCalls: maximumUnmatchedCalls, unmatchedToolCallsAtEnd: pending.size, awaitedNormalContinuationAtEnd: true, playbackQueuedChunksTotal: events.filter(e => e.type === 'playback.queued').length, playbackQueuedSamplesTotal: events.filter(e => e.type === 'playback.queued').reduce((n, e) => n + e.samples, 0), playbackPendingAtFinalSnapshot: audio.playbackPending, boundary: 'Queued chunks/samples are cumulative admissions, not instantaneous queue depth. Only call/result pairs and pending playback state are measured.' },
  audioComparison: { counters: samples, elapsedSnapshotSeconds: rounded(audio.elapsedMs / 1000), exportedWavDurationSeconds: audio.media.input.durationSeconds, boundary: 'WAVs are aligned to the snapshot timeline with silence; sample counters describe observed chunks and are not wall-clock or provider-duration measures. Per-fixture scheduled/ended comparison is recorded above.' },
  unknownMeasurements: ['Rejected arguments and actual target handle', 'Independent server request/validation/result timestamps', 'Server HTTP round-trip time', 'Browser or Node event-loop delay', 'WebSocket bufferedAmount and network queue depth', 'Provider input/output backlog, processing time and model scheduling', 'Exact playback queue depth in samples at each instant', 'Exact browser/driver monotonic clock offset', 'Remote ending and provider session duration'],
  interpretation: 'Observed delays and repeated rejections are established; their attribution to browser, network, server, model or provider is not. Call-to-sent-result includes the reply.done delivery boundary. Temporal next-reply matching is identified explicitly; a tool result has no direct continuation reply identifier.',
  providerRequestsMadeByAudit: 0,
};
const path = process.argv[2] ?? 'artifacts/goal-005b/timing-attempt-13.json';
assert(/^artifacts\/goal-005b\/timing-[a-z0-9-]+\.json$/.test(path));
writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ path, turns: turns.length, finalThree: turns.slice(-3).map(t => ({ turn: t.turnId, inputEndToAsrMs: t.browserClock.finalInputToAsrMs, resultToContinuationMs: t.toolCalls[0]?.resultToContinuationMs })), maximumUnmatchedCalls }));
