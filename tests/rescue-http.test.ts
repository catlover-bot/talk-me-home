import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { HumanView, MissionRecord, RobotRecap, ToolResponse } from '../game/shared/contracts.js'
import { createGameServer } from '../game/server/http.js'
import { SessionStore } from '../game/server/sessions.js'
const ownerCookies = new Map<string, string>()

async function withRescue(configuration: 'a' | 'b', callback: (base: string) => Promise<void>) {
  let providerCalls = 0
  const server = createGameServer({
    store: new SessionStore({ galleryConfiguration: configuration }), apiKey: '',
    fetch: (async () => { providerCalls += 1; throw new Error('No provider request belongs in this test.') }) as typeof fetch,
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    assert.equal(providerCalls, 0)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

const post = async (base: string, path: string, body: unknown) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: ownerCookies.get(base) ?? '' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
  const owner = response.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))
  if (owner) ownerCookies.set(base, owner.split(';')[0]!)
  return response
}
const path = (view: HumanView, action: string) => `/api/sessions/${view.sessionId}/${action}`
const envelope = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const tool = (view: HumanView, name: string, args: Record<string, unknown>) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args })
async function create(base: string) {
  const response = await post(base, '/api/sessions', { missionKind: 'rescue', scenario: 'classic' })
  assert.equal(response.status, 201)
  return response.json() as Promise<HumanView>
}
async function act(base: string, view: HumanView, name: string, args: Record<string, unknown>, ok = true) {
  const response = await post(base, path(view, 'tools'), tool(view, name, args))
  assert.equal(response.status, 200)
  let result = await response.json() as ToolResponse
  if (result.code === 'awaiting_confirmation') result = await (await post(base, path(view, 'proposal-decision'), {
    roundId: view.roundId, requestId: randomUUID(), proposalId: result.proposal!.id, decision: 'confirm',
  })).json() as ToolResponse
  assert.equal(result.ok, ok, result.message)
  return result.view
}
async function control(base: string, view: HumanView, route: string, command: Record<string, unknown>) {
  const response = await post(base, path(view, route), envelope(view, { revision: view.revision, ...command }))
  assert.equal(response.status, 200)
  return response.json() as Promise<HumanView>
}
async function gallery(base: string, start = create(base)) {
  let view = await start
  view = await act(base, view, 'interact_object', { object: 'latch', action: 'latch_open' })
  view = await control(base, view, 'power', { powerOn: false })
  return act(base, view, 'move_to', { target: 'far_side' })
}
async function record<T = MissionRecord>(base: string, view: HumanView, action = 'record'): Promise<T> {
  const response = await fetch(`${base}${path(view, action)}?roundId=${view.roundId}`, { headers: { cookie: ownerCookies.get(base) ?? '' }, signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, 200)
  return response.json() as Promise<T>
}

for (const configuration of ['a', 'b'] as const) {
  test(`HTTP Rescue ${configuration}: one round crosses two nonterminal checkpoints and returns only with both authorizations`, { timeout: 10_000 }, async () => {
    await withRescue(configuration, async base => {
      let view = await gallery(base)
      const roundId = view.roundId
      assert.equal(view.chapter, 'gallery'); assert.equal(view.chapterEpoch, 1); assert.equal(view.completed, false)
      assert.equal((await record(base, view)).debrief, null)
      assert.doesNotMatch(JSON.stringify(view), /configuration|gallery\.g|contactHeld|"room"|"location"/)
      view = await control(base, view, 'relay', { relay: 'beacon' })
      view = await act(base, view, 'move_to', { target: 'gallery.g1' })
      if (configuration === 'a') view = await act(base, view, 'move_to', { target: 'gallery.g4' })
      else {
        view = await control(base, view, 'relay', { relay: 'harbor' })
        view = await act(base, view, 'move_to', { target: 'gallery.g2' })
      }
      view = await control(base, view, 'relay', { relay: configuration === 'a' ? 'harbor' : 'beacon' })
      view = await act(base, view, 'move_to', { target: configuration === 'a' ? 'gallery.g5' : 'gallery.g3' })
      assert.equal(view.chapter, 'return_dock'); assert.equal(view.chapterEpoch, 2); assert.equal(view.completed, false)
      assert.deepEqual(view.chaptersCleared, ['cargo', 'gallery']); assert.equal((await record(base, view)).debrief, null)
      assert.deepEqual(view.returnDock, { energy: 'empty', readyForReturn: false, returnAuthorized: false })
      assert.equal((await post(base, path(view, 'dock-control'), envelope(view, { revision: view.revision, action: 'authorize_return' }))).status, 409)
      view = await act(base, view, 'interact_object', { object: 'return.contact', action: 'hold_contact' })
      view = await control(base, view, 'dock-control', { action: 'charge' })
      view = await control(base, view, 'dock-control', { action: 'store' })
      view = await act(base, view, 'move_to', { target: 'return.aboard' }, false)
      view = await act(base, view, 'interact_object', { object: 'return.contact', action: 'release_contact' })
      view = await act(base, view, 'move_to', { target: 'return.aboard' })
      view = await act(base, view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' }, false)
      view = await control(base, view, 'dock-control', { action: 'authorize_return' })
      assert.equal(view.completed, false)
      const confirm = tool(view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' })
      const proposed = await (await post(base, path(view, 'tools'), confirm)).json() as ToolResponse
      assert.equal(proposed.view.completed, false)
      const approval = { roundId: view.roundId, requestId: randomUUID(), proposalId: proposed.proposal!.id, decision: 'confirm' }
      const result = await (await post(base, path(view, 'proposal-decision'), approval)).json() as ToolResponse
      assert.equal(result.view.completed, true); assert.equal(result.view.roundId, roundId)
      assert.deepEqual(await (await post(base, path(view, 'tools'), confirm)).json(), proposed)
      assert.deepEqual(await (await post(base, path(view, 'proposal-decision'), approval)).json(), result)
      const timeline = (await record(base, result.view)).debrief!.timeline
      assert.equal(timeline.filter(event => event.kind === 'checkpoint').length, 2)
      assert.equal(timeline.filter(event => event.kind === 'completion').length, 1)
      assert.equal(timeline.at(-1)!.chapter, 'return_dock')
    })
  })
}

test('HTTP Rescue selection, chapter generations and actor-bound controls reject forged fields without revealing profiles', async () => {
  await withRescue('a', async base => {
    for (const setup of [{ missionKind: 'rescue', scenario: 'maintenance' },
      { missionKind: 'rescue', scenario: 'classic', galleryConfiguration: 'a' },
      { missionKind: 'rescue', scenario: 'classic', chapter: 'return_dock' }]) {
      assert.equal((await post(base, '/api/sessions', setup)).status, 400)
    }
    const start = await create(base), view = await gallery(base, Promise.resolve(start))
    for (const route of ['relay', 'dock-control']) {
      const command = route === 'relay' ? { relay: 'beacon' } : { action: 'charge' }
      assert.equal((await post(base, path(view, route), envelope(view, { revision: view.revision, ...command, role: 'robot' }))).status, 400)
      assert.equal((await post(base, path(view, route), envelope(start, { revision: view.revision, ...command }))).status, 409)
    }
    assert.equal((await post(base, path(view, 'tools'), { ...tool(view, 'observe_room', {}), chapterEpoch: undefined })).status, 400)
    assert.equal((await post(base, path(view, 'tools'), tool(start, 'observe_room', {}))).status, 409)
    const invalid = await (await post(base, path(view, 'tools'), tool(view, 'inspect_object', { object: 'gallery.g5' }))).json() as ToolResponse
    assert.equal(invalid.ok, false); assert.doesNotMatch(invalid.message, /Leaf|Sail|Harbor|Beacon|configuration|blocked/i)
    const stopped = await (await post(base, path(view, 'stop'), envelope(start))).json() as HumanView
    assert.equal(stopped.status, 'stopped'); assert.equal(stopped.chapter, 'gallery')
    assert.equal((await post(base, path(stopped, 'cancel'), envelope(stopped, { reason: ['supersede'] }))).status, 400)
  })
})

test('HTTP Rescue annotations and hints remain private while historical captions preserve their original chapter', async () => {
  await withRescue('b', async base => {
    const start = await create(base), view = await gallery(base, Promise.resolve(start))
    await act(base, view, 'observe_room', {})
    const annotation = envelope(view, { kind: 'location', target: 'sail' })
    assert.equal((await post(base, path(view, 'annotations'), annotation)).status, 200)
    assert.equal((await post(base, path(view, 'annotations'), { ...annotation, target: 'leaf' })).status, 409)
    assert.equal((await post(base, path(view, 'annotations'), envelope(view, { kind: 'blocked_gate', target: 'g3', marked: true }))).status, 200)
    assert.equal((await post(base, path(view, 'annotations'), envelope(view, { kind: 'location', target: ['fork'] }))).status, 400)
    assert.equal((await post(base, path(view, 'hint'), envelope(view, { level: 3 }))).status, 200)
    assert.equal((await post(base, path(view, 'notebook'), envelope(view, { kind: 'note', text: 'PRIVATE_ROUTE_NOTE' }))).status, 200)
    const historical = { roundId: view.roundId, chapter: start.chapter, chapterEpoch: start.chapterEpoch,
      messageId: 'late:caption', segmentId: 'practice:chapter-test', role: 'human', text: 'I switched Power off.',
      inputMethod: 'typed', origin: 'practice', interrupted: false }
    assert.equal((await post(base, path(view, 'messages'), historical)).status, 200)
    assert.equal((await post(base, path(view, 'messages'), { ...historical, chapter: view.chapter, chapterEpoch: view.chapterEpoch })).status, 409)
    assert.equal((await post(base, path(view, 'messages'), { ...historical, messageId: 'future:caption', chapter: 'return_dock', chapterEpoch: 2 })).status, 400)
    const publicRecord = await record(base, view)
    assert.deepEqual(publicRecord.annotations, { chapter: 'gallery', location: 'sail', blockedGates: ['g3'], plannedGates: [], exploredGates: [], reportLinks: [] })
    assert.equal(publicRecord.debrief, null)
    const recap = await record<RobotRecap>(base, view, 'recap'), serialized = JSON.stringify(recap)
    assert.doesNotMatch(serialized, /PRIVATE_ROUTE_NOTE|suspected|blockedGates|"location"|Either service bay/)
    const quote = recap.entries.find(entry => entry.kind === 'player_quote')!
    assert.equal(quote.chapter, 'cargo'); assert.equal(quote.chapterEpoch, 0)
    const reset = await (await post(base, path(view, 'reset'), envelope(view, { missionKind: 'training', scenario: 'maintenance' }))).json() as HumanView
    assert.equal(reset.missionKind, 'training'); assert.equal(reset.scenario, 'maintenance'); assert.equal(reset.chapterEpoch, 0)
    assert.deepEqual((await record(base, reset)).annotations, { chapter: 'gallery', location: null, blockedGates: [], plannedGates: [], exploredGates: [], reportLinks: [] })
    assert.equal((await post(base, path(reset, 'annotations'), annotation)).status, 409)
    assert.equal((await post(base, path(reset, 'messages'), historical)).status, 409)
  })
})
