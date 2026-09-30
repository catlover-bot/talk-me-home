import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createGameServer } from '../game/server/http.js'
import { initializeReleaseAllocation, RELEASE_GRANT_ID, ReleaseAdmission, releaseRuntimeFingerprint, type AcceptanceEvidence, type ReleaseBinding } from '../game/server/release-admission.js'

const origin = 'https://release.example'
const binding: ReleaseBinding = { origin, serviceId: 'srv-test-release', runtimeSha256: 'a'.repeat(64) }
const qa = { purpose: 'qa', mode: 'voice' } as const
const reviewer = { purpose: 'reviewer', mode: 'voice' } as const
const browser = 'A'.repeat(43)
const qaCode = 'offline-test-qa-code-not-a-secret-000000'
const reviewerCode = 'offline-test-reviewer-code-not-a-secret'
const textCode = 'offline-test-text-code-not-a-secret-0000'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-release-test-'))
  const path = join(directory, 'allocation.jsonl')
  let now = Date.now()
  const admission = new ReleaseAdmission(path, binding, () => now)
  return { directory, path, admission, now: () => now, advance: () => { now += 970_000 },
    initialize: () => initializeReleaseAllocation(path, binding, new Date(now).toISOString(), now),
    dispose: () => rmSync(directory, { recursive: true, force: true }) }
}
function evidence(attempt: number, recorder: boolean, runtimeSha256 = binding.runtimeSha256): AcceptanceEvidence {
  return { attempt, runtimeSha256, reportSha256: String(attempt).repeat(64), mode: 'voice', completion: true,
    chapters: ['cargo', 'gallery', 'dock', 'home'], endingAck: true, cleanup: true, nonzeroPlayback: true,
    exactConfirmations: true, accessCodeRoute: true, recorderCollected: recorder, recoveryExercised: recorder }
}
function pair(f: ReturnType<typeof fixture>) {
  f.admission.reserve(qa, browser); f.advance(); f.admission.reserve(qa, browser); f.advance()
  f.admission.acceptPair(evidence(1, false), evidence(2, true))
}

test('the one service-bound grant initializes explicitly and idempotently without resetting spent slots', () => {
  const f = fixture()
  try {
    assert.equal(f.initialize(), 'created')
    f.admission.reserve(qa, browser)
    const before = readFileSync(f.path)
    assert.equal(f.initialize(), 'existing')
    assert.deepEqual(readFileSync(f.path), before)
    const restarted = new ReleaseAdmission(f.path, binding, f.now)
    assert.equal(restarted.inspect().reservations.length, 1)
    assert.equal(restarted.status(qa).available, false)
    assert.throws(() => initializeReleaseAllocation(f.path, { ...binding, serviceId: 'srv-unrelated' }, new Date(f.now()).toISOString(), f.now()))
    assert.deepEqual(readFileSync(f.path), before)
  } finally { f.dispose() }
})

test('the grant rejects stale pricing, changed limits, truncation, alternate origin and symlinked accounting', () => {
  const f = fixture()
  try {
    assert.throws(() => initializeReleaseAllocation(f.path, binding, new Date(f.now() - 86_400_001).toISOString(), f.now()))
    f.initialize()
    const source = readFileSync(f.path, 'utf8')
    writeFileSync(f.path, source.replace('"qaAttempts":8', '"qaAttempts":9'))
    assert.equal(new ReleaseAdmission(f.path, binding).status(qa).available, false)
    assert.throws(() => f.initialize())
    writeFileSync(f.path, source.trimEnd())
    assert.throws(() => new ReleaseAdmission(f.path, binding).inspect())
    writeFileSync(f.path, source)
    assert.throws(() => new ReleaseAdmission(f.path, { ...binding, origin: 'https://wrong.example' }).inspect())
    symlinkSync(f.path, join(f.directory, 'alias'))
    assert.throws(() => new ReleaseAdmission(join(f.directory, 'alias'), binding).inspect())
  } finally { f.dispose() }
})

test('QA exhaustion preserves all eight reviewer slots, which require a current accepted pair', () => {
  const f = fixture()
  try {
    f.initialize()
    for (let index = 0; index < 8; index++) { assert.equal(f.admission.reserve(qa, browser).poolAttempt, index + 1); f.advance() }
    assert.throws(() => f.admission.reserve(qa, browser), /allocation is used/)
    assert.equal(f.admission.accessSummary(reviewer)?.remaining, 8)
    assert.throws(() => f.admission.reserve(reviewer, browser), /not open yet/)
    f.admission.acceptPair(evidence(1, false), evidence(2, true))
    for (let index = 0; index < 8; index++) {
      const owner = String.fromCharCode(66 + Math.floor(index / 2)).repeat(43)
      assert.equal(f.admission.reserve(reviewer, owner).poolAttempt, index + 1)
      f.advance()
      if (index % 2 === 1 && index < 7) assert.throws(() => f.admission.reserve(reviewer, owner), /Both Live launches/)
    }
    assert.throws(() => f.admission.reserve(reviewer, 'Z'.repeat(43)), /allocation is used/)
    const state = new ReleaseAdmission(f.path, binding, f.now).inspect()
    assert.equal(state.reservations.length, 16)
    assert.equal(state.reservations.length * 970, 15520)
    assert.equal(state.reservations.length * 970 * 4.5 / 3600, 19.4)
  } finally { f.dispose() }
})

test('two diagnostic Text requests consume QA capacity only and cannot evade the Text ceiling', () => {
  const f = fixture()
  try {
    f.initialize()
    const text = { purpose: 'qa', mode: 'text' } as const
    f.admission.reserve(text, browser); f.advance(); f.admission.reserve(text, browser); f.advance()
    assert.throws(() => f.admission.reserve(text, 'B'.repeat(43)), /two Text diagnostic/)
    assert.equal(f.admission.reserve(qa, browser).poolAttempt, 3)
    const summary = f.admission.accessSummary(text)
    assert.equal(summary && 'textRemaining' in summary ? summary.textRemaining : undefined, 0)
    assert.equal(f.admission.accessSummary(reviewer)?.remaining, 8)
  } finally { f.dispose() }
})

test('one durable 970-second lease covers the full grant across restarts without an End refund', () => {
  const f = fixture()
  try {
    f.initialize()
    const first = f.admission.reserve(qa, browser)
    assert.equal(first.leaseUntil - first.reservedAt, 970_000)
    assert.throws(() => new ReleaseAdmission(f.path, binding, f.now).reserve(qa, 'B'.repeat(43)), /connection place/)
    assert.equal(f.admission.inspect().reservations.length, 1)
    f.advance()
    assert.equal(new ReleaseAdmission(f.path, binding, f.now).reserve(qa, browser).attempt, 2)
  } finally { f.dispose() }
})

test('reviewer acceptance requires two distinct current Voice reports with home, playback, recovery and ACK', () => {
  const f = fixture()
  try {
    f.initialize(); f.admission.reserve(qa, browser); f.advance(); f.admission.reserve(qa, browser)
    assert.throws(() => f.admission.acceptPair(evidence(1, false), evidence(2, true)), /expired connection leases/)
    f.advance()
    assert.throws(() => f.admission.acceptPair(evidence(1, false), { ...evidence(2, true), endingAck: false } as unknown as AcceptanceEvidence))
    assert.throws(() => f.admission.acceptPair(evidence(1, false), evidence(1, true)))
    assert.throws(() => f.admission.acceptPair(evidence(1, false), evidence(2, true, 'b'.repeat(64))))
    assert.equal(f.admission.acceptPair(evidence(1, false), evidence(2, true)), 'accepted')
    const bytes = readFileSync(f.path)
    assert.equal(f.admission.acceptPair(evidence(1, false), evidence(2, true)), 'existing')
    assert.deepEqual(readFileSync(f.path), bytes)
    assert.throws(() => f.admission.reserve(qa, browser), /already passed/)
    assert.equal(f.admission.status(reviewer).available, true)
    assert.equal(new ReleaseAdmission(f.path, { ...binding, runtimeSha256: 'b'.repeat(64) }, f.now).status(reviewer).available, false)
  } finally { f.dispose() }
})

test('an actual account refusal permanently halts both pools and initialization cannot restore them', () => {
  const f = fixture()
  try {
    f.initialize(); f.admission.reserve(qa, browser)
    f.admission.halt('provider_credit_refused')
    f.advance()
    const bytes = readFileSync(f.path)
    assert.equal(f.initialize(), 'existing')
    assert.deepEqual(readFileSync(f.path), bytes)
    const restarted = new ReleaseAdmission(f.path, binding, f.now)
    assert.equal(restarted.status(qa).available, false)
    assert.equal(restarted.status(reviewer).available, false)
    assert.equal(restarted.inspect().halt?.reason, 'provider_credit_refused')
    restarted.halt('provider_credit_refused')
    assert.deepEqual(readFileSync(f.path), bytes)
  } finally { f.dispose() }
})

test('missing or corrupt admission fails closed without creating a grant and an interrupted writer cannot overbook', () => {
  const f = fixture()
  try {
    assert.equal(f.admission.status(qa).available, false)
    assert.throws(() => readFileSync(f.path))
    f.initialize()
    writeFileSync(`${f.path}.lock`, 'interrupted writer')
    assert.throws(() => new ReleaseAdmission(f.path, binding, f.now).reserve(qa, browser), /unavailable/)
    assert.equal(new ReleaseAdmission(f.path, binding, f.now).inspect().reservations.length, 0)
  } finally { f.dispose() }
})

test('behavior fingerprints preserve documentation-only deploy evidence but change with shipped runtime bytes', () => {
  const f = fixture()
  try {
    mkdirSync(join(f.directory, 'client')); mkdirSync(join(f.directory, 'server'))
    writeFileSync(join(f.directory, 'client', 'index.html'), 'game')
    writeFileSync(join(f.directory, 'server', 'prompt.js'), 'prompt')
    const initial = releaseRuntimeFingerprint(f.directory)
    writeFileSync(join(f.directory, 'release.json'), '{"commit":"different-docs-sha"}')
    writeFileSync(join(f.directory, 'README.md'), 'a changed report')
    assert.equal(releaseRuntimeFingerprint(f.directory), initial)
    writeFileSync(join(f.directory, 'server', 'prompt.js'), 'changed prompt')
    assert.notEqual(releaseRuntimeFingerprint(f.directory), initial)
  } finally { f.dispose() }
})

type ServerOptions = Parameters<typeof createGameServer>[0]
async function request(base: string, path: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return new Promise<Response>((done, reject) => {
    const sent = httpRequest(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { host: 'release.example', origin,
      ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra }, signal: AbortSignal.timeout(5000) }, response => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(response.headers)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, item)
      const parts: Buffer[] = []
      response.on('data', chunk => parts.push(Buffer.from(chunk)))
      response.on('end', () => done(new Response(Buffer.concat(parts), { status: response.statusCode, headers })))
      response.on('error', reject)
    })
    sent.on('error', reject); sent.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
function cookies(response: Response, previous = '') {
  const jar = new Map(previous.split('; ').filter(Boolean).map(value => value.split('=') as [string, string]))
  for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); jar.set(name!, value!) }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}
async function mission(base: string, cookie?: string) {
  const response = await request(base, '/api/sessions', { missionKind: 'rescue', scenario: 'classic' }, cookie)
  assert.equal(response.status, 201)
  return { view: await response.json(), cookie: cookies(response, cookie) }
}
async function hosted(run: (base: string, f: ReturnType<typeof fixture>, calls: () => number) => Promise<void>, options: ServerOptions = {}, initialize = true) {
  const f = fixture()
  if (initialize) f.initialize()
  let calls = 0
  const server = createGameServer({ production: true, allowedOrigins: [origin], releaseAdmission: f.admission, maxVoiceSessionSeconds: 900,
    apiKey: 'offline-test-provider-credential', hostedQaEnabled: true, publicLiveEnabled: false,
    qaAccessCode: qaCode, qaTextAccessCode: textCode, demoAccessCode: reviewerCode, allowTestProvider: true,
    fetch: async url => { calls++; assert.equal(f.admission.inspect().reservations.length, calls); assert.match(String(url), /max_session_duration_seconds=900/); return Response.json({ token: 'offline-test-token' }) }, ...options })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, f, () => calls) }
  finally { server.closeAllConnections(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); f.dispose() }
}

test('public access cannot mint, choose QA purpose, transplant cookies, or unlock reviewers before acceptance', async () => {
  await hosted(async (base, f, calls) => {
    const first = await mission(base), other = await mission(base)
    const anonymous = await (await request(base, '/api/access')).json()
    assert.equal(anonymous.authorized, false); assert.equal('allocation' in anonymous, false)
    assert.equal('allowedMode' in anonymous, false)
    assert.equal(anonymous.maxSessionSeconds, 900)
    const path = `/api/sessions/${first.view.sessionId}/voice-token`, body = { roundId: first.view.roundId, mode: 'voice' }
    assert.equal((await request(base, path, body, first.cookie)).status, 403)
    assert.equal((await request(base, '/api/access', { code: qaCode, purpose: 'reviewer' }, first.cookie)).status, 400)
    assert.equal((await request(base, '/api/access', { code: reviewerCode }, first.cookie)).status, 503)
    const access = await request(base, '/api/access', { code: qaCode }, first.cookie)
    assert.equal(access.status, 200)
    const status = await access.json()
    assert.equal(status.allocation.purpose, 'qa'); assert.equal(status.allocation.remaining, 8)
    assert.equal(status.allowedMode, 'voice')
    assert.equal(status.allocation.runtimeSha256, binding.runtimeSha256)
    const authorized = cookies(access, first.cookie)
    const transplanted = `${other.cookie}; ${authorized.split('; ').find(value => value.startsWith('tmh_live='))}`
    assert.equal((await (await request(base, '/api/access', undefined, transplanted)).json()).authorized, false)
    assert.equal((await (await request(base, '/api/access', undefined, authorized.replace('.qa.voice.', '.reviewer.voice.'))).json()).authorized, false)
    const response = await request(base, path, body, authorized, { 'x-tmh-purpose': 'reviewer' })
    assert.equal(response.status, 200)
    const issued = await response.json()
    assert.equal(issued.allocation.grantId, RELEASE_GRANT_ID); assert.equal(issued.allocation.purpose, 'qa')
    assert.equal(issued.allocation.reservedSeconds, 970); assert.equal(issued.maxSessionSeconds, 900)
    assert.equal('browserHash' in issued.allocation, false)
    assert.equal(response.headers.get('x-tmh-allocation-attempt'), '1')
    assert.equal(calls(), 1); assert.equal(f.admission.inspect().reservations[0]?.purpose, 'qa')
  })
})

test('parallel hosted token requests reserve exactly one slot before contacting the fake provider', async () => {
  await hosted(async (base, f, calls) => {
    const first = await mission(base)
    const access = await request(base, '/api/access', { code: qaCode }, first.cookie)
    const authorized = cookies(access, first.cookie)
    const second = await mission(base, authorized)
    const responses = await Promise.all([first, second].map(({ view }) => request(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId, mode: 'voice' }, authorized)))
    assert.deepEqual(responses.map(value => value.status).sort(), [200, 429])
    assert.equal(calls(), 1); assert.equal(f.admission.inspect().reservations.length, 1)
  })
})

test('normal code exchange classifies a Text diagnostic without a client-selected pool', async () => {
  await hosted(async (base, f) => {
    const first = await mission(base)
    const access = await request(base, '/api/access', { code: textCode }, first.cookie)
    const status = await access.json()
    assert.equal(status.allocation.mode, 'text'); assert.equal(status.allowedMode, 'text')
    assert.equal((await request(base, `/api/sessions/${first.view.sessionId}/voice-token`, { roundId: first.view.roundId, mode: 'text' }, cookies(access, first.cookie))).status, 200)
    assert.equal(f.admission.inspect().reservations[0]?.mode, 'text')
  })
})

for (const capability of [{ code: qaCode, mode: 'voice', wrongMode: 'text' }, { code: textCode, mode: 'text', wrongMode: 'voice' }]) {
  test(`a signed QA ${capability.mode} capability rejects omitted, forged, and mismatched transport modes before reservation`, async () => {
    await hosted(async (base, f, calls) => {
      const first = await mission(base)
      const access = await request(base, '/api/access', { code: capability.code }, first.cookie)
      const authorized = cookies(access, first.cookie)
      const path = `/api/sessions/${first.view.sessionId}/voice-token`
      const originalLedger = readFileSync(f.path)
      for (const [input, status] of [
        [{ roundId: first.view.roundId }, 400],
        [{ roundId: first.view.roundId, mode: 'invalid' }, 400],
        [{ roundId: first.view.roundId, mode: capability.wrongMode }, 403],
        [{ roundId: first.view.roundId, mode: capability.mode, purpose: 'reviewer' }, 400],
      ] as const) {
        const response = await request(base, path, input, authorized)
        assert.equal(response.status, status)
        assert.equal(response.headers.has('x-tmh-allocation-attempt'), false)
      }
      assert.equal(calls(), 0); assert.deepEqual(readFileSync(f.path), originalLedger)
      assert.equal((await request(base, path, { roundId: first.view.roundId, mode: capability.mode }, authorized)).status, 200)
      assert.equal(calls(), 1); assert.equal(f.admission.inspect().reservations[0]?.mode, capability.mode)
      assert.equal(f.admission.inspect().reservations[0]?.purpose, 'qa')
    })
  })
}

test('missing hosted accounting leaves Practice and health available without minting or initialization', async () => {
  await hosted(async (base, f, calls) => {
    assert.deepEqual(await (await request(base, '/api/health')).json(), { ok: true })
    await mission(base)
    assert.equal((await request(base, '/api/access', { code: qaCode })).status, 503)
    assert.equal(calls(), 0); assert.throws(() => readFileSync(f.path))
  }, {}, false)
})

test('accepted reviewer access consumes its own pool and a code refresh cannot reset two launches', async () => {
  await hosted(async (base, f) => {
    pair(f)
    const first = await mission(base)
    let access = await request(base, '/api/access', { code: reviewerCode }, first.cookie)
    assert.equal(access.status, 200)
    let authorized = cookies(access, first.cookie)
    for (let index = 0; index < 2; index++) {
      const current = await mission(base, authorized)
      const response = await request(base, `/api/sessions/${current.view.sessionId}/voice-token`, { roundId: current.view.roundId, mode: 'voice' }, authorized)
      assert.equal(response.status, 200); assert.equal((await response.json()).allocation.purpose, 'reviewer')
      f.advance()
      if (index === 0) { access = await request(base, '/api/access', { code: reviewerCode }, authorized); authorized = cookies(access, authorized) }
    }
    assert.equal((await request(base, '/api/access', { code: reviewerCode }, authorized)).status, 429)
    const state = await (await request(base, '/api/access', undefined, authorized)).json()
    assert.equal(state.allocation.visitRemaining, 0); assert.equal(state.allocation.remaining, 6)
    assert.equal(f.admission.inspect().reservations.filter(row => row.purpose === 'qa').length, 2)
  }, { publicLiveEnabled: true, fetch: async () => Response.json({ token: 'offline-test-token' }) })
})

for (const failure of [{ status: 402, body: { error: 'insufficient_credit' }, reason: 'provider_credit_refused' },
  { status: 401, body: { error: 'credential refused' }, reason: 'provider_credential_or_account_refused' },
  { status: 400, body: { message: 'workspace mismatch' }, reason: 'provider_credential_or_account_refused' }]) {
  test(`provider ${failure.status} ${failure.reason} is durably halted and does not disclose its response`, async () => {
    await hosted(async (base, f) => {
      const first = await mission(base)
      const access = await request(base, '/api/access', { code: qaCode }, first.cookie)
      const response = await request(base, `/api/sessions/${first.view.sessionId}/voice-token`, { roundId: first.view.roundId, mode: 'voice' }, cookies(access, first.cookie))
      assert.equal(response.status, 502); assert.equal(response.headers.get('x-tmh-allocation-attempt'), '1')
      assert.doesNotMatch(await response.text(), /offline-test-provider-credential|workspace mismatch|insufficient_credit/)
      assert.equal(new ReleaseAdmission(f.path, binding, f.now).inspect().halt?.reason, failure.reason)
      f.advance(); assert.equal(f.admission.status(qa).available, false)
    }, { fetch: async () => Response.json(failure.body, { status: failure.status }) })
  })
}

test('a non-account provider failure consumes the attempt without silently refunding or halting the pool', async () => {
  await hosted(async (base, f) => {
    const first = await mission(base)
    const access = await request(base, '/api/access', { code: qaCode }, first.cookie)
    const response = await request(base, `/api/sessions/${first.view.sessionId}/voice-token`, { roundId: first.view.roundId, mode: 'voice' }, cookies(access, first.cookie))
    assert.equal(response.status, 502); assert.equal(f.admission.inspect().reservations.length, 1)
    assert.equal(f.admission.inspect().halt, undefined)
    assert.equal(f.admission.status(qa).available, false)
    f.advance(); assert.equal(f.admission.status(qa).available, true)
  }, { fetch: async () => Response.json({ error: 'temporary failure' }, { status: 503 }) })
})

test('client refusal requires an issued owned connection, is idempotent, and never claims server-verified account evidence', async () => {
  await hosted(async (base, f) => {
    const first = await mission(base), other = await mission(base)
    const path = `/api/sessions/${first.view.sessionId}`
    const body = { roundId: first.view.roundId, reason: 'provider_credit_refused' }
    const access = await request(base, '/api/access', { code: qaCode }, first.cookie)
    const authorized = cookies(access, first.cookie)
    assert.equal((await request(base, `${path}/live-refusal`, body, authorized)).status, 403)
    assert.equal((await request(base, `${path}/voice-token`, { roundId: first.view.roundId, mode: 'voice' }, authorized)).status, 200)
    assert.equal((await request(base, `${path}/live-refusal`, body, other.cookie)).status, 404)
    assert.equal((await request(base, `${path}/live-refusal`, { ...body, reason: 'refund' }, authorized)).status, 400)
    assert.equal((await request(base, `${path}/live-refusal`, { ...body, purpose: 'reviewer' }, authorized)).status, 400)
    assert.equal((await request(base, `${path}/live-refusal`, { ...body, roundId: 'wrong-round' }, authorized)).status, 403)
    // Stop-only reports remain possible after the access cookie expires or is cleared.
    const response = await request(base, `${path}/live-refusal`, body, first.cookie)
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { stopped: true, source: 'client_report' })
    const bytes = readFileSync(f.path)
    assert.equal((await request(base, `${path}/live-refusal`, body, first.cookie)).status, 200)
    assert.deepEqual(readFileSync(f.path), bytes)
    const state = new ReleaseAdmission(f.path, binding, f.now).inspect()
    assert.equal(state.halt?.source, 'client_report'); assert.equal(state.reservations.length, 1)
    f.advance()
    assert.equal((await request(base, `${path}/live-refusal`, body, first.cookie)).status, 403)
    assert.equal(f.admission.status(qa).available, false); assert.equal(f.admission.status(reviewer).available, false)
  })
})

test('a protected reviewer can conservatively report a socket refusal without a QA credential', async () => {
  await hosted(async (base, f) => {
    pair(f)
    const first = await mission(base)
    const access = await request(base, '/api/access', { code: reviewerCode }, first.cookie)
    const authorized = cookies(access, first.cookie)
    const path = `/api/sessions/${first.view.sessionId}`
    assert.equal((await request(base, `${path}/voice-token`, { roundId: first.view.roundId, mode: 'voice' }, authorized)).status, 200)
    assert.equal((await request(base, `${path}/live-refusal`, { roundId: first.view.roundId, reason: 'provider_credential_or_account_refused' }, authorized)).status, 200)
    assert.equal(f.admission.inspect().halt?.source, 'client_report')
    assert.equal(f.admission.inspect().reservations.filter(row => row.purpose === 'reviewer').length, 1)
  }, { publicLiveEnabled: true, fetch: async () => Response.json({ token: 'offline-test-token' }) })
})

test('protected codes cannot be short or shared between purposes', () => {
  const f = fixture()
  try {
    const base = { production: true, allowedOrigins: [origin], releaseAdmission: f.admission, maxVoiceSessionSeconds: 900 }
    assert.throws(() => createGameServer({ ...base, qaAccessCode: qaCode, demoAccessCode: qaCode }), /distinct/)
    assert.throws(() => createGameServer({ ...base, qaAccessCode: 'short' }), /32 characters/)
  } finally { f.dispose() }
})
