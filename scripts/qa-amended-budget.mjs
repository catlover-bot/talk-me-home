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
const integer = value => Number.isSafeInteger(value) && value >= 0
const keys = value => Object.keys(value).sort().join(',')
const digest = value => createHash('sha256').update(value).digest('hex')
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const rowKeys = 'attempt,gracefulAt,hardAt,identitySha256,leaseUntil,name,reservedAt,reservedSeconds,type'

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

/** Explicit one-time operation after price/approval review; no runner calls this. */
export function initializeAmendment(directory, { hourlyRate = 4.5, now = Date.now } = {}) {
  directory = resolve(directory)
  const original = originalCampaign(directory)
  if (hourlyRate !== 4.5 || 2010 * hourlyRate / 3600 > 2.52) throw new Error('The verified applicable price no longer matches this fixed amendment.')
  const ledger = join(directory, QA_AMENDMENT_LEDGER)
  const allowance = join(directory, QA_AMENDMENT_ALLOWANCE)
  if (existsSync(ledger) || existsSync(allowance)) throw new Error('This fixed amendment already exists or is incomplete; it can never be initialized again.')
  const createdAt = now()
  if (!integer(createdAt) || createdAt < original.attempts[0].closedAt) throw new Error('Invalid amendment creation time.')
  append(ledger, [{ type: 'amendment', version: 1, id: QA_AMENDMENT_ID, originalCampaignSha256: QA_AMENDMENT_ORIGINAL_HASHES.campaign,
    originalAllowanceSha256: QA_AMENDMENT_ORIGINAL_HASHES.allowance, historicalAttempts: 1, maxNewAttempts: 2, newCapacitySeconds: 1340,
    ...QA_LIMITS, hourlyRate, createdAt }], true)
  // The production format remains unchanged: its first reservation is historical,
  // and this aggregate copy cannot make the original slot independently spendable.
  const [, ...historicalReservations] = readRows(join(directory, 'allowance.jsonl'))
  append(allowance, [{ version: 1, allowanceSessions: 3, maxSessionSeconds: 600 }, ...historicalReservations], true)
  const descriptor = openSync(directory, 'r')
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
  return inspectAmendedCampaign(directory)
}

/** Read both preserved history and its sole supplement; never repairs accounting. */
export function inspectAmendedCampaign(directory) {
  directory = resolve(directory)
  const original = originalCampaign(directory)
  const [header, ...rows] = readRows(join(directory, QA_AMENDMENT_LEDGER))
  if (!header || keys(header) !== 'capacitySeconds,createdAt,disconnectGraceSeconds,historicalAttempts,hourlyRate,id,maxAttempts,maxNewAttempts,maxSessionSeconds,newCapacitySeconds,originalAllowanceSha256,originalCampaignSha256,planningDollars,reservationSeconds,type,version'
    || header.type !== 'amendment' || header.version !== 1 || header.id !== QA_AMENDMENT_ID
    || header.originalCampaignSha256 !== QA_AMENDMENT_ORIGINAL_HASHES.campaign || header.originalAllowanceSha256 !== QA_AMENDMENT_ORIGINAL_HASHES.allowance
    || header.historicalAttempts !== 1 || header.maxNewAttempts !== 2 || header.newCapacitySeconds !== 1340
    || Object.entries(QA_LIMITS).some(([key, value]) => header[key] !== value) || header.hourlyRate !== 4.5
    || !integer(header.createdAt) || header.createdAt < original.attempts[0].closedAt) throw new Error('Invalid fixed amendment limits or history link.')
  const attempts = original.attempts.map(value => ({ ...value }))
  for (const row of rows) {
    if (!row || !integer(row.attempt) || row.attempt < 2 || row.attempt > 3) throw new Error('Invalid amended accounting event.')
    const previous = attempts.at(-1)
    if (row.type === 'reserved') {
      if (keys(row) !== rowKeys || row.attempt !== attempts.length + 1 || row.name !== (row.attempt === 2 ? 'text-mission' : 'voice-mission')
        || !integer(row.reservedAt) || row.reservedAt < header.createdAt || row.reservedSeconds !== 670 || row.leaseUntil !== row.reservedAt + 670_000
        || !integer(row.gracefulAt) || row.gracefulAt <= row.reservedAt || row.gracefulAt > row.reservedAt + 590_000
        || row.hardAt !== row.gracefulAt + 10_000 || !hash(row.identitySha256)
        || !previous.result?.endAcknowledged || !integer(previous.closedAt) || previous.closedAt > row.reservedAt
        || row.attempt === 3 && (previous.result.outcome !== 'passed' || previous.identitySha256 !== row.identitySha256)) throw new Error('Invalid amended reservation or Text-before-Voice sequence.')
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
  const [allowance, ...reservations] = readRows(join(directory, QA_AMENDMENT_ALLOWANCE), 10_000)
  const [, historicalReservation] = readRows(join(directory, 'allowance.jsonl'), 10_000)
  if (!allowance || keys(allowance) !== 'allowanceSessions,maxSessionSeconds,version' || allowance.version !== 1 || allowance.allowanceSessions !== 3 || allowance.maxSessionSeconds !== 600
    || reservations.length < 1 || reservations.length > attempts.length || reservations.length > 3
    || JSON.stringify(reservations[0]) !== JSON.stringify(historicalReservation)
    || reservations.some((row, index) => !row || keys(row) !== 'leaseUntil,reservedAt' || !integer(row.reservedAt) || row.leaseUntil !== row.reservedAt + 670_000
      || index > 0 && (row.reservedAt < attempts[index].reservedAt || row.reservedAt > attempts[index].gracefulAt))) throw new Error('Invalid aggregate production allowance or unreserved admission.')
  return { header, historicalHeader: original.header, attempts, productionAttempts: reservations.length, historicalAttempts: 1, newAttempts: attempts.length - 1,
    reservedSeconds: attempts.length * 670, newReservedSeconds: (attempts.length - 1) * 670, estimatedReservedDollars: attempts.length * 670 * header.hourlyRate / 3600 }
}

/** Used only by the existing flock-owning supervisor, with its independent proof gate. */
export class AmendedCampaignBudget {
  constructor(directory, now = Date.now) { this.directory = resolve(directory); this.now = now; inspectAmendedCampaign(this.directory) }
  reserve({ name, maxRunSeconds = 570, identity }) {
    const state = inspectAmendedCampaign(this.directory)
    if (state.attempts.length >= 3) throw new Error('The aggregate amended attempt allowance is exhausted.')
    const attempt = state.attempts.length + 1
    if (name !== (attempt === 2 ? 'text-mission' : 'voice-mission') || !Number.isSafeInteger(maxRunSeconds) || maxRunSeconds < 1 || maxRunSeconds > 590
      || !identity || !/^[0-9a-f]{40}$/.test(identity.commit) || !hash(identity.runtimeSha256) || !hash(identity.harnessSha256)) throw new Error('Invalid fixed amended attempt or candidate identity.')
    const previous = state.attempts.at(-1)
    const identitySha256 = digest(JSON.stringify(identity))
    const reservedAt = this.now()
    if (!integer(reservedAt) || reservedAt < state.header.createdAt || !previous.result?.endAcknowledged || !integer(previous.closedAt) || previous.closedAt > reservedAt
      || attempt === 3 && (previous.result.outcome !== 'passed' || previous.identitySha256 !== identitySha256 || state.productionAttempts !== 2)) {
      throw new Error('Conditional Voice requires passed, acknowledged, closed Text on the unchanged candidate; failures never release the next slot.')
    }
    const row = { type: 'reserved', attempt, name, reservedAt, reservedSeconds: 670, gracefulAt: reservedAt + maxRunSeconds * 1000,
      hardAt: reservedAt + (maxRunSeconds + 10) * 1000, leaseUntil: reservedAt + 670_000, identitySha256 }
    append(join(this.directory, QA_AMENDMENT_LEDGER), [row])
    return row
  }
  finish(attempt, { endAcknowledged, connectedSeconds = null, outcome }) {
    const state = inspectAmendedCampaign(this.directory)
    const finishedAt = this.now()
    if (attempt < 2 || attempt !== state.attempts.length || state.attempts.at(-1)?.result || typeof endAcknowledged !== 'boolean'
      || !integer(finishedAt) || finishedAt < state.attempts.at(-1).reservedAt
      || !(connectedSeconds === null || Number.isFinite(connectedSeconds) && connectedSeconds >= 0) || !['passed', 'failed', 'blocked'].includes(outcome)) throw new Error('Invalid or duplicate amended attempt result.')
    append(join(this.directory, QA_AMENDMENT_LEDGER), [{ type: 'result', attempt, finishedAt, endAcknowledged, connectedSeconds, outcome }])
  }
  closed(attempt) {
    const state = inspectAmendedCampaign(this.directory)
    const previous = state.attempts.at(-1)
    const closedAt = this.now()
    if (attempt < 2 || attempt !== state.attempts.length || previous.closedAt !== null || !previous.result || !integer(closedAt) || closedAt < previous.result.finishedAt) throw new Error('Invalid or duplicate amended cleanup result.')
    append(join(this.directory, QA_AMENDMENT_LEDGER), [{ type: 'closed', attempt, closedAt }])
  }
}
