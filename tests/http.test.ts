import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { HumanView, ToolResponse } from '../game/shared/contracts.js'
import { createGameServer } from '../game/server/http.js'

type TestServerOptions = Parameters<typeof createGameServer>[0]
async function withServer(callback: (base: string) => Promise<void>, options: TestServerOptions = {}) {
  const server = createGameServer({ apiKey: '', allowTestProvider: Boolean(options.fetch), ...options })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try { await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`) }
  finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

async function post(base: string, path: string, body: unknown, headers = {}) {
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
}
async function create(base: string): Promise<HumanView> {
  const response = await post(base, '/api/sessions', {})
  assert.equal(response.status, 201)
  return response.json() as Promise<HumanView>
}
const lifecycle = (view: HumanView) => ({ roundId: view.roundId, requestId: randomUUID() })
const tool = (view: HumanView, name: string, args: Record<string, unknown>) => ({ roundId: view.roundId, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args })

test('HTTP cooperative path uses separate routes and returns authoritative completion only', async () => {
  await withServer(async (base) => {
    let view = await create(base)
    const path = `/api/sessions/${view.sessionId}`
    assert.equal(view.completed, false)
    assert.doesNotMatch(JSON.stringify(view), /latch|conveyor|doorOpen|robotLocation/i)
    const observation = await (await post(base, `${path}/tools`, tool(view, 'observe_room', {}))).json() as ToolResponse
    assert.match(observation.message, /near-side safe platform/)
    const latched = await (await post(base, `${path}/tools`, tool(view, 'interact_object', { object: 'latch', action: 'latch_open' }))).json() as ToolResponse
    assert.equal(latched.ok, true)
    view = latched.view
    view = await (await post(base, `${path}/power`, { ...lifecycle(view), revision: view.revision, powerOn: false })).json() as HumanView
    assert.equal(view.completed, false)
    const crossed = await (await post(base, `${path}/tools`, tool(view, 'move_to', { target: 'far_side' }))).json() as ToolResponse
    assert.equal(crossed.ok, true)
    assert.equal(crossed.view.completed, true)
    assert.equal((await (await fetch(`${base}${path}`)).json()).completed, true)
  })
})

test('HTTP rejects forged roles, unknown sessions and unauthorized action sets', async () => {
  await withServer(async (base) => {
    const view = await create(base)
    const path = `/api/sessions/${view.sessionId}`
    assert.equal((await post(base, `${path}/power`, { ...lifecycle(view), revision: 0, powerOn: false, role: 'robot' })).status, 400)
    assert.equal((await post(base, `${path}/tools`, { ...tool(view, 'observe_room', {}), sessionId: 'other' })).status, 400)
    assert.equal((await post(base, '/api/sessions/unknown/tools', tool(view, 'observe_room', {}))).status, 404)
    const denied = await (await post(base, `${path}/tools`, tool(view, 'power', { powerOn: false }))).json() as ToolResponse
    assert.equal(denied.ok, false)
    assert.equal(denied.view.powerOn, true)
    assert.equal((await post(base, `${path}/human-move`, {})).status, 404)
  })
})

test('HTTP reset rejects old-round actions and restores safe human projection', async () => {
  await withServer(async (base) => {
    const view = await create(base)
    const path = `/api/sessions/${view.sessionId}`
    const reset = await (await post(base, `${path}/reset`, lifecycle(view))).json() as HumanView
    assert.notEqual(reset.roundId, view.roundId)
    assert.equal(reset.powerOn, true)
    assert.equal(reset.completed, false)
    assert.equal((await post(base, `${path}/tools`, tool(view, 'move_to', { target: 'far_side' }))).status, 409)
  })
})

test('HTTP rejects stale Power revisions and changed duplicate request payloads', async () => {
  await withServer(async (base) => {
    const view = await create(base)
    const path = `/api/sessions/${view.sessionId}/power`
    const request = { ...lifecycle(view), revision: 0, powerOn: false }
    const first = await (await post(base, path, request)).json()
    assert.deepEqual(await (await post(base, path, request)).json(), first)
    assert.equal((await post(base, path, { ...request, powerOn: true })).status, 409)
    assert.equal((await post(base, path, { ...lifecycle(view), revision: 0, powerOn: true })).status, 409)
  })
})

test('HTTP origin and host checks reject cross-site requests without exposing data', async () => {
  await withServer(async (base) => {
    assert.equal((await post(base, '/api/sessions', {}, { origin: 'https://untrusted.example' })).status, 403)
    const forgedHostStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${base}/api/sessions`, { method: 'POST', headers: { host: 'untrusted.example', 'content-type': 'application/json' } }, (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode!))
      })
      request.on('error', reject)
      request.end('{}')
    })
    assert.equal(forgedHostStatus, 403)
    assert.equal((await post(base, '/api/sessions', {}, { 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await post(base, '/api/sessions', {}, { origin: 'http://localhost:5173' })).status, 201)
  })
})

test('HTTP enforces JSON content, schema and bounded request size', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/sessions`, { method: 'POST', body: '{}' })).status, 415)
    assert.equal((await post(base, '/api/sessions', { role: 'robot' })).status, 400)
    assert.equal((await post(base, '/api/sessions', { text: 'x'.repeat(17_000) })).status, 413)
    assert.equal((await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400)
  })
})

test('missing credentials block Live explicitly while Mock state remains available', async () => {
  await withServer(async (base) => {
    const view = await create(base)
    const response = await post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /Mock \/ Simulation remains available/)
    assert.equal((await fetch(`${base}/api/sessions/${view.sessionId}`)).status, 200)
  })
})

test('token issuance uses documented independent expiry and duration limits and inline config', async () => {
  const sentinelKey = 'unit-test-server-only-key'
  let called = 0
  await withServer(async (base) => {
    const view = await create(base)
    const response = await post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const text = await response.text()
    assert.ok(!text.includes(sentinelKey))
    const data = JSON.parse(text)
    assert.equal(data.token, 'unit-test-temporary-token')
    assert.equal(data.maxSessionSeconds, 600)
    assert.equal(data.sessionConfig.agent_id, undefined)
    assert.equal(typeof data.sessionConfig.system_prompt, 'string')
    assert.equal(called, 1)
  }, {
    apiKey: sentinelKey,
    fetch: (async (input, init) => {
      called += 1
      const url = new URL(String(input))
      assert.equal(url.origin + url.pathname, 'https://agents.assemblyai.com/v1/token')
      assert.equal(url.searchParams.get('expires_in_seconds'), '60')
      assert.equal(url.searchParams.get('max_session_duration_seconds'), '600')
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${sentinelKey}`)
      return Response.json({ token: 'unit-test-temporary-token' })
    }) as typeof fetch,
  })
})

test('provider token errors are sanitized and never echo credentials or diagnostics', async () => {
  const sentinel = 'private-provider-diagnostic-test'
  await withServer(async (base) => {
    const view = await create(base)
    const response = await post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })
    assert.equal(response.status, 502)
    assert.ok(!(await response.text()).includes(sentinel))
  }, { apiKey: sentinel, fetch: (async () => new Response(sentinel, { status: 401 })) as typeof fetch })
})

test('token results from a reset or stopped round are rejected before reaching the browser', { timeout: 7000 }, async () => {
  let release!: () => void
  let arrived!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const called = new Promise<void>((resolve) => { arrived = resolve })
  await withServer(async (base) => {
    const view = await create(base)
    const pending = post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })
    // If issuance fails before entering the fake, fail with its actual response instead of hanging.
    try {
      await Promise.race([called, pending.then((response) => { throw new Error(`Token request ended before the fake provider: HTTP ${response.status}`) })])
      await post(base, `/api/sessions/${view.sessionId}/reset`, lifecycle(view))
    } finally { release() }
    const response = await pending
    assert.equal(response.status, 409)
    assert.ok(!(await response.text()).includes('unit-test-temporary-token'))
  }, {
    apiKey: 'unit-test-key',
    fetch: (async () => { arrived(); await gate; return Response.json({ token: 'unit-test-temporary-token' }) }) as typeof fetch,
  })
})

test('CI Live disable blocks ordinary connections while explicit injected fake transport remains testable', { timeout: 7000 }, async () => {
  const previous = process.env.GAME_DISABLE_LIVE
  process.env.GAME_DISABLE_LIVE = '1'
  let calls = 0
  const fakeFetch = (async () => { calls += 1; return Response.json({ token: 'unit-test-temporary-token' }) }) as typeof fetch
  try {
    assert.throws(() => createGameServer({ allowTestProvider: true }), /injected provider/)
    await withServer(async (base) => {
      const view = await create(base)
      assert.equal((await post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })).status, 503)
      assert.equal(calls, 0)
    }, { apiKey: 'unit-test-key', fetch: fakeFetch, allowTestProvider: false })
    await withServer(async (base) => {
      const view = await create(base)
      assert.equal((await post(base, `/api/sessions/${view.sessionId}/voice-token`, { roundId: view.roundId })).status, 200)
      assert.equal(calls, 1)
    }, { apiKey: 'unit-test-key', fetch: fakeFetch })
  } finally {
    if (previous === undefined) delete process.env.GAME_DISABLE_LIVE
    else process.env.GAME_DISABLE_LIVE = previous
  }
})

test('HTTP Maintenance setup hides the plate, exposes only an inspected module, and rejects profile selection', async () => {
  await withServer(async (base) => {
    assert.equal((await post(base, '/api/sessions', { scenario: 'maintenance', profile: 'crescent' })).status, 400)
    let view = await (await post(base, '/api/sessions', { scenario: 'maintenance' })).json() as HumanView
    assert.equal(view.scenario, 'maintenance')
    assert.doesNotMatch(JSON.stringify(view), /crescent|kite|selector|profile/i)
    const path = `/api/sessions/${view.sessionId}`
    const inspection = await (await post(base, `${path}/tools`, tool(view, 'inspect_object', { object: 'latch' }))).json() as ToolResponse
    const correct = inspection.message.includes('Crescent') ? 'anchor' : 'bridge'
    const neutral = await (await post(base, `${path}/tools`, tool(view, 'interact_object', { object: 'latch', action: 'latch_open' }))).json() as ToolResponse
    assert.equal(neutral.ok, false)
    const selected = await (await post(base, `${path}/tools`, tool(view, 'interact_object', { object: 'latch', action: `select_${correct}` }))).json() as ToolResponse
    view = selected.view
    const latched = await (await post(base, `${path}/tools`, tool(view, 'interact_object', { object: 'latch', action: 'latch_open' }))).json() as ToolResponse
    view = latched.view
    view = await (await post(base, `${path}/power`, { ...lifecycle(view), revision: view.revision, powerOn: false })).json() as HumanView
    const crossed = await (await post(base, `${path}/tools`, tool(view, 'move_to', { target: 'far_side' }))).json() as ToolResponse
    assert.equal(crossed.view.completed, true)
    const debrief = await (await fetch(`${base}${path}/record?roundId=${view.roundId}`)).json()
    assert.equal(debrief.debrief.timeline.at(-1).kind, 'completion')
  })
})

test('HTTP notebook, hint and recap routes remain round scoped and never export internal observations', async () => {
  await withServer(async (base) => {
    const view = await create(base)
    const path = `/api/sessions/${view.sessionId}`
    await post(base, `${path}/tools`, tool(view, 'observe_room', {}))
    const initial = await (await fetch(`${base}${path}/record?roundId=${view.roundId}`)).json()
    assert.deepEqual(initial.messages, [])
    assert.equal(initial.debrief, null)
    assert.doesNotMatch(JSON.stringify(initial), /Latch|Conveyor|near-side/)
    const communicated = { roundId: view.roundId, messageId: 'test:report', segmentId: 'practice:1', role: 'robot', text: 'I can see a lever.', origin: 'practice', inputMethod: 'robot', interrupted: false }
    assert.equal((await post(base, `${path}/messages`, communicated)).status, 200)
    const note = await (await post(base, `${path}/notebook`, { ...lifecycle(view), kind: 'report', messageId: communicated.messageId })).json()
    assert.equal(note.text, communicated.text)
    await post(base, `${path}/notebook`, { ...lifecycle(view), kind: 'note', text: 'PRIVATE_NOTE_ONLY' })
    assert.equal((await post(base, `${path}/hint`, { ...lifecycle(view), level: 1 })).status, 200)
    const recap = await (await fetch(`${base}${path}/recap?roundId=${view.roundId}`)).json()
    assert.match(recap.entries[0].text, /near-side/)
    assert.doesNotMatch(JSON.stringify(recap), /PRIVATE_NOTE_ONLY/)
    assert.equal((await fetch(`${base}${path}/recap`)).status, 400)
    assert.equal((await fetch(`${base}${path}/record?roundId=${view.roundId}&role=robot`)).status, 400)
    assert.equal((await post(base, `${path}/recap`, {})).status, 405)
    await post(base, `${path}/reset`, lifecycle(view))
    assert.equal((await fetch(`${base}${path}/recap?roundId=${view.roundId}`)).status, 409)
    assert.equal((await post(base, `${path}/messages`, communicated)).status, 409)
  })
})
