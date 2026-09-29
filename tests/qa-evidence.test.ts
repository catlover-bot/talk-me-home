import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { writeGoal004CHistory, writeGoal004DRetestHistory, writeGoal004EConfirmedHistory } from './fixtures/goal-004c-history.ts'
// @ts-expect-error This local accounting helper is intentionally a native Node module.
import { initializeAmendment, AmendedCampaignBudget, inspectAmendedCampaign, QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE, QA_RUNTIME_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE, QA_CONFIRMED_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE, QA_RECHECK_AMENDMENT_ID, QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE } from '../scripts/qa-amended-budget.mjs'
// @ts-expect-error This local CLI helper is intentionally a native Node module.
import { approximateVideoAlignment, summarizeAttempt, exportCampaign } from '../scripts/qa-evidence.mjs'

const label = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI'
const textLabel = 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI'

test('confirmed-action evidence preserves Game provenance and never reports a pending proposal as execution', () => {
  const confirmedLabel = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI'
  const report = { label: confirmedLabel, mode: 'voice', identity: {},
    visibleHistory: [{ speaker: 'Game event', text: 'Action p1 declined; not executed.', sourceLabel: 'Game event' }],
    confirmations: [{ proposalId: 'p2', label: 'Secure the door with the Latch', intendedRequest: 'Please engage the Latch.', status: 'committed', confirmedAtMs: 42, source: 'Visible exact UI button' }] }
  const summary = summarizeAttempt(report, { label: confirmedLabel, events: [
    { type: 'tool.call', name: 'propose_interaction', callRef: 1, atMs: 10 },
    { type: 'tool.result', callRef: 1, atMs: 12, isError: false, actionStatus: 'awaiting_confirmation', proposalRef: 2 },
  ] })
  assert.equal(summary.visibleHistory[0].speaker, 'Game event')
  assert.equal(summary.typedTurns.length, 0)
  assert.equal(summary.tools[0].succeeded, false)
  assert.equal(summary.tools[0].status, 'awaiting_confirmation_not_executed')
  assert.equal(summary.confirmations[0].proposalId, 'p2')
  assert.match(summary.boundary, /not hands-free/)
})

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

test('recheck evidence keeps strict-first and recovered diagnostics separate from pre-submit waiting', () => {
  const report = { label, mode: 'voice', identity: {}, actionRequests: [{
    intendedRequest: 'Please cross to the far side.', expectedLabel: 'Move to the far-side platform', sourceChapter: 'Cargo Bay', strictFirstResponse: false, recovered: true, outcome: 'committed', hiddenState: 'excluded-private-fixture',
    exchanges: [{ kind: 'initial', text: 'Please cross to the far side.', outcome: 'verified_committed_receipt',
      proposal: { proposalId: 'old-latch', label: 'Engage the Latch', status: 'committed', rawPayload: 'excluded-private-fixture' },
      replies: [{ speaker: 'Pip', text: 'May I check the status of that proposal?', chapter: 'Cargo Bay', sourceLabel: 'Live Voice', final: true, interrupted: false, messageId: 'message-one', displayedAt: '2026-09-29T00:00:00.000Z', hiddenState: 'excluded-private-fixture' }] },
    { kind: 'clarification', text: 'Please report the proposal status.', outcome: 'matching_pending', proposal: { proposalId: 'crossing', label: 'Move to the far-side platform', status: 'awaiting_confirmation' }, replies: [] }],
  }], preSubmitWaits: [{ beforeTurnId: 7, settled: true, reason: 'acknowledgement_opportunity_expired', startedAtMs: 2000, endedAtMs: 6000, waitedMs: 4000, confirmation: { rawPayload: 'excluded-private-fixture' } },
  { beforeTurnId: 8, settled: false, fatal: true, reason: 'provider_error', startedAtMs: 7000, endedAtMs: 7010, waitedMs: 10 }] }
  const summary = summarizeAttempt(report, { label, events: [] })
  assert.equal(summary.actionRequests[0].strictFirstResponse, false); assert.equal(summary.actionRequests[0].recovered, true)
  assert.equal(summary.actionRequests[0].exchanges[0].proposal.proposalId, 'old-latch')
  assert.equal(summary.actionRequests[0].exchanges[0].replies[0].messageId, 'message-one')
  assert.equal(summary.actionRequests[0].exchanges[0].replies[0].chapterLabel, 'Cargo Bay')
  assert.equal(summary.actionRequests[0].exchanges[1].outcome, 'matching_pending')
  assert.equal(summary.preSubmitWaits[0].beforeTurnId, 7); assert.equal(summary.preSubmitWaits[0].waitedMs, 4000)
  assert.equal(summary.preSubmitWaits[0].reason, 'acknowledgement_opportunity_expired')
  assert.equal(summary.preSubmitWaits[1].fatal, true); assert.equal(summary.preSubmitWaits[1].settled, false)
  assert.equal(summary.typedTurns.length, 0); assert.equal(summary.utterances.length, 0)
  assert.doesNotMatch(JSON.stringify(summary), /excluded-private-fixture|hiddenState|rawPayload/)
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

test('acceptance export retains exact visible timing, settled input provenance and behavioral defects without hidden payloads', () => {
  const message = { historyIndex: 3, speaker: 'Pip', text: 'I crossed.', sourceLabel: 'Live Text', chapterLabel: 'Cargo Bay', displayedAt: '2026-09-27T00:00:00.123Z', final: true, interrupted: false, provenance: 'rendered DOM labels' }
  const report = { label: textLabel, mode: 'text', scenario: 'mission', identity: {}, visibleHistory: [message],
    lifecycle: [{ type: 'browser.closed', observedAt: '2026-09-27T00:00:01.123Z', elapsedMs: 60.456, outcome: 'observed', source: 'driver', raw: 'excluded-secret-world' }, { type: 'unsupported', hidden: 'excluded-secret-world' }],
    steps: [{ inputMode: 'text', utterance: 'Please engage the Latch.', turnId: 2, startedAtMs: 10.123, endedAtMs: 40.789, settled: true, terminal: false, inputSource: 'normal UI typed message', messages: [message], elapsedMs: 41 }],
    behavior: { status: 'blocked', materialDefects: [{ code: 'mutation_outside_requested_action', turnId: 2, request: 'Please engage the Latch.', callRef: 4, name: 'move_to', arguments: { hidden: 'excluded-secret-world' } }],
      uncertainties: [{ code: 'response_window_is_temporal_association', blocking: false, turnId: 2, callRef: 4 }],
      turns: [{ turnId: 2, request: 'Please engage the Latch.', intent: 'engage_latch', sourceWindow: { startedAtMs: 10.123, endedAtMs: 40.789 }, replies: [message], tools: [{ name: 'move_to', callRef: 4, replyRef: 8, atMs: 20, resultAtMs: 30, outcome: 'success', result: 'excluded-secret-world' }] }],
      reviewedToolCalls: 1, boundary: 'Temporal evidence only.' } }
  const evidence = { label: textLabel, events: [{ type: 'tool.call', name: 'move_to', atMs: 20, callRef: 4, replyRef: 8 }, { type: 'tool.result', atMs: 30, callRef: 4, replyRef: 9, isError: false }] }
  const summary = summarizeAttempt(report, evidence)
  assert.equal(summary.typedTurns[0].startedAtMs, 10.123)
  assert.equal(summary.typedTurns[0].endedAtMs, 40.789)
  assert.equal(summary.typedTurns[0].settled, true)
  assert.equal(summary.inputSteps[0].messages[0].historyIndex, 3)
  assert.equal(summary.visibleHistory[0].displayedAt, message.displayedAt)
  assert.equal(summary.visibleHistory[0].provenance, 'rendered DOM labels')
  assert.equal(summary.lifecycle.length, 1)
  assert.equal(summary.lifecycle[0].observedAt, '2026-09-27T00:00:01.123Z')
  assert.equal(summary.lifecycle[0].elapsedMs, 60.456)
  assert.equal(summary.tools[0].callRef, 4)
  assert.equal(summary.tools[0].replyRef, 8)
  assert.equal(summary.tools[0].resultReplyRef, 9)
  assert.equal(summary.tools[0].status, 'success')
  assert.equal(summary.behavior.status, 'blocked')
  assert.equal(summary.behavior.materialDefects[0].code, 'mutation_outside_requested_action')
  assert.equal(summary.behavior.uncertainties[0].blocking, false)
  assert.equal(summary.behavior.turns[0].sourceWindow.startedAtMs, 10.123)
  assert.doesNotMatch(JSON.stringify(summary), /excluded-secret-world/)
})

test('amended export combines preserved history with failed new Text and keeps conditional Voice blocked', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-amended-export-offline-'))
  try {
    await writeGoal004CHistory(directory)
    const original = await readFile(join(directory, 'campaign.jsonl'))
    const originalAllowance = await readFile(join(directory, 'allowance.jsonl'))
    initializeAmendment(directory, { now: () => 2_000_000_000_000 })
    const budget = new AmendedCampaignBudget(directory, () => 2_000_000_000_100)
    const files = { 'dist/fixture.js': 'a'.repeat(64) }; const harnessFiles = { 'fixture.mjs': 'b'.repeat(64) }
    const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    const identity = { commit: 'c'.repeat(40), files, harnessFiles, runtimeSha256: digest(files), harnessSha256: digest(harnessFiles) }
    const reservation = budget.reserve({ name: 'text-mission', identity })
    const allowancePath = join(directory, QA_AMENDMENT_ALLOWANCE)
    await writeFile(allowancePath, await readFile(allowancePath, 'utf8') + JSON.stringify({ reservedAt: reservation.reservedAt, leaseUntil: reservation.leaseUntil }) + '\n')
    budget.finish(2, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 25 })
    budget.closed(2)
    const name = '2033-05-18T03-33-20-100Z-text-mission'; const attemptPath = join(directory, name)
    await mkdir(attemptPath)
    await writeFile(join(attemptPath, 'report.json'), JSON.stringify({ label: textLabel, mode: 'text', scenario: 'mission', reservation, identity, failure: 'Concrete fixture failure.', completion: false, cleanup: { activeTracks: 0, activeSources: 0, openApplicationContexts: 0 }, behavior: { status: 'blocked', materialDefects: [{ code: 'mutation_outside_requested_action' }], uncertainties: [], turns: [] } }))
    await writeFile(join(attemptPath, 'audio-evidence.json'), JSON.stringify({ label: textLabel, events: [{ type: 'session.end', atMs: 25_000 }, { type: 'session.ended', atMs: 25_100 }] }))
    const summary = await exportCampaign({ directory, output: join(directory, 'export') })
    assert.equal(summary.attempts, 2)
    assert.equal(summary.historicalAttempts, 1)
    assert.equal(summary.newAttempts, 1)
    assert.equal(summary.productionAttempts, 2)
    assert.equal(summary.reservedSeconds, 1340)
    assert.equal(summary.newReservedSeconds, 670)
    assert.equal(summary.remainingAttempts, 1)
    assert.equal(summary.remainingReservedCapacitySeconds, 670)
    assert.equal(summary.maximumAggregatePlanningDollars, 2.5125)
    assert.equal(summary.admissionStatus, 'conditional_voice_blocked')
    assert.equal(summary.amendedSequence.passed, false)
    assert.match(summary.amendedSequence.reason, /new Text pass/)
    assert.equal(summary.results[0].historical, false)
    assert.equal(summary.results[0].behaviorStatus, 'blocked')
    assert.equal(summary.results[0].cleanup.activeTracks, 0)
    assert.equal(summary.originalAllowanceSha256, createHash('sha256').update(originalAllowance).digest('hex'))
    assert.equal(summary.amendmentLedgerSha256, createHash('sha256').update(await readFile(join(directory, QA_AMENDMENT_LEDGER))).digest('hex'))
    assert.deepEqual(await readFile(join(directory, 'campaign.jsonl')), original)
    assert.deepEqual(await readFile(join(directory, 'allowance.jsonl')), originalAllowance)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('partial or corrupt amendment evidence never falls back to an apparently available original slot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-amended-export-corrupt-'))
  try {
    await writeGoal004CHistory(directory)
    await writeFile(join(directory, QA_AMENDMENT_ALLOWANCE), 'corrupt\n')
    await assert.rejects(exportCampaign({ directory, output: join(directory, 'export') }))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('newest linked export counts all preserved attempts, the single final slot and sanitized physical evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-final-export-offline-'))
  try {
    writeGoal004DRetestHistory(directory)
    const historicalFiles = ['campaign.jsonl', 'allowance.jsonl', QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE, QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE]
    const preserved = await Promise.all(historicalFiles.map(file => readFile(join(directory, file))))
    const previous = inspectAmendedCampaign(directory, QA_RUNTIME_AMENDMENT_ID).attempts[2]
    const historyName = '2026-09-28T00-00-00-000Z-text-mission'
    await mkdir(join(directory, historyName))
    await writeFile(join(directory, historyName, 'report.json'), JSON.stringify({ label: textLabel, mode: 'text', scenario: 'mission', reservation: previous, identity: {}, failure: 'Preserved failed fixture.' }))
    await writeFile(join(directory, historyName, 'audio-evidence.json'), JSON.stringify({ label: textLabel, events: [] }))
    const runtime = await exportCampaign({ directory, output: join(directory, 'runtime-export') })
    assert.equal(runtime.amendmentId, QA_RUNTIME_AMENDMENT_ID)
    assert.equal(runtime.attempts, 3); assert.equal(runtime.historicalAttempts, 2)
    assert.equal(runtime.historicalProductionAttempts, 2); assert.equal(runtime.newProductionAttempts, 1)
    assert.equal(runtime.admissionStatus, 'conditional_voice_blocked')
    assert.equal(runtime.results[0].accountingAttempt, 3); assert.equal(runtime.results[0].historical, false)

    initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID, now: () => 2_000_000_000_000 })
    const unused = await exportCampaign({ directory, output: join(directory, 'unused-export') })
    assert.equal(unused.amendmentId, QA_CONFIRMED_AMENDMENT_ID)
    assert.equal(unused.historicalAttempts, 3); assert.equal(unused.newAttempts, 0)
    assert.equal(unused.remainingAttempts, 1); assert.equal(unused.amendedSequence.passed, false)
    assert.equal(unused.admissionStatus, 'requires_final_voice_frozen_candidate_admission')
    assert.equal(unused.results[0].historical, true)

    const identity = { commit: 'c'.repeat(40), runtimeSha256: 'a'.repeat(64), harnessSha256: 'b'.repeat(64) }
    const budget = new AmendedCampaignBudget(directory, () => 2_000_000_000_100, QA_CONFIRMED_AMENDMENT_ID)
    const reservation = budget.reserve({ name: 'voice-mission', identity })
    const allowancePath = join(directory, QA_CONFIRMED_AMENDMENT_ALLOWANCE)
    await writeFile(allowancePath, await readFile(allowancePath, 'utf8') + JSON.stringify({ reservedAt: reservation.reservedAt, leaseUntil: reservation.leaseUntil }) + '\n')
    budget.finish(4, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 20 }); budget.closed(4)
    const confirmedLabel = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI'
    const name = '2033-05-18T03-33-20-100Z-voice-mission'; const attemptPath = join(directory, name)
    await mkdir(attemptPath)
    const physical = { digest: 'd'.repeat(64), commits: [], observedAt: 2_000_000_000_120, state: 'excluded-hidden-fixture' }
    await writeFile(join(attemptPath, 'report.json'), JSON.stringify({ label: confirmedLabel, mode: 'voice', scenario: 'mission', reservation, identity,
      initialPhysicalTruth: physical, finalPhysicalTruth: { ...physical, commits: [{ proposalId: 'proposal-one', sessionId: 'excluded-hidden-fixture', revisionAfter: 1 }] },
      regressionCanary: { status: 'passed', inputs: ['Please inspect the Latch.'], informationTurnId: 3, noPhysicalCommit: true, confirmationCount: 0, physical },
      runtimePolicyDelivery: { sha256: 'e'.repeat(64), matchesExpected: true, messageCount: 1, config: 'excluded-hidden-fixture' },
      confirmationAudit: { commits: 1, confirmations: 1, everyCommitHasExactConfirmation: true, everyCommittedConfirmationHasCommit: true, uniqueCommitIds: true },
    }))
    await writeFile(join(attemptPath, 'audio-evidence.json'), JSON.stringify({ label: confirmedLabel, events: [] }))
    const output = join(directory, 'final-export'); const summary = await exportCampaign({ directory, output })
    assert.equal(summary.attempts, 4); assert.equal(summary.productionAttempts, 4)
    assert.equal(summary.newAttempts, 1); assert.equal(summary.historicalProductionAttempts, 3); assert.equal(summary.newProductionAttempts, 1)
    assert.equal(summary.reservedSeconds, 2680); assert.equal(summary.estimatedReservedDollars, 3.35)
    assert.equal(summary.remainingAttempts, 0); assert.equal(summary.admissionStatus, 'exhausted')
    assert.equal(summary.amendmentLedgerSha256, createHash('sha256').update(await readFile(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER))).digest('hex'))
    const metrics = JSON.parse(await readFile(join(output, `${name}-metrics.json`), 'utf8'))
    assert.equal(metrics.accountingAttempt, 4); assert.equal(metrics.regressionCanary.noPhysicalCommit, true)
    assert.equal(metrics.regressionCanary.physical.commitCount, 0); assert.equal(metrics.initialPhysicalTruth.digest, physical.digest)
    assert.deepEqual(metrics.finalPhysicalTruth.commitProposalIds, ['proposal-one'])
    assert.equal(metrics.runtimePolicyDelivery.messageCount, 1); assert.equal(metrics.confirmationAudit.everyCommittedConfirmationHasCommit, true)
    assert.doesNotMatch(JSON.stringify(metrics), /excluded-hidden-fixture|revisionAfter|sessionId/)
    for (const [index, file] of historicalFiles.entries()) assert.deepEqual(await readFile(join(directory, file)), preserved[index])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('partial newest runtime, final or recheck supplement never silently exports an older profile', async () => {
  for (const file of [QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE, QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE]) {
    const directory = await mkdtemp(join(tmpdir(), 'qa-newest-export-corrupt-'))
    try {
      writeGoal004CHistory(directory)
      await writeFile(join(directory, file), 'corrupt\n')
      await assert.rejects(exportCampaign({ directory, output: join(directory, 'export') }))
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
})

test('recheck export retains all four consumed attempts and isolates the single fifth reservation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-recheck-export-offline-'))
  try {
    writeGoal004EConfirmedHistory(directory)
    const historicalFiles = ['campaign.jsonl', 'allowance.jsonl', QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE, QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE]
    const preserved = await Promise.all(historicalFiles.map(file => readFile(join(directory, file))))
    initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID, now: () => 2_000_000_000_000 })
    const unused = await exportCampaign({ directory, output: join(directory, 'unused-export') })
    assert.equal(unused.amendmentId, QA_RECHECK_AMENDMENT_ID)
    assert.equal(unused.attempts, 4); assert.equal(unused.historicalAttempts, 4); assert.equal(unused.productionAttempts, 4)
    assert.equal(unused.remainingAttempts, 1); assert.equal(unused.reservedSeconds, 2680)
    assert.equal(unused.newAttempts, 0); assert.equal(unused.newReservedSeconds, 0)
    assert.equal(unused.amendedSequence.mode, 'voice'); assert.equal(unused.amendedSequence.passed, false)
    assert.equal(unused.admissionStatus, 'requires_recheck_voice_frozen_candidate_admission')
    for (const output of ['artifacts/goal-004b/live', 'artifacts/goal-004c/live', 'artifacts/goal-004c/final-acceptance/live', 'artifacts/goal-004d/retest/live', 'artifacts/goal-004e/live']) {
      await assert.rejects(exportCampaign({ directory, output }), /historical compact exports remain unchanged/)
    }
    const identity = { commit: 'c'.repeat(40), runtimeSha256: 'a'.repeat(64), harnessSha256: 'b'.repeat(64) }
    const budget = new AmendedCampaignBudget(directory, () => 2_000_000_000_100, QA_RECHECK_AMENDMENT_ID)
    const reservation = budget.reserve({ name: 'voice-mission', identity })
    const allowancePath = join(directory, QA_RECHECK_AMENDMENT_ALLOWANCE)
    await writeFile(allowancePath, await readFile(allowancePath, 'utf8') + JSON.stringify({ reservedAt: reservation.reservedAt, leaseUntil: reservation.leaseUntil }) + '\n')
    budget.finish(5, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 20 }); budget.closed(5)
    const confirmedLabel = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI'
    const name = '2033-05-18T03-33-20-100Z-voice-mission'; const attemptPath = join(directory, name)
    await mkdir(attemptPath)
    await writeFile(join(attemptPath, 'report.json'), JSON.stringify({ label: confirmedLabel, mode: 'voice', scenario: 'mission', reservation, identity, failure: 'Constructed offline exporter fixture.' }))
    await writeFile(join(attemptPath, 'audio-evidence.json'), JSON.stringify({ label: confirmedLabel, events: [] }))
    const summary = await exportCampaign({ directory, output: join(directory, 'recheck-export') })
    assert.equal(summary.amendmentId, QA_RECHECK_AMENDMENT_ID)
    assert.equal(summary.attempts, 5); assert.equal(summary.productionAttempts, 5)
    assert.equal(summary.historicalAttempts, 4); assert.equal(summary.newAttempts, 1)
    assert.equal(summary.reservedSeconds, 3350); assert.equal(summary.newReservedSeconds, 670)
    assert.equal(summary.remainingAttempts, 0); assert.equal(summary.admissionStatus, 'exhausted')
    assert.equal(summary.results[0].accountingAttempt, 5); assert.equal(summary.results[0].historical, false)
    assert.equal(summary.amendmentLedgerSha256, createHash('sha256').update(await readFile(join(directory, QA_RECHECK_AMENDMENT_LEDGER))).digest('hex'))
    for (const [index, file] of historicalFiles.entries()) assert.deepEqual(await readFile(join(directory, file)), preserved[index])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
