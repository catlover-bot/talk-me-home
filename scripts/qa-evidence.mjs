// Local, read-only campaign inspection plus explicit compact evidence exports. No provider access.
import { readFile, readdir, mkdir, writeFile, access, lstat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectCampaign } from './qa-budget.mjs'
import { inspectAmendedCampaign, QA_AMENDMENT_ID, QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE,
  QA_RUNTIME_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE,
  QA_CONFIRMED_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE,
  QA_RECHECK_AMENDMENT_ID, QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE, QA_GOAL005_AMENDMENT_ID, QA_GOAL005_AMENDMENT_LEDGER, QA_GOAL005_AMENDMENT_ALLOWANCE } from './qa-amended-budget.mjs'
import { assertGoal004CAmendedNextAttempt, assertGoal004DNextAttempt } from './qa-live-authorization.mjs'
import { validateSpeechWav } from './qa-speech-fixtures.mjs'

const LABEL = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI'
const TEXT_LABEL = 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI'
const CONFIRMED_LABEL = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI'
const MIXED_LABEL = 'AUTOMATED QA — UI LIVE TEXT / SYNTHETIC VOICE — REAL ASSEMBLYAI'
const round = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : null
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const exists = path => access(path).then(() => true, () => false)
const iso = value => Number.isSafeInteger(value) ? new Date(value).toISOString() : null
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null
const present = path => lstat(path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error })
const text = value => {
  if (typeof value !== 'string') return null
  if (/\b(?:Bearer\s+\S+|ASSEMBLYAI_API_KEY|GAME_DEMO_ACCESS_CODE|(?:token|resume_token|authorization|cookie)\s*[:=]\s*\S+)/i.test(value)) throw new Error('Credential-like text was excluded from the compact export; inspect the local source privately.')
  return value.replace(/(?:https?|wss?):\/\/\S+/g, '[URL omitted]').slice(0, 12_000)
}
const visibleMessage = item => ({
  source: 'Visible application history snapshot; final/interrupted status may be unavailable',
  speaker: item.speaker === 'Game event' ? 'Game event' : item.speaker === 'Pip' ? 'Pip' : 'Mission Control', text: text(item.text), sourceLabel: text(item.sourceLabel),
  chapterLabel: text(item.chapterLabel), final: typeof item.final === 'boolean' ? item.final : null,
  interrupted: typeof item.interrupted === 'boolean' ? item.interrupted : null,
  ...(item.historyIndex !== undefined ? { historyIndex: count(item.historyIndex) } : {}),
  ...(item.displayedAt !== undefined ? { displayedAt: text(item.displayedAt) } : {}),
  ...(item.provenance !== undefined ? { provenance: text(item.provenance) } : {}),
})
const turnIdentity = value => typeof value === 'string' ? text(value) : count(value)
const choice = (value, allowed) => allowed.includes(value) ? value : 'unknown'
const proposalSummary = proposal => proposal ? {
  proposalId: text(proposal.proposalId), label: text(proposal.label),
  status: choice(proposal.status, ['awaiting_confirmation', 'confirming', 'committed', 'declined', 'expired', 'invalidated', 'failed']),
} : null
const actionRequestSummary = request => ({
  intendedRequest: text(request.intendedRequest), expectedLabel: text(request.expectedLabel), sourceChapter: text(request.sourceChapter),
  strictFirstResponse: request.strictFirstResponse === true, recovered: request.recovered === true,
  outcome: choice(request.outcome, ['pending', 'committed', 'failed']), failure: text(request.failure),
  exchanges: (request.exchanges ?? []).map(exchange => ({
    kind: choice(exchange.kind, ['initial', 'clarification', 'rephrased_request']), text: text(exchange.text),
    outcome: choice(exchange.outcome, ['pending', 'matching_pending', 'verified_committed_receipt', 'relevant_clarification', 'stale_pending', 'wrong_pending', 'false_completion', 'unconfirmed_commit', 'rejected_or_unresolved', 'no_relevant_reply']),
    proposal: proposalSummary(exchange.proposal),
    replies: (exchange.replies ?? []).map(reply => ({ ...visibleMessage({ ...reply, chapterLabel: reply.chapter, speaker: 'Pip' }), messageId: text(reply.messageId) })),
  })),
})
const preSubmitSummary = wait => ({
  beforeTurnId: turnIdentity(wait.beforeTurnId), settled: wait.settled === true,
  ...(typeof wait.fatal === 'boolean' ? { fatal: wait.fatal } : {}),
  reason: choice(wait.reason, ['input_waveform_not_drained', 'input_not_observed', 'asr_turn_open', 'asr_final_pending', 'tool_result_pending', 'reply_pending', 'final_response_pending', 'playback_not_drained', 'provider_error', 'late_event_observation_window', 'response_and_playback_drained', 'wait_input_drained', 'session_ended', 'tool_continuation_pending', 'acknowledgement_response_pending', 'acknowledgement_failed', 'acknowledgement_opportunity_pending', 'acknowledgement_opportunity_expired', 'acknowledgement_cancelled_and_drained', 'acknowledgement_and_playback_drained']),
  startedAtMs: round(wait.startedAtMs), endedAtMs: round(wait.endedAtMs), waitedMs: round(wait.waitedMs),
})
const stepProvenance = step => ({
  ...(step.turnId !== undefined ? { turnId: turnIdentity(step.turnId) } : {}),
  ...(step.startedAtMs !== undefined ? { startedAtMs: Number.isFinite(step.startedAtMs) ? step.startedAtMs : null } : {}),
  ...(step.endedAtMs !== undefined ? { endedAtMs: Number.isFinite(step.endedAtMs) ? step.endedAtMs : null } : {}),
  ...(step.settled !== undefined ? { settled: typeof step.settled === 'boolean' ? step.settled : null } : {}),
  ...(step.terminal !== undefined ? { terminal: typeof step.terminal === 'boolean' ? step.terminal : null } : {}),
  ...(step.inputSource !== undefined ? { inputSource: text(step.inputSource) } : {}),
  ...(Array.isArray(step.messages) ? { messages: step.messages.map(visibleMessage) } : {}),
  ...(step.proposal ? { proposal: { label: text(step.proposal.label), status: text(step.proposal.status), proposalId: text(step.proposal.proposalId) } } : {}),
})
const physicalSummary = value => value ? {
  digest: digest(value.digest), commitCount: Array.isArray(value.commits) ? value.commits.length : null,
  observedAt: iso(value.observedAt),
  // Only opaque proposal references leave the evaluator; no physical fields or session IDs.
  commitProposalIds: Array.isArray(value.commits) ? value.commits.map(commit => text(commit.proposalId)) : [],
} : null

function summarizeBehavior(behavior) {
  const finding = item => ({
    ...Object.fromEntries(['code', 'layer', 'subject', 'request', 'intent', 'name', 'outcome'].filter(key => key in item).map(key => [key, text(item[key])])),
    ...Object.fromEntries(['callRef', 'replyRef'].filter(key => key in item).map(key => [key, count(item[key])])),
    ...Object.fromEntries(['atMs', 'resultAtMs'].filter(key => key in item).map(key => [key, Number.isFinite(item[key]) ? item[key] : null])),
    ...('turnId' in item ? { turnId: turnIdentity(item.turnId) } : {}),
    ...(typeof item.blocking === 'boolean' ? { blocking: item.blocking } : {}),
    ...(Array.isArray(item.quotes) ? { quotes: item.quotes.map(text) } : {}),
  })
  return {
    status: ['pass', 'blocked', 'review_required'].includes(behavior.status) ? behavior.status : 'review_required',
    materialDefects: (behavior.materialDefects ?? []).map(finding), uncertainties: (behavior.uncertainties ?? []).map(finding),
    turns: (behavior.turns ?? []).map(turn => ({
      turnId: turnIdentity(turn.turnId), request: text(turn.request), intent: text(turn.intent),
      sourceWindow: { startedAtMs: Number.isFinite(turn.sourceWindow?.startedAtMs) ? turn.sourceWindow.startedAtMs : null, endedAtMs: Number.isFinite(turn.sourceWindow?.endedAtMs) ? turn.sourceWindow.endedAtMs : null },
      replies: (turn.replies ?? []).map(reply => ({ ...visibleMessage({ ...reply, speaker: 'Pip' }), ...(reply.messageId !== undefined ? { messageId: text(reply.messageId) } : {}) })),
      tools: (turn.tools ?? []).map(finding),
      ...(turn.agreedPlanSourceTurnId !== undefined ? { agreedPlanSourceTurnId: turnIdentity(turn.agreedPlanSourceTurnId) } : {}),
    })),
    reviewedToolCalls: count(behavior.reviewedToolCalls), boundary: text(behavior.boundary),
  }
}

export function durationBounds(report, evidence, reservation) {
  const open = evidence.events.find(event => event.type === 'socket.open')
  const end = evidence.events.find(event => event.type === 'session.end')
  const close = evidence.events.find(event => event.type === 'socket.close')
  const acknowledged = evidence.events.some(event => event.type === 'session.ended')
  const origin = report.audioTimeOriginWallMs
  const exactLocalSeconds = open && close ? (close.atMs - open.atMs) / 1000 : null
  const throughEndRequest = open && end ? (end.atMs - open.atMs) / 1000 : null
  const cleanupUpper = open && Number.isFinite(origin) && Number.isSafeInteger(reservation?.closedAt) ? (reservation.closedAt - origin - open.atMs) / 1000 : null
  const localUpper = exactLocalSeconds ?? cleanupUpper
  return {
    observedSocketOpenToEndSentLowerBoundSeconds: round(throughEndRequest),
    observedSocketOpenToCloseSeconds: round(exactLocalSeconds),
    socketOpenToVerifiedOwnedProcessCleanupUpperBoundSeconds: round(cleanupUpper),
    localConnectionUpperBoundSeconds: round(localUpper),
    documentedDisconnectGraceSeconds: acknowledged ? 0 : 30,
    remoteSecondsWithDocumentedGraceUpperEstimate: Number.isFinite(localUpper) ? round(localUpper + (acknowledged ? 0 : 30)) : null,
    supervisorClosedAt: iso(reservation?.closedAt),
    accountingBoundary: 'Derived observation bounds only; missing socket-close or session.ended events remain missing. The remote upper estimate assumes documented disconnect grace and verified owned-process cleanup, is not an invoice, and does not reduce the full durable reservation.',
  }
}

export function approximateVideoAlignment(report) {
  const start = report.videoPageCreationStartedAt
  const created = report.videoPageCreatedAt
  const origin = report.audioTimeOriginWallMs
  if (![start, created, origin].every(Number.isFinite) || created < start || origin < start) return null
  const offsetMs = origin - (start + created) / 2
  if (offsetMs < 0 || offsetMs > 30_000) return null
  return { offsetMs: round(offsetMs), creationIntervalHalfWidthMs: round((created - start) / 2), source: 'Approximation from QA audio wall-clock origin minus the midpoint of the browser page creation interval. The interval does not bound additional recording-pipeline delay; synchronization is not sample accurate.' }
}

export function summarizeAttempt(report, evidence, reservation) {
  if (![LABEL, TEXT_LABEL, CONFIRMED_LABEL].includes(report.label) || evidence.label !== report.label || !Array.isArray(evidence.events)
    || report.label === TEXT_LABEL && report.mode !== 'text') throw new Error('Only consistently labelled real-provider Text or synthetic Voice QA evidence is accepted.')
  const events = evidence.events
  const endSent = events.find(event => event.type === 'session.end')
  const ended = events.find(event => event.type === 'session.ended')
  const socketOpen = events.find(event => event.type === 'socket.open')
  const socketClose = events.find(event => event.type === 'socket.close')
  const finalTranscripts = events.filter(event => ['transcript.user', 'transcript.agent'].includes(event.type) && event.final === true).map(event => ({ atMs: round(event.atMs), source: event.type === 'transcript.user' ? 'Real provider ASR' : 'Real provider agent transcript', text: text(event.text), reference: Number.isSafeInteger(event.reference) ? event.reference : null, interrupted: typeof event.interrupted === 'boolean' ? event.interrupted : null }))
  const utterances = events.filter(event => event.type === 'synthetic.speech.queued').map((queued, index, all) => {
    const start = events.find(event => event.type === 'synthetic.speech.started' && event.id === queued.id && event.atMs >= queued.atMs)
    const end = events.find(event => event.type === 'synthetic.speech.ended' && event.id === queued.id && event.atMs >= queued.atMs)
    const next = all[index + 1]?.atMs ?? Infinity
    const finals = events.filter(event => event.type === 'transcript.user' && event.final === true && event.atMs >= queued.atMs && event.atMs < next)
    const firstProvider = end && events.find(event => event.type === 'audio.provider.onset' && event.atMs >= end.atMs && event.atMs < next)
    const firstRendered = end && events.find(event => event.type === 'audio.rendered.onset' && event.atMs >= end.atMs && event.atMs < next)
    return {
      fixture: text(queued.id), syntheticText: text(queued.text), startedAtMs: round(start?.atMs), endedAtMs: round(end?.atMs), durationSeconds: round(queued.durationSeconds),
      asrFinals: finals.map(event => ({ text: text(event.text), atMs: round(event.atMs), waveformEndToAsrFinalMs: end ? round(event.atMs - end.atMs) : null })),
      waveformEndToFirstSubsequentProviderOnsetMs: firstProvider ? round(firstProvider.atMs - end.atMs) : null,
      waveformEndToFirstSubsequentRenderedChunkReceiptMs: firstRendered ? round(firstRendered.atMs - end.atMs) : null,
      firstSubsequentRenderedChunkStartAtMs: round(firstRendered?.audioAtMs),
    }
  })
  const tools = events.filter(event => event.type === 'tool.call').map(call => {
    const results = Number.isSafeInteger(call.callRef) ? events.filter(event => event.type === 'tool.result' && event.callRef === call.callRef && event.atMs >= call.atMs) : []
    const result = results.length === 1 ? results[0] : undefined
    const pending = result?.actionStatus === 'awaiting_confirmation';
    return { name: ['observe_room', 'inspect_object', 'inspect_gate', 'interact_object', 'move_to', 'propose_interaction', 'propose_move', 'get_action_status'].includes(call.name) ? call.name : 'other', callRef: count(call.callRef), replyRef: count(call.replyRef), resultReplyRef: count(result?.replyRef), callAtMs: round(call.atMs), resultAtMs: round(result?.atMs), callToResultMs: result ? round(result.atMs - call.atMs) : null, succeeded: pending ? false : typeof result?.isError === 'boolean' ? !result.isError : null, status: !result ? 'missing_result' : pending ? 'awaiting_confirmation_not_executed' : result.isError === true ? 'error' : result.isError === false ? 'success' : 'unknown', ...(result?.actionStatus ? { actionStatus: text(result.actionStatus), proposalRef: count(result.proposalRef) } : {}) }
  })
  const audio = Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(kind => {
    const counter = evidence.counters?.[kind] ?? {}
    return [kind, { chunks: count(counter.chunks), samples: count(counter.samples), nonzeroSamples: count(counter.nonzeroSamples), energy: round(counter.energy), lastNonzeroMarkerAtMs: round(counter.lastNonzeroMs) }]
  }))
  const visible = (report.visibleHistory ?? []).map(visibleMessage)
  const typedSteps = (report.steps ?? []).filter(step => step.inputMode === 'text' && typeof step.utterance === 'string')
  const typedTurns = typedSteps.length
    ? typedSteps.map(step => ({ source: 'QA player UI submission record; not ASR or proof of provider delivery', text: text(step.utterance), recordedAfterTurnAtMs: round(step.elapsedMs), ...stepProvenance(step) }))
    : visible.filter(item => item.speaker === 'Mission Control' && /Live Text.*Typed/.test(item.sourceLabel ?? '')).map(item => ({ source: 'Visible Live Text typed history; not ASR', text: item.text, recordedAfterTurnAtMs: null }))
  return {
    label: report.label, mode: report.mode === 'text' ? 'text' : 'voice', scenario: text(report.scenario), commit: /^[0-9a-f]{40}$/.test(report.identity?.commit) ? report.identity.commit : null,
    runtimeSha256: /^[0-9a-f]{64}$/.test(report.identity?.runtimeSha256) ? report.identity.runtimeSha256 : null,
    harnessSha256: /^[0-9a-f]{64}$/.test(report.identity?.harnessSha256) ? report.identity.harnessSha256 : null,
    ...(report.identity?.fixtureSha256 ? { fixtureSha256: /^[0-9a-f]{64}$/.test(report.identity.fixtureSha256) ? report.identity.fixtureSha256 : null } : {}),
    nodeVersion: /^v\d+\.\d+\.\d+$/.test(report.identity?.node) ? report.identity.node : null,
    browserVersion: /^\d+(?:\.\d+){1,4}$/.test(report.browserVersion) ? report.browserVersion : null,
    ...(report.accountRefusal ? { accountRefusal: choice(report.accountRefusal, ['provider_credit_refused', 'provider_credential_or_account_refused']) } : {}),
    inputMode: text(report.inputMode), completion: report.completion === true, route: (report.route ?? []).map(text), failure: text(report.failure), tokenRequests: count(report.tokenRequests),
    ...(report.voicePath ? { voicePath: Object.fromEntries(['syntheticMicrophoneOnly', 'actualAsrFinalObserved', 'nonzeroInput', 'nonzeroProviderAudio', 'nonzeroRenderedAudio', 'nonzeroPostVolumeAudio'].map(key => [key, report.voicePath[key] === true])) } : {}),
    ending: { explicitEndSent: Boolean(endSent), endAcknowledged: Boolean(ended), endSentAtMs: round(endSent?.atMs), endAcknowledgedAtMs: round(ended?.atMs), endAcknowledgementDelayMs: ended && endSent ? round(ended.atMs - endSent.atMs) : null, socketCloseCode: socketClose?.code ?? null, socketCloseWasClean: socketClose?.clean ?? null, localConnectedSeconds: socketOpen && (ended || socketClose) ? round(((ended ?? socketClose).atMs - socketOpen.atMs) / 1000) : null, providerSessionSeconds: Number.isFinite(report.providerDurationSeconds) ? report.providerDurationSeconds : null },
    durationBounds: durationBounds(report, evidence, reservation),
    checkpoints: (report.checkpoints ?? []).filter(checkpoint => ['Cargo Bay', 'Relay Gallery', 'Return Dock', 'You brought Pip home.', 'Home'].includes(checkpoint.title) && Number.isFinite(checkpoint.observedAtMs)).map(checkpoint => ({ title: checkpoint.title, observedAtMs: round(checkpoint.observedAtMs), source: 'Human-visible chapter/completion heading observed by the browser driver' })),
    audio, utterances, typedTurns, tools, finalTranscripts, visibleHistory: visible,
    decisionReceipts: events.filter(event => event.type === 'conversation.message' && event.purpose === 'decision_receipt').map(event => ({ atMs: round(event.atMs), proposalRef: count(event.proposalRef), perceptionPresent: event.perceptionPresent === true, perceptionOrigin: text(event.perceptionOrigin), visitRef: count(event.visitRef), observationRevision: count(event.observationRevision) })),
    responseRequests: events.filter(event => event.type === 'reply.create').map(event => ({ atMs: round(event.atMs), purpose: text(event.purpose), reportKind: text(event.reportKind), perceptionPresent: event.perceptionPresent === true, perceptionOrigin: text(event.perceptionOrigin), visitRef: count(event.visitRef), observationRevision: count(event.observationRevision) })),
    ...((report.steps ?? []).some(step => step.turnId !== undefined) ? { inputSteps: report.steps.map(step => ({
      inputMode: ['text', 'voice'].includes(step.inputMode) ? step.inputMode : null, utterance: text(step.utterance),
      fixture: text(step.fixture), ...stepProvenance(step), failureLayer: text(step.failureLayer), reason: text(step.reason),
    })) } : {}),
    ...(report.behavior ? { behavior: summarizeBehavior(report.behavior) } : {}),
    ...(Array.isArray(report.actionRequests) ? { actionRequests: report.actionRequests.map(actionRequestSummary) } : {}),
    ...(Array.isArray(report.acquisitions) ? { acquisitions: report.acquisitions.map(item => ({
      subject: text(item.subject), outcome: text(item.outcome), strictFirstResponse: item.strictFirstResponse === true, recovered: item.recovered === true,
      startedAt: round(item.startedAt), endedAt: round(item.endedAt), deadlineAt: round(item.deadlineAt), failure: text(item.failure),
      exchanges: (item.exchanges ?? []).map(exchange => ({ text: text(exchange.text), reason: text(exchange.reason), reply: text(exchange.reply), outcome: text(exchange.outcome), startedAt: round(exchange.startedAt), endedAt: round(exchange.endedAt) })),
    })) } : {}),
    ...(report.recoveryExercise ? { recoveryExercise: Object.fromEntries(Object.entries(report.recoveryExercise).filter(([key]) => ['status', 'label', 'proposalId', 'reason', 'source', 'outcome', 'kind', 'declined', 'recovered', 'completed'].includes(key)).map(([key, value]) => [key, typeof value === 'boolean' ? value : text(value)])) } : {}),
    ...(Array.isArray(report.boundaryWaits) ? { boundaryWaits: report.boundaryWaits.map(preSubmitSummary) } : {}),
    decisionContextDeliveries: events.filter(event => event.type === 'decision.context.delivery').map(event => ({ atMs: round(event.atMs), sha256: digest(event.sha256), proposalRef: count(event.proposalRef), perceptionPresent: event.perceptionPresent === true, boundary: text(event.boundary) })),
    ...(Array.isArray(report.preSubmitWaits) ? { preSubmitWaits: report.preSubmitWaits.map(preSubmitSummary) } : {}),
    ...(Array.isArray(report.confirmations) ? { confirmations: report.confirmations.map(receipt => ({ proposalId: text(receipt.proposalId), label: text(receipt.label), intendedRequest: text(receipt.intendedRequest), status: text(receipt.status),
      confirmationRequestedAtMs: round(receipt.confirmationRequestedAtMs), confirmedAtMs: round(receipt.confirmedAtMs), source: text(receipt.source) })) } : {}),
    ...(report.confirmationAudit ? { confirmationAudit: { commits: count(report.confirmationAudit.commits), confirmations: count(report.confirmationAudit.confirmations), everyCommitHasExactConfirmation: report.confirmationAudit.everyCommitHasExactConfirmation === true,
      everyCommittedConfirmationHasCommit: report.confirmationAudit.everyCommittedConfirmationHasCommit === true, uniqueCommitIds: report.confirmationAudit.uniqueCommitIds === true } } : {}),
    ...(report.regressionCanary ? { regressionCanary: {
      status: ['passed', 'failed'].includes(report.regressionCanary.status) ? report.regressionCanary.status : 'unknown',
      inputs: (report.regressionCanary.inputs ?? []).map(text), informationTurnId: turnIdentity(report.regressionCanary.informationTurnId),
      noPhysicalCommit: report.regressionCanary.noPhysicalCommit === true, confirmationCount: count(report.regressionCanary.confirmationCount),
      physical: physicalSummary(report.regressionCanary.physical),
      ...(report.regressionCanary.explicitLatchRequest ? { explicitLatchRequest: { turnId: turnIdentity(report.regressionCanary.explicitLatchRequest.turnId), text: text(report.regressionCanary.explicitLatchRequest.text) } } : {}),
      boundary: text(report.regressionCanary.boundary),
    } } : {}),
    ...(report.initialPhysicalTruth ? { initialPhysicalTruth: physicalSummary(report.initialPhysicalTruth) } : {}),
    ...(report.finalPhysicalTruth ? { finalPhysicalTruth: physicalSummary(report.finalPhysicalTruth) } : {}),
    ...(report.runtimePolicyDelivery ? { runtimePolicyDelivery: { sha256: digest(report.runtimePolicyDelivery.sha256),
      matchesExpected: report.runtimePolicyDelivery.matchesExpected === true, messageCount: count(report.runtimePolicyDelivery.messageCount) } } : {}),
    visibleHistoryBoundary: 'These source reports retained speaker and text but may omit final/interrupted markers. Entries can therefore include partial or interrupted snippets; missing markers remain null. No finality or successful playback is inferred from matching a provider transcript.',
    cleanup: { activeTracks: count(report.cleanup?.activeTracks), activeSources: count(report.cleanup?.activeSources), openApplicationContexts: count(report.cleanup?.openApplicationContexts) },
    ...(Array.isArray(report.lifecycle) ? { lifecycle: report.lifecycle.filter(event => ['end.requested', 'session.end', 'session.ended', 'socket.open', 'socket.close', 'browser.close.requested', 'browser.closed', 'server.close.requested', 'server.closed'].includes(event.type)).map(event => ({
      type: event.type, observedAt: text(event.observedAt), elapsedMs: Number.isFinite(event.elapsedMs) ? event.elapsedMs : null,
      source: ['browser', 'driver'].includes(event.source) ? event.source : null,
      outcome: ['observed', 'requested', 'not_observed', 'bounded_timeout'].includes(event.outcome) ? event.outcome : null,
      ...(Number.isFinite(event.browserAtMs) ? { browserAtMs: event.browserAtMs } : {}),
      ...(Number.isInteger(event.code) ? { code: event.code } : {}),
      ...(typeof event.clean === 'boolean' ? { clean: event.clean } : {}),
      ...(Number.isFinite(event.durationSeconds) ? { durationSeconds: event.durationSeconds } : {}),
    })) } : {}),
    timingNotes: [
      'Measurements describe this small synthetic sample, not a production SLA or human latency study.',
      'Waveform end includes fixture padding; ASR may finalize before that end or split one fixture into several turns. Negative delays are retained.',
      'Provider onset means the first recorded nonzero-audio onset after a quiet gap. It is not necessarily the first reply.audio frame.',
      'Rendered onset receipt is the main-thread receipt of a nonzero playback chunk. Chunk start is approximate to the 100 ms observer chunk; it is not the exact first nonzero sample.',
      'Tool call-to-result includes waiting for reply.done before returning the result. It is not a pure server HTTP round-trip measurement.',
      'Chapter route is the player-observed report. Checkpoint times, when present, are the first observed visible heading; they are not inferred from tool payloads.',
      'A clean WebSocket close without session.ended does not confirm remote termination.',
    ],
    boundary: report.label === TEXT_LABEL ? 'Player text was submitted through the normal UI; provider replies and digital output are separate evidence. No ASR, physical microphone, loudspeaker routing, human listening, or enjoyment pass is inferred from Text.' : `${report.label === CONFIRMED_LABEL ? 'Synthetic voice plus deliberate UI confirmation; not hands-free gameplay. Game events are application-generated decision receipts, not player speech. ' : ''}Synthetic source and digital rendered capture only. No physical microphone, loudspeaker routing, room acoustics, human listening, or enjoyment was measured.`,
  }
}

function run(command, args, timeout = 30_000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let output = ''; let settled = false
    child.stdout.on('data', chunk => { if (output.length < 100_000) output += chunk })
    child.stderr.resume()
    const timer = setTimeout(() => { child.kill('SIGTERM'); if (!settled) { settled = true; reject(new Error('Local media inspection exceeded its finite deadline.')) } }, timeout)
    child.once('error', () => { clearTimeout(timer); if (!settled) { settled = true; reject(new Error('The requested local media tool is unavailable.')) } })
    child.once('close', code => { clearTimeout(timer); if (settled) return; settled = true; code === 0 ? resolveRun(output) : reject(new Error('Local media processing failed.')) })
  })
}

export async function probeMedia(path) {
  const result = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,sample_rate,channels,width,height:format=duration', '-of', 'json', path]))
  return { file: basename(path), durationSeconds: Number.isFinite(Number(result.format?.duration)) ? Number(result.format.duration) : null, streams: (result.streams ?? []).map(stream => ({ type: stream.codec_type, codec: stream.codec_name, ...(stream.codec_type === 'audio' ? { sampleRate: Number(stream.sample_rate), channels: stream.channels } : {}), ...(stream.codec_type === 'video' ? { width: stream.width, height: stream.height } : {}) })) }
}

async function prepareLocalMedia(directory, { mux, alignment }) {
  const names = (await readdir(directory)).filter(name => /\.(wav|webm|mp4)$/i.test(name) && !name.startsWith('qa-combined'))
  const probes = []
  for (const name of names) {
    try { probes.push(await probeMedia(join(directory, name))) }
    catch { probes.push({ file: name, inspection: 'Unavailable or invalid; no stream claim is made.' }) }
  }
  const video = probes.find(probe => probe.streams?.some(stream => stream.type === 'video'))
  const result = { files: probes, videoStatus: video ? video.streams.some(stream => stream.type === 'audio') ? 'Video contains an audio stream; its content still requires verification.' : 'Source video is silent; separate captured digital WAV files retain the test audio.' : 'No source video file exists for this attempt.', mux: 'Not requested.' }
  if (!mux) return result
  const input = join(directory, 'input-digital.wav')
  const rendered = join(directory, 'rendered-digital.wav')
  if (!await exists(input) || !await exists(rendered)) return { ...result, mux: 'Missing captured source WAV; no substitute audio was produced.' }
  const combined = join(directory, 'qa-combined-digital.wav')
  if (!await exists(combined)) await run('ffmpeg', ['-nostdin', '-n', '-v', 'error', '-i', input, '-i', rendered, '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:weights=0.5 0.5:normalize=0[a]', '-map', '[a]', '-c:a', 'pcm_s16le', combined], 60_000)
  result.combinedDigitalAudio = await probeMedia(combined)
  result.mux = 'Original synthetic input and actual rendered output combined on their shared recorded QA timeline, at half gain each. No generated or replaced Pip answer.'
  if (!video) return result
  const videoOffsetMs = alignment?.offsetMs
  if (!Number.isFinite(videoOffsetMs)) return { ...result, mux: `${result.mux} Video alignment was not measured; video remains silent rather than inventing synchronization.` }
  if (videoOffsetMs < 0 || videoOffsetMs > 30_000) throw new Error('Video alignment must be a measured 0–30000 ms offset from video start to the QA audio origin.')
  const muxed = join(directory, 'qa-combined-video.mp4')
  if (!await exists(muxed)) await run('ffmpeg', ['-nostdin', '-n', '-v', 'error', '-i', join(directory, video.file), '-itsoffset', String(videoOffsetMs / 1000), '-i', combined, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', muxed], 60_000)
  result.muxedVideo = await probeMedia(muxed)
  result.videoAlignment = alignment
  result.mux += ' Video synchronization is approximate from the reported page-creation interval; it is not sample accurate.'
  return result
}

function conversationMarkdown(attempt) {
  const lines = [`# ${attempt.label}`, '', `Scenario: ${attempt.scenario}. Runtime SHA-256: \`${attempt.runtimeSha256}\`.`, '', 'Provider final transcripts are preserved separately from typed UI submissions and the application’s visible history. An interrupted provider transcript is not relabelled as a visible or fully played reply.', '', attempt.visibleHistoryBoundary, '']
  if (attempt.typedTurns.length) {
    lines.push('## Typed UI turns', '')
    for (const row of attempt.typedTurns) lines.push(`- **${row.source}**: ${row.text}`, '')
  }
  lines.push('## Real provider final transcripts', '')
  for (const row of attempt.finalTranscripts) lines.push(`- ${row.atMs} ms — **${row.source}**${row.interrupted === true ? ' [interrupted]' : ''}: ${row.text}`, '')
  lines.push('## Visible application history', '')
  for (const row of attempt.visibleHistory) lines.push(`- **${row.speaker}**${row.final === false ? ' [partial]' : ''}${row.interrupted === true ? ' [interrupted]' : ''}: ${row.text}`, '')
  lines.push(`Outcome: ${attempt.failure ? `Failed: ${attempt.failure}` : attempt.completion ? 'Mission completed.' : 'See the scoped metrics; this was not a full mission.'}`, '', `Explicit session.end: ${attempt.ending.explicitEndSent}. session.ended received: ${attempt.ending.endAcknowledged}.`, '', attempt.boundary, '')
  return lines.join('\n')
}

export async function exportCampaign({ directory = resolve('.validation/goal-004b-live'), output, mux = false, videoOffsetMs, fixtureDirectory = resolve('.validation/goal-004b-media') } = {}) {
  directory = resolve(directory)
  // Either supplement file means amended accounting must be complete and valid.
  // A partial/corrupt supplement must never silently fall back to the old ledger.
  let amendment
  for (const candidate of [
    { id: QA_GOAL005_AMENDMENT_ID, ledger: QA_GOAL005_AMENDMENT_LEDGER, allowance: QA_GOAL005_AMENDMENT_ALLOWANCE, output: 'artifacts/goal-005/live' },
    { id: QA_RECHECK_AMENDMENT_ID, ledger: QA_RECHECK_AMENDMENT_LEDGER, allowance: QA_RECHECK_AMENDMENT_ALLOWANCE, output: 'artifacts/goal-004e/recheck-live' },
    { id: QA_CONFIRMED_AMENDMENT_ID, ledger: QA_CONFIRMED_AMENDMENT_LEDGER, allowance: QA_CONFIRMED_AMENDMENT_ALLOWANCE, output: 'artifacts/goal-004e/live' },
    { id: QA_RUNTIME_AMENDMENT_ID, ledger: QA_RUNTIME_AMENDMENT_LEDGER, allowance: QA_RUNTIME_AMENDMENT_ALLOWANCE, output: 'artifacts/goal-004d/retest/live' },
    { id: QA_AMENDMENT_ID, ledger: QA_AMENDMENT_LEDGER, allowance: QA_AMENDMENT_ALLOWANCE, output: 'artifacts/goal-004c/final-acceptance/live' },
  ]) {
    if (await present(join(directory, candidate.ledger)) || await present(join(directory, candidate.allowance))) { amendment = candidate; break }
  }
  const amended = Boolean(amendment)
  const state = amended ? inspectAmendedCampaign(directory, amendment.id) : inspectCampaign(directory)
  output = resolve(output ?? amendment?.output ?? 'artifacts/goal-004b/live')
  const historicalOutputs = ['artifacts/goal-004b/live', 'artifacts/goal-004c/live',
    ...(amendment?.id === QA_GOAL005_AMENDMENT_ID ? ['artifacts/goal-004d/retest/live', 'artifacts/goal-004e/live', 'artifacts/goal-004e/recheck-live'] : []),
    ...(amendment?.id !== QA_AMENDMENT_ID ? ['artifacts/goal-004c/final-acceptance/live'] : []),
    ...([QA_CONFIRMED_AMENDMENT_ID, QA_RECHECK_AMENDMENT_ID].includes(amendment?.id) ? ['artifacts/goal-004d/retest/live'] : []),
    ...(amendment?.id === QA_RECHECK_AMENDMENT_ID ? ['artifacts/goal-004e/live'] : [])]
  if (amended && historicalOutputs.some(path => output === resolve(path))) throw new Error('Amended exports must use a new evidence directory; historical compact exports remain unchanged.')
  if (mux) {
    const location = relative(resolve('.validation'), directory)
    if (!location || location === '..' || location.startsWith(`..${sep}`) || resolve('.validation', location) !== directory) throw new Error('Large processed media must remain within the ignored .validation directory.')
  }
  const attempts = []
  const reports = []
  const usedFixtureIds = new Set()
  const linkedReservations = new Set()
  await mkdir(output, { recursive: true })
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}T[\d-]+Z-(?:(?:text|voice)-)?(?:canary|mission)$/.test(entry.name)) continue
    const path = join(directory, entry.name)
    if (!await exists(join(path, 'report.json')) || !await exists(join(path, 'audio-evidence.json'))) continue
    const reportBytes = await readFile(join(path, 'report.json')); const evidenceBytes = await readFile(join(path, 'audio-evidence.json'))
    const report = JSON.parse(reportBytes); const evidence = JSON.parse(evidenceBytes)
    reports.push(report)
    const opened = evidence.events.find(event => event.type === 'socket.open')
    const socketWallTime = Number.isFinite(report.audioTimeOriginWallMs) && opened ? report.audioTimeOriginWallMs + opened.atMs : null
    const reservationFields = ['attempt', 'name', 'reservedAt', 'reservedSeconds', 'gracefulAt', 'hardAt', 'leaseUntil', ...(report.reservation?.attempt > 1 && amended ? ['identitySha256'] : [])]
    const reservation = report.reservation
      ? state.attempts.find(row => !linkedReservations.has(row.attempt) && reservationFields.every(field => row[field] === report.reservation[field]))
      : [...state.attempts].reverse().find(row => !linkedReservations.has(row.attempt) && Number.isFinite(socketWallTime) && row.reservedAt <= socketWallTime && socketWallTime <= row.hardAt)
        ?? state.attempts.find(row => !linkedReservations.has(row.attempt) && row.name === report.scenario)
    if (report.reservation && !reservation) throw new Error('Recorded attempt reservation does not match one unused campaign reservation.')
    if (reservation) linkedReservations.add(reservation.attempt)
    if (amendment?.id === QA_GOAL005_AMENDMENT_ID && (!reservation || reservation.attempt <= 5)) continue
    const attempt = summarizeAttempt(report, evidence, reservation)
    attempt.accountingAttempt = reservation?.attempt ?? null
    for (const utterance of attempt.utterances) if (/^speech-[a-f0-9]{16}$/.test(utterance.fixture)) usedFixtureIds.add(utterance.fixture)
    attempt.evidenceDirectory = entry.name
    attempt.sourceHashes = { report: sha256(reportBytes), audioEvidence: sha256(evidenceBytes) }
    const alignment = Number.isFinite(videoOffsetMs) ? { offsetMs: videoOffsetMs, source: 'Explicit operator-supplied offset; synchronization is approximate unless independently established.' } : approximateVideoAlignment(report)
    attempt.media = await prepareLocalMedia(path, { mux, alignment })
    await writeFile(join(output, `${entry.name}-metrics.json`), `${JSON.stringify(attempt, null, 2)}\n`)
    await writeFile(join(output, `${entry.name}-conversation.md`), conversationMarkdown(attempt))
    attempts.push({ evidenceDirectory: entry.name, mode: attempt.mode, label: attempt.label, runtimeSha256: attempt.runtimeSha256, failure: attempt.failure, completion: attempt.completion, endAcknowledged: attempt.ending.endAcknowledged,
      ...(amended ? { accountingAttempt: attempt.accountingAttempt, historical: attempt.accountingAttempt !== null && attempt.accountingAttempt <= state.historicalAttempts, behaviorStatus: attempt.behavior?.status ?? null, materialDefects: attempt.behavior?.materialDefects.length ?? null, cleanup: attempt.cleanup,
        processCleanup: { browserClosedObserved: report.lifecycle?.some(event => event.type === 'browser.closed' && event.outcome === 'observed') ?? false, serverClosedObserved: report.lifecycle?.some(event => event.type === 'server.closed' && event.outcome === 'observed') ?? false, supervisorClosedAt: iso(reservation?.closedAt) },
      } : {}),
    })
  }
  const fixtures = []
  for (const id of [...usedFixtureIds].sort()) {
    const metadata = JSON.parse(await readFile(join(fixtureDirectory, `${id}.json`), 'utf8'))
    const validation = validateSpeechWav(await readFile(join(fixtureDirectory, `${id}.wav`)))
    if (metadata.id !== id || metadata.sha256 !== validation.sha256) throw new Error('A used speech fixture no longer matches its original manifest.')
    fixtures.push({ id, text: text(metadata.text), source: text(metadata.source), voice: text(metadata.voice), file: `${id}.wav`, ...validation })
  }
  await writeFile(join(output, 'used-speech-fixtures.json'), `${JSON.stringify({ label: LABEL, boundary: 'Generic installed offline voice. Synthetic player input only; no cloned or human-recorded voice. Large WAV files remain local and ignored.', fixtures }, null, 2)}\n`)
  const last = state.attempts.at(-1)
  const remainingAttempts = state.header.maxAttempts - state.attempts.length
  const nextPermittedAt = remainingAttempts > 0 && last && !(last.result?.endAcknowledged && last.closedAt !== null) ? last.leaseUntil : null
  let admissionStatus = remainingAttempts === 0 ? 'exhausted' : state.header.capacitySeconds === 1340
    ? !last ? 'requires_explicit_supervised_text_attempt'
      : last.name === 'text-mission' && last.result?.outcome === 'passed' && last.result.endAcknowledged && last.closedAt !== null ? 'requires_identical_candidate_voice_guard' : 'voice_blocked_by_text_result_or_cleanup'
    : nextPermittedAt > Date.now() ? 'waiting_for_uncertain_session_lease' : 'ready_for_explicit_supervised_attempt'
  let amendedSequence
  if (amended && amendment.id !== QA_GOAL005_AMENDMENT_ID) {
    const recheckVoice = amendment.id === QA_RECHECK_AMENDMENT_ID
    const finalVoice = recheckVoice || amendment.id === QA_CONFIRMED_AMENDMENT_ID
    const candidate = reports.find(report => report.reservation?.attempt === state.historicalAttempts + 1)?.identity
    amendedSequence = { mode: finalVoice || state.newAttempts !== 0 ? 'voice' : 'text', passed: false,
      reason: remainingAttempts === 0 ? 'The aggregate campaign allowance is exhausted.' : 'No new frozen candidate report is available for a prospective sequencing check.',
      boundary: 'Read-only pure sequencing check against recorded reports and their candidate, not spending authorization or a current-worktree identity check.' }
    if (remainingAttempts > 0 && finalVoice) {
      amendedSequence.reason = recheckVoice
        ? 'The single additional Voice slot requires the compiled Goal 004E recheck gate, exact frozen candidate and preserved offline validation receipts; the four historical failures remain consumed.'
        : 'The existing final Voice slot requires the compiled Goal 004E gate, exact frozen candidate and complete offline release receipt; historical failed Text is not a new pass.'
    } else if (remainingAttempts > 0 && candidate) {
      try {
        const guard = amendment.id === QA_RUNTIME_AMENDMENT_ID ? assertGoal004DNextAttempt : assertGoal004CAmendedNextAttempt
        guard({ campaign: state, mode: amendedSequence.mode, identity: candidate, reports })
        amendedSequence.passed = true
        amendedSequence.reason = 'Recorded Text evidence satisfies the pure sequence guard for this recorded candidate; production admission still requires the unchanged frozen candidate and the aggregate supervisor lock.'
      } catch (error) { amendedSequence.reason = text(error instanceof Error ? error.message : 'The amended sequence guard rejected these reports.') }
    }
    admissionStatus = remainingAttempts === 0 ? 'exhausted' : recheckVoice ? 'requires_recheck_voice_frozen_candidate_admission' : finalVoice ? 'requires_final_voice_frozen_candidate_admission' : state.newAttempts === 0 ? 'requires_explicit_supervised_amended_text_attempt'
      : amendedSequence.passed ? 'requires_identical_frozen_candidate_voice_admission' : 'conditional_voice_blocked'
  }
  if (amendment?.id === QA_GOAL005_AMENDMENT_ID) {
    admissionStatus = state.halt ? 'permanently_stopped_provider_account_refusal' : remainingAttempts === 0 ? 'exhausted' : !last?.result || !Number.isSafeInteger(last.closedAt) ? 'waiting_for_independent_cleanup' : nextPermittedAt > Date.now() ? 'waiting_for_uncertain_session_lease' : 'requires_current_frozen_candidate_batch_admission';
    amendedSequence = { mode: state.newAttempts === 0 ? 'voice' : 'voice_or_reasoned_text_diagnostic', passed: false,
      diagnosticTextAttemptsUsed: state.attempts.slice(5).filter(attempt => attempt.name === 'text-mission').length,
      reason: 'Each attempt requires the current immutable runtime/player/fixture freeze and aggregate supervisor lock. Repairs between attempts do not refund reservations.',
      boundary: 'Read-only accounting, not a new grant or an executable admission approval.' };
  }
  const summary = {
    label: attempts.some(attempt => attempt.mode === 'text') ? MIXED_LABEL : LABEL, attempts: state.attempts.length, productionAttempts: state.productionAttempts, remainingAttempts,
    reservedSeconds: state.reservedSeconds, estimatedReservedDollars: state.estimatedReservedDollars, verifiedRateDollarsPerHour: state.header.hourlyRate,
    localConnectedSeconds: state.attempts.map(attempt => attempt.result?.connectedSeconds ?? null), endAcknowledgements: state.attempts.map(attempt => attempt.result?.endAcknowledged ?? false),
    nextPermittedAt: iso(nextPermittedAt), admissionStatus, inspectedAt: new Date().toISOString(), ledgerSha256: sha256(await readFile(join(directory, 'campaign.jsonl'))),
    ...(amended ? {
      amendmentId: amendment.id, historicalAttempts: state.historicalAttempts, newAttempts: state.newAttempts,
      historicalReservedSeconds: state.reservedSeconds - state.newReservedSeconds, newReservedSeconds: state.newReservedSeconds,
      historicalProductionAttempts: state.historicalAttempts, newProductionAttempts: state.productionAttempts - state.historicalAttempts,
      remainingReservedCapacitySeconds: state.header.capacitySeconds - state.reservedSeconds,
      maximumAggregatePlanningDollars: state.header.capacitySeconds * state.header.hourlyRate / 3600, approvedAggregatePlanningCeiling: state.header.planningDollars,
      originalCampaignSha256: sha256(await readFile(join(directory, 'campaign.jsonl'))),
      originalAllowanceSha256: sha256(await readFile(join(directory, 'allowance.jsonl'))),
      amendmentLedgerSha256: sha256(await readFile(join(directory, amendment.ledger))),
      amendedAllowanceSha256: sha256(await readFile(join(directory, amendment.allowance))),
      amendedSequence,
      ...(amendment.id === QA_GOAL005_AMENDMENT_ID ? { approvedNewAttempts: 8, approvedNewReservedSeconds: 7760, approvedNewDollars: 10, permanentStop: state.halt ? { reason: state.halt.reason, attempt: state.halt.attempt, haltedAt: iso(state.halt.haltedAt) } : null,
        estimatedNewReservedDollars: state.newReservedSeconds * state.header.hourlyRate / 3600,
        historicalEvidence: 'Five unchanged historical attempts remain linked through the fixed predecessor hashes; their compact exports are not duplicated.' } : {}),
    } : {}),
    results: attempts, accountingBoundary: 'Conservative campaign reservations never decrease. These are planning estimates, not an invoice or an account-wide cap. Balance and unrelated account usage are unknown.',
    redaction: 'Narrow allowlist export: no keys, tokens, cookies, signed URLs, access codes, tool arguments, tool-result payloads, configuration echoes, or hidden state. Provider final transcripts and visible history retain distinct source labels.',
  }
  await writeFile(join(output, 'campaign-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined
  try {
    const summary = await exportCampaign({ directory: value('--directory'), output: value('--output'), mux: args.includes('--mux'), videoOffsetMs: value('--video-offset-ms') === undefined ? undefined : Number(value('--video-offset-ms')) })
    console.log(JSON.stringify({ attempts: summary.attempts, remainingAttempts: summary.remainingAttempts, reservedSeconds: summary.reservedSeconds, nextPermittedAt: summary.nextPermittedAt, exportedResults: summary.results.length }))
  } catch (error) { console.error(error instanceof Error ? error.message : 'Local QA evidence export failed.'); process.exitCode = 1 }
}
