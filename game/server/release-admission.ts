import { createHash } from 'node:crypto'
import { closeSync, constants, existsSync, fsyncSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { GameError } from './errors.js'

export const RELEASE_GRANT_ID = 'goal-007-release-2026-09-30'
export const RELEASE_ALLOCATION_PATH = '/var/data/talk-me-home-goal-007-release.jsonl'
export const RELEASE_LIMITS = Object.freeze({ qaAttempts: 8, reviewerAttempts: 8, textAttempts: 2, maxSessionSeconds: 900, reservationSeconds: 970, hourlyUsd: 4.5, estimatedUsd: 19.4, approvedUsd: 20 })
export type ReleasePurpose = 'qa' | 'reviewer'
export type ReleaseMode = 'voice' | 'text'
export interface ReleaseCapability { purpose: ReleasePurpose; mode: ReleaseMode }
export interface ReleaseBinding { origin: string; serviceId: string; runtimeSha256: string }
export type AccountRefusal = 'provider_credit_refused' | 'provider_credential_or_account_refused'
interface Grant {
  type: 'grant'; version: 2; id: typeof RELEASE_GRANT_ID; origin: string; serviceId: string; createdAt: number; priceCheckedAt: string
  qaAttempts: 8; reviewerAttempts: 8; textAttempts: 2; maxSessionSeconds: 900; reservationSeconds: 970; hourlyUsd: 4.5; estimatedUsd: 19.4; approvedUsd: 20
}
export interface ReleaseReservation extends ReleaseCapability {
  type: 'reserved'; attempt: number; poolAttempt: number; browserHash: string; reservedAt: number; leaseUntil: number; runtimeSha256: string
}
export interface AcceptanceEvidence {
  attempt: number; runtimeSha256: string; reportSha256: string; mode: 'voice'; completion: true
  chapters: ['cargo', 'gallery', 'dock', 'home']; endingAck: true; cleanup: true; nonzeroPlayback: true
  exactConfirmations: true; accessCodeRoute: true; recorderCollected: boolean; recoveryExercised: boolean
}
interface Acceptance { type: 'accepted'; at: number; runtimeSha256: string; ordinary: AcceptanceEvidence; recorderRecovery: AcceptanceEvidence }
interface Halt { type: 'halted'; at: number; reason: AccountRefusal; source: 'token_response' | 'client_report' | 'operator' }
interface Ledger { grant: Grant; reservations: ReleaseReservation[]; acceptances: Acceptance[]; halt?: Halt }
interface AdmissionStatus { available: boolean; status: number; message: string }
const unavailable = (): AdmissionStatus => ({ available: false, status: 503, message: 'Live access is unavailable. Choose Practice or contact the owner.' })
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const timestamp = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
function keys(value: unknown, expected: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === expected.sort().join(','))
}
function validBinding(binding: ReleaseBinding): boolean {
  try { return new URL(binding.origin).origin === binding.origin && binding.origin.startsWith('https://') && /^srv-[a-z0-9-]+$/.test(binding.serviceId) && sha(binding.runtimeSha256) }
  catch { return false }
}
function regularRead(path: string): string {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = fstatSync(descriptor)
    if (!stat.isFile() || stat.size > 150_000) throw new Error('Invalid release allocation')
    return readFileSync(descriptor, 'utf8')
  } finally { closeSync(descriptor) }
}
/** A failed/crashed writer leaves a lock for operator diagnosis, never automatic quota repair. */
function locked<T>(path: string, action: () => T): T {
  const lock = `${path}.lock`
  const descriptor = openSync(lock, 'wx', 0o600)
  try { return action() }
  finally { closeSync(descriptor); unlinkSync(lock) }
}
function append(path: string, row: unknown): void {
  const descriptor = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW)
  try {
    if (!fstatSync(descriptor).isFile()) throw new Error('Invalid release allocation')
    writeFileSync(descriptor, `${JSON.stringify(row)}\n`)
    fsyncSync(descriptor)
  } finally { closeSync(descriptor) }
}
function validEvidence(value: unknown, reservations: ReleaseReservation[], runtime: string, recorder: boolean): value is AcceptanceEvidence {
  if (!keys(value, ['attempt', 'runtimeSha256', 'reportSha256', 'mode', 'completion', 'chapters', 'endingAck', 'cleanup', 'nonzeroPlayback', 'exactConfirmations', 'accessCodeRoute', 'recorderCollected', 'recoveryExercised'])) return false
  const reservation = reservations.find(row => row.attempt === value.attempt)
  return Boolean(reservation?.purpose === 'qa' && reservation.mode === 'voice' && reservation.runtimeSha256 === runtime
    && value.runtimeSha256 === runtime && sha(value.reportSha256) && value.mode === 'voice' && value.completion === true
    && JSON.stringify(value.chapters) === '["cargo","gallery","dock","home"]' && value.endingAck === true && value.cleanup === true
    && value.nonzeroPlayback === true && value.exactConfirmations === true && value.accessCodeRoute === true
    && value.recorderCollected === recorder && value.recoveryExercised === recorder)
}

/** Only the explicit hosted operator command calls this; startup never initializes data. */
export function initializeReleaseAllocation(path: string, binding: ReleaseBinding, priceCheckedAt: string, now = Date.now()): 'created' | 'existing' {
  if (!validBinding(binding) || !timestamp(now) || !Number.isFinite(Date.parse(priceCheckedAt)) || Date.parse(priceCheckedAt) > now || now - Date.parse(priceCheckedAt) > 86_400_000) throw new Error('Verify current pricing and the exact hosted service before allocation')
  return locked(path, () => {
    if (existsSync(path)) { new ReleaseAdmission(path, binding).inspect(); return 'existing' }
    const grant: Grant = { type: 'grant', version: 2, id: RELEASE_GRANT_ID, origin: binding.origin, serviceId: binding.serviceId, createdAt: now, priceCheckedAt, ...RELEASE_LIMITS }
    const descriptor = openSync(path, 'wx', 0o600)
    try { writeFileSync(descriptor, `${JSON.stringify(grant)}\n`); fsyncSync(descriptor) }
    finally { closeSync(descriptor) }
    return 'created'
  })
}

/** One hosted, append-only allocation. Failed attempts and expired leases remain spent. */
export class ReleaseAdmission {
  readonly maxSessionSeconds = 900
  private failed = false
  constructor(private readonly path: string, readonly binding: ReleaseBinding, private readonly now = Date.now) {
    if (!validBinding(binding)) throw new Error('The protected release requires a verified service, HTTPS origin, and runtime fingerprint')
  }
  private read(): Ledger {
    if (this.failed) throw new Error('Release allocation unavailable')
    const source = regularRead(this.path)
    if (!source.endsWith('\n')) throw new Error('Incomplete release allocation')
    const [grant, ...rows]: unknown[] = source.trimEnd().split('\n').map(line => JSON.parse(line))
    if (!keys(grant, ['type', 'version', 'id', 'origin', 'serviceId', 'createdAt', 'priceCheckedAt', ...Object.keys(RELEASE_LIMITS)])
      || grant.type !== 'grant' || grant.version !== 2 || grant.id !== RELEASE_GRANT_ID || grant.origin !== this.binding.origin || grant.serviceId !== this.binding.serviceId
      || !timestamp(grant.createdAt) || typeof grant.priceCheckedAt !== 'string' || !Number.isFinite(Date.parse(grant.priceCheckedAt))
      || Date.parse(grant.priceCheckedAt) > grant.createdAt || grant.createdAt - Date.parse(grant.priceCheckedAt) > 86_400_000
      || Object.entries(RELEASE_LIMITS).some(([key, value]) => grant[key] !== value)) throw new Error('Invalid release grant')
    const ledger: Ledger = { grant: grant as unknown as Grant, reservations: [], acceptances: [] }
    let lastAt = grant.createdAt
    for (const value of rows) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid release record')
      const row = value as Record<string, unknown>
      if (row.type === 'reserved') {
        if (!keys(row, ['type', 'attempt', 'poolAttempt', 'purpose', 'mode', 'browserHash', 'reservedAt', 'leaseUntil', 'runtimeSha256'])
          || !['qa', 'reviewer'].includes(String(row.purpose)) || !['voice', 'text'].includes(String(row.mode))
          || row.attempt !== ledger.reservations.length + 1 || row.poolAttempt !== ledger.reservations.filter(value => value.purpose === row.purpose).length + 1
          || Number(row.poolAttempt) > 8 || !sha(row.browserHash) || !sha(row.runtimeSha256) || !timestamp(row.reservedAt)
          || row.reservedAt < lastAt || row.leaseUntil !== row.reservedAt + 970_000 || ledger.halt
          || ledger.reservations.some(value => value.leaseUntil > Number(row.reservedAt))
          || row.purpose === 'qa' && row.mode === 'text' && ledger.reservations.filter(value => value.purpose === 'qa' && value.mode === 'text').length >= 2
          || row.purpose === 'reviewer' && (row.mode !== 'voice' || !ledger.acceptances.some(value => value.runtimeSha256 === row.runtimeSha256)
            || ledger.reservations.filter(value => value.purpose === 'reviewer' && value.browserHash === row.browserHash).length >= 2)) throw new Error('Invalid release reservation')
        ledger.reservations.push(row as unknown as ReleaseReservation); lastAt = row.reservedAt
      } else if (row.type === 'accepted') {
        if (!keys(row, ['type', 'at', 'runtimeSha256', 'ordinary', 'recorderRecovery']) || !timestamp(row.at) || row.at < lastAt || !sha(row.runtimeSha256) || ledger.halt
          || !validEvidence(row.ordinary, ledger.reservations, row.runtimeSha256, false) || !validEvidence(row.recorderRecovery, ledger.reservations, row.runtimeSha256, true)
          || row.ordinary.attempt === row.recorderRecovery.attempt || row.ordinary.reportSha256 === row.recorderRecovery.reportSha256
          || ledger.reservations.some(value => value.leaseUntil > Number(row.at))) throw new Error('Invalid acceptance record')
        ledger.acceptances.push(row as unknown as Acceptance); lastAt = row.at
      } else if (row.type === 'halted') {
        if (!keys(row, ['type', 'at', 'reason', 'source']) || !timestamp(row.at) || row.at < lastAt || !['provider_credit_refused', 'provider_credential_or_account_refused'].includes(String(row.reason))
          || !['token_response', 'client_report', 'operator'].includes(String(row.source)) || ledger.halt) throw new Error('Invalid halt record')
        ledger.halt = row as unknown as Halt; lastAt = row.at
      } else throw new Error('Unknown release record')
    }
    return ledger
  }
  /** Operator-only detailed accounting, never returned as a public HTTP payload. */
  inspect() { return this.read() }
  /** Safe purpose-scoped counters for an already authorized browser; never returns identities or keys. */
  accessSummary(capability: ReleaseCapability, browser?: string) {
    try {
      const ledger = this.read()
      const used = ledger.reservations.filter(row => row.purpose === capability.purpose).length
      return { grantId: RELEASE_GRANT_ID, purpose: capability.purpose, mode: capability.mode, used, remaining: 8 - used,
        reservationSeconds: 970, maxSessionSeconds: 900, runtimeSha256: this.binding.runtimeSha256,
        leaseUntil: Math.max(0, ...ledger.reservations.map(row => row.leaseUntil)),
        accepted: ledger.acceptances.some(row => row.runtimeSha256 === this.binding.runtimeSha256), halted: Boolean(ledger.halt),
        ...(capability.purpose === 'qa' ? { textRemaining: 2 - ledger.reservations.filter(row => row.purpose === 'qa' && row.mode === 'text').length }
          : { visitRemaining: Math.max(0, 2 - ledger.reservations.filter(row => row.purpose === 'reviewer' && row.browserHash === hash(browser ?? '')).length) }),
      }
    } catch { return null }
  }
  private statusFor(ledger: Ledger, capability: ReleaseCapability, browser?: string): AdmissionStatus {
    if (ledger.halt) return unavailable()
    const accepted = ledger.acceptances.some(value => value.runtimeSha256 === this.binding.runtimeSha256)
    if (capability.purpose === 'reviewer' && !accepted) return { available: false, status: 503, message: 'Reviewer Live access is not open yet. Practice is available.' }
    if (capability.purpose === 'qa' && accepted) return { available: false, status: 403, message: 'The current release already passed hosted QA. Further QA spending is stopped.' }
    if (ledger.reservations.filter(row => row.purpose === capability.purpose).length >= 8) return { available: false, status: 429, message: 'This Live allocation is used. Practice remains available.' }
    if (capability.purpose === 'qa' && capability.mode === 'text' && ledger.reservations.filter(row => row.purpose === 'qa' && row.mode === 'text').length >= 2) return { available: false, status: 429, message: 'The two Text diagnostic attempts are used.' }
    if (capability.purpose === 'reviewer' && browser && ledger.reservations.filter(row => row.purpose === 'reviewer' && row.browserHash === hash(browser)).length >= 2) return { available: false, status: 429, message: 'Both Live launches for this browser visit are used. Practice remains available.' }
    if (ledger.reservations.some(row => row.leaseUntil > this.now())) return { available: false, status: 429, message: 'The Live connection place is reserved. Try later or choose Practice.' }
    return { available: true, status: 200, message: 'Protected Live access is available.' }
  }
  status(capability: ReleaseCapability, browser?: string): AdmissionStatus {
    try { return this.statusFor(this.read(), capability, browser) }
    catch { this.failed = true; return unavailable() }
  }
  /** No await between checking and fsync; a filesystem lock also excludes operator writes. */
  reserve(capability: ReleaseCapability, browser: string): ReleaseReservation {
    if (!['qa', 'reviewer'].includes(capability.purpose) || !['voice', 'text'].includes(capability.mode) || capability.purpose === 'reviewer' && capability.mode !== 'voice' || !/^[A-Za-z0-9_-]{43}$/.test(browser)) throw new GameError(403, 'Protected browser access is required.')
    try {
      return locked(this.path, () => {
        const ledger = this.read()
        const status = this.statusFor(ledger, capability, browser)
        if (!status.available) throw new GameError(status.status, status.message)
        const reservedAt = this.now()
        const reservation: ReleaseReservation = { type: 'reserved', ...capability, attempt: ledger.reservations.length + 1, poolAttempt: ledger.reservations.filter(row => row.purpose === capability.purpose).length + 1, browserHash: hash(browser), reservedAt, leaseUntil: reservedAt + 970_000, runtimeSha256: this.binding.runtimeSha256 }
        if (!timestamp(reservedAt) || reservedAt < ledger.grant.createdAt) throw new Error('Invalid clock')
        append(this.path, reservation)
        return reservation
      })
    } catch (error) {
      if (error instanceof GameError) throw error
      this.failed = true; throw new GameError(503, unavailable().message)
    }
  }
  halt(reason: AccountRefusal, source: Halt['source'] = 'operator'): void {
    if (!['provider_credit_refused', 'provider_credential_or_account_refused'].includes(reason) || !['token_response', 'client_report', 'operator'].includes(source)) throw new Error('Invalid allocation stop')
    try { locked(this.path, () => { const ledger = this.read(); if (!ledger.halt) append(this.path, { type: 'halted', at: this.now(), reason, source }) }) }
    catch { this.failed = true; throw new Error('The release allocation could not record its stop') }
  }
  reportClientRefusal(attempt: number, capability: ReleaseCapability, browser: string, reason: AccountRefusal): void {
    if (!['provider_credit_refused', 'provider_credential_or_account_refused'].includes(reason)) throw new GameError(400, 'This Live stop reason is invalid.')
    locked(this.path, () => {
      const ledger = this.read()
      const reservation = ledger.reservations.find(row => row.attempt === attempt)
      if (!reservation || reservation.purpose !== capability.purpose || reservation.mode !== capability.mode || reservation.browserHash !== hash(browser)
        || reservation.runtimeSha256 !== this.binding.runtimeSha256 || reservation.leaseUntil <= this.now()) throw new GameError(403, 'An issued protected connection is required for this report.')
      if (!ledger.halt) append(this.path, { type: 'halted', at: this.now(), reason, source: 'client_report' })
    })
  }
  /** An operator attests to the preserved actual reports after independently reviewing them. */
  acceptPair(ordinary: AcceptanceEvidence, recorderRecovery: AcceptanceEvidence): 'accepted' | 'existing' {
    return locked(this.path, () => {
      const ledger = this.read()
      const runtime = this.binding.runtimeSha256
      if (ledger.halt || !validEvidence(ordinary, ledger.reservations, runtime, false) || !validEvidence(recorderRecovery, ledger.reservations, runtime, true)
        || ordinary.attempt === recorderRecovery.attempt || ordinary.reportSha256 === recorderRecovery.reportSha256
        || ledger.reservations.some(row => row.leaseUntil > this.now())) throw new Error('Two qualifying preserved reports and expired connection leases are required')
      const previous = ledger.acceptances.find(row => row.runtimeSha256 === runtime)
      if (previous) {
        if (JSON.stringify(previous.ordinary) !== JSON.stringify(ordinary) || JSON.stringify(previous.recorderRecovery) !== JSON.stringify(recorderRecovery)) throw new Error('An existing acceptance cannot be replaced')
        return 'existing'
      }
      append(this.path, { type: 'accepted', at: this.now(), runtimeSha256: runtime, ordinary, recorderRecovery })
      return 'accepted'
    })
  }
}

/** Compiled app behavior and shipped assets only: release SHA, docs, and media are excluded. */
export function releaseRuntimeFingerprint(directory: string): string {
  const files: Record<string, string> = {}
  const visit = (relative: string) => {
    const path = resolve(directory, relative)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw new Error('Unexpected runtime symlink')
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(relative, name))
    else if (stat.isFile()) files[relative.replaceAll('\\', '/')] = hash(readFileSync(path))
    else throw new Error('Unexpected runtime entry')
  }
  visit('client'); visit('server')
  return hash(JSON.stringify({ profile: RELEASE_LIMITS, files }))
}
