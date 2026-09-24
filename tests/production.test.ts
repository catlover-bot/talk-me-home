import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { initializeAllowance, LiveAdmission } from '../game/server/admission.js'
import { createGameServer } from '../game/server/http.js'
import type { HumanView } from '../game/shared/contracts.js'

const origin = 'https://demo.example'
const code = 'test-only-demo-access-code'
type Options = Parameters<typeof createGameServer>[0]

async function fixture(run: (base: string, directory: string) => Promise<void>, options: Options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-production-'))
  mkdirSync(join(directory, 'assets'))
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Talk Me Home</title>Rescue Mission')
  writeFileSync(join(directory, 'assets', 'game-AbCd1234.js'), 'document.title="Talk Me Home"')
  writeFileSync(join(directory, '.env'), 'STATIC_TEST_SECRET')
  const server = createGameServer({ production: true, allowedOrigins: [origin], staticDirectory: directory, apiKey: '', ...options })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, directory) }
  finally {
    server.closeAllConnections()
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    rmSync(directory, { recursive: true, force: true })
  }
}

async function request(base: string, path: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return new Promise<Response>((done, reject) => {
    const sent = httpRequest(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { host: 'demo.example', origin, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      signal: AbortSignal.timeout(5000),
    }, response => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(response.headers)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, item)
      const parts: Buffer[] = []
      response.on('data', chunk => parts.push(Buffer.from(chunk)))
      response.on('end', () => done(new Response(Buffer.concat(parts), { status: response.statusCode, headers })))
      response.on('error', reject)
    })
    sent.on('error', reject)
    sent.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
function cookies(response: Response, previous = ''): string {
  const jar = new Map(previous.split('; ').filter(Boolean).map(value => value.split('=') as [string, string]))
  for (const cookie of response.headers.getSetCookie()) {
    const [name, value] = cookie.split(';')[0]!.split('=')
    jar.set(name!, value!)
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}
async function mission(base: string, cookie?: string) {
  const response = await request(base, '/api/sessions', { missionKind: 'rescue', scenario: 'classic' }, cookie)
  assert.equal(response.status, 201)
  return { view: await response.json() as HumanView, cookie: cookies(response, cookie), response }
}

test('production serves the game build, safe asset types and health, with separate API errors', async () => {
  await fixture(async (base, directory) => {
    const page = await request(base, '/')
    assert.match(await page.text(), /Talk Me Home.*Rescue Mission/)
    assert.equal(page.headers.get('cache-control'), 'no-cache')
    assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/)
    const asset = await request(base, '/assets/game-AbCd1234.js')
    assert.match(asset.headers.get('content-type')!, /javascript/)
    assert.match(asset.headers.get('cache-control')!, /immutable/)
    assert.deepEqual(await (await request(base, '/api/health')).json(), { ok: true })
    for (const path of ['/api', '/api/unknown', '/.env', '/%2eenv', '/game/server/http.ts', '/docs/solution.md', '/.live-test-budget.json', '/assets/missing.js', '/assets/game-AbCd1234.js.map']) {
      const response = await request(base, path)
      assert.equal(response.status, 404, path)
      assert.match(response.headers.get('content-type')!, /application\/json/)
      assert.doesNotMatch(await response.text(), /STATIC_TEST_SECRET|<!doctype/)
    }
    for (const path of ['/api%2funknown', '/api%5cunknown', '/%2e%2e%2f.env']) {
      const response = await request(base, path)
      assert.equal(response.status, 400)
      assert.match(response.headers.get('content-type')!, /application\/json/)
    }
    const outside = join(directory, '..', `${directory.split(/[\\/]/).at(-1)}-outside.js`)
    writeFileSync(outside, 'STATIC_TEST_SECRET')
    try {
      symlinkSync(outside, join(directory, 'assets', 'escape.js'))
      assert.equal((await request(base, '/assets/escape.js')).status, 404)
    } finally { rmSync(outside) }
  })
})

test('production rejects unconfigured hosts and cross-origin API writes while title navigation works', async () => {
  assert.throws(() => createGameServer({ production: true }), /explicit game origins/)
  assert.throws(() => createGameServer({ production: true, allowedOrigins: ['*'] }), /explicit game origins/)
  await fixture(async base => {
    assert.equal((await request(base, '/api/sessions', {}, undefined, { origin: 'https://other.example' })).status, 403)
    assert.equal((await request(base, '/api/sessions', {}, undefined, { origin: '' })).status, 403)
    assert.equal((await request(base, '/api/health', undefined, undefined, { host: 'other.example' })).status, 403)
    assert.equal((await request(base, '/api/sessions', {}, undefined, { 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await request(base, '/', undefined, undefined, { 'sec-fetch-site': 'cross-site' })).status, 200)
  })
})

test('all deployed session reads, records, tools, mutations and token requests belong to their browser', async () => {
  await fixture(async base => {
    const first = await mission(base)
    const second = await mission(base)
    assert.match(first.response.headers.getSetCookie()[0]!, /HttpOnly; SameSite=Strict; Max-Age=7200; Secure/)
    const path = `/api/sessions/${first.view.sessionId}`
    assert.equal((await request(base, path, undefined, first.cookie)).status, 200)
    for (const cookie of [undefined, second.cookie]) {
      for (const suffix of ['', `/record?roundId=${first.view.roundId}`, `/recap?roundId=${first.view.roundId}`]) {
        assert.equal((await request(base, `${path}${suffix}`, undefined, cookie)).status, 404, suffix)
      }
      for (const action of ['power', 'relay', 'dock-control', 'annotations', 'tools', 'stop', 'resume', 'reset', 'end', 'cancel', 'voice-token', 'messages', 'notebook', 'hint']) {
        assert.equal((await request(base, `${path}/${action}`, {}, cookie)).status, 404, action)
      }
    }
    const status = await (await request(base, '/api/access')).json()
    assert.equal(status.liveEnabled, false)
    assert.equal(status.available, false)
    assert.equal((await request(base, `${path}/voice-token`, { roundId: first.view.roundId }, first.cookie)).status, 503)
  })
})

test('public Live requires explicit enablement and a browser-bound short-lived access exchange', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-allowance-'))
  const path = join(directory, 'allowance.jsonl')
  initializeAllowance(path, 2)
  let calls = 0
  try {
    await fixture(async base => {
      const first = await mission(base)
      const second = await mission(base)
      const tokenPath = `/api/sessions/${first.view.sessionId}/voice-token`
      const body = { roundId: first.view.roundId }
      assert.equal((await request(base, tokenPath, body, first.cookie)).status, 403)
      assert.equal((await request(base, '/api/access', { code: 'wrong' }, first.cookie)).status, 403)
      const exchange = await request(base, '/api/access', { code }, first.cookie)
      assert.equal(exchange.status, 200)
      assert.equal((await exchange.json()).authorized, true)
      assert.match(exchange.headers.getSetCookie()[0]!, /Max-Age=1800; Secure/)
      const authorized = cookies(exchange, first.cookie)
      assert.equal((await (await request(base, '/api/access', undefined, authorized)).json()).authorized, true)
      const transplanted = `${second.cookie}; ${authorized.split('; ').find(value => value.startsWith('tmh_live='))}`
      assert.equal((await (await request(base, '/api/access', undefined, transplanted)).json()).authorized, false)
      const response = await request(base, tokenPath, body, authorized)
      assert.equal(response.status, 200)
      const text = await response.text()
      assert.doesNotMatch(text, /test-only-server-key|test-only-demo-access-code/)
      assert.equal(JSON.parse(text).maxSessionSeconds, 600)
      assert.equal(calls, 1)
    }, { publicLiveEnabled: true, demoAccessCode: code, admission: new LiveAdmission(path), apiKey: 'test-only-server-key', allowTestProvider: true, fetch: (async () => { calls++; return Response.json({ token: 'test-only-temporary-token' }) }) as typeof fetch })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('a configured provider key alone never enables public Live', async () => {
  let calls = 0
  const transport = (async () => { calls++; return Response.json({ token: 'test-only-token' }) }) as typeof fetch
  for (const options of [
    { publicLiveEnabled: false, demoAccessCode: code, admission: new LiveAdmission('/absent') },
    { publicLiveEnabled: true, demoAccessCode: 'short', admission: new LiveAdmission('/absent') },
    { publicLiveEnabled: true, demoAccessCode: code },
  ]) await fixture(async base => {
    const created = await mission(base)
    assert.equal((await (await request(base, '/api/access', undefined, created.cookie)).json()).liveEnabled, false)
    assert.equal((await request(base, '/api/access', { code }, created.cookie)).status, 503)
    assert.equal((await request(base, `/api/sessions/${created.view.sessionId}/voice-token`, { roundId: created.view.roundId }, created.cookie)).status, 503)
  }, { ...options, apiKey: 'test-only-server-key', allowTestProvider: true, fetch: transport })
  assert.equal(calls, 0)
})

test('parallel token attempts reserve atomically; uncertain failures retain the full allowance across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-allowance-'))
  const path = join(directory, 'allowance.jsonl')
  initializeAllowance(path, 2)
  let now = Date.now()
  let calls = 0
  try {
    await fixture(async base => {
      const first = await mission(base)
      const exchange = await request(base, '/api/access', { code }, first.cookie)
      const authorized = cookies(exchange, first.cookie)
      const second = await mission(base, authorized)
      const responses = await Promise.all([first, second].map(value => request(base, `/api/sessions/${value.view.sessionId}/voice-token`, { roundId: value.view.roundId }, authorized)))
      assert.deepEqual(responses.map(value => value.status).sort(), [429, 502])
      assert.equal(calls, 1)
      // Even a failed token attempt holds the slot until all possible provider time ends.
      assert.equal(new LiveAdmission(path, 1, () => now).status().available, false)
      now += 670_001
      const restarted = new LiveAdmission(path, 1, () => now)
      assert.equal(restarted.status().available, true)
      restarted.reserve()
      now += 670_001
      const exhausted = new LiveAdmission(path, 1, () => now).status()
      assert.equal(exhausted.status, 429)
      assert.match(exhausted.message, /allowance has been used/)
      assert.equal(readFileSync(path, 'utf8').trim().split('\n').length, 3)
    }, { publicLiveEnabled: true, demoAccessCode: code, admission: new LiveAdmission(path, 1, () => now), apiKey: 'test-only-server-key', allowTestProvider: true, fetch: (async () => { calls++; throw new Error('PRIVATE_PROVIDER_DIAGNOSTIC') }) as typeof fetch })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('missing, corrupt and uncertain allowance files fail closed; initialization cannot reset an allowance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-allowance-'))
  const path = join(directory, 'allowance.jsonl')
  try {
    assert.equal(new LiveAdmission(path).status().status, 503)
    initializeAllowance(path, 1)
    assert.throws(() => initializeAllowance(path, 10))
    writeFileSync(path, '{"version":1,"allowanceSessions":2,"maxSessionSeconds":600}\n{"reservedAt":')
    assert.equal(new LiveAdmission(path).status().status, 503)
    assert.throws(() => new LiveAdmission(path).reserve(), /unavailable/)
    assert.throws(() => new LiveAdmission(path, 5), /between 1 and 4/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('access code rate limits are enforced without contacting the provider', async () => {
  await fixture(async base => {
    for (let count = 0; count < 20; count++) assert.equal((await request(base, '/api/access', { code: 'wrong' })).status, 403)
    const response = await request(base, '/api/access', { code })
    assert.equal(response.status, 429)
    assert.doesNotMatch(await response.text(), /test-only-demo-access-code/)
  }, { publicLiveEnabled: true, demoAccessCode: code, admission: new LiveAdmission('/deliberately-absent-test-allowance'), apiKey: 'test-only-server-key', allowTestProvider: true, fetch: (async () => { throw new Error('Provider must not be called') }) as typeof fetch })
})
