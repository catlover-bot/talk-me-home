import { createHash, randomInt } from 'node:crypto'
import { REMIX_CODE_PATTERN, REMIX_HISTORY_LIMIT, type RemixAvailability, type RemixSetup } from '../shared/remix.js'
import type { SwitchyardAssignment } from '../shared/switchyard.js'
import { createRunSpec, REMIX_PROFILES, type RemixProfile, type SwitchyardRunSpec } from './remix-catalog.js'
import { certifiedStarts, remixCatalogCertified } from './remix-certificates.js'
import { GameError } from './errors.js'

const assignments: readonly SwitchyardAssignment[] = ['rescue', 'lift_survey', 'service_restoration']
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const two = (value: number) => value.toString(36).toUpperCase().padStart(2, '0')
const hex = (value: number) => value.toString(16).toUpperCase().padStart(8, '0')
const invalid = () => new GameError(400, 'Use a complete supported R1 dispatch code. Check its characters and checksum; older or unknown versions are not reinterpreted.')
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

/** This version freezes resolved profile order, certified starts, rules and assignment meaning. */
export function encodeRemixCode(profileIndex: number, startIndex: number, assignment: SwitchyardAssignment, nonce: number): string {
  const profile = REMIX_PROFILES[profileIndex]
  if (!profile || !Number.isInteger(startIndex) || startIndex < 0 || startIndex >= certifiedStarts(profile.panelId).length
    || !assignments.includes(assignment) || !Number.isInteger(nonce) || nonce < 0 || nonce > 0xffffffff) throw invalid()
  const prefix = `R1-${two(profileIndex)}-${two(startIndex)}-${assignments.indexOf(assignment)}-${hex(nonce)}`
  return `${prefix}-${hash(`Talk Me Home dispatch/${prefix}`).slice(0, 8).toUpperCase()}`
}

export function decodeRemixCode(value: unknown): { code: string; profile: RemixProfile; startIndex: number; assignment: SwitchyardAssignment; nonce: number } {
  if (typeof value !== 'string' || value.length !== 28 || !REMIX_CODE_PATTERN.test(value)) throw invalid()
  const parts = value.split('-')
  const profile = REMIX_PROFILES[parseInt(parts[1]!, 36)]
  const startIndex = parseInt(parts[2]!, 36), assignment = assignments[Number(parts[3])]!
  if (!profile || startIndex >= certifiedStarts(profile.panelId).length) throw invalid()
  const nonce = parseInt(parts[4]!, 16)
  if (encodeRemixCode(profile.index, startIndex, assignment, nonce) !== value) throw invalid()
  return { code: value, profile, startIndex, assignment, nonce }
}

export function isRemixSetup(value: unknown): value is RemixSetup {
  if (exact(value, ['kind']) && value.kind === 'daily') return true
  if (exact(value, ['kind', 'code']) && value.kind === 'replay') return typeof value.code === 'string' && value.code.length <= 64
  return exact(value, ['kind', 'assignment', 'recent']) && value.kind === 'new'
    && assignments.includes(value.assignment as SwitchyardAssignment) && Array.isArray(value.recent)
    && value.recent.length <= REMIX_HISTORY_LIMIT && value.recent.every(code => typeof code === 'string' && code.length <= 64)
}

const family = (profile: RemixProfile) => `${profile.panelId}/${profile.procedure}/${profile.layout}`
const differences = (a: RemixProfile, b: RemixProfile) => Number(a.panelId !== b.panelId) + Number(a.procedure !== b.procedure) + Number(a.layout !== b.layout)

/** Bounded selection over certified families, never based on performance or speech errors. */
export function selectNewRemixCode(assignment: SwitchyardAssignment, recent: readonly string[], choose: (maximum: number) => number = randomInt): string {
  const parsed = recent.slice(0, REMIX_HISTORY_LIMIT).flatMap(code => { try { return [decodeRemixCode(code)] } catch { return [] } })
  const previous = parsed[0]?.profile
  const families = [...new Map(REMIX_PROFILES.map(profile => [family(profile), profile])).values()]
  const recentFamilies = new Set(parsed.map(entry => family(entry.profile)))
  let pool = families.filter(profile => !recentFamilies.has(family(profile)))
  if (!pool.length) pool = families.filter(profile => !previous || family(profile) !== family(previous))
  if (!pool.length) pool = families
  if (previous) {
    const contrasting = pool.filter(profile => differences(profile, previous) >= 2)
    if (contrasting.length) pool = contrasting
  }
  const selectedFamily = pool[choose(pool.length)]!
  const variants = REMIX_PROFILES.filter(profile => family(profile) === family(selectedFamily))
  const profile = variants[choose(variants.length)]!
  const startIndex = choose(certifiedStarts(profile.panelId).length)
  const firstNonce = choose(0x100000000)
  // At most twelve recent codes can conflict. Thirteen distinct candidates suffice even with a constant RNG.
  for (let offset = 0; offset <= REMIX_HISTORY_LIMIT; offset++) {
    const code = encodeRemixCode(profile.index, startIndex, assignment, (firstNonce + offset) >>> 0)
    if (!recent.includes(code)) return code
  }
  throw new GameError(503, 'A fresh dispatch could not be selected. Original Switchyard remains available.')
}

export function dailyRemixCode(now: number): { date: string; code: string } {
  const date = new Date(now).toISOString().slice(0, 10)
  const seed = hash(`Talk Me Home daily/R1/${date}`)
  const profile = REMIX_PROFILES[parseInt(seed.slice(0, 8), 16) % REMIX_PROFILES.length]!
  const startIndex = parseInt(seed.slice(8, 16), 16) % certifiedStarts(profile.panelId).length
  return { date, code: encodeRemixCode(profile.index, startIndex, 'rescue', parseInt(seed.slice(16, 24), 16)) }
}

export function remixAvailability(now = Date.now()): RemixAvailability {
  return remixCatalogCertified()
    ? { available: true, daily: dailyRemixCode(now) }
    : { available: false, message: 'Remix is unavailable because its validation data is missing or out of date. Original Switchyard, Rescue and Training remain available.' }
}

export function selectRemixRun(input: unknown, now = Date.now()): SwitchyardRunSpec {
  if (!isRemixSetup(input)) throw new GameError(400, 'Choose New dispatch, Replay a code, or Daily dispatch using only its setup fields. Recent history is limited to twelve codes.')
  const availability = remixAvailability(now)
  if (!availability.available) throw new GameError(503, availability.message!)
  const daily = input.kind === 'daily' ? availability.daily! : undefined
  const value = decodeRemixCode(daily?.code ?? (input.kind === 'replay' ? input.code : input.kind === 'new' ? selectNewRemixCode(input.assignment, input.recent) : ''))
  return createRunSpec(value.profile.index, [...certifiedStarts(value.profile.panelId)[value.startIndex]!] as Parameters<typeof createRunSpec>[1], value.assignment, value.nonce,
    { code: value.code, recentToken: hash(`Talk Me Home recent/R1/${family(value.profile)}`).slice(0, 32), ...(daily ? { dailyDate: daily.date } : {}) })
}
