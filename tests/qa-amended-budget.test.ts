import assert from 'node:assert/strict'
import { fork, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { LiveAdmission } from '../game/server/admission.js'
import { writeGoal004CHistory, writeGoal004CAmendedHistory, writeGoal004DRetestHistory, writeGoal004EConfirmedHistory, writeGoal004ERecheckHistory } from './fixtures/goal-004c-history.js'
// @ts-expect-error Executable accounting helpers remain native Node modules.
import { AmendedCampaignBudget, initializeAmendment, inspectAmendedCampaign, QA_AMENDMENT_ID, QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE, QA_AMENDMENT_ORIGINAL_HASHES, QA_RUNTIME_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE, QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES, QA_CONFIRMED_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE, QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES, QA_RECHECK_AMENDMENT_ID, QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE, QA_RECHECK_AMENDMENT_CLEANUP, QA_RECHECK_AMENDMENT_ORIGINAL_HASHES, QA_GOAL005_AMENDMENT_ID, QA_GOAL005_AMENDMENT_CLEANUP } from '../scripts/qa-amended-budget.mjs'
// @ts-expect-error Executable accounting helpers remain native Node modules.
import { CampaignBudget, inspectCampaign } from '../scripts/qa-budget.mjs'
// @ts-expect-error Executable accounting helpers remain native Node modules.
import { assertOwnsCampaignLock, runSupervised } from '../scripts/qa-supervisor.mjs'

const identity = { commit: 'c'.repeat(40), runtimeSha256: 'a'.repeat(64), harnessSha256: 'b'.repeat(64) }
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
function fixture(run: (directory: string) => void, initialize = true) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-fixed-amendment-'))
  try {
    writeGoal004CHistory(directory)
    if (initialize) initializeAmendment(directory)
    run(directory)
    for (const [file, expected] of [['campaign.jsonl', QA_AMENDMENT_ORIGINAL_HASHES.campaign], ['allowance.jsonl', QA_AMENDMENT_ORIGINAL_HASHES.allowance]]) {
      assert.equal(hash(readFileSync(join(directory, file))), expected)
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

function runtimeFixture(run: (directory: string) => void, initialize = true) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-runtime-amendment-'))
  try {
    writeGoal004CAmendedHistory(directory)
    if (initialize) initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID })
    run(directory)
    for (const [file, expected] of [['campaign.jsonl', QA_AMENDMENT_ORIGINAL_HASHES.campaign], ['allowance.jsonl', QA_AMENDMENT_ORIGINAL_HASHES.allowance],
      [QA_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.campaign], [QA_AMENDMENT_ALLOWANCE, QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.allowance]]) {
      assert.equal(hash(readFileSync(join(directory, file))), expected)
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('runtime retest preserves both failed Text attempts and repeated activation never adds allowance', () => runtimeFixture(directory => {
  const state = inspectAmendedCampaign(directory, QA_RUNTIME_AMENDMENT_ID)
  assert.equal(state.header.id, QA_RUNTIME_AMENDMENT_ID)
  assert.equal(state.header.previousAmendmentId, QA_AMENDMENT_ID)
  assert.equal(state.header.originalCampaignSha256, QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.campaign)
  assert.equal(state.header.originalAllowanceSha256, QA_RUNTIME_AMENDMENT_ORIGINAL_HASHES.allowance)
  assert.equal(state.header.maxAttempts, 4)
  assert.equal(state.header.capacitySeconds, 2680)
  assert.equal(state.header.capacitySeconds * state.header.hourlyRate / 3600, 3.35)
  assert.equal(state.header.newCapacitySeconds, 1340)
  assert.equal(state.historicalAttempts, 2)
  assert.equal(state.newAttempts, 0)
  assert.equal(state.productionAttempts, 2)
  assert.equal(state.reservedSeconds, 1340)
  assert.deepEqual(state.attempts.map((attempt: { result: { outcome: string } }) => attempt.result.outcome), ['failed', 'failed'])
  const before = readFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER))
  assert.deepEqual(initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID }), state)
  assert.deepEqual(readFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER)), before)
  assert.equal(inspectAmendedCampaign(directory).attempts.length, 2)
  assert.equal(inspectCampaign(directory).attempts.length, 1)
}))

test('runtime activation disables earlier writers including an already constructed writer', () => runtimeFixture(directory => {
  const previous = new AmendedCampaignBudget(directory)
  initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID })
  assert.throws(() => previous.reserve({ name: 'voice-mission', identity }), /preserved history/)
  assert.throws(() => previous.finish(2, { outcome: 'passed', endAcknowledged: true }), /preserved history/)
  assert.throws(() => previous.closed(2), /preserved history/)
  assert.throws(() => new AmendedCampaignBudget(directory), /preserved history/)
  assert.throws(() => new CampaignBudget(directory), /preserved history/)
}, false))

test('failed runtime Text consumes global attempt three and blocks Voice or Text retry after expiry', () => runtimeFixture(directory => {
  let now = Date.now()
  const budget = new AmendedCampaignBudget(directory, () => now, QA_RUNTIME_AMENDMENT_ID)
  const text = budget.reserve({ name: 'text-mission', identity })
  assert.equal(text.attempt, 3)
  assert.equal(text.leaseUntil - text.reservedAt, 670_000)
  new LiveAdmission(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE), 2, () => now).reserve()
  budget.finish(3, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 5 })
  budget.closed(3)
  now += 1_000_000
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
  assert.throws(() => budget.reserve({ name: 'text-mission', identity }), /Invalid fixed/)
  const reused = initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID })
  assert.equal(reused.attempts.length, 3)
  assert.equal(reused.productionAttempts, 3)
  assert.equal(reused.reservedSeconds, 2010)
  assert.equal(reused.newReservedSeconds, 670)
}))

test('runtime Voice requires passed acknowledged closed Text and unchanged identity within four total attempts', () => runtimeFixture(directory => {
  const budget = new AmendedCampaignBudget(directory, Date.now, QA_RUNTIME_AMENDMENT_ID)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Invalid fixed/)
  const text = budget.reserve({ name: 'text-mission', identity, maxRunSeconds: 590 })
  assert.equal(text.hardAt - text.reservedAt, 600_000)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
  new LiveAdmission(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE)).reserve()
  budget.finish(3, { outcome: 'passed', endAcknowledged: true, connectedSeconds: 10 })
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
  budget.closed(3)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity: { ...identity, commit: 'd'.repeat(40) } }), /Conditional Voice/)
  const voice = budget.reserve({ name: 'voice-mission', identity })
  assert.equal(voice.attempt, 4)
  assert.equal(voice.identitySha256, text.identitySha256)
  new LiveAdmission(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE)).reserve()
  budget.finish(4, { outcome: 'passed', endAcknowledged: true, connectedSeconds: 20 })
  budget.closed(4)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /exhausted/)
  const state = initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID })
  assert.equal(state.productionAttempts, 4)
  assert.equal(state.newAttempts, 2)
  assert.equal(state.newReservedSeconds, 1340)
  assert.equal(state.reservedSeconds, 2680)
  assert.equal(state.estimatedReservedDollars, 3.35)
}))

test('runtime amendment cannot repair partial accounting, change its predecessor, or select an arbitrary profile', () => {
  for (const corruption of ['missing-ledger', 'missing-allowance', 'changed-limit', 'unreserved', 'duplicate-approval']) runtimeFixture(directory => {
    const ledger = join(directory, QA_RUNTIME_AMENDMENT_LEDGER)
    if (corruption === 'missing-ledger') rmSync(ledger)
    if (corruption === 'missing-allowance') rmSync(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE))
    if (corruption === 'changed-limit') writeFileSync(ledger, readFileSync(ledger, 'utf8').replace('"maxAttempts":4', '"maxAttempts":5'))
    if (corruption === 'unreserved') new LiveAdmission(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE)).reserve()
    if (corruption === 'duplicate-approval') writeFileSync(ledger, readFileSync(ledger, 'utf8').repeat(2))
    assert.throws(() => inspectAmendedCampaign(directory, QA_RUNTIME_AMENDMENT_ID))
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID }))
    assert.throws(() => new AmendedCampaignBudget(directory), /preserved history/)
  })
  runtimeFixture(directory => {
    assert.throws(() => initializeAmendment(directory, { amendmentId: 'arbitrary-campaign' }), /Unknown fixed/)
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID, hourlyRate: 4.6 }), /price/)
    const historical = join(directory, QA_AMENDMENT_LEDGER)
    const before = readFileSync(historical)
    writeFileSync(historical, before.toString().replace('"connectedSeconds":44.61229999999702', '"connectedSeconds":45'))
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RUNTIME_AMENDMENT_ID }), /both exact preserved/)
    writeFileSync(historical, before)
  }, false)
})

test('fixed amendment links exact historical bytes and cannot be initialized twice or as another campaign', () => fixture(directory => {
  const state = inspectAmendedCampaign(directory)
  assert.equal(state.header.id, QA_AMENDMENT_ID)
  assert.equal(state.header.maxAttempts, 3)
  assert.equal(state.header.capacitySeconds, 2010)
  assert.equal(state.header.newCapacitySeconds, 1340)
  assert.equal(state.header.capacitySeconds * state.header.hourlyRate / 3600, 2.5125)
  assert.equal(state.newAttempts, 0)
  assert.equal(state.productionAttempts, 1)
  assert.equal(state.attempts[0].result.outcome, 'failed')
  assert.throws(() => initializeAmendment(directory), /already exists/)
  assert.equal(inspectCampaign(directory).attempts.length, 1)
}))

test('old writer is disabled including a writer obtained before amendment activation', () => fixture(directory => {
  const oldWriter = new CampaignBudget(directory)
  initializeAmendment(directory)
  assert.throws(() => oldWriter.reserve({ name: 'old-unused-slot' }), /preserved history/)
  assert.throws(() => new CampaignBudget(directory), /preserved history/)
}, false))

test('failed or uncertain amended Text consumes its slot and never unlocks Voice after lease expiry', () => {
  for (const acknowledged of [false, true]) fixture(directory => {
    let now = Date.now()
    const budget = new AmendedCampaignBudget(directory, () => now)
    const second = budget.reserve({ name: 'text-mission', identity })
    assert.equal(second.attempt, 2)
    budget.finish(2, { outcome: 'failed', endAcknowledged: acknowledged, connectedSeconds: 1 })
    budget.closed(2)
    now += 1_000_000
    assert.throws(() => new AmendedCampaignBudget(directory, () => now).reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
    assert.throws(() => new AmendedCampaignBudget(directory, () => now).reserve({ name: 'text-mission', identity }), /Invalid fixed/)
    const state = inspectAmendedCampaign(directory)
    assert.equal(state.newAttempts, 1)
    assert.equal(state.reservedSeconds, 1340)
    assert.equal(state.estimatedReservedDollars, 1.675)
  })
})

test('same-candidate passed Text permits only one conditional Voice and aggregate capacity never replenishes', () => fixture(directory => {
  const budget = new AmendedCampaignBudget(directory)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Invalid fixed/)
  const text = budget.reserve({ name: 'text-mission', identity })
  new LiveAdmission(join(directory, QA_AMENDMENT_ALLOWANCE)).reserve()
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
  budget.finish(2, { outcome: 'passed', endAcknowledged: true, connectedSeconds: 10 })
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /Conditional Voice/)
  budget.closed(2)
  assert.throws(() => budget.reserve({ name: 'voice-mission', identity: { ...identity, commit: 'd'.repeat(40) } }), /Conditional Voice/)
  const voice = budget.reserve({ name: 'voice-mission', identity })
  assert.equal(voice.identitySha256, text.identitySha256)
  assert.equal(voice.attempt, 3)
  new LiveAdmission(join(directory, QA_AMENDMENT_ALLOWANCE)).reserve()
  budget.finish(3, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 20 })
  budget.closed(3)
  assert.throws(() => new AmendedCampaignBudget(directory).reserve({ name: 'voice-mission', identity }), /exhausted/)
  assert.throws(() => initializeAmendment(directory), /already exists/)
  const state = inspectAmendedCampaign(directory)
  assert.equal(state.productionAttempts, 3)
  assert.equal(state.newAttempts, 2)
  assert.equal(state.newReservedSeconds, 1340)
  assert.equal(state.reservedSeconds, 2010)
  assert.equal(state.estimatedReservedDollars, 2.5125)
}))

test('missing, partial, corrupt and unreserved aggregate accounting fails closed without replacement', () => {
  for (const corruption of ['missing-ledger', 'missing-allowance', 'truncated', 'unreserved', 'changed-limit', 'duplicate-approval']) fixture(directory => {
    const path = join(directory, QA_AMENDMENT_LEDGER)
    if (corruption === 'missing-ledger') rmSync(path)
    if (corruption === 'missing-allowance') rmSync(join(directory, QA_AMENDMENT_ALLOWANCE))
    if (corruption === 'truncated') writeFileSync(path, readFileSync(path, 'utf8').trimEnd())
    if (corruption === 'unreserved') new LiveAdmission(join(directory, QA_AMENDMENT_ALLOWANCE)).reserve()
    if (corruption === 'changed-limit') writeFileSync(path, readFileSync(path, 'utf8').replace('"maxAttempts":3', '"maxAttempts":4'))
    if (corruption === 'duplicate-approval') writeFileSync(path, readFileSync(path, 'utf8').repeat(2))
    assert.throws(() => inspectAmendedCampaign(directory))
    assert.throws(() => initializeAmendment(directory), /already exists/)
  })
})

test('initialization refuses changed price, missing history and modified historical evidence', () => fixture(directory => {
  assert.throws(() => initializeAmendment(directory, { hourlyRate: 4.6 }), /price/)
  const historical = join(directory, 'campaign.jsonl')
  const original = readFileSync(historical)
  writeFileSync(historical, original.toString().replace('"outcome":"failed"', '"outcome":"passed"'))
  assert.throws(() => initializeAmendment(directory), /preserved approved history/)
  rmSync(historical)
  assert.throws(() => initializeAmendment(directory))
  writeFileSync(historical, original)
}, false))

test('amendment restricts durations, identity, result order and duplicate events before mutation', () => fixture(directory => {
  const budget = new AmendedCampaignBudget(directory)
  for (const maxRunSeconds of [0, -1, 591, 1.5, Infinity]) assert.throws(() => budget.reserve({ name: 'text-mission', identity, maxRunSeconds }))
  assert.throws(() => budget.reserve({ name: 'text-mission' }))
  assert.equal(inspectAmendedCampaign(directory).newAttempts, 0)
  budget.reserve({ name: 'text-mission', identity })
  assert.throws(() => budget.closed(2))
  budget.finish(2, { outcome: 'failed', endAcknowledged: false })
  assert.throws(() => budget.finish(2, { outcome: 'failed', endAcknowledged: false }))
  budget.closed(2)
  assert.throws(() => budget.closed(2))
}))

test('internal supervisor CLI cannot run without its own original campaign flock', { skip: process.platform !== 'linux' }, () => fixture(directory => {
  assert.throws(() => assertOwnsCampaignLock(directory), /kernel lock/)
  const worker = join(directory, 'must-never-run.mjs')
  writeFileSync(worker, 'throw new Error("Unsupervised worker executed")\n')
  for (const mode of ['--supervise', '--supervise-amendment', '--supervise-runtime-amendment', '--supervise-confirmed-amendment', '--goal-004e-recheck', '--goal-005-batch']) {
    const result = spawnSync(process.execPath, [resolve('scripts/qa-supervisor.mjs'), mode, directory, worker, '1'], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /Unsupervised worker executed/)
    assert.equal(inspectAmendedCampaign(directory).newAttempts, 0)
  }
}))

test('supplement cannot be routed as an independent campaign or substituted worker', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-amendment-route-'))
  try {
    writeGoal004CHistory(directory)
    initializeAmendment(directory)
    await assert.rejects(runSupervised({ directory, worker: resolve('scripts/qa-live-browser.mjs'), amendmentId: QA_AMENDMENT_ID }), /Only the fixed/)
    await assert.rejects(runSupervised({ directory, worker: resolve('scripts/qa-live-browser.mjs') }), /preserved history/)
    assert.equal(inspectAmendedCampaign(directory).newAttempts, 0)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('a fake IPC parent cannot impersonate the amendment supervisor with environment flags', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-fake-supervisor-'))
  const campaign = resolve('.validation/goal-004c-live')
  try {
    const worker = join(directory, 'offline-parent-check.mjs')
    const helper = pathToFileURL(resolve('scripts/qa-supervisor.mjs')).href
    writeFileSync(worker, `import { assertSupervisedParent } from ${JSON.stringify(helper)};
try { assertSupervisedParent(${JSON.stringify(campaign)}); process.send({ rejected: false }); }
catch (error) { process.send({ rejected: true, message: error.message }); }
process.disconnect();
`)
    const child = fork(worker, [], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env,
      GAME_DISABLE_LIVE: '1', QA_SUPERVISED_WORKER: '1', QA_CAMPAIGN_DIRECTORY: campaign, QA_CAMPAIGN_AMENDMENT: QA_AMENDMENT_ID } })
    let response: { rejected?: boolean; message?: string } | undefined
    child.on('message', message => { response = message as typeof response })
    const timer = setTimeout(() => child.kill(), 5000)
    const code = await new Promise(resolveExit => child.once('exit', resolveExit))
    clearTimeout(timer)
    assert.equal(code, 0)
    assert.equal(response?.rejected, true)
    assert.match(response?.message ?? '', /not the compiled amendment supervisor/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('compiled amendment supervisors prove their parent lock and reject an unfrozen reservation in isolated offline trees', { skip: process.platform !== 'linux' }, async () => {
  for (const amendmentId of [QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_ID, QA_RECHECK_AMENDMENT_ID, QA_GOAL005_AMENDMENT_ID]) {
    const directory = mkdtempSync(join(tmpdir(), 'tmh-real-parent-proof-'))
    try {
      const scripts = join(directory, 'scripts')
      mkdirSync(scripts)
      for (const file of ['qa-supervisor.mjs', 'qa-budget.mjs', 'qa-amended-budget.mjs', 'qa-live-authorization.mjs']) {
        copyFileSync(resolve('scripts', file), join(scripts, file))
      }
      const campaign = join(directory, '.validation/goal-004c-live')
      if (amendmentId === QA_GOAL005_AMENDMENT_ID) writeGoal004ERecheckHistory(campaign)
      else if (amendmentId === QA_RECHECK_AMENDMENT_ID) writeGoal004EConfirmedHistory(campaign)
      else if (amendmentId === QA_CONFIRMED_AMENDMENT_ID) writeGoal004DRetestHistory(campaign)
      else if (amendmentId === QA_RUNTIME_AMENDMENT_ID) writeGoal004CAmendedHistory(campaign)
      else writeGoal004CHistory(campaign)
      initializeAmendment(campaign, { amendmentId })
      const worker = join(scripts, 'qa-live-browser.mjs')
      writeFileSync(worker, `import assert from 'node:assert/strict';
import { assertSupervisedParent, requestAttempt } from './qa-supervisor.mjs';
assertSupervisedParent(process.env.QA_CAMPAIGN_DIRECTORY);
process.env.QA_CAMPAIGN_AMENDMENT = ${JSON.stringify(amendmentId === QA_AMENDMENT_ID ? QA_RUNTIME_AMENDMENT_ID : QA_AMENDMENT_ID)};
assert.throws(() => assertSupervisedParent(process.env.QA_CAMPAIGN_DIRECTORY), /not the compiled amendment supervisor/);
process.env.QA_CAMPAIGN_AMENDMENT = ${JSON.stringify(amendmentId)};
await assert.rejects(requestAttempt({ name: ${JSON.stringify([QA_RECHECK_AMENDMENT_ID, QA_GOAL005_AMENDMENT_ID].includes(amendmentId) ? 'voice-mission' : 'text-mission')}, identity: ${JSON.stringify(identity)} }));
process.disconnect();
`)
      const copiedSupervisor = await import(pathToFileURL(join(scripts, 'qa-supervisor.mjs')).href)
      const result = await copiedSupervisor.runSupervised({ directory: campaign, worker, amendmentId,
        args: ['--worker', '--scenario', 'mission', '--mode', [QA_RECHECK_AMENDMENT_ID, QA_GOAL005_AMENDMENT_ID].includes(amendmentId) ? 'voice' : 'text'], env: { ...process.env, GAME_DISABLE_LIVE: '1' } })
      assert.equal(result.exitCode, 0)
      assert.equal(inspectAmendedCampaign(campaign, amendmentId).newAttempts, 0)
      assert.equal(inspectAmendedCampaign(campaign, amendmentId).productionAttempts, amendmentId === QA_GOAL005_AMENDMENT_ID ? 5 : amendmentId === QA_RECHECK_AMENDMENT_ID ? 4 : amendmentId === QA_CONFIRMED_AMENDMENT_ID ? 3 : amendmentId === QA_RUNTIME_AMENDMENT_ID ? 2 : 1)
      const cleanupFile = amendmentId === QA_GOAL005_AMENDMENT_ID ? QA_GOAL005_AMENDMENT_CLEANUP : amendmentId === QA_RECHECK_AMENDMENT_ID ? QA_RECHECK_AMENDMENT_CLEANUP : amendmentId === QA_CONFIRMED_AMENDMENT_ID ? 'amendment-confirmed-actions-cleanup.jsonl' : amendmentId === QA_RUNTIME_AMENDMENT_ID ? 'amendment-runtime-retest-cleanup.jsonl' : 'amendment-final-acceptance-cleanup.jsonl'
      assert.equal(JSON.parse(readFileSync(join(campaign, cleanupFile), 'utf8').trim()).survivors, 0)
    } finally { rmSync(directory, { recursive: true, force: true }) }
  }
})

test('confirmed-action amendment reassigns only existing final Voice slot and preserves all three failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-confirmed-amendment-'))
  try {
    writeGoal004DRetestHistory(directory)
    const oldWriter = new AmendedCampaignBudget(directory, Date.now, QA_RUNTIME_AMENDMENT_ID)
    const state = initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID })
    assert.equal(state.header.maxAttempts, 4)
    assert.equal(state.header.capacitySeconds, 2680)
    assert.equal(state.header.maxNewAttempts, 1)
    assert.equal(state.header.newCapacitySeconds, 670)
    assert.equal(state.header.planningDollars, 3.35)
    assert.equal(state.attempts.length, 3)
    assert.equal(state.productionAttempts, 3)
    assert.equal(state.reservedSeconds, 2010)
    assert.throws(() => oldWriter.reserve({ name: 'voice-mission', identity }), /preserved history/)
    assert.throws(() => oldWriter.finish(3, { outcome: 'failed', endAcknowledged: true, connectedSeconds: 0 }), /preserved history/)
    assert.throws(() => oldWriter.closed(3), /preserved history/)
    assert.throws(() => new AmendedCampaignBudget(directory, Date.now, QA_AMENDMENT_ID), /preserved history/)
    const budget = new AmendedCampaignBudget(directory, Date.now, QA_CONFIRMED_AMENDMENT_ID)
    assert.throws(() => budget.reserve({ name: 'text-mission', identity }), /Invalid fixed/)
    const voice = budget.reserve({ name: 'voice-mission', identity })
    assert.equal(voice.attempt, 4)
    assert.equal(voice.reservedSeconds, 670)
    new LiveAdmission(join(directory, QA_CONFIRMED_AMENDMENT_ALLOWANCE), 1).reserve()
    budget.finish(4, { outcome: 'failed', endAcknowledged: false, connectedSeconds: null })
    budget.closed(4)
    assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /exhausted/)
    const bytes = readFileSync(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER))
    const repeated = initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID })
    assert.equal(repeated.attempts.length, 4)
    assert.equal(repeated.reservedSeconds, 2680)
    assert.equal(repeated.productionAttempts, 4)
    assert.deepEqual(readFileSync(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER)), bytes)
    assert.equal(hash(readFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER))), QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES.campaign)
    assert.equal(hash(readFileSync(join(directory, QA_RUNTIME_AMENDMENT_ALLOWANCE))), QA_CONFIRMED_AMENDMENT_ORIGINAL_HASHES.allowance)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('final-slot activation fails closed on changed history, price or partial accounting', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-confirmed-corruption-'))
  try {
    writeGoal004DRetestHistory(directory)
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID, hourlyRate: 4.6 }), /price/)
    writeFileSync(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER), '{}\n')
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID }), /incomplete/)
    rmSync(join(directory, QA_CONFIRMED_AMENDMENT_LEDGER))
    const original = readFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER), 'utf8')
    writeFileSync(join(directory, QA_RUNTIME_AMENDMENT_LEDGER), original.replace('"outcome":"failed"', '"outcome":"passed"'))
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_CONFIRMED_AMENDMENT_ID }), /preserved failed/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

function recheckFixture(run: (directory: string) => void, initialize = true) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-candidate-recheck-'))
  try {
    writeGoal004EConfirmedHistory(directory)
    const history = ['campaign.jsonl', 'allowance.jsonl', QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE,
      QA_RUNTIME_AMENDMENT_LEDGER, QA_RUNTIME_AMENDMENT_ALLOWANCE, QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE]
      .map(file => ({ file, bytes: readFileSync(join(directory, file)) }))
    if (initialize) initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID })
    run(directory)
    for (const { file, bytes } of history) assert.deepEqual(readFileSync(join(directory, file)), bytes)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('candidate recheck preserves all four consumed attempts and grants exactly one additional Voice reservation', () => recheckFixture(directory => {
  const state = inspectAmendedCampaign(directory, QA_RECHECK_AMENDMENT_ID)
  assert.equal(state.header.previousAmendmentId, QA_CONFIRMED_AMENDMENT_ID)
  assert.equal(state.header.originalCampaignSha256, QA_RECHECK_AMENDMENT_ORIGINAL_HASHES.campaign)
  assert.equal(state.header.originalAllowanceSha256, QA_RECHECK_AMENDMENT_ORIGINAL_HASHES.allowance)
  assert.equal(state.header.maxAttempts, 5)
  assert.equal(state.header.capacitySeconds, 3350)
  assert.equal(state.header.planningDollars, 4.1875)
  assert.equal(state.header.maxNewAttempts, 1)
  assert.equal(state.header.newCapacitySeconds, 670)
  assert.equal(state.header.newCapacitySeconds * state.header.hourlyRate / 3600, .8375)
  assert.equal(state.historicalAttempts, 4)
  assert.equal(state.productionAttempts, 4)
  assert.equal(state.newAttempts, 0)
  assert.equal(state.reservedSeconds, 2680)
  assert.deepEqual(state.attempts.map((a: { name: string; result: { outcome: string } }) => [a.name, a.result.outcome]),
    [['text-mission', 'failed'], ['text-mission', 'failed'], ['text-mission', 'failed'], ['voice-mission', 'failed']])
  const before = readFileSync(join(directory, QA_RECHECK_AMENDMENT_LEDGER))
  assert.deepEqual(initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID }), state)
  assert.deepEqual(readFileSync(join(directory, QA_RECHECK_AMENDMENT_LEDGER)), before)
  assert.equal(inspectAmendedCampaign(directory, QA_CONFIRMED_AMENDMENT_ID).attempts.length, 4)
}))

test('candidate recheck blocks all earlier writers, including an already constructed writer', () => recheckFixture(directory => {
  const old = new AmendedCampaignBudget(directory, Date.now, QA_CONFIRMED_AMENDMENT_ID)
  initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID })
  for (const id of [QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_ID]) {
    assert.throws(() => new AmendedCampaignBudget(directory, Date.now, id), /preserved history/)
  }
  assert.throws(() => new CampaignBudget(directory), /preserved history/)
  assert.throws(() => old.reserve({ name: 'voice-mission', identity }), /preserved history/)
  assert.throws(() => old.finish(4, { outcome: 'failed', endAcknowledged: true }), /preserved history/)
  assert.throws(() => old.closed(4), /preserved history/)
}, false))

test('the fifth Voice reserves before admission and stays exhausted after failed or uncertain termination and repeat activation', () => {
  for (const admit of [false, true]) recheckFixture(directory => {
    let now = Date.now()
    const budget = new AmendedCampaignBudget(directory, () => now, QA_RECHECK_AMENDMENT_ID)
    assert.throws(() => budget.reserve({ name: 'text-mission', identity }), /Invalid fixed/)
    for (const maxRunSeconds of [0, 591, 600]) assert.throws(() => budget.reserve({ name: 'voice-mission', identity, maxRunSeconds }), /Invalid fixed/)
    assert.equal(inspectAmendedCampaign(directory, QA_RECHECK_AMENDMENT_ID).newAttempts, 0)
    const voice = budget.reserve({ name: 'voice-mission', identity, maxRunSeconds: 590 })
    assert.equal(voice.attempt, 5)
    assert.equal(voice.reservedSeconds, 670)
    assert.equal(voice.gracefulAt - voice.reservedAt, 590_000)
    assert.equal(voice.hardAt - voice.reservedAt, 600_000)
    assert.equal(voice.leaseUntil - voice.reservedAt, 670_000)
    assert.equal(inspectAmendedCampaign(directory, QA_RECHECK_AMENDMENT_ID).productionAttempts, 4)
    if (admit) new LiveAdmission(join(directory, QA_RECHECK_AMENDMENT_ALLOWANCE), 1, () => now).reserve()
    assert.throws(() => budget.reserve({ name: 'voice-mission', identity }), /exhausted/)
    budget.finish(5, { outcome: 'failed', endAcknowledged: admit, connectedSeconds: admit ? 2 : null })
    budget.closed(5)
    now += 1_000_000
    const before = [QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE].map(file => readFileSync(join(directory, file)))
    const repeated = initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID })
    assert.equal(repeated.attempts.length, 5)
    assert.equal(repeated.productionAttempts, admit ? 5 : 4)
    assert.equal(repeated.newAttempts, 1)
    assert.equal(repeated.newReservedSeconds, 670)
    assert.equal(repeated.reservedSeconds, 3350)
    assert.equal(repeated.estimatedReservedDollars, 4.1875)
    assert.throws(() => new AmendedCampaignBudget(directory, () => now, QA_RECHECK_AMENDMENT_ID).reserve({ name: 'voice-mission', identity }), /exhausted/)
    for (const [i, file] of [QA_RECHECK_AMENDMENT_LEDGER, QA_RECHECK_AMENDMENT_ALLOWANCE].entries()) assert.deepEqual(readFileSync(join(directory, file)), before[i])
  })
})

test('candidate recheck fails closed on partial accounting, tampered limits and unreserved production consumption', () => {
  for (const corruption of ['missing-ledger', 'missing-allowance', 'truncated', 'changed-limit', 'unreserved', 'duplicate-header']) recheckFixture(directory => {
    const ledger = join(directory, QA_RECHECK_AMENDMENT_LEDGER)
    if (corruption === 'missing-ledger') rmSync(ledger)
    if (corruption === 'missing-allowance') rmSync(join(directory, QA_RECHECK_AMENDMENT_ALLOWANCE))
    if (corruption === 'truncated') writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd())
    if (corruption === 'changed-limit') writeFileSync(ledger, readFileSync(ledger, 'utf8').replace('"maxAttempts":5', '"maxAttempts":6'))
    if (corruption === 'unreserved') new LiveAdmission(join(directory, QA_RECHECK_AMENDMENT_ALLOWANCE)).reserve()
    if (corruption === 'duplicate-header') writeFileSync(ledger, readFileSync(ledger, 'utf8').repeat(2))
    assert.throws(() => inspectAmendedCampaign(directory, QA_RECHECK_AMENDMENT_ID))
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID }))
    assert.throws(() => new AmendedCampaignBudget(directory, Date.now, QA_CONFIRMED_AMENDMENT_ID), /preserved history/)
  })
})

test('candidate recheck rejects changed price or predecessor bytes without repairing history', () => recheckFixture(directory => {
  assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID, hourlyRate: 4.6 }), /price/)
  for (const file of [QA_CONFIRMED_AMENDMENT_LEDGER, QA_CONFIRMED_AMENDMENT_ALLOWANCE]) {
    const path = join(directory, file), before = readFileSync(path)
    writeFileSync(path, ' ' + before.toString())
    assert.throws(() => initializeAmendment(directory, { amendmentId: QA_RECHECK_AMENDMENT_ID }), /four exact preserved/)
    assert.equal(readFileSync(path, 'utf8'), ' ' + before.toString())
    writeFileSync(path, before)
  }
}, false))
