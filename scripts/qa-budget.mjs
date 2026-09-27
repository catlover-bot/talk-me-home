import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_LIMITS = Object.freeze({ maxAttempts: 3, reservationSeconds: 670, capacitySeconds: 2010, maxSessionSeconds: 600, planningDollars: 2.52, disconnectGraceSeconds: 30 })
// A prospective accounting format only. Goal 004C's runner remains blocked pending owner approval.
export const QA_RECOVERY_LIMITS = Object.freeze({ ...QA_LIMITS, maxAttempts: 2, capacitySeconds: 1340, planningDollars: 1.68 })
const HEADER_KEYS = 'capacitySeconds,createdAt,disconnectGraceSeconds,hourlyRate,maxAttempts,maxSessionSeconds,planningDollars,reservationSeconds,type,version'
const integer = value => Number.isSafeInteger(value) && value >= 0
const keys = value => Object.keys(value).sort().join(',')
const validName = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(value)
const fixedRecoveryDirectory = fileURLToPath(new URL('../.validation/goal-004c-live', import.meta.url))

function assertUnamendedWriter(directory) {
  if (directory === fixedRecoveryDirectory || ['amendment-final-acceptance.jsonl', 'amendment-final-acceptance-allowance.jsonl'].some(file => existsSync(join(directory, file)))) {
    throw new Error('The original campaign is preserved history; only the aggregate amendment supervisor may reserve new attempts.')
  }
}

function syncDirectory(directory) {
  const descriptor = openSync(directory, 'r')
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
}

function append(path, value, exclusive = false) {
  const descriptor = openSync(path, exclusive ? 'wx' : 'a', 0o600)
  try { writeFileSync(descriptor, `${JSON.stringify(value)}\n`); fsyncSync(descriptor) } finally { closeSync(descriptor) }
}

function ordinaryFile(path) {
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('QA accounting must use ordinary files.')
}

/** Explicit one-time setup. The supplied initializer is the existing production allowance function. */
export function initializeCampaign(directory, initializeAllowance, { hourlyRate = 4.5, now = Date.now, profile = 'goal-004b' } = {}) {
  directory = resolve(directory)
  if (!['goal-004b', 'goal-004c'].includes(profile)) throw new Error('Unknown fixed QA campaign profile.')
  const limits = profile === 'goal-004c' ? QA_RECOVERY_LIMITS : QA_LIMITS
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) throw new Error('A verified positive hourly rate is required.')
  const maxAttempts = Math.min(limits.maxAttempts, Math.floor(limits.planningDollars * 3600 / hourlyRate / limits.reservationSeconds))
  if (maxAttempts < 1) throw new Error('The verified rate exceeds the campaign planning ceiling.')
  if (profile === 'goal-004c' && maxAttempts !== 2) throw new Error('The proposed Goal 004C envelope no longer fits; revised owner approval is required.')
  if (existsSync(directory)) {
    if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('Invalid QA campaign directory.')
    if (existsSync(join(directory, 'campaign.jsonl')) && existsSync(join(directory, 'allowance.jsonl'))) {
      const state = inspectCampaign(directory)
      if (state.header.capacitySeconds !== limits.capacitySeconds) throw new Error('An existing campaign cannot be replaced by another profile.')
      if (hourlyRate !== state.header.hourlyRate) throw new Error('The verified rate changed; existing campaign limits were not replaced.')
      return state
    }
    if (readdirSync(directory).length) throw new Error('Unexpected or incomplete QA campaign directory; nothing was replaced.')
  } else mkdirSync(directory, { recursive: true, mode: 0o700 })
  const header = { type: 'campaign', version: 1, ...limits, maxAttempts, hourlyRate, createdAt: now() }
  append(join(directory, 'campaign.jsonl'), header, true)
  // Partial initialization fails closed on every later invocation; it never creates a replacement allowance.
  initializeAllowance(join(directory, 'allowance.jsonl'), limits.maxAttempts)
  syncDirectory(directory)
  return inspectCampaign(directory)
}

/** Pure local inspection. It never initializes files, loads credentials, or contacts a provider. */
export function inspectCampaign(directory) {
  const ledgerPath = join(resolve(directory), 'campaign.jsonl')
  const allowancePath = join(resolve(directory), 'allowance.jsonl')
  ordinaryFile(ledgerPath); ordinaryFile(allowancePath)
  const source = readFileSync(ledgerPath, 'utf8')
  if (source.length > 100_000 || !source.endsWith('\n')) throw new Error('Corrupt QA campaign ledger.')
  let rows
  try { rows = source.trimEnd().split('\n').map(line => JSON.parse(line)) } catch { throw new Error('Corrupt QA campaign ledger.') }
  const header = rows.shift()
  const limits = header?.capacitySeconds === QA_RECOVERY_LIMITS.capacitySeconds ? QA_RECOVERY_LIMITS : QA_LIMITS
  if (!header || keys(header) !== HEADER_KEYS || header.type !== 'campaign' || header.version !== 1 || !integer(header.createdAt)
    || header.reservationSeconds !== 670 || header.capacitySeconds !== limits.capacitySeconds || header.maxSessionSeconds !== 600 || header.disconnectGraceSeconds !== 30
    || header.planningDollars !== limits.planningDollars || !Number.isFinite(header.hourlyRate) || header.hourlyRate <= 0 || !integer(header.maxAttempts) || header.maxAttempts < 1 || header.maxAttempts > limits.maxAttempts
    || limits === QA_RECOVERY_LIMITS && header.maxAttempts !== 2
    || header.maxAttempts * 670 * header.hourlyRate / 3600 > limits.planningDollars) throw new Error('Invalid QA campaign limits.')
  const attempts = []
  for (const row of rows) {
    if (!row || !integer(row.attempt)) throw new Error('Invalid QA accounting event.')
    if (row.type === 'reserved') {
      if (keys(row) !== 'attempt,gracefulAt,hardAt,leaseUntil,name,reservedAt,reservedSeconds,type' || row.attempt !== attempts.length + 1 || row.attempt > header.maxAttempts || !validName(row.name)
        || !integer(row.reservedAt) || row.reservedSeconds !== 670 || row.leaseUntil !== row.reservedAt + 670_000 || !integer(row.gracefulAt)
        || row.gracefulAt <= row.reservedAt || row.gracefulAt > row.reservedAt + 590_000 || row.hardAt !== row.gracefulAt + 10_000) throw new Error('Invalid QA reservation.')
      attempts.push({ ...row, result: null, closedAt: null })
    } else if (row.type === 'result') {
      const attempt = attempts[row.attempt - 1]
      if (keys(row) !== 'attempt,connectedSeconds,endAcknowledged,finishedAt,outcome,type' || !attempt || attempt.result || !integer(row.finishedAt) || row.finishedAt < attempt.reservedAt
        || typeof row.endAcknowledged !== 'boolean' || !(row.connectedSeconds === null || Number.isFinite(row.connectedSeconds) && row.connectedSeconds >= 0)
        || !['passed', 'failed', 'blocked'].includes(row.outcome)) throw new Error('Invalid QA result.')
      attempt.result = row
    } else if (row.type === 'closed') {
      const attempt = attempts[row.attempt - 1]
      if (keys(row) !== 'attempt,closedAt,type' || !attempt || attempt.closedAt !== null || !integer(row.closedAt) || row.closedAt < attempt.reservedAt) throw new Error('Invalid QA cleanup event.')
      attempt.closedAt = row.closedAt
    } else throw new Error('Unknown QA accounting event.')
  }
  const allowanceSource = readFileSync(allowancePath, 'utf8')
  if (allowanceSource.length > 10_000 || !allowanceSource.endsWith('\n')) throw new Error('Corrupt QA production allowance.')
  let allowanceRows
  try { allowanceRows = allowanceSource.trimEnd().split('\n').map(line => JSON.parse(line)) } catch { throw new Error('Corrupt QA production allowance.') }
  const allowance = allowanceRows.shift()
  if (!allowance || keys(allowance) !== 'allowanceSessions,maxSessionSeconds,version' || allowance.version !== 1 || allowance.allowanceSessions !== limits.maxAttempts || allowance.maxSessionSeconds !== 600
    || allowanceRows.length > limits.maxAttempts || allowanceRows.length > attempts.length || allowanceRows.some(row => !row || keys(row) !== 'leaseUntil,reservedAt' || !integer(row.reservedAt) || row.leaseUntil !== row.reservedAt + 670_000)) throw new Error('Invalid QA production allowance.')
  return { header, attempts, productionAttempts: allowanceRows.length, reservedSeconds: attempts.length * 670, estimatedReservedDollars: attempts.length * 670 * header.hourlyRate / 3600 }
}

/** Only the flock-owning supervisor may instantiate this writer. */
export class CampaignBudget {
  constructor(directory, now = Date.now) { this.directory = resolve(directory); this.now = now; assertUnamendedWriter(this.directory); inspectCampaign(this.directory) }
  reserve({ name, maxRunSeconds = 570 }) {
    assertUnamendedWriter(this.directory)
    if (!validName(name) || !Number.isSafeInteger(maxRunSeconds) || maxRunSeconds < 1 || maxRunSeconds > 590) throw new Error('Invalid bounded QA attempt.')
    const state = inspectCampaign(this.directory)
    if (state.attempts.length >= state.header.maxAttempts) throw new Error('The durable QA campaign attempt allowance is exhausted.')
    const previous = state.attempts.at(-1)
    const reservedAt = this.now()
    if (previous && !(previous.result?.endAcknowledged && previous.closedAt !== null) && reservedAt < previous.leaseUntil) throw new Error('The preceding QA attempt is not confirmed closed; its conservative lease is still active.')
    const row = { type: 'reserved', attempt: state.attempts.length + 1, name, reservedAt, reservedSeconds: 670, gracefulAt: reservedAt + maxRunSeconds * 1000, hardAt: reservedAt + (maxRunSeconds + 10) * 1000, leaseUntil: reservedAt + 670_000 }
    append(join(this.directory, 'campaign.jsonl'), row)
    return row
  }
  finish(attempt, { endAcknowledged, connectedSeconds = null, outcome }) {
    assertUnamendedWriter(this.directory)
    const state = inspectCampaign(this.directory)
    if (attempt !== state.attempts.length || state.attempts.at(-1)?.result || typeof endAcknowledged !== 'boolean' || !(connectedSeconds === null || Number.isFinite(connectedSeconds) && connectedSeconds >= 0) || !['passed', 'failed', 'blocked'].includes(outcome)) throw new Error('Invalid or duplicate QA attempt result.')
    append(join(this.directory, 'campaign.jsonl'), { type: 'result', attempt, finishedAt: this.now(), endAcknowledged, connectedSeconds, outcome })
  }
  closed(attempt) {
    assertUnamendedWriter(this.directory)
    const state = inspectCampaign(this.directory)
    if (attempt !== state.attempts.length || state.attempts.at(-1)?.closedAt !== null) throw new Error('Invalid or duplicate QA cleanup result.')
    append(join(this.directory, 'campaign.jsonl'), { type: 'closed', attempt, closedAt: this.now() })
  }
}
