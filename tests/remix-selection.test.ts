import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { REMIX_PROFILES } from '../game/server/remix-catalog.js'
import { certifiedStarts, remixCatalogCertified } from '../game/server/remix-certificates.js'
import { dailyRemixCode, decodeRemixCode, encodeRemixCode, isRemixSetup, selectNewRemixCode, selectRemixRun } from '../game/server/remix.js'
import { previewSwitchyardRouting } from '../game/shared/switchyard.js'

const family = (index: number) => {
  const p = REMIX_PROFILES[index]!
  return [p.panelId, p.procedure, p.layout].join('/')
}
const chooseFor = (seed: number) => {
  let draw = 0
  return (maximum: number) => parseInt(createHash('sha256').update(`selection-test/${seed}/${draw++}`).digest('hex').slice(0, 8), 16) % maximum
}

test('1000 deterministic code samples recreate immutable initial specifications across every profile and safe start', t => {
  assert.equal(remixCatalogCertified(), true, 'A stale or missing proof must be regenerated and reviewed, never bypassed.')
  const seen = new Set<number>(), starts = new Set<string>(), codes = new Set<string>()
  for (let sample = 0; sample < 1000; sample++) {
    const profile = REMIX_PROFILES[sample % REMIX_PROFILES.length]!
    const start = Math.floor(sample / REMIX_PROFILES.length) % certifiedStarts(profile.panelId).length
    const assignment = (['rescue', 'lift_survey', 'service_restoration'] as const)[sample % 3]!
    const code = encodeRemixCode(profile.index, start, assignment, sample)
    const first = selectRemixRun({ kind: 'replay', code }), second = selectRemixRun({ kind: 'replay', code }, 0)
    assert.deepEqual(first, second); assert(Object.isFrozen(first)); assert(Object.isFrozen(first.installation.lift))
    assert.equal(first.profileIndex, profile.index); assert.equal(first.assignment, assignment)
    assert.deepEqual(previewSwitchyardRouting(first.initialRotations, first.panel).poweredTerminals, [])
    assert(first.initialRotations.some(rotation => rotation !== 0))
    assert.throws(() => { (first as { narrativeSeed: string }).narrativeSeed = 'mutated' }, TypeError)
    seen.add(profile.index); starts.add(`${profile.panelId}/${start}`); codes.add(code)
  }
  assert.equal(seen.size, 48); assert.equal(starts.size, 48); assert.equal(codes.size, 1000)
  t.diagnostic('1000 sampled codes; 48 profiles, 48 panel/start pairs, 1000 unique codes. Starts and nonce variations are not new mechanical families.')
})

test('1000 new dispatch selections are family-first, bounded and independent of performance', t => {
  const without: Record<string, number> = {}, withHistory: Record<string, number> = {}
  const recent: string[] = []
  for (let seed = 0; seed < 1000; seed++) {
    const plain = decodeRemixCode(selectNewRemixCode('rescue', [], chooseFor(seed)))
    const chosen = decodeRemixCode(selectNewRemixCode('rescue', recent, chooseFor(seed)))
    const key = family(chosen.profile.index), previous = recent[0] && decodeRemixCode(recent[0]).profile
    assert(!recent.includes(chosen.code))
    if (previous) assert.notEqual(key, family(previous.index))
    const seenFamilies = new Set(recent.map(code => family(decodeRemixCode(code).profile.index)))
    if (seenFamilies.size < 12) assert(!seenFamilies.has(key))
    without[family(plain.profile.index)] = (without[family(plain.profile.index)] ?? 0) + 1
    withHistory[key] = (withHistory[key] ?? 0) + 1
    recent.unshift(chosen.code); recent.splice(12)
  }
  assert.equal(Object.keys(without).length, 12); assert.equal(Object.keys(withHistory).length, 12)
  for (const count of Object.values(without)) assert(count >= 45 && count <= 120, 'Fixed seed distribution should not collapse into a cosmetic family.')
  t.diagnostic(JSON.stringify({ samples: 1000, withoutHistory: without, withHistory }))
})

test('history exhaustion, corruption and constant entropy terminate with truthful accepted codes', () => {
  const onePerFamily = REMIX_PROFILES.filter(p => p.index % 4 === 0).map(p => encodeRemixCode(p.index, 0, 'rescue', 0))
  const code = selectNewRemixCode('rescue', onePerFamily, () => 0)
  assert(!onePerFamily.includes(code)); assert.notEqual(family(decodeRemixCode(code).profile.index), family(decodeRemixCode(onePerFamily[0]).profile.index))
  assert.equal(selectNewRemixCode('rescue', ['corrupt', 'R0-obsolete'], () => 0), selectNewRemixCode('rescue', [], () => 0))
  assert.deepEqual(selectRemixRun({ kind: 'replay', code }), selectRemixRun({ kind: 'replay', code }))
})

test('daily is pinned to server UTC, deterministic for its date and replayable after midnight', () => {
  const before = Date.parse('2026-10-01T23:59:59.999Z'), after = before + 1
  const first = dailyRemixCode(before), next = dailyRemixCode(after)
  assert.equal(first.date, '2026-10-01'); assert.equal(next.date, '2026-10-02'); assert.notEqual(first.code, next.code)
  assert.deepEqual(first, dailyRemixCode(Date.parse('2026-10-01T00:00:00.000Z')))
  const run = selectRemixRun({ kind: 'daily' }, before)
  assert.equal(run.dispatch.dailyDate, first.date); assert.equal(run.dispatch.code, first.code)
  const replay = selectRemixRun({ kind: 'replay', code: first.code }, after)
  assert.deepEqual({ ...run, dispatch: replay.dispatch }, replay)
})

test('presentation nonce changes do not change routing, hidden installation or initial physical conditions', () => {
  const a = selectRemixRun({ kind: 'replay', code: encodeRemixCode(39, 8, 'rescue', 1) })
  const b = selectRemixRun({ kind: 'replay', code: encodeRemixCode(39, 8, 'rescue', 0xffffffff) })
  const mechanical = ({ narrativeSeed: _narrative, dispatch: _dispatch, ...rest }: typeof a) => rest
  assert.notEqual(a.narrativeSeed, b.narrativeSeed); assert.deepEqual(mechanical(a), mechanical(b))
})

test('code and selection validation reject forged definitions, unsupported versions and amplified work', () => {
  const code = encodeRemixCode(0, 0, 'rescue', 0)
  for (const bad of [null, {}, [], 12, 'R9' + code.slice(2), code.toLowerCase(), code + 'A', code.slice(0, -1) + 'Z', 'x'.repeat(100000)]) {
    assert.throws(() => decodeRemixCode(bad), { status: 400 })
  }
  for (const bad of [{ kind: 'new', assignment: 'rescue', recent: Array(13).fill(code) }, { kind: 'new', assignment: 'rescue', recent: [{}] },
    { kind: 'new', assignment: 'rescue', recent: [], profileIndex: 0 }, { kind: 'replay', code: {} }, { kind: 'replay', code, panel: {} },
    { kind: 'daily', date: '2026-01-01' }, { kind: 'daily', assignment: 'rescue' }]) {
    assert.equal(isRemixSetup(bad), false); assert.throws(() => selectRemixRun(bad), { status: 400 })
  }
  assert.throws(() => encodeRemixCode(48, 0, 'rescue', 0), { status: 400 })
  assert.throws(() => encodeRemixCode(0, 16, 'rescue', 0), { status: 400 })
})

test('normal fresh Node processes reproduce a code without retaining mutable progress', () => {
  const code = encodeRemixCode(47, 15, 'service_restoration', 123456)
  const script = `import {selectRemixRun} from './game/server/remix.ts';import {initialSwitchyardState} from './game/server/switchyard.ts';const r=selectRemixRun({kind:'replay',code:${JSON.stringify(code)}});const s=initialSwitchyardState(undefined,r);console.log(JSON.stringify({r,s:{location:s.location,completed:s.completed,inspected:s.inspectedDevices,rotations:s.appliedRotations},visit:s.visitId}));`
  const run = () => {
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 })
    assert.equal(child.status, 0, child.stderr)
    return JSON.parse(child.stdout)
  }
  const a = run(), b = run(); assert.notEqual(a.visit, b.visit); assert.deepEqual(a.r, b.r); assert.deepEqual(a.s, b.s)
  assert.equal(a.s.completed, false); assert.deepEqual(a.s.inspected, [])
})
