// Explicit owner approval on September 26, 2026 JST activates this one fixed campaign.
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectAmendedCampaign, QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_ID } from './qa-amended-budget.mjs'

export const GOAL_004C_PROPOSAL = Object.freeze({
  status: 'AUTHORIZED_BOUNDED_CAMPAIGN',
  maxAttempts: 2,
  reservationSeconds: 670,
  capacitySeconds: 1340,
  maxSessionSeconds: 600,
  concurrentConnections: 1,
  preparedRateDollarsPerHour: 4.5,
  estimatedReservedDollars: 1.675,
  planningDollars: 1.68,
  ordering: Object.freeze(['live_text_rescue', 'synthetic_voice_rescue']),
})

export const GOAL_004C_AUTHORIZATION = Object.freeze({
  approvedOnJst: '2026-09-26',
  reviewedCommit: '35ced22e0fbba070f2533bb4e3eaeca30ea3723c',
  campaignPath: '.validation/goal-004c-live',
  existingBalanceOnly: true,
  automaticReplenishment: false,
  limits: GOAL_004C_PROPOSAL,
})
const campaignDirectory = fileURLToPath(new URL('../.validation/goal-004c-live', import.meta.url))
export const GOAL_004C_AMENDMENT = Object.freeze({
  id: QA_AMENDMENT_ID, approvedOnJst: '2026-09-27', reviewedCommit: '0f0a5acaa1cbaa10a56228390d6c1e8ec0163030',
  historicalAttempts: 1, maxNewAttempts: 2, maxAttempts: 3, reservationSeconds: 670,
  capacitySeconds: 2010, maxSessionSeconds: 600, concurrentConnections: 1,
  planningDollars: 2.52, existingBalanceOnly: true, automaticReplenishment: false,
})
export const GOAL_004C_FROZEN_FILE = 'final-acceptance-candidate.json'

// Separate explicit owner amendment received September 28. Earlier approvals and
// their failed results remain history; this fixed profile never replenishes itself.
export const GOAL_004D_AMENDMENT = Object.freeze({
  id: QA_RUNTIME_AMENDMENT_ID, approvedOnJst: '2026-09-28', reviewedCommit: '1e84207181a1d48dc2cc768fcc36a5a72950543e',
  runtimeSourceCommit: '5014a6452468897e7d30e08d95bbb6f9a36a8047',
  historicalAttempts: 2, maxNewAttempts: 2, maxAttempts: 4, reservationSeconds: 670,
  capacitySeconds: 2680, maxSessionSeconds: 600, concurrentConnections: 1,
  hourlyRate: 4.5, planningDollars: 3.35, existingBalanceOnly: true, automaticReplenishment: false,
})
export const GOAL_004D_FROZEN_FILE = 'runtime-retest-candidate.json'
export const GOAL_004D_RUNTIME_SHA256 = 'b7df05ef45f353575b4f40dc32a92e6b72c51e352480e8e66dacbb23e69d156b'
export const GOAL_004D_SESSION_UPDATE_SHA256 = 'f7715ff67a2b88960c74b55c21017cbee9a3832fa42e8dd53fcccb11efce4562'
export const GOAL_004D_CANARY_INPUTS = Object.freeze([
  'Pip, please look around.', 'Please inspect the Latch.',
  'My diagram says the Door and Conveyor share one Power supply.',
])

// The owner explicitly replaced the failed-Text prerequisite for the existing
// final slot with complete offline confirmed-action UI verification.
export const GOAL_004E_AMENDMENT = Object.freeze({
  id: QA_CONFIRMED_AMENDMENT_ID, approvedOnJst: '2026-09-28', reviewedCommit: '52d8c6d4cc68d136890ffa4dfb39c4060602ffb0',
  historicalAttempts: 3, maxNewAttempts: 1, maxAttempts: 4, reservationSeconds: 670,
  capacitySeconds: 2680, maxSessionSeconds: 600, concurrentConnections: 1,
  hourlyRate: 4.5, planningDollars: 3.35, existingBalanceOnly: true, automaticReplenishment: false,
  contract: 'synthetic_voice_plus_ui_confirmation',
})
export const GOAL_004E_FROZEN_FILE = 'confirmed-actions-candidate.json'
export const GOAL_004E_RUNTIME_SHA256 = 'cacfeef453ca4ad49e6aa3317fd61a77b3a55f4cbfdb8c2eeae95e2ae96ccbce'
export const GOAL_004E_SESSION_UPDATE_SHA256 = '7504148459f16110e193f54db94007f82d83d53b9bdb80f5f14829f924104dfc'
export const GOAL_004E_CANARY_INPUTS = GOAL_004D_CANARY_INPUTS

export function assertGoal004ELiveAuthorized() {
  if (process.env.CI !== undefined || process.env.GAME_DISABLE_LIVE !== undefined) throw new Error('LIVE_DISABLED: CI and GAME_DISABLE_LIVE prohibit real Goal 004E calls.')
  let campaign
  try {
    const directory = lstatSync(campaignDirectory)
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Invalid directory')
    campaign = inspectAmendedCampaign(campaignDirectory, QA_CONFIRMED_AMENDMENT_ID)
  } catch { throw new Error('APPROVED_CAMPAIGN_UNAVAILABLE: The one-time final-slot amendment must already exist; no accounting was initialized.') }
  if (campaign.attempts.length !== 3 || campaign.productionAttempts !== 3) throw new Error('APPROVED_CAMPAIGN_EXHAUSTED: The final linked C/D/E slot is consumed or unavailable; no retry is authorized.')
}

/** Pure gate: a receipt is required evidence, not a substitute for owner approval. */
export function assertGoal004ENextAttempt({ campaign, mode, identity, offline }) {
  const header = campaign?.header
  if (mode !== 'voice' || header?.id !== QA_CONFIRMED_AMENDMENT_ID
    || header.maxAttempts !== 4 || header.capacitySeconds !== 2680 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.hourlyRate !== 4.5 || header.planningDollars !== 3.35
    || campaign.attempts?.length !== 3 || campaign.productionAttempts !== 3
    || campaign.attempts.some((attempt, index) => attempt.attempt !== index + 1 || attempt.name !== 'text-mission'
      || attempt.result?.outcome !== 'failed' || !attempt.result.endAcknowledged
      || !Number.isSafeInteger(attempt.closedAt) || attempt.closedAt < attempt.result.finishedAt)
    || !validIdentity(identity)) throw new Error('The final slot requires the three preserved failures and one verified Voice candidate; no Text or retry is authorized.')
  if (!offline || offline.status !== 'passed' || offline.dirty !== false || offline.commit !== identity.commit
    || offline.branch !== 'work/goal-004e-confirmed-actions' || offline.realProviderCalls !== 0
    || offline.runtimeManifestSha256 !== identity.runtimeSha256
    || offline.confirmedActions?.confirmedHome !== true || !Number.isSafeInteger(offline.confirmedActions?.confirmations) || offline.confirmedActions.confirmations < 1
    || !['pending', 'committed', 'declined', 'home'].every(state => offline.confirmedActions?.screenshots?.includes(state))
    || !['typecheck', 'unit tests', 'production build', 'compiled-production browser tests', 'diff whitespace'].every(label => offline.checks?.some(check => check.label === label && check.status === 'passed'))
    || offline.checks.some(check => check.status !== 'passed') || typeof offline.cleanup !== 'string') {
    throw new Error('The exact clean candidate must complete the existing offline release suite and confirmed-action production UI before the final Voice slot.')
  }
}

/** Independently enforced by the supervisor holding the original campaign lock. */
export function assertGoal004EReservationAuthorized({ directory, mode, identity }) {
  assertGoal004ELiveAuthorized()
  if (resolve(directory) !== resolve(campaignDirectory)) throw new Error('The final slot cannot be redirected to another campaign.')
  const frozenPath = join(campaignDirectory, GOAL_004E_FROZEN_FILE)
  const offlinePath = fileURLToPath(new URL('../.validation/goal-004e-offline.json', import.meta.url))
  for (const path of [frozenPath, offlinePath]) {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Frozen and offline evidence must be ordinary files.')
  }
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'))
  if (!validIdentity(identity) || identity.runtimeSha256 !== GOAL_004E_RUNTIME_SHA256
    || identity.sessionUpdateSha256 !== GOAL_004E_SESSION_UPDATE_SHA256 || !identity.fixtureSha256 || !identity.browserExecutableSha256
    || frozen.amendmentId !== QA_CONFIRMED_AMENDMENT_ID || JSON.stringify(frozen.identity) !== JSON.stringify(identity)) {
    throw new Error('The confirmed-action runtime, policy, harness, fixtures and browser must exactly match the frozen candidate.')
  }
  assertGoal004ENextAttempt({ campaign: inspectAmendedCampaign(campaignDirectory, QA_CONFIRMED_AMENDMENT_ID), mode, identity,
    offline: JSON.parse(readFileSync(offlinePath, 'utf8')) })
}

export function assertGoal004DLiveAuthorized() {
  if (process.env.CI !== undefined || process.env.GAME_DISABLE_LIVE !== undefined) {
    throw new Error('LIVE_DISABLED: CI and GAME_DISABLE_LIVE always prohibit this approved retest.')
  }
  let campaign
  try {
    const directory = lstatSync(campaignDirectory)
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Invalid directory')
    campaign = inspectAmendedCampaign(campaignDirectory, QA_RUNTIME_AMENDMENT_ID)
  } catch {
    throw new Error('APPROVED_CAMPAIGN_UNAVAILABLE: The fixed Goal 004D amendment must already exist and be valid; nothing was initialized.')
  }
  const header = campaign.header
  if (header.maxAttempts !== 4 || header.capacitySeconds !== 2680 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.disconnectGraceSeconds !== 30
    || header.hourlyRate !== 4.5 || header.planningDollars !== 3.35) {
    throw new Error('APPROVED_CAMPAIGN_MISMATCH: Existing accounting differs from the explicit Goal 004D approval.')
  }
  if (campaign.attempts.length >= 4) throw new Error('APPROVED_CAMPAIGN_EXHAUSTED: All four aggregate attempts remain consumed.')
}

/** No argument, local flag, environment value, or file constitutes owner approval. */
export function assertGoal004CLiveAuthorized() {
  if (process.env.CI !== undefined || process.env.GAME_DISABLE_LIVE !== undefined) {
    throw new Error('LIVE_DISABLED: CI and GAME_DISABLE_LIVE always prohibit this approved campaign.')
  }
  let campaign
  try {
    const directory = lstatSync(campaignDirectory)
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Invalid directory')
    campaign = inspectAmendedCampaign(campaignDirectory)
  } catch {
    throw new Error('APPROVED_CAMPAIGN_UNAVAILABLE: The fixed Goal 004C accounting must already exist and be valid; nothing was initialized.')
  }
  const header = campaign.header
  if (header.maxAttempts !== 3 || header.capacitySeconds !== 2010 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.disconnectGraceSeconds !== 30
    || header.hourlyRate !== 4.5 || header.planningDollars !== 2.52) {
    throw new Error('APPROVED_CAMPAIGN_MISMATCH: Existing accounting differs from the explicit Goal 004C approval.')
  }
  if (campaign.attempts.length >= 3) throw new Error('APPROVED_CAMPAIGN_EXHAUSTED: All three aggregate attempts remain consumed.')
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function validIdentity(identity) {
  if (!identity || !/^[0-9a-f]{40}$/.test(identity.commit)) return false
  for (const [manifest, hash] of [['files', 'runtimeSha256'], ['harnessFiles', 'harnessSha256']]) {
    const entries = identity[manifest]
    if (!entries || Array.isArray(entries) || typeof entries !== 'object' || Object.keys(entries).length === 0
      || Object.values(entries).some(value => typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
      || digest(entries) !== identity[hash]) return false
  }
  return true
}

/** Pure prospective sequencing only. Passing this guard never supplies spending authorization. */
export function assertGoal004CNextAttempt({ campaign, mode, identity, reports = [] }) {
  const header = campaign?.header
  if (!header || header.maxAttempts !== 2 || header.capacitySeconds !== 1340 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.planningDollars !== 1.68 || header.disconnectGraceSeconds !== 30
    || !Array.isArray(campaign.attempts) || !['text', 'voice'].includes(mode) || !validIdentity(identity)) {
    throw new Error('The prospective attempt requires the exact Goal 004C profile and a verified candidate manifest.')
  }
  if (mode === 'text') {
    if (campaign.attempts.length !== 0 || campaign.productionAttempts !== 0) throw new Error('Live Text must be the first and only Text attempt in the campaign.')
    return
  }
  const previous = campaign.attempts[0]
  if (campaign.attempts.length !== 1 || campaign.productionAttempts !== 1 || previous?.attempt !== 1 || previous.name !== 'text-mission'
    || previous.result?.outcome !== 'passed' || previous.result.endAcknowledged !== true
    || !Number.isSafeInteger(previous.closedAt) || previous.closedAt < previous.result.finishedAt) {
    throw new Error('Live Voice requires one passed, acknowledged and closed Text attempt.')
  }
  const fields = ['attempt', 'name', 'reservedAt', 'reservedSeconds', 'gracefulAt', 'hardAt', 'leaseUntil']
  const matches = Array.isArray(reports) ? reports.filter(report => report && fields.every(field => report.reservation?.[field] === previous[field])) : []
  if (matches.length !== 1) throw new Error('The prior Text evidence is missing or ambiguous; Voice remains blocked.')
  const report = matches[0]
  if (report.mode !== 'text' || report.scenario !== 'mission' || report.completion !== true || report.failure !== null
    || report.tokenRequests !== 1 || report.explicitEndSent !== true || report.endAcknowledged !== true
    || !validIdentity(report.identity) || report.identity.commit !== identity.commit
    || report.identity.runtimeSha256 !== identity.runtimeSha256 || report.identity.harnessSha256 !== identity.harnessSha256
    || JSON.stringify(report.identity.files) !== JSON.stringify(identity.files)
    || JSON.stringify(report.identity.harnessFiles) !== JSON.stringify(identity.harnessFiles)) {
    throw new Error('Live Voice requires completed Text evidence for the identical candidate and harness.')
  }
}

/** The historical failure stays consumed. Only the new Text result can qualify Voice. */
export function assertGoal004CAmendedNextAttempt({ campaign, mode, identity, reports = [] }) {
  const header = campaign?.header
  const historical = campaign?.attempts?.[0]
  if (header?.maxAttempts !== 3 || header.capacitySeconds !== 2010 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.planningDollars !== 2.52 || header.hourlyRate !== 4.5
    || historical?.attempt !== 1 || historical.name !== 'text-mission' || historical.result?.outcome !== 'failed'
    || historical.result.endAcknowledged !== true || !Number.isSafeInteger(historical.closedAt)
    || !['text', 'voice'].includes(mode) || !validIdentity(identity)) {
    throw new Error('The amendment requires the unchanged failed history, aggregate limits and verified candidate.')
  }
  if (mode === 'text') {
    if (campaign.attempts.length !== 1 || campaign.productionAttempts !== 1) throw new Error('The single amended Text retest is already consumed or unavailable.')
    return
  }
  const previous = campaign.attempts[1]
  if (campaign.attempts.length !== 2 || campaign.productionAttempts !== 2 || previous?.attempt !== 2
    || previous.name !== 'text-mission' || previous.result?.outcome !== 'passed' || previous.result.endAcknowledged !== true
    || !Number.isSafeInteger(previous.closedAt) || previous.closedAt < previous.result.finishedAt
    || previous.identitySha256 !== digest(identity)) {
    throw new Error('Conditional Voice requires the new Text pass, ending ACK, aggregate cleanup and identical identity.')
  }
  const fields = ['attempt', 'name', 'reservedAt', 'reservedSeconds', 'gracefulAt', 'hardAt', 'leaseUntil', 'identitySha256']
  const matches = reports.filter(report => report && fields.every(field => report.reservation?.[field] === previous[field]))
  if (matches.length !== 1) throw new Error('New Text evidence is missing or ambiguous; conditional Voice remains unused.')
  const report = matches[0]
  if (report.mode !== 'text' || report.scenario !== 'mission' || report.completion !== true || report.failure !== null
    || report.tokenRequests !== 1 || report.explicitEndSent !== true || report.endAcknowledged !== true
    || report.behavior?.status !== 'pass' || report.behavior.materialDefects?.length !== 0
    || !Array.isArray(report.behavior.uncertainties) || report.behavior.uncertainties.some(item => item.blocking === true)
    || !['activeTracks', 'activeSources', 'openApplicationContexts'].every(key => report.cleanup?.[key] === 0)
    || !['browser.closed', 'server.closed'].every(type => report.lifecycle?.some(event => event.type === type && event.outcome === 'observed'))
    || !validIdentity(report.identity) || JSON.stringify(report.identity) !== JSON.stringify(identity)) {
    throw new Error('Conditional Voice requires full Text completion, no unresolved behavioral defect, explicit ACK and cleanup on the frozen candidate.')
  }
}

/** Called independently by the supervisor under the aggregate kernel lock. */
export function assertGoal004CReservationAuthorized({ directory, mode, identity }) {
  assertGoal004CLiveAuthorized()
  if (resolve(directory) !== resolve(campaignDirectory)) throw new Error('The amendment cannot be redirected to another campaign.')
  const frozenPath = join(campaignDirectory, GOAL_004C_FROZEN_FILE)
  const stat = lstatSync(frozenPath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('A regular frozen candidate receipt is required.')
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'))
  if (!validIdentity(identity) || identity.runtimeSha256 !== 'e1e681dc447c6a7c64d92153fa6706b44b8a3033b23191de48425c3dbac87a5e'
    || Object.keys(identity.files).length !== 21 || !identity.fixtureSha256 || !identity.browserExecutableSha256
    || frozen.amendmentId !== QA_AMENDMENT_ID || JSON.stringify(frozen.identity) !== JSON.stringify(identity)) {
    throw new Error('The current runtime, harness, fixtures, browser and environment must exactly match the frozen candidate.')
  }
  const reports = []
  for (const entry of readdirSync(campaignDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-(?:text|voice)-mission$/.test(entry.name)) continue
    const path = join(campaignDirectory, entry.name, 'report.json')
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Prior evidence must be a regular report file.')
    reports.push(JSON.parse(readFileSync(path, 'utf8')))
  }
  assertGoal004CAmendedNextAttempt({ campaign: inspectAmendedCampaign(campaignDirectory), mode, identity, reports })
}

/** One corrected Text after both historical failures; Voice depends on this Text only. */
export function assertGoal004DNextAttempt({ campaign, mode, identity, reports = [] }) {
  const header = campaign?.header
  const historical = campaign?.attempts?.slice(0, 2)
  if (header?.id !== QA_RUNTIME_AMENDMENT_ID || header.maxAttempts !== 4 || header.capacitySeconds !== 2680
    || header.reservationSeconds !== 670 || header.maxSessionSeconds !== 600 || header.disconnectGraceSeconds !== 30
    || header.planningDollars !== 3.35 || header.hourlyRate !== 4.5 || historical?.length !== 2
    || historical.some((attempt, index) => attempt.attempt !== index + 1 || attempt.name !== 'text-mission'
      || attempt.result?.outcome !== 'failed' || attempt.result.endAcknowledged !== true
      || !Number.isSafeInteger(attempt.closedAt) || attempt.closedAt < attempt.result.finishedAt)
    || !['text', 'voice'].includes(mode) || !validIdentity(identity)) {
    throw new Error('The runtime retest requires both unchanged failed attempts, exact aggregate limits and a verified candidate.')
  }
  if (mode === 'text') {
    if (campaign.attempts.length !== 2 || campaign.productionAttempts !== 2) throw new Error('The single Goal 004D Text retest is already consumed or unavailable.')
    return
  }
  const previous = campaign.attempts[2]
  if (campaign.attempts.length !== 3 || campaign.productionAttempts !== 3 || previous?.attempt !== 3
    || previous.name !== 'text-mission' || previous.result?.outcome !== 'passed' || previous.result.endAcknowledged !== true
    || !Number.isSafeInteger(previous.closedAt) || previous.closedAt < previous.result.finishedAt
    || previous.identitySha256 !== digest(identity)) {
    throw new Error('Conditional Voice requires the corrected Text pass, ending ACK, aggregate cleanup and identical identity.')
  }
  const fields = ['attempt', 'name', 'reservedAt', 'reservedSeconds', 'gracefulAt', 'hardAt', 'leaseUntil', 'identitySha256']
  const matches = reports.filter(report => report && fields.every(field => report.reservation?.[field] === previous[field]))
  if (matches.length !== 1) throw new Error('Corrected Text evidence is missing or ambiguous; conditional Voice remains unused.')
  const report = matches[0]
  const actionRequest = report.regressionCanary?.explicitLatchRequest
  const actionStep = report.steps?.find(step => step.turnId === actionRequest?.turnId)
  if (report.mode !== 'text' || report.scenario !== 'mission' || report.completion !== true || report.failure !== null
    || report.tokenRequests !== 1 || report.explicitEndSent !== true || report.endAcknowledged !== true
    || report.behavior?.status !== 'pass' || report.behavior.materialDefects?.length !== 0
    || !Array.isArray(report.behavior.uncertainties) || report.behavior.uncertainties.some(item => item.blocking === true)
    || report.regressionCanary?.status !== 'passed' || !Number.isSafeInteger(actionRequest?.turnId) || actionRequest.turnId < 4
    || !['Please engage the Latch.', 'Please set the Latch to hold the Door open.'].includes(actionRequest?.text)
    || actionStep?.utterance !== actionRequest.text || actionStep?.settled !== true
    || !GOAL_004D_CANARY_INPUTS.every((input, index) => report.steps?.[index]?.utterance === input && report.steps[index].settled === true)
    || report.runtimePolicyDelivery?.sha256 !== GOAL_004D_SESSION_UPDATE_SHA256
    || report.runtimePolicyDelivery?.matchesExpected !== true || report.runtimePolicyDelivery?.messageCount !== 1
    || !['activeTracks', 'activeSources', 'openApplicationContexts'].every(key => report.cleanup?.[key] === 0)
    || !['browser.closed', 'server.closed'].every(type => report.lifecycle?.some(event => event.type === type && event.outcome === 'observed'))
    || !validIdentity(report.identity) || JSON.stringify(report.identity) !== JSON.stringify(identity)) {
    throw new Error('Conditional Voice requires the exact canary, repaired runtime delivery, full Text completion, correct action control, explicit ACK and cleanup on the frozen candidate.')
  }
}

/** Independently called by the supervisor under the original aggregate kernel lock. */
export function assertGoal004DReservationAuthorized({ directory, mode, identity }) {
  assertGoal004DLiveAuthorized()
  if (resolve(directory) !== resolve(campaignDirectory)) throw new Error('The runtime amendment cannot be redirected to another campaign.')
  const frozenPath = join(campaignDirectory, GOAL_004D_FROZEN_FILE)
  const stat = lstatSync(frozenPath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('A regular frozen runtime candidate receipt is required.')
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'))
  if (!validIdentity(identity) || identity.runtimeSha256 !== GOAL_004D_RUNTIME_SHA256
    || identity.sessionUpdateSha256 !== GOAL_004D_SESSION_UPDATE_SHA256
    || Object.keys(identity.files).length !== 21 || !identity.fixtureSha256 || !identity.browserExecutableSha256
    || frozen.amendmentId !== QA_RUNTIME_AMENDMENT_ID || JSON.stringify(frozen.identity) !== JSON.stringify(identity)) {
    throw new Error('The repaired runtime, serialized policy, harness, fixtures, browser and environment must exactly match the frozen candidate.')
  }
  const reports = []
  for (const entry of readdirSync(campaignDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-(?:text|voice)-mission$/.test(entry.name)) continue
    const path = join(campaignDirectory, entry.name, 'report.json')
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Prior evidence must be a regular report file.')
    reports.push(JSON.parse(readFileSync(path, 'utf8')))
  }
  assertGoal004DNextAttempt({ campaign: inspectAmendedCampaign(campaignDirectory, QA_RUNTIME_AMENDMENT_ID), mode, identity, reports })
}
