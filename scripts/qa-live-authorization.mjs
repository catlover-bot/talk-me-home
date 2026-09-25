// Explicit owner approval on September 26, 2026 JST activates this one fixed campaign.
import { createHash } from 'node:crypto'
import { lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inspectCampaign } from './qa-budget.mjs'

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

/** No argument, local flag, environment value, or file constitutes owner approval. */
export function assertGoal004CLiveAuthorized() {
  if (process.env.CI !== undefined || process.env.GAME_DISABLE_LIVE !== undefined) {
    throw new Error('LIVE_DISABLED: CI and GAME_DISABLE_LIVE always prohibit this approved campaign.')
  }
  let campaign
  try {
    const directory = lstatSync(campaignDirectory)
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Invalid directory')
    campaign = inspectCampaign(campaignDirectory)
  } catch {
    throw new Error('APPROVED_CAMPAIGN_UNAVAILABLE: The fixed Goal 004C accounting must already exist and be valid; nothing was initialized.')
  }
  const header = campaign.header
  if (header.maxAttempts !== 2 || header.capacitySeconds !== 1340 || header.reservationSeconds !== 670
    || header.maxSessionSeconds !== 600 || header.disconnectGraceSeconds !== 30
    || header.hourlyRate !== 4.5 || header.planningDollars !== 1.68) {
    throw new Error('APPROVED_CAMPAIGN_MISMATCH: Existing accounting differs from the explicit Goal 004C approval.')
  }
  if (campaign.attempts.length >= 2) throw new Error('APPROVED_CAMPAIGN_EXHAUSTED: The two approved attempts remain consumed.')
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
