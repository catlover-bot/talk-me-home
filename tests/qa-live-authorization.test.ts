import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { initializeAllowance } from '../game/server/admission.js'
import { assertGoal004CNextAttempt, assertGoal004CAmendedNextAttempt, GOAL_004C_AUTHORIZATION, GOAL_004C_PROPOSAL, GOAL_004C_AMENDMENT, assertGoal004DNextAttempt, GOAL_004D_AMENDMENT, GOAL_004D_CANARY_INPUTS, GOAL_004D_SESSION_UPDATE_SHA256 } from '../scripts/qa-live-authorization.mjs'
import { writeGoal004CHistory, writeGoal004CAmendedHistory } from './fixtures/goal-004c-history.js'
// @ts-expect-error Executable accounting helpers are native Node modules.
import { initializeAmendment } from '../scripts/qa-amended-budget.mjs'
// @ts-expect-error Executable accounting helpers are native Node modules.
import { CampaignBudget, initializeCampaign, inspectCampaign } from '../scripts/qa-budget.mjs'
// @ts-expect-error Executable accounting helpers are native Node modules.
import { runSupervised } from '../scripts/qa-supervisor.mjs'

async function authorizationFixture(run: (fixture: { directory: string; campaign: string; gate: (...args: unknown[]) => void }) => void, runtime = false) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-approval-fixture-'))
  const previous = Object.fromEntries(['CI', 'GAME_DISABLE_LIVE', 'GOAL_004C_APPROVED'].map(name => [name, process.env[name]]))
  try {
    // Copy the exact modules into an isolated tree; production exposes no path,
    // environment or argument injection that could redirect its fixed campaign.
    mkdirSync(join(directory, 'scripts'))
    for (const file of ['qa-live-authorization.mjs', 'qa-budget.mjs', 'qa-amended-budget.mjs']) copyFileSync(resolve('scripts', file), join(directory, 'scripts', file))
    const module = await import(pathToFileURL(join(directory, 'scripts/qa-live-authorization.mjs')).href)
    delete process.env.CI
    delete process.env.GAME_DISABLE_LIVE
    run({ directory, campaign: join(directory, '.validation/goal-004c-live'), gate: runtime ? module.assertGoal004DLiveAuthorized : module.assertGoal004CLiveAuthorized })
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    rmSync(directory, { recursive: true, force: true })
  }
}

test('compiled Goal 004C approval cannot be supplied or redirected by local flags, files or arguments', async () => {
  await authorizationFixture(({ directory, campaign, gate }) => {
    process.env.GOAL_004C_APPROVED = '1'
    writeFileSync(join(directory, 'approval.json'), '{"approved":true,"source":"offline-negative-test"}\n')
    const other = join(directory, 'unapproved-campaign')
    initializeCampaign(other, initializeAllowance, { profile: 'goal-004c' })
    for (const claim of [undefined, true, '--approved', { approved: true }, { approvalFile: join(directory, 'approval.json') }, { campaignDirectory: other }]) {
      assert.throws(() => gate(claim), /APPROVED_CAMPAIGN_UNAVAILABLE/)
    }
    assert.equal(existsSync(campaign), false)
    assert.equal(GOAL_004C_PROPOSAL.maxAttempts, 2)
    assert.equal(GOAL_004C_PROPOSAL.capacitySeconds, 1340)
    assert.equal(GOAL_004C_PROPOSAL.estimatedReservedDollars, 1.675)
    assert.ok(Object.isFrozen(GOAL_004C_PROPOSAL))
    assert.ok(Object.isFrozen(GOAL_004C_AUTHORIZATION))
    assert.equal(GOAL_004C_AUTHORIZATION.reviewedCommit, '35ced22e0fbba070f2533bb4e3eaeca30ea3723c')
  })
})

test('compiled approval accepts only existing fixed accounting and always fails closed for CI or Live-disable', async () => {
  await authorizationFixture(({ campaign, gate }) => {
    writeGoal004CHistory(campaign)
    initializeAmendment(campaign)
    const original = readFileSync(join(campaign, 'campaign.jsonl'), 'utf8')
    assert.doesNotThrow(() => gate())
    for (const name of ['CI', 'GAME_DISABLE_LIVE']) {
      for (const value of ['true', '1', '0', '']) {
        process.env[name] = value
        assert.throws(() => gate(), /LIVE_DISABLED/)
      }
      delete process.env[name]
    }
    assert.doesNotThrow(() => gate())
    assert.equal(readFileSync(join(campaign, 'campaign.jsonl'), 'utf8'), original)
    assert.equal(inspectCampaign(campaign).attempts.length, 1)
    assert.equal(GOAL_004C_AMENDMENT.maxAttempts, 3)
  })
})

test('004D activation requires the existing linked amendment and remains disabled in CI regardless of local flags', async () => {
  await authorizationFixture(({ directory, campaign, gate }) => {
    writeFileSync(join(directory, 'approval.json'), '{"approved":true}\n')
    assert.throws(() => gate({ approvalFile: join(directory, 'approval.json') }), /APPROVED_CAMPAIGN_UNAVAILABLE/)
    writeGoal004CAmendedHistory(campaign)
    assert.throws(() => gate(), /APPROVED_CAMPAIGN_UNAVAILABLE/)
    const before = readFileSync(join(campaign, 'amendment-final-acceptance.jsonl'), 'utf8')
    initializeAmendment(campaign, { amendmentId: GOAL_004D_AMENDMENT.id })
    assert.doesNotThrow(() => gate())
    for (const name of ['CI', 'GAME_DISABLE_LIVE']) {
      for (const value of ['1', '0', '']) {
        process.env[name] = value
        assert.throws(() => gate(), /LIVE_DISABLED/)
      }
      delete process.env[name]
    }
    assert.equal(readFileSync(join(campaign, 'amendment-final-acceptance.jsonl'), 'utf8'), before)
    assert.equal(GOAL_004D_AMENDMENT.maxAttempts, 4)
    assert.equal(GOAL_004D_AMENDMENT.capacitySeconds, 2680)
    assert.equal(GOAL_004D_AMENDMENT.planningDollars, 3.35)
  }, true)
})

test('004D Voice requires corrected Text canary, explicit action, actual policy delivery and complete same-candidate cleanup', () => {
  const f = prospectiveSequenceFixture()
  const identitySha256 = f.hash(f.identity)
  const historical = [1, 2].map(attempt => ({ ...f.previous, attempt, result: { ...f.previous.result, outcome: 'failed' } }))
  const header = { ...f.header, id: GOAL_004D_AMENDMENT.id, maxAttempts: 4, capacitySeconds: 2680, planningDollars: 3.35, hourlyRate: 4.5 }
  const initial = { header, attempts: historical, productionAttempts: 2 }
  assert.doesNotThrow(() => assertGoal004DNextAttempt({ campaign: initial, mode: 'text', identity: f.identity }))
  assert.throws(() => assertGoal004DNextAttempt({ campaign: initial, mode: 'voice', identity: f.identity }))
  const previous = { ...f.previous, attempt: 3, identitySha256 }
  const campaign = { header, attempts: [...historical, previous], productionAttempts: 3 }
  const report = { ...f.report, reservation: { ...f.reservation, attempt: 3, identitySha256 },
    behavior: { status: 'pass', materialDefects: [], uncertainties: [] },
    regressionCanary: { status: 'passed', explicitLatchRequest: { turnId: 4, text: 'Please engage the Latch.' } },
    steps: [...GOAL_004D_CANARY_INPUTS.map((utterance, index) => ({ turnId: index + 1, utterance, settled: true })),
      { turnId: 4, utterance: 'Please engage the Latch.', settled: true }],
    runtimePolicyDelivery: { sha256: GOAL_004D_SESSION_UPDATE_SHA256, matchesExpected: true, messageCount: 1 },
    cleanup: { activeTracks: 0, activeSources: 0, openApplicationContexts: 0 },
    lifecycle: [{ type: 'browser.closed', outcome: 'observed' }, { type: 'server.closed', outcome: 'observed' }] }
  const guard = (evidence: unknown = report, state: unknown = campaign, identity: unknown = f.identity) => assertGoal004DNextAttempt({ campaign: state, mode: 'voice', identity, reports: [evidence] })
  assert.doesNotThrow(() => guard())
  assert.throws(() => assertGoal004DNextAttempt({ campaign, mode: 'text', identity: f.identity }))
  for (const change of [
    { completion: false }, { failure: 'Failure' }, { explicitEndSent: false }, { endAcknowledged: false },
    { regressionCanary: { status: 'failed' } }, { regressionCanary: { status: 'passed' } }, { steps: report.steps.slice(1) },
    { steps: report.steps.slice(0, 3) },
    { runtimePolicyDelivery: { ...report.runtimePolicyDelivery, messageCount: 2 } },
    { runtimePolicyDelivery: { ...report.runtimePolicyDelivery, sha256: 'a'.repeat(64) } },
    { runtimePolicyDelivery: { ...report.runtimePolicyDelivery, matchesExpected: false } },
    { behavior: { status: 'pass', materialDefects: [], uncertainties: [{ blocking: true }] } },
    { behavior: { status: 'blocked', materialDefects: [{ code: 'unrequested_mutation' }], uncertainties: [] } },
    { cleanup: { ...report.cleanup, activeTracks: 1 } }, { lifecycle: [] }, { tokenRequests: 2 },
  ]) assert.throws(() => guard({ ...report, ...change }))
  assert.throws(() => guard(report, { ...campaign, attempts: [...historical, { ...previous, result: { ...previous.result, outcome: 'failed' } }] }))
  assert.throws(() => guard(report, { ...campaign, attempts: [...historical, { ...previous, closedAt: null }] }))
  assert.throws(() => guard(report, campaign, { ...f.identity, commit: 'd'.repeat(40) }))
  assert.throws(() => guard(report, { ...campaign, header: { ...header, planningDollars: 3.36 } }))
})

test('amended Voice requires new full-clear behavior, ACK, cleanup and identical candidate while retaining old failure', () => {
  const f = prospectiveSequenceFixture()
  const identitySha256 = f.hash(f.identity)
  const historical = { ...f.previous, result: { ...f.previous.result, outcome: 'failed' } }
  const header = { ...f.header, maxAttempts: 3, capacitySeconds: 2010, planningDollars: 2.52, hourlyRate: 4.5 }
  const onlyHistory = { header, attempts: [historical], productionAttempts: 1 }
  assert.doesNotThrow(() => assertGoal004CAmendedNextAttempt({ campaign: onlyHistory, mode: 'text', identity: f.identity }))
  assert.throws(() => assertGoal004CAmendedNextAttempt({ campaign: onlyHistory, mode: 'voice', identity: f.identity }))
  const previous = { ...f.previous, attempt: 2, identitySha256 }
  const campaign = { header, attempts: [historical, previous], productionAttempts: 2 }
  const report = { ...f.report, reservation: { ...f.reservation, attempt: 2, identitySha256 }, behavior: { status: 'pass', materialDefects: [], uncertainties: [] }, cleanup: { activeTracks: 0, activeSources: 0, openApplicationContexts: 0 }, lifecycle: [{ type: 'browser.closed', outcome: 'observed' }, { type: 'server.closed', outcome: 'observed' }] }
  const guard = (evidence: unknown = report, state: unknown = campaign, identity: unknown = f.identity) => assertGoal004CAmendedNextAttempt({ campaign: state, mode: 'voice', identity, reports: [evidence] })
  assert.doesNotThrow(() => guard())
  assert.throws(() => assertGoal004CAmendedNextAttempt({ campaign, mode: 'text', identity: f.identity }))
  for (const change of [
    { completion: false }, { failure: 'Player failure' }, { endAcknowledged: false }, { explicitEndSent: false },
    { behavior: { status: 'blocked', materialDefects: [{ code: 'unsupported_mutation' }] } },
    { behavior: { status: 'review_required', materialDefects: [] } },
    { behavior: { status: 'pass', materialDefects: [], uncertainties: [{ blocking: true }] } },
    { cleanup: { ...report.cleanup, activeTracks: 1 } }, { lifecycle: [] }, { tokenRequests: 2 },
  ]) assert.throws(() => guard({ ...report, ...change }))
  assert.throws(() => guard(report, { ...campaign, attempts: [historical, { ...previous, closedAt: null }] }))
  assert.throws(() => guard(report, { ...campaign, attempts: [historical, { ...previous, result: { ...previous.result, outcome: 'failed' } }] }))
  assert.throws(() => guard(report, campaign, { ...f.identity, commit: 'd'.repeat(40) }))
  assert.equal(historical.result.outcome, 'failed')
})

test('compiled approval refuses other profiles, rates, corrupt accounting and exhausted attempts without repair', async () => {
  for (const kind of ['old-profile', 'rate', 'corrupt', 'missing-allowance', 'exhausted']) {
    await authorizationFixture(({ campaign, gate }) => {
      initializeCampaign(campaign, initializeAllowance, { profile: kind === 'old-profile' ? 'goal-004b' : 'goal-004c', hourlyRate: kind === 'rate' ? 4 : 4.5 })
      const ledger = join(campaign, 'campaign.jsonl')
      if (kind === 'corrupt') writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd())
      if (kind === 'missing-allowance') rmSync(join(campaign, 'allowance.jsonl'))
      if (kind === 'exhausted') {
        let now = Date.now()
        const budget = new CampaignBudget(campaign, () => now)
        now = budget.reserve({ name: 'text-mission' }).leaseUntil
        budget.reserve({ name: 'voice-mission' })
      }
      const original = readFileSync(ledger, 'utf8')
      assert.throws(() => gate(), /APPROVED_CAMPAIGN_(?:MISMATCH|UNAVAILABLE|EXHAUSTED)/)
      assert.equal(readFileSync(ledger, 'utf8'), original)
    })
  }
})

function prospectiveSequenceFixture() {
  const files = { 'dist/client/index.html': 'a'.repeat(64) }
  const harnessFiles = { 'qa-live-browser.mjs': 'b'.repeat(64) }
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const identity = { commit: 'c'.repeat(40), files, harnessFiles, runtimeSha256: hash(files), harnessSha256: hash(harnessFiles) }
  const reservation = { attempt: 1, name: 'text-mission', reservedAt: 1000, reservedSeconds: 670, gracefulAt: 571000, hardAt: 581000, leaseUntil: 671000 }
  const previous = { ...reservation, result: { outcome: 'passed', endAcknowledged: true, finishedAt: 500000 }, closedAt: 501000 }
  const header = { maxAttempts: 2, capacitySeconds: 1340, reservationSeconds: 670, maxSessionSeconds: 600, planningDollars: 1.68, disconnectGraceSeconds: 30 }
  const report = { reservation, mode: 'text', scenario: 'mission', completion: true, failure: null, tokenRequests: 1, explicitEndSent: true, endAcknowledged: true, identity }
  return { identity, reservation, previous, header, report, hash }
}

test('prospective sequencing permits Text first and Voice only after the same completed candidate, without authorizing spending', () => {
  const f = prospectiveSequenceFixture()
  const empty = { header: f.header, attempts: [], productionAttempts: 0 }
  assert.doesNotThrow(() => assertGoal004CNextAttempt({ campaign: empty, mode: 'text', identity: f.identity }))
  assert.throws(() => assertGoal004CNextAttempt({ campaign: empty, mode: 'voice', identity: f.identity }), /requires one passed/)
  const completed = { header: f.header, attempts: [f.previous], productionAttempts: 1 }
  assert.doesNotThrow(() => assertGoal004CNextAttempt({ campaign: completed, mode: 'voice', identity: f.identity, reports: [f.report] }))
  assert.throws(() => assertGoal004CNextAttempt({ campaign: completed, mode: 'text', identity: f.identity }), /first and only/)
  assert.throws(() => assertGoal004CNextAttempt({ campaign: { ...completed, attempts: [f.previous, { ...f.previous, attempt: 2 }] }, mode: 'voice', identity: f.identity, reports: [f.report] }), /requires one passed/)
})

test('prospective Voice sequencing rejects failed, unacknowledged, unclosed, missing or ambiguous Text evidence', () => {
  const f = prospectiveSequenceFixture()
  const completed = { header: f.header, attempts: [f.previous], productionAttempts: 1 }
  for (const previous of [
    { ...f.previous, name: 'voice-mission' },
    { ...f.previous, result: { ...f.previous.result, outcome: 'failed' } },
    { ...f.previous, result: { ...f.previous.result, endAcknowledged: false } },
    { ...f.previous, closedAt: null },
  ]) assert.throws(() => assertGoal004CNextAttempt({ campaign: { ...completed, attempts: [previous] }, mode: 'voice', identity: f.identity, reports: [f.report] }))
  for (const reports of [[], [f.report, f.report], [{ ...f.report, reservation: { ...f.reservation, reservedAt: 1001 } }]]) {
    assert.throws(() => assertGoal004CNextAttempt({ campaign: completed, mode: 'voice', identity: f.identity, reports }), /missing or ambiguous/)
  }
  for (const report of [
    { ...f.report, completion: false }, { ...f.report, failure: 'Failed' },
    { ...f.report, explicitEndSent: false }, { ...f.report, endAcknowledged: false },
    { ...f.report, tokenRequests: 2 }, { ...f.report, mode: 'voice' },
  ]) assert.throws(() => assertGoal004CNextAttempt({ campaign: completed, mode: 'voice', identity: f.identity, reports: [report] }), /identical candidate/)
})

test('prospective sequencing refuses a changed build, changed harness, corrupt digest, or other campaign profile', () => {
  const f = prospectiveSequenceFixture()
  const completed = { header: f.header, attempts: [f.previous], productionAttempts: 1 }
  const newFiles = { 'dist/client/index.html': 'd'.repeat(64) }
  const newHarness = { 'qa-live-browser.mjs': 'e'.repeat(64) }
  for (const identity of [
    { ...f.identity, commit: 'd'.repeat(40) },
    { ...f.identity, files: newFiles, runtimeSha256: f.hash(newFiles) },
    { ...f.identity, harnessFiles: newHarness, harnessSha256: f.hash(newHarness) },
    { ...f.identity, files: newFiles }, { ...f.identity, files: {} },
  ]) assert.throws(() => assertGoal004CNextAttempt({ campaign: completed, mode: 'voice', identity, reports: [f.report] }))
  assert.throws(() => assertGoal004CNextAttempt({ campaign: { ...completed, header: { ...f.header, maxAttempts: 3, capacitySeconds: 2010 } }, mode: 'voice', identity: f.identity, reports: [f.report] }), /exact Goal 004C profile/)
})

test('prospective two-attempt accounting persists failed reservations and remains exhausted after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-recovery-budget-offline-'))
  try {
    initializeCampaign(directory, initializeAllowance, { profile: 'goal-004c' })
    let now = Date.now()
    let budget = new CampaignBudget(directory, () => now)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const reserved = budget.reserve({ name: `offline-${attempt}` })
      assert.equal(reserved.reservedSeconds, 670)
      budget.finish(attempt, { endAcknowledged: false, connectedSeconds: null, outcome: 'failed' })
      budget.closed(attempt)
      budget = new CampaignBudget(directory, () => now)
      if (attempt === 1) assert.throws(() => budget.reserve({ name: 'overlap' }), /lease/)
      now = reserved.leaseUntil
    }
    const before = readFileSync(join(directory, 'campaign.jsonl'), 'utf8')
    const restarted = initializeCampaign(directory, () => { throw new Error('Never regenerate allowance on restart') }, { profile: 'goal-004c' })
    assert.equal(restarted.reservedSeconds, 1340)
    assert.equal(restarted.estimatedReservedDollars, 1.675)
    assert.equal(JSON.parse(readFileSync(join(directory, 'allowance.jsonl'), 'utf8')).allowanceSessions, 2)
    assert.throws(() => new CampaignBudget(directory, () => now).reserve({ name: 'third' }), /exhausted/)
    assert.equal(readFileSync(join(directory, 'campaign.jsonl'), 'utf8'), before)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('prospective accounting rejects corrupt or missing restart state and never changes an exhausted old profile', () => {
  for (const kind of ['corrupt', 'missing', 'old-profile', 'changed-rate']) {
    const directory = mkdtempSync(join(tmpdir(), 'tmh-recovery-invalid-offline-'))
    try {
      initializeCampaign(directory, initializeAllowance, { profile: kind === 'old-profile' ? 'goal-004b' : 'goal-004c' })
      const ledger = join(directory, 'campaign.jsonl')
      if (kind === 'corrupt') writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd())
      if (kind === 'missing') rmSync(join(directory, 'allowance.jsonl'))
      if (kind === 'old-profile') {
        let now = Date.now()
        const budget = new CampaignBudget(directory, () => now)
        for (let attempt = 0; attempt < 3; attempt++) now = budget.reserve({ name: 'historical' }).leaseUntil
        const original = readFileSync(ledger, 'utf8')
        assert.throws(() => initializeCampaign(directory, initializeAllowance, { profile: 'goal-004c' }), /cannot be replaced/)
        assert.throws(() => new CampaignBudget(directory, () => now).reserve({ name: 'extra' }), /exhausted/)
        assert.equal(readFileSync(ledger, 'utf8'), original)
      } else if (kind === 'changed-rate') {
        assert.throws(() => initializeCampaign(directory, initializeAllowance, { profile: 'goal-004c', hourlyRate: 9 }), /revised owner approval/)
        assert.equal(inspectCampaign(directory).attempts.length, 0)
      } else {
        assert.throws(() => new CampaignBudget(directory))
        assert.throws(() => initializeCampaign(directory, () => { throw new Error('Must not initialize') }, { profile: 'goal-004c' }))
      }
    } finally { rmSync(directory, { recursive: true, force: true }) }
  }
})

test('prospective campaign uses the existing exclusive supervisor across concurrent offline drivers', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-recovery-lock-offline-'))
  try {
    initializeCampaign(directory, initializeAllowance, { profile: 'goal-004c' })
    const worker = join(directory, 'offline-worker.mjs')
    const helper = pathToFileURL(resolve('scripts/qa-supervisor.mjs')).href
    writeFileSync(worker, `import { requestAttempt, finishAttempt } from ${JSON.stringify(helper)};
await requestAttempt({ name: 'offline-lock', maxRunSeconds: 5 });
await new Promise(done => setTimeout(done, 600));
await finishAttempt({ endAcknowledged: true, connectedSeconds: 0, outcome: 'passed' });
process.disconnect();
`)
    const first = runSupervised({ directory, worker })
    for (let count = 0; count < 100 && inspectCampaign(directory).attempts.length === 0; count++) await new Promise(done => setTimeout(done, 20))
    await assert.rejects(runSupervised({ directory, worker }), /exclusive lock/)
    assert.equal((await first).exitCode, 0)
    assert.equal((await runSupervised({ directory, worker })).exitCode, 0)
    const final = inspectCampaign(directory)
    assert.equal(final.attempts.length, 2)
    assert.equal(final.productionAttempts, 0)
    assert.equal(final.reservedSeconds, 1340)
    assert.throws(() => new CampaignBudget(directory).reserve({ name: 'third' }), /exhausted/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
