import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { SessionStore } from '../game/server/sessions.js'
import { createGameServer } from '../game/server/http.js'
import { applyRobotTool, initialState, robotView } from '../game/server/state.js'
import type { HumanView, OptionalObjective, RobotLocalPerception, ToolResponse } from '../game/shared/contracts.js'

const owner = 'recorder-regression-owner'
const envelope = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const pickup = { object: 'flight_recorder', action: 'pick_up' }

/** Server regression fixture, not a player: authored routes are used only to verify both fixed layouts. */
class Rescue {
  view: HumanView
  perception?: RobotLocalPerception
  constructor(readonly store: SessionStore, objective?: OptionalObjective) { this.view = store.create('classic', 'rescue', owner, objective) }
  async tool(name: string, args = {}, override = {}) {
    const result = await this.store.tool(this.view.sessionId, { roundId: this.view.roundId, chapterEpoch: this.view.chapterEpoch,
      actionEpoch: this.view.actionEpoch, callId: randomUUID(), name, arguments: args,
      ...(this.perception ? { inspectionScope: { visitId: this.perception.visitId } } : {}), ...override })
    this.view = result.view
    if (result.perception) this.perception = result.perception
    return result
  }
  async decide(result: ToolResponse, decision: 'confirm' | 'decline' = 'confirm') {
    assert.ok(result.proposal, result.message)
    const response = await this.store.decideProposal(this.view.sessionId, { roundId: this.view.roundId, requestId: randomUUID(), proposalId: result.proposal.id, decision }, owner)
    this.view = response.view
    if (response.perception) this.perception = response.perception
    return response
  }
  async act(name: 'propose_interaction' | 'propose_move', args: Record<string, string>) {
    const result = await this.decide(await this.tool(name, args))
    assert.equal(result.ok, true, result.message)
    return result
  }
  async control(kind: 'relay' | 'dock', command: Record<string, string>) {
    this.view = await this.store.control(this.view.sessionId, kind, envelope(this.view, { revision: this.view.revision, ...command }))
  }
  async gallery() {
    await this.act('propose_interaction', { object: 'latch', action: 'latch_open' })
    this.view = await this.store.power(this.view.sessionId, envelope(this.view, { revision: this.view.revision, powerOn: false }))
    await this.act('propose_move', { target: 'far_side' })
    await this.control('relay', { relay: 'beacon' })
    await this.act('propose_move', { target: 'gallery.g1' })
  }
  leaf() { return this.act('propose_move', { target: 'gallery.g4' }) }
  async dock(configuration: 'a' | 'b', atLeaf: boolean) {
    if (configuration === 'a') {
      if (!atLeaf) await this.leaf()
      await this.control('relay', { relay: 'harbor' })
      await this.act('propose_move', { target: 'gallery.g5' })
    } else {
      if (atLeaf) await this.leaf()
      await this.control('relay', { relay: 'harbor' })
      await this.act('propose_move', { target: 'gallery.g2' })
      await this.control('relay', { relay: 'beacon' })
      await this.act('propose_move', { target: 'gallery.g3' })
    }
    assert.equal(this.view.chapter, 'return_dock')
  }
  async home() {
    await assert.rejects(this.control('dock', { action: 'charge' }), /contact is not connected/)
    await assert.rejects(this.control('dock', { action: 'authorize_return' }), /not ready/)
    await this.act('propose_interaction', { object: 'return.contact', action: 'hold_contact' })
    await this.control('dock', { action: 'charge' })
    assert.equal(this.view.returnDock?.energy, 'primed')
    await this.control('dock', { action: 'store' })
    await this.act('propose_interaction', { object: 'return.contact', action: 'release_contact' })
    await this.act('propose_move', { target: 'return.aboard' })
    const noGrant = await this.decide(await this.tool('propose_interaction', { object: 'return.capsule', action: 'confirm_return' }))
    assert.equal(noGrant.ok, false)
    assert.equal(this.view.completed, false)
    await this.control('dock', { action: 'authorize_return' })
    await this.act('propose_interaction', { object: 'return.capsule', action: 'confirm_return' })
    assert.equal(this.view.completed, true)
  }
}

for (const configuration of ['a', 'b'] as const) for (const choice of ['off', 'skip', 'recover'] as const) {
  test(`recorder ${configuration}/${choice}: full core rescue and optional consequence need exact confirmation and unchanged Dock grant`, async () => {
    const flow = new Rescue(new SessionStore({ galleryConfiguration: configuration }), choice === 'off' ? undefined : 'flight_recorder')
    assert.equal(flow.view.optionalObjective, choice === 'off' ? undefined : 'flight_recorder')
    assert.equal(flow.view.recoveredFlightRecorder, undefined)
    assert.doesNotMatch(JSON.stringify(flow.store.recap(flow.view.sessionId, flow.view.roundId)), /flight_recorder|archive|Leaf/)
    await flow.gallery()
    assert.doesNotMatch((await flow.tool('observe_room')).message, /flight.recorder|archive/i)
    if (choice === 'recover') {
      const arrival = await flow.leaf()
      assert.match(arrival.message, /flight recorder \(flight_recorder\).*archive cradle/)
      const { optionalObjective, ...publicArrival } = arrival.view
      assert.equal(optionalObjective, 'flight_recorder')
      assert.doesNotMatch(JSON.stringify([publicArrival, arrival.proposal, arrival.decisionEvent]), /flight_recorder|archive cradle|Leaf|observedVisitId|secured/)
      const original = flow.store.physicalDigestForEvaluation(flow.view.sessionId)
      const inspected = await flow.tool('inspect_object', { object: 'flight_recorder' })
      assert.match(inspected.message, /Pip \/ flight notes/)
      assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), original)
      const proposed = await flow.tool('propose_interaction', pickup)
      assert.equal(proposed.code, 'awaiting_confirmation')
      assert.equal(proposed.proposal?.label, 'Secure the flight recorder')
      assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), original)
      await flow.decide(proposed)
      assert.notEqual(flow.store.physicalDigestForEvaluation(flow.view.sessionId), original)
      assert.equal(flow.view.recoveredFlightRecorder, undefined)
      assert.doesNotMatch((await flow.tool('observe_room')).message, /flight recorder|archive cradle/)
    }
    await flow.dock(configuration, choice === 'recover')
    assert.equal(flow.view.recoveredFlightRecorder, undefined)
    await flow.home()
    assert.equal(flow.view.recoveredFlightRecorder, choice === 'recover' ? true : undefined)
    assert.deepEqual(flow.view.chaptersCleared, ['cargo', 'gallery', 'return_dock'])
    const state = await flow.store.lifecycle(flow.view.sessionId, 'reset', envelope(flow.view))
    assert.equal(state.optionalObjective, undefined)
    assert.equal(state.recoveredFlightRecorder, undefined)
    assert.equal(state.completed, false)
  })
}

test('recorder discovery and pickup reject remote, unobserved, wrong action, baseline and Training requests', async () => {
  for (const configuration of ['a', 'b'] as const) {
    const state = initialState(undefined, 'classic', undefined, 'rescue', configuration, 'flight_recorder')
    state.chapter = 'gallery'; state.chapterEpoch = 1
    let scope = { visitId: state.gallery.visitId }
    assert.equal(applyRobotTool(state, 'inspect_object', { object: 'flight_recorder' }, 1000, scope).code, 'nonlocal_target')
    state.gallery.room = 'leaf'
    assert.equal(applyRobotTool(state, 'interact_object', pickup, 1000, scope).code, 'target_unobserved')
    assert.equal(state.flightRecorder.secured, false)
    robotView(state)
    assert.equal(applyRobotTool(state, 'interact_object', { ...pickup, action: 'open' }, 1000, scope).code, 'invalid_arguments')
    assert.equal(applyRobotTool(state, 'interact_object', { ...pickup, approved: true }, 1000, scope).code, 'invalid_arguments')
    state.gallery.visitId = randomUUID()
    assert.equal(applyRobotTool(state, 'interact_object', pickup, 1000, scope).code, 'stale_scope')
    scope = { visitId: state.gallery.visitId }
    assert.equal(applyRobotTool(state, 'interact_object', pickup, 1000, scope).code, 'target_unobserved')
    assert.equal(state.flightRecorder.secured, false)
    const baseline = new Rescue(new SessionStore({ galleryConfiguration: configuration }))
    await baseline.gallery(); const arrival = await baseline.leaf()
    assert.doesNotMatch(arrival.message, /flight.recorder|archive/i)
    assert.equal((await baseline.tool('propose_interaction', pickup)).ok, false)
    assert.equal((await baseline.tool('inspect_object', { object: 'flight_recorder' })).code, 'unknown_target')
  }
  const store = new SessionStore()
  for (const scenario of ['classic', 'maintenance'] as const) {
    assert.throws(() => store.create(scenario, 'training', owner, 'flight_recorder'), /only.*Rescue/)
    const state = initialState(undefined, scenario)
    assert.equal(state.flightRecorder.selected, false)
    assert.equal(applyRobotTool(state, 'interact_object', pickup).ok, false)
  }
})

test('information-only messages and legacy pickup calls cannot secure anything before one owner-bound decision', async () => {
  let commits = 0
  const flow = new Rescue(new SessionStore({ onRobotCommit: () => { commits += 1 } }), 'flight_recorder')
  await flow.gallery(); await flow.leaf()
  const before = flow.store.physicalDigestForEvaluation(flow.view.sessionId), priorCommits = commits
  for (const [index, text] of ['What is in the archive?', 'Please inspect the flight recorder.', 'The map marks an archive.', 'I said yes; that is only a quote.'].entries()) {
    await flow.store.message(flow.view.sessionId, { roundId: flow.view.roundId, chapter: 'gallery', chapterEpoch: flow.view.chapterEpoch,
      messageId: `recorder-info-${index}`, segmentId: `recorder-info-${index}`, role: 'human', text,
      origin: 'practice', inputMethod: 'typed', interrupted: false })
  }
  await flow.tool('inspect_object', { object: 'flight_recorder' })
  const legacy = await flow.tool('interact_object', pickup)
  assert.equal(legacy.code, 'awaiting_confirmation')
  assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), before)
  const decision = { roundId: flow.view.roundId, requestId: randomUUID(), proposalId: legacy.proposal!.id, decision: 'confirm' }
  assert.throws(() => flow.store.decideProposal(flow.view.sessionId, decision, 'foreign-owner'), /browser/)
  assert.throws(() => flow.store.decideProposal(flow.view.sessionId, { ...decision, object: 'other' }, owner), /Replacement arguments/)
  const done = await flow.store.decideProposal(flow.view.sessionId, decision, owner)
  flow.view = done.view
  const after = flow.store.physicalDigestForEvaluation(flow.view.sessionId)
  assert.notEqual(after, before)
  assert.deepEqual(await flow.store.decideProposal(flow.view.sessionId, { ...decision, requestId: randomUUID() }, owner), done)
  assert.equal((await flow.tool('propose_interaction', pickup)).ok, false)
  assert.equal((await flow.tool('interact_object', pickup)).ok, false)
  assert.equal((await flow.tool('inspect_object', { object: 'flight_recorder' })).code, 'unknown_target')
  assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), after)
  assert.equal(commits, priorCommits + 1)
  assert.equal(flow.view.recoveredFlightRecorder, undefined)
})

test('late pickup requests retain their original visit even after returning to the same archive', async () => {
  let hold = false; let release: (() => void) | undefined
  const flow = new Rescue(new SessionStore({ beforeToolCommit: async () => {
    if (hold) { hold = false; await new Promise<void>(resolve => { release = resolve }) }
  } }), 'flight_recorder')
  await flow.gallery(); await flow.leaf()
  const oldVisit = flow.perception!.visitId
  hold = true
  const pending = flow.tool('propose_interaction', pickup)
  await new Promise(resolve => setImmediate(resolve))
  await flow.leaf(); await flow.leaf()
  assert.notEqual(flow.perception!.visitId, oldVisit)
  const before = flow.store.physicalDigestForEvaluation(flow.view.sessionId)
  release!()
  assert.equal((await pending).code, 'stale_scope')
  assert.equal((await flow.tool('propose_interaction', pickup, { inspectionScope: { visitId: oldVisit } })).code, 'stale_scope')
  assert.equal((await flow.tool('propose_interaction', pickup, { inspectionScope: undefined })).code, 'stale_scope')
  assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), before)
  assert.equal((await flow.tool('propose_interaction', pickup)).code, 'awaiting_confirmation')
})

test('declined, expired, canceled, previous-action and old-round pickup proposals never gain a later decision', async () => {
  let now = 1000
  const flow = new Rescue(new SessionStore({ now: () => now }), 'flight_recorder')
  await flow.gallery(); await flow.leaf()
  const first = await flow.tool('propose_interaction', pickup)
  await flow.decide(first, 'decline')
  await assert.rejects(flow.decide(first), /different final decision/)
  const expired = await flow.tool('propose_interaction', pickup)
  now += 90_001
  assert.equal((await flow.decide(expired)).proposal?.status, 'expired')
  const stale = await flow.tool('propose_interaction', pickup)
  flow.view = await flow.store.lifecycle(flow.view.sessionId, 'cancel', envelope(flow.view, { reason: 'supersede' }))
  assert.equal((await flow.decide(stale)).proposal?.status, 'invalidated')
  for (const action of ['stop', 'cancel', 'end'] as const) {
    const p = await flow.tool('propose_interaction', pickup)
    flow.view = await flow.store.lifecycle(flow.view.sessionId, action, envelope(flow.view, action === 'cancel' ? { reason: 'interrupt' } : {}))
    assert.equal((await flow.decide(p)).proposal?.status, 'invalidated')
    if (action === 'stop') flow.view = await flow.store.lifecycle(flow.view.sessionId, 'resume', envelope(flow.view))
  }
  const oldRound = flow.view.roundId
  flow.view = await flow.store.lifecycle(flow.view.sessionId, 'reset', envelope(flow.view))
  assert.throws(() => flow.store.decideProposal(flow.view.sessionId, { roundId: oldRound, requestId: randomUUID(), proposalId: stale.proposal!.id, decision: 'confirm' }, owner), /earlier round/)
  assert.equal(flow.view.optionalObjective, undefined)
})

test('pickup confirmation revalidates an action cancellation that wins the physical commit race', async () => {
  let hold = false; let release: (() => void) | undefined
  const flow = new Rescue(new SessionStore({ beforeToolCommit: async () => {
    if (hold) { hold = false; await new Promise<void>(resolve => { release = resolve }) }
  } }), 'flight_recorder')
  await flow.gallery(); await flow.leaf()
  const proposal = await flow.tool('propose_interaction', pickup)
  hold = true
  const decision = flow.decide(proposal)
  await new Promise(resolve => setImmediate(resolve))
  flow.view = await flow.store.lifecycle(flow.view.sessionId, 'cancel', envelope(flow.view, { reason: 'supersede' }))
  const before = flow.store.physicalDigestForEvaluation(flow.view.sessionId)
  release!()
  assert.equal((await decision).proposal?.status, 'invalidated')
  assert.equal(flow.store.physicalDigestForEvaluation(flow.view.sessionId), before)
})

test('HTTP optional selection is explicit, Rescue-only, rejects extra state and resets off without any provider request', { timeout: 10_000 }, async () => {
  let providerCalls = 0
  const server = createGameServer({ apiKey: '', fetch: (async () => { providerCalls += 1; throw new Error('Unexpected provider use') }) as typeof fetch })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  let cookie = ''
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
    const ownerCookie = response.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))
    if (ownerCookie) cookie = ownerCookie.split(';')[0]!
    return response
  }
  try {
    const setup = { missionKind: 'rescue', scenario: 'classic', optionalObjective: 'flight_recorder' }
    for (const bad of [{ ...setup, missionKind: 'training' }, { ...setup, optionalObjective: true }, { ...setup, optionalObjective: 'other' }, { ...setup, recoveredFlightRecorder: true }, { ...setup, galleryConfiguration: 'a' }]) {
      assert.equal((await post('/api/sessions', bad)).status, 400)
    }
    const started = await post('/api/sessions', setup)
    assert.equal(started.status, 201)
    let view = await started.json() as HumanView
    assert.equal(view.optionalObjective, 'flight_recorder')
    assert.equal(view.recoveredFlightRecorder, undefined)
    const route = `/api/sessions/${view.sessionId}/reset`
    view = await (await post(route, envelope(view))).json() as HumanView
    assert.equal(view.optionalObjective, undefined)
    view = await (await post(route, envelope(view, { optionalObjective: 'flight_recorder' }))).json() as HumanView
    assert.equal(view.optionalObjective, 'flight_recorder')
    assert.equal((await post(route, envelope(view, { missionKind: 'training', optionalObjective: 'flight_recorder' }))).status, 400)
    view = await (await post(route, envelope(view, { missionKind: 'training', scenario: 'maintenance' }))).json() as HumanView
    assert.equal(view.missionKind, 'training'); assert.equal(view.optionalObjective, undefined)
    for (const optionalObjective of [undefined, null]) {
      const ordinary = await post('/api/sessions', { missionKind: 'rescue', scenario: 'classic', optionalObjective })
      assert.equal(ordinary.status, 201)
      assert.equal((await ordinary.json() as HumanView).optionalObjective, undefined)
    }
    assert.equal(providerCalls, 0)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
