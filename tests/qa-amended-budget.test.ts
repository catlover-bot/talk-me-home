import assert from 'node:assert/strict'
import { fork, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { LiveAdmission } from '../game/server/admission.js'
import { writeGoal004CHistory } from './fixtures/goal-004c-history.js'
// @ts-expect-error Executable accounting helpers remain native Node modules.
import { AmendedCampaignBudget, initializeAmendment, inspectAmendedCampaign, QA_AMENDMENT_ID, QA_AMENDMENT_LEDGER, QA_AMENDMENT_ALLOWANCE, QA_AMENDMENT_ORIGINAL_HASHES } from '../scripts/qa-amended-budget.mjs'
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
  for (const mode of ['--supervise', '--supervise-amendment']) {
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

test('the compiled amendment supervisor proves its genuine parent lock in an isolated offline tree', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-real-parent-proof-'))
  try {
    const scripts = join(directory, 'scripts')
    mkdirSync(scripts)
    for (const file of ['qa-supervisor.mjs', 'qa-budget.mjs', 'qa-amended-budget.mjs', 'qa-live-authorization.mjs']) {
      copyFileSync(resolve('scripts', file), join(scripts, file))
    }
    const campaign = join(directory, '.validation/goal-004c-live')
    writeGoal004CHistory(campaign)
    initializeAmendment(campaign)
    const worker = join(scripts, 'qa-live-browser.mjs')
    writeFileSync(worker, `import { assertSupervisedParent } from './qa-supervisor.mjs';
assertSupervisedParent(process.env.QA_CAMPAIGN_DIRECTORY);
process.disconnect();
`)
    const copiedSupervisor = await import(pathToFileURL(join(scripts, 'qa-supervisor.mjs')).href)
    const result = await copiedSupervisor.runSupervised({ directory: campaign, worker, amendmentId: QA_AMENDMENT_ID,
      args: ['--worker', '--scenario', 'mission', '--mode', 'text'], env: { ...process.env, GAME_DISABLE_LIVE: '1' } })
    assert.equal(result.exitCode, 0)
    assert.equal(inspectAmendedCampaign(campaign).newAttempts, 0)
    assert.equal(inspectAmendedCampaign(campaign).productionAttempts, 1)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
