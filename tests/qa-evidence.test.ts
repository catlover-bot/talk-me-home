import assert from 'node:assert/strict'
import { test } from 'node:test'
// @ts-expect-error This local CLI helper is intentionally a native Node module.
import { approximateVideoAlignment, summarizeAttempt } from '../scripts/qa-evidence.mjs'

const label = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI'

test('QA evidence keeps the observed split-ASR and unacknowledged ending distinct from visible history', () => {
  // Sanitized timing pattern from the first canary; no provider or browser is invoked.
  const report = { label, scenario: 'canary', identity: {}, failure: 'No finalized visible Pip reply followed synthetic speech.', completion: false,
    visibleHistory: [{ speaker: 'Mission Control', text: 'Please wait.' }], cleanup: { activeTracks: 0 } }
  const evidence = { label, events: [
    { type: 'socket.open', atMs: 1679.6 },
    { type: 'synthetic.speech.queued', id: 'wait', text: 'Please wait. Do not move.', atMs: 38437.9, durationSeconds: 6.4095 },
    { type: 'synthetic.speech.started', id: 'wait', atMs: 38487.9 },
    { type: 'transcript.user', final: true, text: 'Please wait.', atMs: 42297.5, reference: 6 },
    { type: 'synthetic.speech.ended', id: 'wait', atMs: 44897.7 },
    { type: 'transcript.user', final: true, text: 'Do not move.', atMs: 46762.9, reference: 8 },
    { type: 'transcript.agent', final: true, text: 'Understood. I will wait here.', atMs: 52577.7, reference: 7 },
    { type: 'session.end', atMs: 52932.7 },
    { type: 'socket.close', atMs: 54600.8, code: 1005, clean: true },
  ] }
  const summary = summarizeAttempt(report, evidence)
  assert.equal(summary.ending.endAcknowledged, false)
  assert.equal(summary.ending.socketCloseWasClean, true)
  assert.equal(summary.ending.endAcknowledgementDelayMs, null)
  assert.equal(summary.ending.providerSessionSeconds, null)
  assert.equal(summary.utterances[0].asrFinals.length, 2)
  assert.equal(summary.utterances[0].asrFinals[0].waveformEndToAsrFinalMs, -2600.2)
  assert.equal(summary.utterances[0].asrFinals[1].waveformEndToAsrFinalMs, 1865.2)
  assert.equal(summary.finalTranscripts.length, 3)
  assert.equal(summary.visibleHistory.length, 1)
  assert.equal(summary.visibleHistory[0].speaker, 'Mission Control')
  assert.equal(summary.visibleHistory[0].final, null)
  assert.equal(summary.visibleHistory[0].interrupted, null)
  assert.equal(summary.failure, report.failure)
})

test('QA missing ending remains unknown while supervisor cleanup supports explicitly derived duration bounds', () => {
  const report = {
    label, scenario: 'mission', identity: { harnessSha256: 'a'.repeat(64), node: 'v24.20.0' }, browserVersion: '153.0.8010.12',
    audioTimeOriginWallMs: 1790255921480.5, videoPageCreationStartedAt: 1790255921419, videoPageCreatedAt: 1790255921456,
    checkpoints: [{ title: 'Cargo Bay', observedAtMs: 556.3 }, { title: 'Untrusted hidden field', observedAtMs: 5 }],
    visibleHistory: [{ speaker: 'Pip', text: 'The route is', final: false, interrupted: true }],
  }
  const evidence = { label, events: [{ type: 'socket.open', atMs: 1567 }, { type: 'session.end', atMs: 189319.8 }] }
  const summary = summarizeAttempt(report, evidence, { closedAt: 1790256120725 })
  assert.equal(summary.ending.localConnectedSeconds, null)
  assert.equal(summary.ending.endAcknowledged, false)
  assert.equal(summary.durationBounds.observedSocketOpenToEndSentLowerBoundSeconds, 187.8)
  assert.equal(summary.durationBounds.localConnectionUpperBoundSeconds, 197.7)
  assert.equal(summary.durationBounds.remoteSecondsWithDocumentedGraceUpperEstimate, 227.7)
  assert.equal(summary.durationBounds.documentedDisconnectGraceSeconds, 30)
  assert.equal(summary.checkpoints.length, 1)
  assert.equal(summary.checkpoints[0].title, 'Cargo Bay')
  assert.equal(summary.harnessSha256, 'a'.repeat(64))
  assert.equal(summary.browserVersion, '153.0.8010.12')
  assert.equal(summary.visibleHistory[0].final, false)
  assert.equal(summary.visibleHistory[0].interrupted, true)
  const alignment = approximateVideoAlignment(report)
  assert.equal(alignment.offsetMs, 43)
  assert.equal(alignment.creationIntervalHalfWidthMs, 18.5)
  assert.match(alignment.source, /not sample accurate/)
  assert.equal(approximateVideoAlignment({}), null)
})

test('QA evidence exports allowlisted tool metadata without arguments, results, configuration, or credentials', () => {
  const report = { label, scenario: 'canary', identity: {}, config: { secret: 'fixture-only-configuration' } }
  const evidence = { label, events: [
    { type: 'tool.call', atMs: 15985.7, callRef: 4, name: 'observe_room', arguments: { hidden: 'fixture-only-hidden' } },
    { type: 'tool.result', atMs: 18280.1, callRef: 4, isError: false, result: 'fixture-only-result' },
    { type: 'session.ready', atMs: 200, resume_token: 'fixture-only-token' },
  ] }
  const summary = summarizeAttempt(report, evidence)
  assert.equal(summary.tools[0].callToResultMs, 2294.4)
  assert.equal(summary.tools[0].succeeded, true)
  assert.doesNotMatch(JSON.stringify(summary), /fixture-only-/)
  assert.throws(() => summarizeAttempt(report, { label, events: [{ type: 'transcript.user', final: true, atMs: 10, text: 'Authorization: Bearer fixture-only-credential' }] }), /Credential-like/)
})
