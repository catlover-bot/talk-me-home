import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { inspectCampaign, QA_LIMITS } from './qa-budget.mjs'

// One owner-authorized amendment of the existing campaign, never a new campaign.
export const QA_AMENDMENT_ID = 'goal-004c-final-acceptance-2026-09-27'
export const QA_AMENDMENT_LEDGER = 'amendment-final-acceptance.jsonl'
export const QA_AMENDMENT_ALLOWANCE = 'amendment-final-acceptance-allowance.jsonl'
export const QA_AMENDMENT_ORIGINAL_HASHES = Object.freeze({
  campaign: '72391b60ceba2b56da77336a4b54d7c8e6d184bb6aca26ef24fcd1217451b0e0',
  allowance: '0c870762bf49809f26ee8bba0861fdafe36a8c890fab98722eb6c3bed9530a24',
})
export const QA_RUNTIME_AMENDMENT_ID = 'goal-004d-runtime-retest-2026-09-28'
export const QA_RUNTIME_AMENDMENT_LEDGER = 'amendment-runtime-retest.jsonl'
export const QA_RUNTIME_AMENDMENT_ALLOWANCE = 'amendment-runtime-retest-allowance.jsonl'
export const QA_RUNTIME_AMENDMENT_LIMITS = Object.freeze({ ...QA_LIMITS, maxAttempts: 4, capacitySeconds: 2680, planningDollars: 3.35 })
export const QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES = Object.freeze({
  campaign: '8c9c0f4c94c8f8e400769fdbc62aa20a7b6c232fcf4bf5cfffc992bd28ef70d0',
  allowance: '4cc324d8dc43d7bd4ff57986e43dc5f0d37ead592117b53d49fff7bf6a455152',
})
export const QA_CONFIRMED_AMENDMENT_ID = 'goal-004e-confirmed-actions-2026-09-28'
export const QA_CONFIRMED_AMENDMENT_LEDGER = 'amendment-confirmed-actions.jsonl'
export const QA_CONFIRMED_AMENDMENT_ALLOWANCE = 'amendment-confirmed-actions-allowance.jsonl'
// Reassign the existing fourth slot. Neither aggregate limit increases.
export const QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES = Object.freeze({
  campaign: 'f14a70efc214e673305bf8bcb0f289f4f2519b9c3ff4cc2cb757521056d63dae',
  allowance: '5b40201155c6fe78141cf36de9863552d76669f33cde02d243434de1da117bd5',
})
export const QA_RECHECK_AMENDMENT_ID = 'goal-004e-candidate-recheck-2026-09-29'
export const QA_RECHECK_AMENDMENT_LEDGER = 'amendment-candidate-recheck.jsonl'
export const QA_RECHECK_AMENDMENT_ALLOWANCE = 'amendment-candidate-recheck-allowance.jsonl'
export const QA_RECHECK_AMENDMENT_CLEANUP = 'amendment-candidate-recheck-cleanup.jsonl'
// One additional owner-approved Voice attempt, linked to all four consumed attempts.
export const QA_RECHECK_AMENDMENT_LIMITS = Object.freeze({ ...QA_LIMITS, maxAttempts: 5, capacitySeconds: 3350, planningDollars: 4.1875 })
export const QA_RECHECK_AMENDMENT_ORIGINAL_HASHES = Object.freeze({
  campaign: 'c42a6ede742eb0a6e7259f19084f06f7c666864d751b11d3809240c238b9929c',
  allowance: '1bc88bc19921daef227a75420c02f2f50af3d2c00de27a941241f097a156cadb',
})
const integer = value => Number.isSafeInteger(value) && value >= 0
const keys = value => Object.keys(value).sort().join(',')
const digest = value => createHash('sha256').update(value).digest('hex')
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const rowKeys = 'attempt,gracefulAt,hardAt,identitySha256,leaseUntil,name,reservedAt,reservedSeconds,type'
const headerKeys = 'capacitySeconds,createdAt,disconnectGraceSeconds,historicalAttempts,hourlyRate,id,maxAttempts,maxNewAttempts,maxSessionSeconds,newCapacitySeconds,originalAllowanceSha256,originalCampaignSha256,planningDollars,reservationSeconds,type,version'

// Only these compiled, owner-approved amendments exist. A caller cannot supply limits.
function profile(amendmentId) {
  if (amendmentId === QA_RECHECK_AMENDMENT_ID) return { id: amendmentId, ledger: QA_RECHECK_AMENDMENT_LEDGER, allowance: QA_RECHECK_AMENDMENT_ALLOWANCE,
    historicalAttempts: 4, limits: QA_RECHECK_AMENDMENT_LIMITS, originalHashes: QA_RECHECK_AMENDMENT_ORIGINAL_HASHES,
    precedingAllowance: QA_CONFIRMED_AMENDMENT_ALLOWANCE, previousAmendmentId: QA_CONFIRMED_AMENDMENT_ID, finalVoiceOnly: true }
  if (amendmentId === QA_AMENDMENT_ID) return { id: amendmentId, ledger: QA_AMENDMENT_LEDGER, allowance: QA_AMENDMENT_ALLOWANCE,
    historicalAttempts: 1, limits: QA_LIMITS, originalHashes: QA_AMENDMENT_ORIGINAL_HASHES, precedingAllowance: 'allowance.jsonl' }
  if (amendmentId === QA_RUNTIME_AMENDMENT_ID) return { id: amendmentId, ledger: QA_RUNTIME_AMENDMENT_LEDGER, allowance: QA_RUNTIME_AMENDMENT_ALLOWANCE,
    historicalAttempts: 2, limits: QA_RUNTIME_AMENDMENT_LIMITS, originalHashes: QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES,
    precedingAllowance: QA_AMENDMENT_ALLOWANCE, previousAmendmentId: QA_AMENDMENT_ID }
  if (amendmentId === QA_CONFIRMED_AMENDMENT_ID) return { id: amendmentId, ledger: QA_CONFIRMED_AMENDMENT_LEDGER, allowance: QA_CONFIRMED_AMENDMENT_ALLOWANCE,
    historicalAttempts: 3, limits: QA_RUNTIME_AMENDMENT_LIMITS, originalHashes: QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES,
    precedingAllowance: QA_RUNTIME_AMENDMENT_ALLOWANCE, previousAmendmentId: QA_RUNTIME_AMENDMENT_ID, finalVoiceOnly: true }
  throw new Error('Unknown fixed campaign amendment.')
}
function assertCurrentWriter(directory, amendmentId) {
  if (amendmentId !== QA_RECHECK_AMENDMENT_ID && [QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE].some(file => existsSync(join(directory, file)))) {
    throw new Error('Earlier amendments are preserved history; only the linked candidate recheck writer may consume the additional Voice slot.')
  }
  if (![QA_CONFIRMED_AMENDMENT_ID, QA_RECHECK_AMENDMENT_ID].includes(amendmentId) && [QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE].some(file => existsSync(join(directory, file)))) {
    throw new Error('Earlier amendments are preserved history; only the linked Goal 004E writer may consume the existing final slot.')
  }
  if (amendmentId === QA_AMENDMENT_ID && [QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE].some(file => existsSync(join(directory, file)))) {
    throw new Error('The earlier amendment is preserved history; only the linked Goal 004D writer may consume the reassigned slot.')
  }
}

function ordinary(path, directory = false) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) throw new Error('Amended accounting requires ordinary files in the original campaign directory.')
}
function readRows(path, maxLength = 100_000) {
  ordinary(path)
  const source = readFileSync(path, 'utf8')
  if (source.length > maxLength || !source.endsWith('\n')) throw new Error('Corrupt amended accounting.')
  try { return source.trimEnd().split('\n').map(line => JSON.parse(line)) } catch { throw new Error('Corrupt amended accounting.') }
}
function append(path, rows, exclusive = false) {
  const descriptor = openSync(path, exclusive ? 'wx' : 'a', 0o600)
  try { writeFileSync(descriptor, rows.map(row => JSON.stringify(row) + '\n').join('')); fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
function originalCampaign(directory) {
  ordinary(directory, true)
  const original = inspectCampaign(directory)
  if (digest(readFileSync(join(directory, 'campaign.jsonl'))) !== QA_AMENDMENT_ORIGINAL_HASHES.campaign
    || digest(readFileSync(join(directory, 'allowance.jsonl'))) !== QA_AMENDMENT_ORIGINAL_HASHES.allowance) throw new Error('Original Goal 004C accounting differs from the preserved approved history.')
  const first = original.attempts[0]
  if (original.header.maxAttempts !== 2 || original.header.capacitySeconds !== 1340 || original.header.hourlyRate !== 4.5
    || original.attempts.length !== 1 || original.productionAttempts !== 1 || first.name !== 'text-mission'
    || first.result?.outcome !== 'failed' || first.result.endAcknowledged !== true || !integer(first.closedAt)
    || first.closedAt < first.result.finishedAt) throw new Error('The amendment requires the single preserved failed and closed Text attempt.')
  return original
}

function precedingCampaign(directory, amendmentId) {
  if (amendmentId === QA_AMENDMENT_ID) return originalCampaign(directory)
  if (amendmentId === QA_RECHECK_AMENDMENT_ID) {
    const previous = inspectAmendedCampaign(directory, QA_CONFIRMED_AMENDMENT_ID)
    if (digest(readFileSync(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER))) !== QA_RECHECK_AMENDMENT_ORIGINAL_HASHES.campaign
      || digest(readFileSync(join(directory, QA_CONFIRMED_AMENDMENT_ALLOWANCE))) !== QA_RECHECK_AMENDMENT_ORIGINAL_HASHES.allowance
      || previous.attempts.length !== 4 || previous.productionAttempts !== 4
      || previous.attempts.some((attempt, index) => attempt.name !== (index < 3 ? 'text-mission' : 'voice-mission') || attempt.result?.outcome !== 'failed'
        || attempt.result.endAcknowledged !== true || !integer(attempt.closedAt) || attempt.closedAt < attempt.result.finishedAt)) {
      throw new Error('The candidate recheck requires all four exact preserved failed and closed attempts; consumed attempts cannot be reassigned.')
    }
    return previous
  }
  if (amendmentId === QA_CONFIRMED_AMENDMENT_ID) {
    const previous = inspectAmendedCampaign(directory, QA_RUNTIME_AMENDMENT_ID)
    if (digest(readFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER))) !== QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES.campaign
      || digest(readFileSync(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE))) !== QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES.allowance
      || previous.attempts.length !== 3 || previous.productionAttempts !== 3
      || previous.attempts.some(attempt => attempt.name !== 'text-mission' || attempt.result?.outcome !== 'failed'
        || attempt.result.endAcknowledged !== true || !integer(attempt.closedAt) || attempt.closedAt < attempt.result.finishedAt)) {
      throw new Error('Goal 004E requires all three exact preserved failed and closed Text attempts; a consumed final slot cannot be reassigned again.')
    }
    return previous
  }
  const previous = inspectAmendedCampaign(directory, QA_AMENDMENT_ID)
  if (digest(readFileSync(join(directory, QA_AMENDMENT_LEDGER))) !== QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.campaign
    || digest(readFileSync(join(directory, QA_AMENDMENT_ALLOWANCE))) !== QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.allowance
    || previous.attempts.length !== 2 || previous.productionAttempts !== 2
    || previous.attempts.some(attempt => attempt.name !== 'text-mission' || attempt.result?.outcome !== 'failed'
      || attempt.result.endAcknowledged !== true || !integer(attempt.closedAt) || attempt.closedAt < attempt.result.finishedAt)) {
    throw new Error('Goal 004D requires both exact preserved failed and closed Text attempts; historical accounting was not replaced.')
  }
  return previous
}

/** Explicit one-time operation after price/approval review; no runner calls this. */
export function initializeAmendment(directory, { hourlyRate = 4.5, now = Date.now, amendmentId = QA_AMENDMENT_ID } = {}) {
  directory = resolve(directory)
  const selected = profile(amendmentId)
  const original = precedingCampaign(directory, amendmentId)
  if (hourlyRate !== 4.5 || selected.limits.capacitySeconds * hourlyRate / 3600 > selected.limits.planningDollars) throw new Error('The verified applicable price no longer matches this fixed amendment.')
  const ledger = join(directory, selected.ledger)
  const allowance = join(directory, selected.allowance)
  // Repeated delivery reuses this exact linked amendment, including consumed attempts.
  if ([QA_RUNTIME_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_ID, QA_RECHECK_AMENDMENT_ID].includes(amendmentId) && existsSync(ledger) && existsSync(allowance)) return inspectAmendedCampaign(directory, amendmentId)
  if (existsSync(ledger) || existsSync(allowance)) throw new Error('This fixed amendment already exists or is incomplete; it can never be initialized again.')
  const createdAt = now()
  if (!integer(createdAt) || createdAt < original.attempts.at(-1).closedAt) throw new Error('Invalid amendment creation time.')
  append(ledger, [{ type: 'amendment', version: 1, id: amendmentId, originalCampaignSha256: selected.originalHashes.campaign,
    originalAllowanceSha256: selected.originalHashes.allowance, historicalAttempts: selected.historicalAttempts,
    maxNewAttempts: selected.limits.maxAttempts - selected.historicalAttempts, newCapacitySeconds: (selected.limits.maxAttempts - selected.historicalAttempts) * 670,
    ...selected.limits, hourlyRate, createdAt, ...(selected.previousAmendmentId ? { previousAmendmentId: selected.previousAmendmentId } : {}) }], true)
  // The production format remains unchanged: preceding reservations are historical,
  // and this aggregate copy cannot make the original slot independently spendable.
  const [, ...historicalReservations] = readRows(join(directory, selected.precedingAllowance))
  append(allowance, [{ version: 1, allowanceSessions: selected.limits.maxAttempts, maxSessionSeconds: 600 }, ...historicalReservations], true)
  const descriptor = openSync(directory, 'r')
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
  return inspectAmendedCampaign(directory, amendmentId)
}

/** Read both preserved history and its sole supplement; never repairs accounting. */
export function inspectAmendedCampaign(directory, amendmentId = QA_AMENDMENT_ID) {
  directory = resolve(directory)
  const selected = profile(amendmentId)
  const original = precedingCampaign(directory, amendmentId)
  const [header, ...rows] = readRows(join(directory, selected.ledger))
  const expectedKeys = (headerKeys + (selected.previousAmendmentId ? ',previousAmendmentId' : '')).split(',').sort().join(',')
  if (!header || keys(header) !== expectedKeys
    || header.type !== 'amendment' || header.version !== 1 || header.id !== amendmentId
    || header.originalCampaignSha256 !== selected.originalHashes.campaign || header.originalAllowanceSha256 !== selected.originalHashes.allowance
    || header.previousAmendmentId !== selected.previousAmendmentId
    || header.historicalAttempts !== selected.historicalAttempts || header.maxNewAttempts !== selected.limits.maxAttempts - selected.historicalAttempts
    || header.newCapacitySeconds !== (selected.limits.maxAttempts - selected.historicalAttempts) * 670
    || Object.entries(selected.limits).some(([key, value]) => header[key] !== value) || header.hourlyRate !== 4.5
    || !integer(header.createdAt) || header.createdAt < original.attempts.at(-1).closedAt) throw new Error('Invalid fixed amendment limits or history link.')
  const attempts = original.attempts.map(value => ({ ...value }))
  for (const row of rows) {
    if (!row || !integer(row.attempt) || row.attempt <= selected.historicalAttempts || row.attempt > selected.limits.maxAttempts) throw new Error('Invalid amended accounting event.')
    const previous = attempts.at(-1)
    if (row.type === 'reserved') {
      if (keys(row) !== rowKeys || row.attempt !== attempts.length + 1 || row.name !== (selected.finalVoiceOnly ? 'voice-mission' : row.attempt === selected.historicalAttempts + 1 ? 'text-mission' : 'voice-mission')
        || !integer(row.reservedAt) || row.reservedAt < header.createdAt || row.reservedSeconds !== 670 || row.leaseUntil !== row.reservedAt + 670_000
        || !integer(row.gracefulAt) || row.gracefulAt <= row.reservedAt || row.gracefulAt > row.reservedAt + 590_000
        || row.hardAt !== row.gracefulAt + 10_000 || !hash(row.identitySha256)
        || !previous.result?.endAcknowledged || !integer(previous.closedAt) || previous.closedAt > row.reservedAt
        || !selected.finalVoiceOnly && row.attempt === selected.limits.maxAttempts && (previous.result.outcome !== 'passed' || previous.identitySha256 !== row.identitySha256)) throw new Error('Invalid amended reservation or approved sequence.')
      attempts.push({ ...row, result: null, closedAt: null })
    } else if (row.type === 'result') {
      if (keys(row) !== 'attempt,connectedSeconds,endAcknowledged,finishedAt,outcome,type' || row.attempt !== previous.attempt || previous.result
        || !integer(row.finishedAt) || row.finishedAt < previous.reservedAt || typeof row.endAcknowledged !== 'boolean'
        || !(row.connectedSeconds === null || Number.isFinite(row.connectedSeconds) && row.connectedSeconds >= 0)
        || !['passed', 'failed', 'blocked'].includes(row.outcome)) throw new Error('Invalid amended result.')
      previous.result = row
    } else if (row.type === 'closed') {
      if (keys(row) !== 'attempt,closedAt,type' || row.attempt !== previous.attempt || previous.closedAt !== null || !previous.result
        || !integer(row.closedAt) || row.closedAt < previous.result.finishedAt) throw new Error('Invalid amended cleanup event.')
      previous.closedAt = row.closedAt
    } else throw new Error('Unknown amended accounting event.')
  }
  const [allowance, ...reservations] = readRows(join(directory, selected.allowance), 10_000)
  const [, ...historicalReservations] = readRows(join(directory, selected.precedingAllowance), 10_000)
  if (!allowance || keys(allowance) !== 'allowanceSessions,maxSessionSeconds,version' || allowance.version !== 1 || allowance.allowanceSessions !== selected.limits.maxAttempts || allowance.maxSessionSeconds !== 600
    || reservations.length < selected.historicalAttempts || reservations.length > attempts.length || reservations.length > selected.limits.maxAttempts
    || JSON.stringify(reservations.slice(0, selected.historicalAttempts)) !== JSON.stringify(historicalReservations)
    || reservations.some((row, index) => !row || keys(row) !== 'leaseUntil,reservedAt' || !integer(row.reservedAt) || row.leaseUntil !== row.reservedAt + 670_000
      || index >= selected.historicalAttempts && (row.reservedAt < attempts[index].reservedAt || row.reservedAt > attempts[index].gracefulAt))) throw new Error('Invalid aggregate production allowance or unreserved admission.')
  return { header, historicalHeader: original.header, attempts, productionAttempts: reservations.length, historicalAttempts: selected.historicalAttempts, newAttempts: attempts.length - selected.historicalAttempts,
    reservedSeconds: attempts.length * 670, newReservedSeconds: (attempts.length - selected.historicalAttempts) * 670, estimatedReservedDollars: attempts.length * 670 * header.hourlyRate / 3600 }
}

/** Used only by the existing flock-owning supervisor, with its independent proof gate. */
export class AmendedCampaignBudget {
  constructor(directory, now = Date.now, amendmentId = QA_AMENDMENT_ID) {
    this.directory = resolve(directory); this.now = now; this.amendmentId = amendmentId; this.selected = profile(amendmentId)
    assertCurrentWriter(this.directory, amendmentId); inspectAmendedCampaign(this.directory, amendmentId)
  }
  reserve({ name, maxRunSeconds = 570, identity }) {
    assertCurrentWriter(this.directory, this.amendmentId)
    const state = inspectAmendedCampaign(this.directory, this.amendmentId)
    if (state.attempts.length >= this.selected.limits.maxAttempts) throw new Error('The aggregate amended attempt allowance is exhausted.')
    const attempt = state.attempts.length + 1
    if (name !== (this.selected.finalVoiceOnly ? 'voice-mission' : attempt === this.selected.historicalAttempts + 1 ? 'text-mission' : 'voice-mission') || !Number.isSafeInteger(maxRunSeconds) || maxRunSeconds < 1 || maxRunSeconds > 590
      || !identity || !/^[0-9a-f]{40}$/.test(identity.commit) || !hash(identity.runtimeSha256) || !hash(identity.harnessSha256)) throw new Error('Invalid fixed amended attempt or candidate identity.')
    const previous = state.attempts.at(-1)
    const identitySha256 = digest(JSON.stringify(identity))
    const reservedAt = this.now()
    if (!integer(reservedAt) || reservedAt < state.header.createdAt || !previous.result?.endAcknowledged || !integer(previous.closedAt) || previous.closedAt > reservedAt
      || state.productionAttempts !== attempt - 1
      || !this.selected.finalVoiceOnly && attempt === this.selected.limits.maxAttempts && (previous.result.outcome !== 'passed' || previous.identitySha256 !== identitySha256)) {
      throw new Error('Conditional Voice requires passed, acknowledged, closed Text on the unchanged candidate; failures never release the next slot.')
    }
    const row = { type: 'reserved', attempt, name, reservedAt, reservedSeconds: 670, gracefulAt: reservedAt + maxRunSeconds * 1000,
      hardAt: reservedAt + (maxRunSeconds + 10) * 1000, leaseUntil: reservedAt + 670_000, identitySha256 }
    append(join(this.directory, this.selected.ledger), [row])
    return row
  }
  finish(attempt, { endAcknowledged, connectedSeconds = null, outcome }) {
    assertCurrentWriter(this.directory, this.amendmentId)
    const state = inspectAmendedCampaign(this.directory, this.amendmentId)
    const finishedAt = this.now()
    if (attempt <= this.selected.historicalAttempts || attempt !== state.attempts.length || state.attempts.at(-1)?.result || typeof endAcknowledged !== 'boolean'
      || !integer(finishedAt) || finishedAt < state.attempts.at(-1).reservedAt
      || !(connectedSeconds === null || Number.isFinite(connectedSeconds) && connectedSeconds >= 0) || !['passed', 'failed', 'blocked'].includes(outcome)) throw new Error('Invalid or duplicate amended attempt result.')
    append(join(this.directory, this.selected.ledger), [{ type: 'result', attempt, finishedAt, endAcknowledged, connectedSeconds, outcome }])
  }
  closed(attempt) {
    assertCurrentWriter(this.directory, this.amendmentId)
    const state = inspectAmendedCampaign(this.directory, this.amendmentId)
    const previous = state.attempts.at(-1)
    const closedAt = this.now()
    if (attempt <= this.selected.historicalAttempts || attempt !== state.attempts.length || previous.closedAt !== null || !previous.result || !integer(closedAt) || closedAt < previous.result.finishedAt) throw new Error('Invalid or duplicate amended cleanup result.')
    append(join(this.directory, this.selected.ledger), [{ type: 'closed', attempt, closedAt }])
  }
}
