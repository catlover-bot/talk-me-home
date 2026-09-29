import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LiveAdmission } from '../game/server/admission.js'
import { assertGoal005NextAttempt, assertGoal005Validation, goal005FrozenFile } from '../scripts/qa-live-authorization.mjs'
import { writeGoal004ERecheckHistory } from './fixtures/goal-004c-history.js'
// @ts-expect-error Native Node executable accounting module.
import { AmendedCampaignBudget, initializeAmendment, inspectAmendedCampaign, QA_GOAL005_AMENDMENT_ID as id, QA_GOAL005_AMENDMENT_LEDGER as ledger, QA_GOAL005_AMENDMENT_ALLOWANCE as allowance, QA_RECHECK_AMENDMENT_ID, isGoal005ProductionReservationClosed } from '../scripts/qa-amended-budget.mjs'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const files = { 'dist/test.js': 'a'.repeat(64) }
const harnessFiles = { 'test.mjs': 'b'.repeat(64) }
const fixtureFiles = { 'speech-test.wav': 'c'.repeat(64) }
const identity = { commit: 'a'.repeat(40), files, runtimeSha256: hash(files), harnessFiles, harnessSha256: hash(harnessFiles), fixtureFiles, fixtureSha256: hash(fixtureFiles), sessionUpdateSha256: 'd'.repeat(64), browserExecutableSha256: 'e'.repeat(64) }

function fixture(run: (directory: string, clock: { now: number }) => void, initialize = true) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-goal005-'))
  try {
    writeGoal004ERecheckHistory(directory)
    const history = readdirSync(directory).map(file => ({ file, bytes: readFileSync(join(directory, file)) }))
    const clock = { now: 1_800_000_000_000 }
    if (initialize) initializeAmendment(directory, { amendmentId: id, now: () => clock.now })
    run(directory, clock)
    for (const { file, bytes } of history) assert.deepEqual(readFileSync(join(directory, file)), bytes)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('Goal005 links five exhausted attempts and idempotently reuses exactly eight new 970-second slots', () => fixture((directory, clock) => {
  const state = inspectAmendedCampaign(directory, id)
  assert.equal(state.historicalAttempts, 5)
  assert.equal(state.reservedSeconds, 3350)
  assert.equal(state.productionAttempts, 5)
  assert.equal(state.header.newCapacitySeconds, 7760)
  assert.equal(state.header.newCapacitySeconds * state.header.hourlyRate / 3600, 9.7)
  assert.equal(state.header.capacitySeconds, 11110)
  assert.deepEqual(JSON.parse(readFileSync(join(directory, allowance), 'utf8')), { version: 1, allowanceSessions: 8, maxSessionSeconds: 900 })
  assert.deepEqual(initializeAmendment(directory, { amendmentId: id }), state)
  assert.throws(() => new AmendedCampaignBudget(directory, Date.now, QA_RECHECK_AMENDMENT_ID), /preserved history/)
  const budget = new AmendedCampaignBudget(directory, () => clock.now, id)
  assert.throws(() => budget.reserve({ name: 'text-mission', identity }), /Invalid fixed/)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity, maxRunSeconds: 891 }), /Invalid fixed/)
  for (let index = 0; index < 8; index++) {
    const attempt = budget.reserve({ name: index === 1 || index === 2 ? 'text-mission' : 'voice-mission', maxRunSeconds: 890, identity: { ...identity, commit: String(index).repeat(40) } })
    assert.equal(attempt.reservedSeconds, 970)
    assert.equal(attempt.hardAt - attempt.reservedAt, 900_000)
    // Failed-before-production attempts still consume the full QA reservation.
    clock.now++
    budget.finish(attempt.attempt, { outcome: 'failed', endAcknowledged: true })
    budget.closed(attempt.attempt)
    if (index === 2) assert.throws(() => budget.reserve({ name: 'text-mission', identity }), /Invalid fixed/)
  }
  const exhausted = inspectAmendedCampaign(directory, id)
  assert.equal(exhausted.newAttempts, 8)
  assert.equal(exhausted.reservedSeconds, 11110)
  assert.equal(exhausted.productionAttempts, 5)
  assert.equal(exhausted.estimatedReservedDollars, 13.8875)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /exhausted/)
  assert.deepEqual(initializeAmendment(directory, { amendmentId: id }), exhausted)
}))

test('Goal005 uncertain ending requires full lease expiration and independent cleanup', () => fixture((directory, clock) => {
  const budget = new AmendedCampaignBudget(directory, () => clock.now, id)
  const attempt = budget.reserve({ name: 'voice-mission', identity, maxRunSeconds: 890 })
  budget.finish(6, { outcome: 'failed', endAcknowledged: false })
  clock.now = attempt.leaseUntil
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /cleanup/)
  budget.closed(6)
  clock.now--
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /cleanup/)
  clock.now++
  assert.equal(budget.reserve({ name: 'voice-mission', identity }).attempt, 7)
}))

test('Goal005 production admits one active session and trusted ACK cleanup never refunds capacity', () => fixture((directory, clock) => {
  const budget = new AmendedCampaignBudget(directory, () => clock.now, id)
  const admission = new LiveAdmission(join(directory, allowance), 1, () => clock.now, 900, reservation => isGoal005ProductionReservationClosed(directory, reservation))
  budget.reserve({ name: 'voice-mission', identity })
  admission.reserve()
  assert.equal(admission.status().available, false)
  assert.equal(new LiveAdmission(join(directory, allowance), 1, () => clock.now).status().available, false)
  assert.throws(() => new LiveAdmission(join(directory, allowance), 2, () => clock.now, 900), /one active/)
  budget.finish(6, { outcome: 'failed', endAcknowledged: true })
  budget.closed(6)
  assert.equal(admission.status().available, true)
  clock.now++
  budget.reserve({ name: 'voice-mission', identity })
  admission.reserve()
  assert.equal(admission.status().available, false)
  assert.equal(inspectAmendedCampaign(directory, id).productionAttempts, 7)
  const rows = readFileSync(join(directory, allowance), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.equal(rows.length, 3)
  assert.equal(rows[1].leaseUntil - rows[1].reservedAt, 970_000)
}))

test('Goal005 partial supplement, changed price, orphan production reservation and changed history fail closed', () => fixture(directory => {
  assert.throws(() => initializeAmendment(directory, { amendmentId: id, hourlyRate: 4.6 }), /price/)
  writeFileSync(join(directory, ledger), '{}\n')
  assert.throws(() => initializeAmendment(directory, { amendmentId: id }), /incomplete/)
  assert.throws(() => new AmendedCampaignBudget(directory, Date.now, QA_RECHECK_AMENDMENT_ID), /preserved history/)
  rmSync(join(directory, ledger))
  initializeAmendment(directory, { amendmentId: id })
  appendFileSync(join(directory, allowance), JSON.stringify({ reservedAt: Date.now(), leaseUntil: Date.now() + 970_000 }) + '\n')
  assert.throws(() => inspectAmendedCampaign(directory, id), /unreserved admission/)
}, false))

test('Goal005 pure guard freezes mode, Voice-first order and bounded diagnostic reason without old runtime pins', () => fixture((directory, clock) => {
  const campaign = inspectAmendedCampaign(directory, id)
  assert.doesNotThrow(() => assertGoal005NextAttempt({ campaign, mode: 'voice', identity, now: clock.now, exerciseRecovery: true }))
  assert.throws(() => assertGoal005NextAttempt({ campaign, mode: 'text', identity, diagnosticReason: 'Investigate a specific arrival ambiguity.', now: clock.now }))
  const budget = new AmendedCampaignBudget(directory, () => clock.now, id)
  budget.reserve({ name: 'voice-mission', identity })
  budget.finish(6, { outcome: 'failed', endAcknowledged: true })
  budget.closed(6)
  const next = inspectAmendedCampaign(directory, id)
  assert.doesNotThrow(() => assertGoal005NextAttempt({ campaign: next, mode: 'text', identity: { ...identity, commit: 'f'.repeat(40) }, diagnosticReason: 'Investigate a specific arrival ambiguity.', now: clock.now }))
  assert.throws(() => assertGoal005NextAttempt({ campaign: next, mode: 'text', identity, diagnosticReason: 'retry', now: clock.now }))
  assert.match(goal005FrozenFile(6, identity.commit), /^goal-005-attempt-6-a{40}\.json$/)
  assert.throws(() => goal005FrozenFile(14, identity.commit))
}))


test('Goal005 validation receipt binds clean source and current built runtime; repairs retain focused checks', () => {
  const checks = ['typecheck', 'unit tests', 'production build', 'compiled-production browser tests', 'diff whitespace'].map(label => ({ label, status: 'passed', exitCode: 0 }))
  const validation = { status: 'passed', dirty: false, commit: identity.commit, branch: 'work/goal-005-gallery-live-completion', realProviderCalls: 0, runtimeManifestSha256: identity.runtimeSha256, checks }
  assert.doesNotThrow(() => assertGoal005Validation({ validation, identity, firstAttempt: true }))
  for (const change of [{ dirty: true }, { commit: 'f'.repeat(40) }, { runtimeManifestSha256: 'f'.repeat(64) }, { status: 'failed' }, { realProviderCalls: 1 }, { targetBuildIdentity: 'unknown' }, { checks: [] }]) {
    assert.throws(() => assertGoal005Validation({ validation: { ...validation, ...change }, identity, firstAttempt: true }))
  }
  const focused = { ...validation, checks: ['typecheck', 'focused tests', 'production build', 'diff whitespace'].map(label => ({ label, status: 'passed', exitCode: 0 })) }
  assert.doesNotThrow(() => assertGoal005Validation({ validation: focused, identity }))
  assert.throws(() => assertGoal005Validation({ validation: focused, identity, firstAttempt: true }))
})

test('provider credit/account refusal permanently stops Goal005 across repeats while cleanup still records', () => fixture((directory, clock) => {
  const budget = new AmendedCampaignBudget(directory, () => clock.now, id)
  budget.reserve({ name: 'voice-mission', identity })
  const halt = budget.halt('provider_credit_refused')
  assert.equal(halt.attempt, 6)
  assert.deepEqual(budget.halt('provider_credential_or_account_refused'), halt, 'the first stop remains immutable')
  budget.finish(6, { outcome: 'failed', endAcknowledged: false })
  budget.closed(6)
  clock.now += 2_000_000
  const restarted = new AmendedCampaignBudget(directory, () => clock.now, id)
  assert.throws(() => restarted.reserve({ name: 'voice-mission', identity }), /permanently stopped/)
  const state = initializeAmendment(directory, { amendmentId: id })
  assert.equal(state.newAttempts, 1)
  assert.equal(state.newReservedSeconds, 970)
  assert.deepEqual(state.halt, halt)
  assert.throws(() => assertGoal005NextAttempt({ campaign: state, mode: 'voice', identity, now: clock.now }))
  assert.throws(() => restarted.halt('ordinary_network_failure'), /Invalid permanent/)
}))
