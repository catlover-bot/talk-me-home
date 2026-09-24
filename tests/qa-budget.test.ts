import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { initializeAllowance, LiveAdmission } from '../game/server/admission.js'
// @ts-expect-error The executable QA helpers are intentionally native Node modules.
import { CampaignBudget, initializeCampaign, inspectCampaign } from '../scripts/qa-budget.mjs'
// @ts-expect-error The executable QA helpers are intentionally native Node modules.
import { processIdentity, requestAttempt, runSupervised } from '../scripts/qa-supervisor.mjs'

function fixture(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-budget-'))
  try { initializeCampaign(directory, initializeAllowance); run(directory) }
  finally { rmSync(directory, { recursive: true, force: true }) }
}

test('QA campaign creates exactly three production attempts and never replenishes a consumed reservation', () => fixture(directory => {
  const budget = new CampaignBudget(directory)
  const reservation = budget.reserve({ name: 'canary', maxRunSeconds: 60 })
  assert.equal(reservation.reservedSeconds, 670)
  assert.equal(reservation.hardAt - reservation.reservedAt, 70_000)
  const admission = new LiveAdmission(join(directory, 'allowance.jsonl'))
  admission.reserve()
  budget.finish(1, { endAcknowledged: true, connectedSeconds: 3.5, outcome: 'passed' })
  budget.closed(1)
  const prior = readFileSync(join(directory, 'campaign.jsonl'), 'utf8')
  const resumed = initializeCampaign(directory, () => { throw new Error('Existing allowance must never be initialized again') })
  assert.equal(resumed.productionAttempts, 1)
  assert.equal(resumed.reservedSeconds, 670)
  assert.equal(readFileSync(join(directory, 'campaign.jsonl'), 'utf8'), prior)
  assert.equal(resumed.header.maxSessionSeconds, 600)
  assert.equal(resumed.header.hourlyRate * 2010 / 3600, 2.5125)
}))

test('QA reservation is persisted before return, survives a new writer, and blocks overlapping uncertain sessions', () => fixture(directory => {
  let now = Date.now()
  const first = new CampaignBudget(directory, () => now).reserve({ name: 'first' })
  assert.equal(inspectCampaign(directory).attempts.length, 1)
  const restarted = new CampaignBudget(directory, () => now)
  assert.throws(() => restarted.reserve({ name: 'second' }), /lease/)
  restarted.finish(1, { endAcknowledged: false, connectedSeconds: null, outcome: 'failed' })
  restarted.closed(1)
  assert.throws(() => restarted.reserve({ name: 'second' }), /lease/)
  now = first.leaseUntil
  assert.equal(restarted.reserve({ name: 'second' }).attempt, 2)
}))

test('QA acknowledgement alone does not permit a second session before owned browser cleanup', () => fixture(directory => {
  const budget = new CampaignBudget(directory)
  budget.reserve({ name: 'first' })
  budget.finish(1, { endAcknowledged: true, connectedSeconds: 1, outcome: 'passed' })
  assert.throws(() => budget.reserve({ name: 'second' }), /lease/)
  budget.closed(1)
  assert.equal(budget.reserve({ name: 'second' }).attempt, 2)
}))

test('QA failed token attempts remain consumed and the fourth attempt is rejected', () => fixture(directory => {
  let now = Date.now()
  const budget = new CampaignBudget(directory, () => now)
  for (let count = 1; count <= 3; count++) {
    const reservation = budget.reserve({ name: `attempt-${count}` })
    budget.finish(count, { endAcknowledged: false, connectedSeconds: 0, outcome: 'blocked' })
    budget.closed(count)
    now = reservation.leaseUntil
  }
  assert.throws(() => budget.reserve({ name: 'fourth' }), /exhausted/)
  assert.equal(inspectCampaign(directory).reservedSeconds, 2010)
}))

test('QA ledger rejects invalid durations, duplicate results, and duplicate cleanup records', () => fixture(directory => {
  const budget = new CampaignBudget(directory)
  for (const duration of [-1, 0, 590.5, 591, 600, Infinity]) assert.throws(() => budget.reserve({ name: 'bad', maxRunSeconds: duration }))
  assert.equal(inspectCampaign(directory).attempts.length, 0)
  budget.reserve({ name: 'valid', maxRunSeconds: 590 })
  budget.finish(1, { endAcknowledged: true, connectedSeconds: 1, outcome: 'passed' })
  assert.throws(() => budget.finish(1, { endAcknowledged: true, connectedSeconds: 1, outcome: 'passed' }))
  budget.closed(1)
  assert.throws(() => budget.closed(1))
}))

test('QA corrupt, truncated, missing, and unreserved production ledgers fail closed without initialization', () => {
  for (const corruption of ['truncated', 'unknown-event', 'missing', 'production-extra']) fixture(directory => {
    const ledger = join(directory, 'campaign.jsonl')
    if (corruption === 'truncated') writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd())
    if (corruption === 'unknown-event') writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}{"type":"refund","attempt":1}\n`)
    if (corruption === 'missing') rmSync(ledger)
    if (corruption === 'production-extra') new LiveAdmission(join(directory, 'allowance.jsonl')).reserve()
    let initialized = false
    assert.throws(() => initializeCampaign(directory, () => { initialized = true }))
    assert.equal(initialized, false)
  })
})

test('QA setup refuses unexpected files, partial initialization, and rates beyond the planning ceiling', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-invalid-'))
  try {
    writeFileSync(join(directory, 'unrelated-owner-file'), 'preserve')
    assert.throws(() => initializeCampaign(directory, initializeAllowance), /Unexpected/)
    assert.equal(readFileSync(join(directory, 'unrelated-owner-file'), 'utf8'), 'preserve')
  } finally { rmSync(directory, { recursive: true, force: true }) }
  const partial = mkdtempSync(join(tmpdir(), 'tmh-qa-partial-'))
  try {
    assert.throws(() => initializeCampaign(partial, () => { throw new Error('Simulated failed allowance creation') }))
    assert.throws(() => initializeCampaign(partial, initializeAllowance), /incomplete/)
  } finally { rmSync(partial, { recursive: true, force: true }) }
  const expensive = mkdtempSync(join(tmpdir(), 'tmh-qa-rate-'))
  try {
    assert.throws(() => initializeCampaign(expensive, initializeAllowance, { hourlyRate: 100 }))
    const state = initializeCampaign(expensive, initializeAllowance, { hourlyRate: 9 })
    assert.equal(state.header.maxAttempts, 1)
  } finally { rmSync(expensive, { recursive: true, force: true }) }
})

test('QA token boundary requires an independent supervisor', async () => {
  await assert.rejects(requestAttempt({ name: 'unsupervised' }), /independent supervisor/)
})

test('QA campaign rejects a changed verified rate without rewriting existing limits', () => fixture(directory => {
  const before = readFileSync(join(directory, 'campaign.jsonl'), 'utf8')
  assert.throws(() => initializeCampaign(directory, initializeAllowance, { hourlyRate: 9 }), /rate changed/)
  assert.equal(readFileSync(join(directory, 'campaign.jsonl'), 'utf8'), before)
}))

const supervisorUrl = pathToFileURL(resolve('scripts/qa-supervisor.mjs')).href
const workerSource = (body: string) => `import { requestAttempt, registerOwnedProcess, finishAttempt } from ${JSON.stringify(supervisorUrl)};\n${body}\n`

test('QA supervisor holds a cross-process lock, rejects duplicate tokens, and confirms normal cleanup', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-supervisor-'))
  try {
    initializeCampaign(directory, initializeAllowance)
    const worker = join(directory, 'offline-worker.mjs')
    writeFileSync(worker, workerSource(`
      import assert from 'node:assert/strict';
      const result = await requestAttempt({ name: 'offline', maxRunSeconds: 5 });
      assert.equal(result.reservedSeconds, 670);
      await assert.rejects(registerOwnedProcess(process.ppid), /not owned/);
      await assert.rejects(requestAttempt({ name: 'duplicate' }), /one token/);
      await new Promise(resolve => setTimeout(resolve, 1200));
      await finishAttempt({ endAcknowledged: true, connectedSeconds: 0, outcome: 'passed' });
      process.disconnect();
    `))
    const first = runSupervised({ directory, worker })
    for (let count = 0; count < 50 && inspectCampaign(directory).attempts.length === 0; count++) await new Promise(done => setTimeout(done, 30))
    await assert.rejects(runSupervised({ directory, worker }), /exclusive lock/)
    assert.equal((await first).exitCode, 0)
    const state = inspectCampaign(directory)
    assert.equal(state.attempts.length, 1)
    assert.equal(state.attempts[0].result.endAcknowledged, true)
    assert.equal(typeof state.attempts[0].closedAt, 'number')
    assert.equal(state.productionAttempts, 0)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('QA independent watchdog cleans a detached owned child after a driver exception', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-crash-'))
  try {
    initializeCampaign(directory, initializeAllowance)
    const worker = join(directory, 'offline-worker.mjs')
    const pidFile = join(directory, 'child-pid')
    writeFileSync(worker, workerSource(`
      import { spawn } from 'node:child_process';
      import { writeFileSync } from 'node:fs';
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
      writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
      await registerOwnedProcess(child.pid);
      await requestAttempt({ name: 'crash', maxRunSeconds: 5 });
      throw new Error('Intentional offline driver exception');
    `))
    assert.equal((await runSupervised({ directory, worker })).exitCode, 1)
    const child = processIdentity(Number(readFileSync(pidFile, 'utf8')))
    assert.ok(!child || child.state === 'Z')
    const state = inspectCampaign(directory)
    assert.equal(state.attempts[0].result.endAcknowledged, false)
    assert.equal(state.reservedSeconds, 670)
    assert.throws(() => new CampaignBudget(directory).reserve({ name: 'retry' }), /lease/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('QA independent watchdog survives supervisor death and terminates an unresponsive driver', { skip: process.platform !== 'linux' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-orphan-'))
  try {
    initializeCampaign(directory, initializeAllowance)
    const worker = join(directory, 'offline-worker.mjs')
    const driverPidFile = join(directory, 'driver-pid')
    const supervisorPidFile = join(directory, 'supervisor-pid')
    writeFileSync(worker, workerSource(`
      import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(driverPidFile)}, String(process.pid));
      writeFileSync(${JSON.stringify(supervisorPidFile)}, String(process.ppid));
      await requestAttempt({ name: 'orphan', maxRunSeconds: 2 });
      while (true) {}
    `))
    const running = runSupervised({ directory, worker })
    for (let count = 0; count < 100 && inspectCampaign(directory).attempts.length === 0; count++) await new Promise(done => setTimeout(done, 20))
    process.kill(Number(readFileSync(supervisorPidFile, 'utf8')), 'SIGKILL')
    assert.equal((await running).signal, 'SIGKILL')
    const driverPid = Number(readFileSync(driverPidFile, 'utf8'))
    for (let count = 0; count < 80 && processIdentity(driverPid)?.state !== 'Z' && processIdentity(driverPid); count++) await new Promise(done => setTimeout(done, 50))
    assert.ok(!processIdentity(driverPid) || processIdentity(driverPid).state === 'Z')
    assert.equal(inspectCampaign(directory).reservedSeconds, 670)
    assert.throws(() => new CampaignBudget(directory).reserve({ name: 'retry' }), /lease/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('QA watchdog enforces its absolute deadline when the driver event loop is hung', { skip: process.platform !== 'linux', timeout: 20_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-hang-'))
  try {
    initializeCampaign(directory, initializeAllowance)
    const worker = join(directory, 'offline-worker.mjs')
    writeFileSync(worker, workerSource(`
      await requestAttempt({ name: 'hung', maxRunSeconds: 1 });
      while (true) {}
    `))
    const started = Date.now()
    assert.equal((await runSupervised({ directory, worker })).exitCode, 1)
    const elapsed = Date.now() - started
    assert.ok(elapsed >= 10_500 && elapsed < 17_000, `Independent cleanup elapsed ${elapsed} ms`)
    const state = inspectCampaign(directory)
    assert.equal(state.attempts[0].result.endAcknowledged, false)
    assert.equal(state.reservedSeconds, 670)
    assert.equal(typeof state.attempts[0].closedAt, 'number')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
