import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error This local CLI helper is intentionally a native Node module.
import { approximateVideoAlignment, summarizeAttempt, exportCampaign } from '../scripts/qa-evidence.mjs'

const label = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI'
const textLabel = 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI'

test('Text export keeps typed UI input separate from provider finals and retains interrupted provenance', () => {
  const report = { label: textLabel, mode: 'text', scenario: 'mission', identity: {},
    steps: [{ inputMode: 'text', utterance: 'Please look around.', elapsedMs: 500 }],
    visibleHistory: [{ speaker: 'Mission Control', text: 'Please look around.', sourceLabel: 'Live Text · Typed', chapterLabel: 'Cargo Bay', final: true, interrupted: false }] }
  const evidence = { label: textLabel, events: [
    { type: 'conversation.message', role: 'human', atMs: 100 },
    { type: 'transcript.agent', final: true, interrupted: true, text: 'I can see', atMs: 200 },
    { type: 'transcript.agent', final: true, interrupted: false, text: 'I can see a Latch.', atMs: 400 },
  ] }
  const summary = summarizeAttempt(report, evidence)
  assert.equal(summary.label, textLabel)
  assert.equal(summary.mode, 'text')
  assert.deepEqual(summary.typedTurns, [{ source: 'QA player UI submission record; not ASR or proof of provider delivery', text: 'Please look around.', recordedAfterTurnAtMs: 500 }])
  assert.equal(summary.finalTranscripts.length, 2)
  assert.equal(summary.finalTranscripts.some((row: { source: string }) => row.source === 'Real provider ASR'), false)
  assert.equal(summary.finalTranscripts[0].interrupted, true)
  assert.equal(summary.visibleHistory[0].sourceLabel, 'Live Text · Typed')
  assert.equal(summary.visibleHistory[0].chapterLabel, 'Cargo Bay')
  assert.deepEqual(summary.utterances, [])
  assert.match(summary.boundary, /No ASR/)
  const fallback = summarizeAttempt({ ...report, steps: [] }, evidence)
  assert.equal(fallback.typedTurns[0].source, 'Visible Live Text typed history; not ASR')
  assert.equal(fallback.typedTurns[0].recordedAfterTurnAtMs, null)
  assert.throws(() => summarizeAttempt(report, { ...evidence, label }), /consistently labelled/)
  assert.throws(() => summarizeAttempt({ ...report, steps: [{ inputMode: 'text', utterance: 'Authorization: Bearer private-fixture' }] }, evidence), /Credential-like/)
})

test('campaign export discovers Text/Voice directories and binds their explicit reservation without guessing from absent socket events', async () => {
  // Throwaway accounting fixtures only: no campaign initializer, credentials, browser or provider.
  const directory = await mkdtemp(join(tmpdir(), 'qa-export-offline-'))
  const output = join(directory, 'export')
  try {
    const header = { type: 'campaign', version: 1, createdAt: 1000, maxAttempts: 2, reservationSeconds: 670, capacitySeconds: 1340, maxSessionSeconds: 600, planningDollars: 1.68, disconnectGraceSeconds: 30, hourlyRate: 4.5 }
    const reservations = ['text', 'voice'].map((mode, index) => ({ type: 'reserved', attempt: index + 1, name: `${mode}-mission`, reservedAt: 2000 + index * 670000, reservedSeconds: 670, gracefulAt: 572000 + index * 670000, hardAt: 582000 + index * 670000, leaseUntil: 672000 + index * 670000 }))
    await writeFile(join(directory, 'campaign.jsonl'), [header, ...reservations].map(row => JSON.stringify(row)).join('\n') + '\n')
    await writeFile(join(directory, 'allowance.jsonl'), [{ version: 1, allowanceSessions: 2, maxSessionSeconds: 600 }, ...reservations.map(({ reservedAt, leaseUntil }) => ({ reservedAt, leaseUntil }))].map(row => JSON.stringify(row)).join('\n') + '\n')
    const names = ['2026-09-26T00-00-00-000Z-text-mission', '2026-09-26T00-12-00-000Z-voice-mission']
    for (const [index, name] of names.entries()) {
      const mode = index === 0 ? 'text' : 'voice'; const currentLabel = mode === 'text' ? textLabel : label
      await mkdir(join(directory, name))
      await writeFile(join(directory, name, 'report.json'), JSON.stringify({ label: currentLabel, mode, scenario: 'mission', reservation: reservations[index], identity: {}, failure: 'Offline exporter fixture; no actual call.', completion: false, steps: mode === 'text' ? [{ inputMode: 'text', utterance: 'Please look around.', elapsedMs: 20 }] : [] }))
      await writeFile(join(directory, name, 'audio-evidence.json'), JSON.stringify({ label: currentLabel, events: [] }))
    }
    const summary = await exportCampaign({ directory, output })
    assert.equal(summary.results.length, 2)
    assert.deepEqual(summary.results.map((row: { mode: string }) => row.mode), ['text', 'voice'])
    assert.match(summary.label, /UI LIVE TEXT \/ SYNTHETIC VOICE/)
    for (const [index, name] of names.entries()) {
      const metrics = JSON.parse(await readFile(join(output, `${name}-metrics.json`), 'utf8'))
      assert.equal(metrics.accountingAttempt, index + 1)
    }
    const conversation = await readFile(join(output, `${names[0]}-conversation.md`), 'utf8')
    assert.match(conversation, /UI LIVE TEXT/)
    assert.match(conversation, /Typed UI turns/)
    assert.match(conversation, /not ASR or proof of provider delivery/)
    const path = join(directory, names[0]!, 'report.json'); const invalid = JSON.parse(await readFile(path, 'utf8'))
    invalid.reservation.reservedAt++
    await writeFile(path, JSON.stringify(invalid))
    await assert.rejects(exportCampaign({ directory, output }), /reservation does not match/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

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
