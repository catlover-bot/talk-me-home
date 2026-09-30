import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createGameServer } from '../game/server/http.js'
import { SessionStore } from '../game/server/sessions.js'
import { encodeRemixCode } from '../game/server/remix.js'
import type { HumanView, ToolResponse } from '../game/shared/contracts.js'
import { previewSwitchyardRouting, type SwitchyardRotations } from '../game/shared/switchyard.js'

const code = (profile = 0) => encodeRemixCode(profile, 0, 'lift_survey', 100)
const setup = (profile = 0) => ({ kind: 'replay' as const, code: code(profile) })
const owner = 'remix-owner'
const envelope = (view: HumanView) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID() })
const routing = (view: HumanView, rotations: SwitchyardRotations) => ({ ...envelope(view), revision: view.revision, panelRevision: view.switchyardPanel!.panelRevision, rotations })
const request = (view: HumanView, name: string, args = {}, visitId?: string) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch,
  callId: randomUUID(), name, arguments: args, ...(visitId ? { inspectionScope: { visitId } } : {}) })
const decision = (response: ToolResponse, choice = 'confirm') => ({ roundId: response.view.roundId, requestId: randomUUID(), proposalId: response.proposal!.id, decision: choice })

test('public geometry is a copied reference, never a mutable installation or client certificate', async () => {
  const store = new SessionStore()
  const view = store.create('classic', 'switchyard', owner, undefined, setup(32))
  const before = store.get(view.sessionId)
  const drawing = view.switchyardPanel!.specification! as unknown as { capacity: number; source: { pieceId: string } }
  drawing.capacity = 99; drawing.source.pieceId = 'forged'
  assert.deepEqual(store.get(view.sessionId), before)
  for (const extra of [{ certificate: {} }, { specification: drawing }, { panelRevision: -1 }]) {
    await assert.rejects(async () => store.panel(view.sessionId, { ...routing(before, before.switchyardPanel!.appliedRotations), ...extra }), { status: 400 })
  }
})

function firstBoard(view: HumanView, valid: boolean, changed = false): SwitchyardRotations {
  for (let value = 0; value < 4096; value++) {
    const layout = Array.from({ length: 6 }, (_, index) => (value >> index * 2) & 3) as SwitchyardRotations
    if (previewSwitchyardRouting(layout, view.switchyardPanel!.specification).valid === valid
      && (!changed || JSON.stringify(layout) !== JSON.stringify(view.switchyardPanel!.appliedRotations))) return layout
  }
  throw new Error('Expected a public routing class.')
}

test('all Remix schemas keep exact proposals, unchanged specs and no remote authority for drafts', async () => {
  for (const profile of [0, 12, 16, 28, 32, 44]) {
    const store = new SessionStore()
    let view = store.create('classic', 'switchyard', owner, undefined, setup(profile))
    const definition = JSON.stringify({ specification: view.switchyardPanel!.specification, schematic: view.switchyardPanel!.schematic,
      manual: view.switchyardPanel!.manual, dispatch: view.switchyardPanel!.dispatch })
    const unchanged = () => {
      const panel = store.get(view.sessionId).switchyardPanel!
      assert.equal(JSON.stringify({ specification: panel.specification, schematic: panel.schematic, manual: panel.manual, dispatch: panel.dispatch }), definition)
    }
    const seen = await store.tool(view.sessionId, request(view, 'observe_room'))
    const local = seen.switchyardObservation!
    const proposed = await store.tool(view.sessionId, request(view, 'propose_move', { target: local.exits[0]!.target }, local.visitId))
    assert.equal(proposed.code, 'awaiting_confirmation'); assert.equal(proposed.view.revision, view.revision)
    await assert.rejects(async () => store.decideProposal(view.sessionId, decision(proposed), 'another-owner'), { status: 404 })
    const declined = await store.decideProposal(view.sessionId, decision(proposed, 'decline'), owner)
    assert.equal(declined.proposal!.status, 'declined'); assert.equal(declined.view.revision, view.revision); unchanged()
    const fresh = await store.tool(view.sessionId, request(view, 'propose_move', { target: local.exits[0]!.target }, local.visitId))
    const confirm = decision(fresh)
    const committed = await store.decideProposal(view.sessionId, confirm, owner)
    assert.equal(committed.proposal!.status, 'committed'); view = committed.view
    assert.deepEqual(await store.decideProposal(view.sessionId, confirm, owner), committed)
    const oldVisit = await store.tool(view.sessionId, request(view, 'inspect_object', { object: 'switchyard.directory' }, local.visitId))
    assert.equal(oldVisit.code, 'stale_scope'); unchanged()
    const before = store.get(view.sessionId)
    await assert.rejects(async () => store.panel(view.sessionId, { ...routing(view, firstBoard(view, true)), topology: {} }), { status: 400 })
    await assert.rejects(async () => store.panel(view.sessionId, routing(view, firstBoard(view, false))), { status: 400 })
    assert.deepEqual(store.get(view.sessionId), before); unchanged()
    view = await store.panel(view.sessionId, routing(view, firstBoard(view, true, true))); unchanged()
    await assert.rejects(async () => store.panel(view.sessionId, routing(before, firstBoard(before, true))), { status: 409 })
    for (const level of [1, 2, 3]) {
      await store.hint(view.sessionId, { ...envelope(view), level }); unchanged()
    }
    view = await store.lifecycle(view.sessionId, 'stop', envelope(view)); unchanged()
    view = await store.lifecycle(view.sessionId, 'resume', envelope(view)); unchanged()
    assert.equal(JSON.stringify(store.recap(view.sessionId, view.roundId)).includes(code(profile)), false)
    assert.equal(view.switchyardPanel!.journey, undefined)
    for (const hidden of ['profileIndex', 'installation', 'narrativeSeed', 'liftRow', 'serviceRow', 'procedure', 'layout', 'liftIndex', 'liftTested', 'bridgeDeployed', 'turntableAligned']) {
      assert(!Object.hasOwn(view.switchyardPanel!, hidden), `${hidden} must not be projected`)
    }
    const oldRound = view
    view = await store.lifecycle(view.sessionId, 'reset', { ...envelope(view), missionKind: 'switchyard', scenario: 'classic', remix: setup(profile) })
    assert.notEqual(view.roundId, oldRound.roundId); assert.equal(view.completed, false); assert.equal(view.revision, 0)
    unchanged(); assert.deepEqual(store.record(view.sessionId, view.roundId).notebook, [])
    await assert.rejects(async () => store.panel(view.sessionId, routing(oldRound, firstBoard(oldRound, true))), { status: 409 })
  }
})

test('Remix Apply racing confirmation checks the live panel and delayed work cannot reroll', async () => {
  let release: (() => void) | undefined
  let gate: Promise<void> | undefined
  const store = new SessionStore({ beforeToolCommit: async () => { await gate } })
  let view = store.create('classic', 'switchyard', owner, undefined, setup(44))
  const observation = await store.tool(view.sessionId, request(view, 'observe_room'))
  const local = observation.switchyardObservation!
  // beforeToolCommit protects physical commits; proposal creation remains immediate.
  const proposed = await store.tool(view.sessionId, request(view, 'propose_move', { target: local.exits[0]!.target }, local.visitId))
  gate = new Promise<void>(resolve => { release = resolve })
  const pending = store.decideProposal(view.sessionId, decision(proposed), owner)
  await Promise.resolve(); await Promise.resolve()
  view = await store.panel(view.sessionId, routing(view, firstBoard(view, true, true)))
  release!()
  const result = await pending
  assert.equal(result.ok, false); assert.notEqual(result.proposal!.status, 'committed')
  assert.equal(result.view.switchyardPanel!.dispatch!.code, code(44))
})

test('HTTP exposes only bounded dispatch selection and daily metadata, with no token/provider work', async () => {
  let providerRequests = 0
  const server = createGameServer({ apiKey: '', fetch: async () => { providerRequests++; throw new Error('Provider use is forbidden') } })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  let cookie = ''
  const post = async (path: string, input: unknown) => {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(input) })
    const ownerCookie = response.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))
    if (ownerCookie) cookie = ownerCookie.split(';')[0]!
    return response
  }
  try {
    const available = await (await fetch(origin + '/api/remix')).json()
    assert.equal(available.available, true); assert.match(available.daily.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal((await fetch(origin + '/api/remix?profile=1')).status, 400)
    for (const kind of ['rescue', 'training']) assert.equal((await post('/api/sessions', { missionKind: kind, scenario: 'classic', remix: setup() })).status, 400)
    for (const extra of [{ configuration: 'a' }, { certificate: true }, { profileIndex: 1 }, { initialRotations: [0, 0, 0, 0, 0, 0] }]) {
      assert.equal((await post('/api/sessions', { missionKind: 'switchyard', scenario: 'classic', remix: { ...setup(), ...extra } })).status, 400)
    }
    const response = await post('/api/sessions', { missionKind: 'switchyard', scenario: 'classic', remix: setup() })
    assert.equal(response.status, 201)
    const view = await response.json() as HumanView
    assert.equal(view.switchyardPanel!.dispatch!.code, code()); assert.equal(view.completed, false)
    const replay = await post(`/api/sessions/${view.sessionId}/reset`, { ...envelope(view), missionKind: 'switchyard', scenario: 'classic', remix: setup() })
    assert.equal(replay.status, 200); assert.notEqual((await replay.json()).roundId, view.roundId)
    assert.equal(providerRequests, 0)
  } finally {
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
