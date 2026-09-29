import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { GameError } from './errors.js'

const MAX_SESSION_SECONDS = 600
// Ten seconds for a token request, sixty for redemption, then the full provider cap.
interface Allowance { version: 1; allowanceSessions: number; maxSessionSeconds: 600 | 900 }
interface Reservation { reservedAt: number; leaseUntil: number }

/** Called explicitly by the owner, never by the service startup path. */
export function initializeAllowance(path: string, sessions: number): void {
  if (!Number.isSafeInteger(sessions) || sessions < 1 || sessions > 1000) throw new Error('Choose an allowance of 1 to 1000 full sessions.')
  const descriptor = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(descriptor, `${JSON.stringify({ version: 1, allowanceSessions: sessions, maxSessionSeconds: MAX_SESSION_SECONDS })}\n`)
    fsyncSync(descriptor)
  } finally { closeSync(descriptor) }
}

/** A single-process, append-only allowance. Missing or damaged data fails closed. */
export class LiveAdmission {
  private failed = false
  constructor(private readonly path: string, private readonly concurrentLimit = 2, private readonly now = Date.now, readonly maxSessionSeconds: 600 | 900 = 600, private readonly confirmedClosed?: (reservation: Readonly<Reservation>) => boolean) {
    if (!Number.isSafeInteger(concurrentLimit) || concurrentLimit < 1 || concurrentLimit > 4) throw new Error('Public Live concurrency must be between 1 and 4.')
    if (![600, 900].includes(maxSessionSeconds) || maxSessionSeconds === 900 && concurrentLimit !== 1) throw new Error('The extended QA session requires one active connection.')
  }

  private read(): { allowance: Allowance; reservations: Reservation[] } {
    if (this.failed) throw new Error('Allowance unavailable')
    const source = readFileSync(this.path, 'utf8')
    if (source.length > 150_000 || !source.endsWith('\n')) throw new Error('Invalid allowance')
    const [allowance, ...reservations] = source.trimEnd().split('\n').map(line => JSON.parse(line))
    if (!allowance || Object.keys(allowance).sort().join(',') !== 'allowanceSessions,maxSessionSeconds,version' || allowance.version !== 1 || allowance.maxSessionSeconds !== this.maxSessionSeconds || !Number.isSafeInteger(allowance.allowanceSessions) || allowance.allowanceSessions < 1 || allowance.allowanceSessions > 1000 || this.maxSessionSeconds === 900 && allowance.allowanceSessions !== 8) throw new Error('Invalid allowance')
    if (reservations.length > allowance.allowanceSessions || reservations.some(value => !value || Object.keys(value).sort().join(',') !== 'leaseUntil,reservedAt' || !Number.isSafeInteger(value.reservedAt) || value.reservedAt < 0 || value.leaseUntil !== value.reservedAt + (this.maxSessionSeconds + 70) * 1000)) throw new Error('Invalid reservation')
    return { allowance, reservations }
  }

  /** A longer server cap is usable only with its matching durable admission ledger. */
  validateSessionLimit(): number { this.read(); return this.maxSessionSeconds }

  status(): { available: boolean; message: string; status: number } {
    try {
      const { allowance, reservations } = this.read()
      if (reservations.length >= allowance.allowanceSessions) return { available: false, status: 429, message: 'The demo Live allowance has been used. Practice is available without a connection.' }
      if (reservations.filter(value => value.leaseUntil > this.now() && !(this.maxSessionSeconds === 900 && this.confirmedClosed?.(Object.freeze({ ...value })) === true)).length >= this.concurrentLimit) return { available: false, status: 429, message: 'All Live demo places are busy. Try again in a few minutes or choose Practice.' }
      return { available: true, status: 200, message: 'Live demo access is available.' }
    } catch {
      this.failed = true
      return { available: false, status: 503, message: 'Live demo access is unavailable. Choose Practice or contact the demo owner.' }
    }
  }

  /** No await occurs between checking and fsync: parallel HTTP requests cannot overbook. */
  reserve(): void {
    const status = this.status()
    if (!status.available) throw new GameError(status.status, status.message)
    const reservedAt = this.now()
    let descriptor: number | undefined
    try {
      descriptor = openSync(this.path, 'a')
      writeFileSync(descriptor, `${JSON.stringify({ reservedAt, leaseUntil: reservedAt + (this.maxSessionSeconds + 70) * 1000 })}\n`)
      fsyncSync(descriptor)
    } catch {
      this.failed = true
      throw new GameError(503, 'Live demo access is unavailable. Choose Practice or contact the demo owner.')
    } finally { if (descriptor !== undefined) closeSync(descriptor) }
    // Every attempt consumes its complete configured slot, including uncertain requests.
    // Only the internal QA observer may verify remote ACK plus independent cleanup.
    // That removes concurrency occupancy, never the consumed reservation.
  }
}
