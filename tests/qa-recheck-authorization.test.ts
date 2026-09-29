import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { assertGoal004ERecheckNextAttempt, GOAL_004E_RECHECK_AMENDMENT, GOAL_004E_RECHECK_RUNTIME_SHA256, GOAL_004E_RECHECK_SESSION_UPDATE_SHA256 } from '../scripts/qa-live-authorization.mjs'
import { writeGoal004EConfirmedHistory } from './fixtures/goal-004c-history.js'
// @ts-expect-error Native executable accounting module has no declaration file.
import { initializeAmendment, AmendedCampaignBudget } from '../scripts/qa-amended-budget.mjs'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function fixture() {
  const files = JSON.parse(readFileSync('artifacts/goal-004e/follow-up/candidate.json', 'utf8')).files
  const harnessFiles = { 'constructed-activation.mjs': 'a'.repeat(64) }
  const fixtureFiles = { 'constructed.wav': 'b'.repeat(64) }
  const identity = { commit: 'c'.repeat(40), files, runtimeSha256: hash(files), harnessFiles, harnessSha256: hash(harnessFiles),
    fixtureFiles, fixtureSha256: hash(fixtureFiles), sessionUpdateSha256: GOAL_004E_RECHECK_SESSION_UPDATE_SHA256,
    browserExecutableSha256: '8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e', node: 'v24.20.0' }
  const campaign = { header: { id: GOAL_004E_RECHECK_AMENDMENT.id, maxAttempts: 5, historicalAttempts: 4, maxNewAttempts: 1,
    capacitySeconds: 3350, newCapacitySeconds: 670, reservationSeconds: 670, maxSessionSeconds: 600, disconnectGraceSeconds: 30, hourlyRate: 4.5, planningDollars: 4.1875 },
    productionAttempts: 4, attempts: [1, 2, 3, 4].map(attempt => ({ attempt, name: attempt < 4 ? 'text-mission' : 'voice-mission', closedAt: 100,
      result: { outcome: 'failed', endAcknowledged: true, finishedAt: 99 } })) }
  const activation = { status: 'passed', dirty: false, commit: identity.commit, branch: 'work/goal-004e-confirmed-actions',
    preparedCommit: GOAL_004E_RECHECK_AMENDMENT.reviewedCommit, runtimeSha256: identity.runtimeSha256, harnessSha256: identity.harnessSha256,
    fixtureSha256: identity.fixtureSha256, sessionUpdateSha256: identity.sessionUpdateSha256, realProviderCalls: 0,
    historicalOfflineSha256: 'd98af583a942d65434e18d4c74cc93421e46000c31d2c12af8086600eff04216',
    preparedPreflightSha256: 'bb1a0a5053c89ff8ee81f357693b492a8fac49ab73ae9a29b70a46d1038d2187',
    pricing: { hourlyRate: 4.5, reservationEstimateDollars: 0.8375 },
    checks: ['focused activation tests', 'typecheck', 'diff whitespace'].map(label => ({ label, status: 'passed', exitCode: 0 })) }
  return { campaign, mode: 'voice', identity, activation }
}

test('fifth-attempt proof reuses delivered runtime history and requires clean exact activation evidence', () => {
  const f = fixture()
  assert.equal(f.identity.runtimeSha256, GOAL_004E_RECHECK_RUNTIME_SHA256)
  assert.doesNotThrow(() => assertGoal004ERecheckNextAttempt(f))
  assert.equal(GOAL_004E_RECHECK_AMENDMENT.maxNewDollars, 0.84)
  for (const change of [{ dirty: true }, { commit: 'd'.repeat(40) }, { preparedCommit: 'd'.repeat(40) }, { realProviderCalls: 1 },
    { runtimeSha256: 'd'.repeat(64) }, { harnessSha256: 'd'.repeat(64) }, { fixtureSha256: 'd'.repeat(64) }, { sessionUpdateSha256: 'd'.repeat(64) },
    { historicalOfflineSha256: 'd'.repeat(64) }, { preparedPreflightSha256: 'd'.repeat(64) }, { pricing: { hourlyRate: 4.6, reservationEstimateDollars: 0.856 } },
    ...f.activation.checks.map(missing => ({ checks: f.activation.checks.filter(check => check.label !== missing.label) }))]) {
    assert.throws(() => assertGoal004ERecheckNextAttempt({ ...f, activation: { ...f.activation, ...change } }))
  }
})

test('fifth-attempt proof rejects wrong mode, spent or uncertain history and altered capacity or frozen runtime', () => {
  const f = fixture()
  for (const mode of ['text', 'practice', undefined]) assert.throws(() => assertGoal004ERecheckNextAttempt({ ...f, mode }))
  for (const change of [{ maxAttempts: 6 }, { maxNewAttempts: 2 }, { capacitySeconds: 4020 }, { newCapacitySeconds: 1340 }, { planningDollars: 5 }, { hourlyRate: 4.6 }]) {
    assert.throws(() => assertGoal004ERecheckNextAttempt({ ...f, campaign: { ...f.campaign, header: { ...f.campaign.header, ...change } } }))
  }
  for (const change of [{ productionAttempts: 5 }, { attempts: [...f.campaign.attempts, f.campaign.attempts[3]] },
    { attempts: f.campaign.attempts.map(row => ({ ...row, result: { ...row.result, endAcknowledged: false } })) }]) {
    assert.throws(() => assertGoal004ERecheckNextAttempt({ ...f, campaign: { ...f.campaign, ...change } }))
  }
  for (const change of [{ runtimeSha256: 'd'.repeat(64) }, { sessionUpdateSha256: 'd'.repeat(64) }, { fixtureSha256: 'd'.repeat(64) },
    { browserExecutableSha256: 'd'.repeat(64) }, { node: 'v24.21.0' }]) assert.throws(() => assertGoal004ERecheckNextAttempt({ ...f, identity: { ...f.identity, ...change } }))
})

test('fixed recheck gate has no initializer or local override and becomes exhausted immediately after reservation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-recheck-approval-'))
  const previous = { CI: process.env.CI, GAME_DISABLE_LIVE: process.env.GAME_DISABLE_LIVE }
  try {
    mkdirSync(join(directory, 'scripts'))
    for (const name of ['qa-live-authorization.mjs', 'qa-amended-budget.mjs', 'qa-budget.mjs']) copyFileSync(resolve('scripts', name), join(directory, 'scripts', name))
    const module = await import(pathToFileURL(join(directory, 'scripts/qa-live-authorization.mjs')).href)
    delete process.env.CI; delete process.env.GAME_DISABLE_LIVE
    const campaign = join(directory, '.validation/goal-004c-live')
    writeFileSync(join(directory, 'approval.json'), '{"approved":true}\n')
    assert.throws(() => module.assertGoal004ERecheckLiveAuthorized({ approved: true }), /UNAVAILABLE/)
    assert.equal(existsSync(campaign), false)
    writeGoal004EConfirmedHistory(campaign)
    initializeAmendment(campaign, { amendmentId: GOAL_004E_RECHECK_AMENDMENT.id })
    assert.doesNotThrow(() => module.assertGoal004ERecheckLiveAuthorized())
    for (const name of ['CI', 'GAME_DISABLE_LIVE']) {
      for (const value of ['', '0', '1']) { process.env[name] = value; assert.throws(() => module.assertGoal004ERecheckLiveAuthorized(), /LIVE_DISABLED/) }
      delete process.env[name]
    }
    const budget = new AmendedCampaignBudget(campaign, Date.now, GOAL_004E_RECHECK_AMENDMENT.id)
    budget.reserve({ name: 'voice-mission', identity: fixture().identity })
    assert.throws(() => module.assertGoal004ERecheckLiveAuthorized(), /EXHAUSTED/)
  } finally {
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
    rmSync(directory, { recursive: true, force: true })
  }
})
