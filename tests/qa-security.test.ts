import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { BrowserAccess } from '../game/server/browser-access.js'
import { initializeAllowance, LiveAdmission } from '../game/server/admission.js'
import { createGameServer } from '../game/server/http.js'

test('access grants expire exactly at the boundary and cannot survive a server restart', () => {
  let now = 1_800_000_000_000
  const code = 'offline-expiry-test-access-code'
  const access = new BrowserAccess(code, false, () => now)
  const headers = new Map<string, unknown>()
  const response = { getHeader: (name: string) => headers.get(name), setHeader: (name: string, value: unknown) => headers.set(name, value) } as unknown as ServerResponse
  access.exchange({ headers: {} } as IncomingMessage, response, { code })
  const cookie = (headers.get('set-cookie') as string[]).map(value => value.split(';')[0]).join('; ')
  const request = { headers: { cookie } } as IncomingMessage
  assert.equal(access.authorized(request), true)
  assert.equal(new BrowserAccess(code, false, () => now).authorized(request), false)
  now += 1_799_999
  assert.equal(access.authorized(request), true)
  now += 1
  assert.equal(access.authorized(request), false)
})

test('offline production denials do not call the provider or consume the throwaway allowance', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-qa-offline-'))
  const path = join(directory, 'allowance.jsonl')
  initializeAllowance(path, 1)
  const original = readFileSync(path, 'utf8')
  let calls = 0
  const code = 'offline-rejections-test-access-code'
  const allowedOrigins = ['http://127.0.0.1']
  // No transport can escape this process; counters must remain zero on every rejection.
  const server = createGameServer({ production: true, secureCookies: false, allowedOrigins, publicLiveEnabled: true, demoAccessCode: code,
    apiKey: 'offline-fake-key', allowTestProvider: true, admission: new LiveAdmission(path),
    fetch: (async () => { calls++; throw new Error('Offline fake provider should not be called') }) as typeof fetch,
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  allowedOrigins.push(base)
  const request = (route: string, body: unknown, cookie = '', origin = base) => fetch(base + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) })
  const jar = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  try {
    const created = await request('/api/sessions', { missionKind: 'rescue', scenario: 'classic' })
    assert.equal(created.status, 201)
    const owner = jar(created)
    const mission = await created.json()
    const route = `/api/sessions/${mission.sessionId}/voice-token`
    assert.equal((await request(route, { roundId: mission.roundId }, owner)).status, 403)
    assert.equal(calls, 0)
    for (const [body, expected] of [[{}, 400], [{ code: '' }, 403], [{ code: 'wrong' }, 403]] as const) {
      assert.equal((await request('/api/access', body, owner)).status, expected)
      assert.equal(calls, 0)
    }
    const access = await request('/api/access', { code }, owner)
    assert.equal(access.status, 200)
    const authorized = `${owner}; ${jar(access)}`
    assert.equal((await request(route, { roundId: mission.roundId }, authorized, 'http://other.example')).status, 403)
    assert.equal(calls, 0)
    const expired = authorized.replace(/(tmh_live=)\d+\./, (_match, prefix: string) => `${prefix}1000000000000.`)
    assert.equal((await request(route, { roundId: mission.roundId }, expired)).status, 403)
    assert.equal(calls, 0)
    assert.equal(readFileSync(path, 'utf8'), original)
    writeFileSync(path, '{broken-offline-ledger\n')
    const corrupt = await request(route, { roundId: mission.roundId }, authorized)
    assert.equal(corrupt.status, 503)
    assert.equal(calls, 0)
    assert.doesNotMatch(await corrupt.text(), /offline-fake-key|offline-rejections-test-access-code|allowance\.jsonl/)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    rmSync(directory, { recursive: true, force: true })
  }
})
