import { fork, spawn } from 'node:child_process'
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { CampaignBudget } from './qa-budget.mjs'
import { AmendedCampaignBudget, inspectAmendedCampaign, QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID } from './qa-amended-budget.mjs'

const SELF = fileURLToPath(import.meta.url)
const FIXED_DIRECTORY = fileURLToPath(new URL('../.validation/goal-004c-live', import.meta.url))
const FIXED_WORKER = fileURLToPath(new URL('./qa-live-browser.mjs', import.meta.url))
const supervisorMode = amendmentId => amendmentId === QA_RUNTIME_AMENDMENT_ID ? '--supervise-runtime-amendment' : amendmentId === QA_AMENDMENT_ID ? '--supervise-amendment' : '--supervise'
const watchdogMode = amendmentId => amendmentId === QA_RUNTIME_AMENDMENT_ID ? '--watchdog-runtime-amendment' : amendmentId === QA_AMENDMENT_ID ? '--watchdog-amendment' : '--watchdog'
const sleep = milliseconds => new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds))
const safeEnv = source => {
  const env = { ...source }
  delete env.ASSEMBLYAI_API_KEY
  delete env.NODE_OPTIONS
  return env
}

export function processIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid < 2) return null
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ')
    return { pid, parent: Number(fields[1]), group: Number(fields[2]), start: fields[19], state: fields[0] }
  } catch { return null }
}
const sameProcess = identity => {
  const current = processIdentity(identity.pid)
  return current && current.start === identity.start && current.state !== 'Z' ? current : null
}
function descendantOf(pid, ancestor) {
  for (let count = 0; count < 64 && pid > 1; count++) {
    const current = processIdentity(pid)
    if (!current) return false
    if (current.pid === ancestor.pid) return current.start === ancestor.start
    pid = current.parent
  }
  return false
}

/** Linux/WSL uses a kernel flock, released by the OS on crash; reservations remain durable. */
export async function runSupervised({ directory, worker, args = [], env = process.env, preparationSeconds = 120, amendmentId }) {
  if (process.platform !== 'linux') throw new Error('Bounded QA supervision requires Linux/WSL process ownership checks.')
  directory = resolve(directory); worker = resolve(worker)
  validateCampaignRoute(directory, worker, amendmentId)
  if (!Number.isInteger(preparationSeconds) || preparationSeconds < 1 || preparationSeconds > 300) throw new Error('Invalid QA preparation deadline.')
  const lock = join(directory, 'campaign.lock')
  if (existsSync(lock) && (!lstatSync(lock).isFile() || lstatSync(lock).isSymbolicLink())) throw new Error('Unexpected QA campaign lock.')
  const descriptor = openSync(lock, 'a', 0o600); closeSync(descriptor)
  const child = spawn('flock', ['--nonblock', '--no-fork', '--conflict-exit-code', '75', lock, process.execPath, SELF, supervisorMode(amendmentId), directory, worker, String(preparationSeconds), ...args], {
    stdio: ['ignore', 'inherit', 'inherit'], env: safeEnv(env),
  })
  return await new Promise((resolveRun, reject) => {
    child.once('error', () => reject(new Error('The independent QA supervisor could not start.')))
    child.once('exit', (code, signal) => {
      if (code === 75) reject(new Error('Another QA campaign process holds the exclusive lock.'))
      else resolveRun({ exitCode: code, signal })
    })
  })
}

function validateCampaignRoute(directory, worker, amendmentId) {
  if (amendmentId !== undefined) {
    if (![QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID].includes(amendmentId) || directory !== FIXED_DIRECTORY || worker !== FIXED_WORKER) throw new Error('Only the fixed linked amendment and compiled Live worker may use the aggregate campaign.')
    inspectAmendedCampaign(directory, amendmentId)
  } else {
    if (directory === FIXED_DIRECTORY) throw new Error('The original Goal 004C runner is disabled; its remaining slot is governed by the fixed aggregate amendment.')
    new CampaignBudget(directory)
  }
}

/** The internal CLI is not authorization: the supervisor must own the kernel lock. */
export function assertOwnsCampaignLock(directory) {
  assertProcessOwnsCampaignLock(directory, process.pid)
}

function assertProcessOwnsCampaignLock(directory, pid) {
  const lock = join(resolve(directory), 'campaign.lock')
  for (const descriptor of readdirSync(`/proc/${pid}/fd`)) {
    try {
      if (readlinkSync(`/proc/${pid}/fd/${descriptor}`) !== lock) continue
      const info = readFileSync(`/proc/${pid}/fdinfo/${descriptor}`, 'utf8')
      if (new RegExp(`^lock:\\s+\\d+: FLOCK\\s+ADVISORY\\s+WRITE\\s+${pid}\\s`, 'm').test(info)) return
    } catch {}
  }
  throw new Error('The independent supervisor does not own the original campaign kernel lock.')
}

/** A flag and an IPC channel alone cannot impersonate the compiled supervisor. */
export function assertSupervisedParent(directory) {
  directory = resolve(directory)
  const amendmentId = process.env.QA_CAMPAIGN_AMENDMENT
  if (directory !== FIXED_DIRECTORY || !process.send || process.env.QA_SUPERVISED_WORKER !== '1'
    || process.env.QA_CAMPAIGN_DIRECTORY !== directory || ![QA_AMENDMENT_ID, QA_RUNTIME_AMENDMENT_ID].includes(amendmentId)) {
    throw new Error('The Live worker requires its fixed, independently supervised parent.')
  }
  const parent = processIdentity(process.ppid)
  if (!parent || parent.state === 'Z') throw new Error('The independent supervisor parent is unavailable.')
  const command = readFileSync(`/proc/${parent.pid}/cmdline`, 'utf8').split('\0').filter(Boolean)
  if (command.length !== 11 || command[0] !== process.execPath || command[1] !== SELF || command[2] !== supervisorMode(amendmentId)
    || command[3] !== directory || command[4] !== FIXED_WORKER || !/^\d+$/.test(command[5]) || Number(command[5]) < 1 || Number(command[5]) > 300
    || command[6] !== '--worker' || command[7] !== '--scenario' || command[8] !== 'mission' || command[9] !== '--mode'
    || !['text', 'voice'].includes(command[10])) throw new Error('The IPC parent is not the compiled amendment supervisor.')
  assertProcessOwnsCampaignLock(directory, parent.pid)
  if (processIdentity(parent.pid)?.start !== parent.start) throw new Error('The independent supervisor parent identity changed.')
  new AmendedCampaignBudget(directory, Date.now, amendmentId)
}

let requestSequence = 0
function request(type, data = {}) {
  if (!process.send || process.env.QA_SUPERVISED_WORKER !== '1') return Promise.reject(new Error('A bounded independent supervisor is required.'))
  const id = ++requestSequence
  return new Promise((resolveRequest, reject) => {
    const timer = setTimeout(() => { process.off('message', listener); reject(new Error('QA supervisor acknowledgement timed out.')) }, 10_000)
    const listener = message => {
      if (message?.type !== 'qa.response' || message.id !== id) return
      clearTimeout(timer); process.off('message', listener)
      if (message.ok) resolveRequest(message.value)
      else reject(new Error(message.error))
    }
    process.on('message', listener)
    process.send({ type, id, ...data })
  })
}

/** Call at the intercepted production token-request boundary, before allowing that request. */
export const requestAttempt = options => request('qa.reserve', { options })
/** Registration accepts only a currently proven child of this driver. */
export const registerOwnedProcess = pid => request('qa.register', { pid })
export const finishAttempt = result => request('qa.finish', { result })

async function supervise(directory, worker, preparationSeconds, args, amendmentId) {
  directory = resolve(directory); worker = resolve(worker)
  assertOwnsCampaignLock(directory)
  validateCampaignRoute(directory, worker, amendmentId)
  if (!Number.isInteger(preparationSeconds) || preparationSeconds < 1 || preparationSeconds > 300) throw new Error('Invalid QA preparation deadline.')
  const budget = amendmentId ? new AmendedCampaignBudget(directory, Date.now, amendmentId) : new CampaignBudget(directory)
  const authorization = amendmentId ? await import('./qa-live-authorization.mjs') : null
  const reservationGuard = amendmentId === QA_RUNTIME_AMENDMENT_ID ? authorization.assertGoal004DReservationAuthorized : amendmentId ? authorization.assertGoal004CReservationAuthorized : null
  if (amendmentId && typeof reservationGuard !== 'function') throw new Error('The fixed amendment reservation guard is unavailable.')
  const driver = fork(worker, args, { detached: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], env: { ...safeEnv(process.env), QA_SUPERVISED_WORKER: '1', QA_CAMPAIGN_DIRECTORY: directory, ...(amendmentId ? { QA_CAMPAIGN_AMENDMENT: amendmentId } : {}) } })
  const identity = processIdentity(driver.pid)
  if (!identity) throw new Error('QA driver ownership could not be established.')
  const watchdog = fork(SELF, [watchdogMode(amendmentId), directory, String(identity.pid), identity.start, String(Date.now() + preparationSeconds * 1000)], {
    detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: safeEnv(process.env),
  })
  let reservation = null
  let resultWritten = false
  let driverExited = false
  let watchdogClosed = false
  let watchdogReady = false
  let cleanupPromise
  let stopTimer
  let exitCode = 1
  const pending = new Map()
  const sendStop = () => { if (driver.connected) driver.send({ type: 'qa.stop', reason: 'deadline-or-cleanup' }) }
  const stop = () => {
    sendStop()
    if (!cleanupPromise) cleanupPromise = (async () => {
      if (watchdog.connected) watchdog.send({ type: 'stop' })
      for (let wait = 0; wait < 100 && !watchdogClosed; wait++) await sleep(100)
      if (!watchdogClosed) throw new Error('Independent QA cleanup was not confirmed.')
    })()
    return cleanupPromise
  }
  const onSignal = () => { exitCode = 1; void stop().catch(() => {}) }
  process.on('SIGTERM', onSignal); process.on('SIGINT', onSignal)
  const response = (id, ok, value) => { if (driver.connected) driver.send({ type: 'qa.response', id, ok, ...(ok ? { value } : { error: value }) }) }
  const watchdogRequest = message => new Promise((resolveRequest, reject) => {
    const id = randomUUID()
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Independent watchdog acknowledgement timed out.')) }, 5000)
    pending.set(id, value => { clearTimeout(timer); resolveRequest(value) })
    watchdog.send({ ...message, id })
  })
  watchdog.on('message', message => {
    if (message?.type === 'ready') watchdogReady = true
    if (message?.type === 'closed') watchdogClosed = message.survivors === 0
    if (message?.type === 'ack') { pending.get(message.id)?.(message); pending.delete(message.id) }
  })
  driver.on('message', message => {
    void (async () => {
      if (!message || !Number.isSafeInteger(message.id)) return
      try {
        for (let count = 0; count < 50 && !watchdogReady; count++) await sleep(100)
        if (!watchdogReady || watchdogClosed) throw new Error('The independent watchdog is unavailable.')
        if (message.type === 'qa.reserve') {
          if (reservation) throw new Error('Only one token attempt is allowed per supervised driver.')
          if (reservationGuard) reservationGuard({ directory, mode: message.options?.name === 'text-mission' ? 'text' : message.options?.name === 'voice-mission' ? 'voice' : null, identity: message.options?.identity })
          reservation = budget.reserve(message.options)
          // The watchdog acknowledges the durable absolute deadline before the driver can issue the request.
          const armed = await watchdogRequest({ type: 'arm', hardAt: reservation.hardAt })
          if (!armed.ok) throw new Error('The independent watchdog could not arm its deadline.')
          stopTimer = setTimeout(sendStop, Math.max(0, reservation.gracefulAt - Date.now()))
          response(message.id, true, reservation)
        } else if (message.type === 'qa.register') {
          const owned = processIdentity(message.pid)
          if (!owned || !descendantOf(owned.pid, identity)) throw new Error('The proposed cleanup process is not owned by the QA driver.')
          const registered = await watchdogRequest({ type: 'register', identity: owned })
          if (!registered.ok) throw new Error('The independent watchdog rejected process ownership.')
          response(message.id, true, { registered: true })
        } else if (message.type === 'qa.finish') {
          if (!reservation) throw new Error('No QA attempt has been reserved.')
          budget.finish(reservation.attempt, message.result); resultWritten = true
          response(message.id, true, { recorded: true })
        } else throw new Error('Unknown QA supervisor request.')
      } catch (error) { response(message.id, false, error instanceof Error ? error.message : 'QA supervision failed.') }
    })()
  })
  try {
    const termination = await new Promise(resolveExit => {
      driver.once('error', () => resolveExit({ code: 1 }))
      driver.once('exit', (code, signal) => { driverExited = true; resolveExit({ code, signal }) })
    })
    exitCode = termination.code === 0 ? 0 : 1
    await stop()
    if (reservation) {
      if (!resultWritten) budget.finish(reservation.attempt, { endAcknowledged: false, connectedSeconds: null, outcome: 'failed' })
      budget.closed(reservation.attempt)
    }
  } finally {
    clearTimeout(stopTimer)
    process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal)
    if (!driverExited) await stop()
    if (watchdog.connected) watchdog.disconnect()
  }
  process.exitCode = exitCode
}

async function watch(directory, pid, start, initialDeadline, amendmentId) {
  const driver = { pid, start }
  const owned = new Map([[pid, driver]])
  let deadline = initialDeadline
  let stopping = false
  let closed = false
  const collect = () => {
    const processes = readdirSync('/proc').filter(name => /^\d+$/.test(name)).map(name => processIdentity(Number(name))).filter(Boolean)
    for (let pass = 0; pass < 5; pass++) for (const candidate of processes) {
      const parent = owned.get(candidate.parent)
      if (parent && sameProcess(parent)) owned.set(candidate.pid, candidate)
    }
    return [...owned.values()].filter(sameProcess)
  }
  const signalOwned = signal => {
    // Signal individually, retaining start-time identities; never kill a reused PID or an unrelated group.
    for (const identity of collect().reverse()) if (sameProcess(identity)) try { process.kill(identity.pid, signal) } catch {}
  }
  const timer = setInterval(() => {
    collect()
    if (Date.now() >= deadline) void cleanup()
  }, 100)
  async function cleanup() {
    if (stopping) return
    stopping = true
    signalOwned('SIGTERM')
    for (let count = 0; count < 20 && collect().length; count++) await sleep(100)
    if (collect().length) signalOwned('SIGKILL')
    for (let count = 0; count < 20 && collect().length; count++) await sleep(100)
    const survivors = collect().length
    const cleanupFile = amendmentId === QA_RUNTIME_AMENDMENT_ID ? 'amendment-runtime-retest-cleanup.jsonl' : amendmentId === QA_AMENDMENT_ID ? 'amendment-final-acceptance-cleanup.jsonl' : 'cleanup.jsonl'
    const descriptor = openSync(join(directory, cleanupFile), 'a', 0o600)
    try { writeFileSync(descriptor, `${JSON.stringify({ time: Date.now(), driverPid: pid, survivors })}\n`); fsyncSync(descriptor) } finally { closeSync(descriptor) }
    if (process.connected) process.send({ type: 'closed', survivors })
    closed = true
    clearInterval(timer)
    if (process.connected) process.disconnect()
  }
  process.on('message', message => {
    if (message?.type === 'arm') {
      const ok = Number.isSafeInteger(message.hardAt) && message.hardAt > Date.now() && message.hardAt <= Date.now() + 600_000 && !stopping
      if (ok) deadline = message.hardAt
      process.send?.({ type: 'ack', id: message.id, ok })
    } else if (message?.type === 'register') {
      const ok = message.identity && sameProcess(message.identity) && descendantOf(message.identity.pid, driver) && !stopping
      if (ok) owned.set(message.identity.pid, message.identity)
      process.send?.({ type: 'ack', id: message.id, ok: Boolean(ok) })
    } else if (message?.type === 'stop') void cleanup()
  })
  process.on('disconnect', () => { if (!closed) void cleanup() })
  process.on('SIGTERM', () => void cleanup())
  process.send?.({ type: 'ready' })
}

if (resolve(process.argv[1] ?? '') === SELF) {
  const [mode, directory, ...args] = process.argv.slice(2)
  try {
    if (mode === '--supervise') await supervise(directory, args[0], Number(args[1]), args.slice(2))
    else if (mode === '--supervise-amendment') await supervise(directory, args[0], Number(args[1]), args.slice(2), QA_AMENDMENT_ID)
    else if (mode === '--supervise-runtime-amendment') await supervise(directory, args[0], Number(args[1]), args.slice(2), QA_RUNTIME_AMENDMENT_ID)
    else if (mode === '--watchdog') await watch(directory, Number(args[0]), args[1], Number(args[2]))
    else if (mode === '--watchdog-amendment') await watch(directory, Number(args[0]), args[1], Number(args[2]), QA_AMENDMENT_ID)
    else if (mode === '--watchdog-runtime-amendment') await watch(directory, Number(args[0]), args[1], Number(args[2]), QA_RUNTIME_AMENDMENT_ID)
    else throw new Error('Use the QA release runner to start the supervisor.')
  } catch { console.error('Bounded QA supervision failed; reservations were preserved.'); process.exitCode = 1 }
}
