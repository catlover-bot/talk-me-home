import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { SessionStore } from '../game/server/sessions.js'
import { createGameServer } from '../game/server/http.js'
import type { HumanView, ToolResponse } from '../game/shared/contracts.js'
import { previewSwitchyardRouting, type SwitchyardRotations } from '../game/shared/switchyard.js'

const owner = 'switchyard-owner'
const envelope = (view: HumanView) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID() })
const panel = (view: HumanView, rotations: unknown = [0, 0, 0, 0, 0, 0]) => ({ ...envelope(view), revision: view.revision, panelRevision: view.switchyardPanel!.panelRevision, rotations })
const decision = (result: ToolResponse, choice = 'confirm') => ({ roundId: result.view.roundId, requestId: randomUUID(), proposalId: result.proposal!.id, decision: choice })
const request = (view: HumanView, name: string, args: Record<string, unknown> = {}, visitId?: string) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args, ...(visitId ? { inspectionScope: { visitId } } : {}) })
const rejects = (operation: () => unknown, status: number) => assert.rejects(async () => operation(), { status })

function player(options: ConstructorParameters<typeof SessionStore>[0] = {}) {
  const store = new SessionStore({ switchyardConfiguration: 'a', ...options })
  let view = store.create('classic', 'switchyard', owner)
  let visit: string | undefined
  const accept = (result: ToolResponse) => { view = result.view; if (result.switchyardObservation) visit = result.switchyardObservation.visitId; return result }
  const tool = async (name: string, args: Record<string, unknown> = {}) => accept(await store.tool(view.sessionId, request(view, name, args, visit)))
  const decide = async (result: ToolResponse, choice = 'confirm') => accept(await store.decideProposal(view.sessionId, decision(result, choice), owner))
  const move = async (target: string) => { const proposed = await tool('propose_move', { target }); assert.equal(proposed.code, 'awaiting_confirmation'); const result = await decide(proposed); assert.equal(result.ok, true, result.message); return result }
  const inspect = (object: string) => tool('inspect_object', { object })
  const interact = async (object: string, action: string) => { const proposed = await tool('propose_interaction', { object, action }); assert.equal(proposed.code, 'awaiting_confirmation'); return decide(proposed) }
  return { store, tool, decide, move, inspect, interact, get view() { return view }, get visit() { return visit },
    apply: async (rotations: SwitchyardRotations) => { view = await store.panel(view.sessionId, panel(view, rotations)); return view },
    lifecycle: async (action: 'stop' | 'resume' | 'cancel' | 'reset', extra = {}) => { view = await store.lifecycle(view.sessionId, action, { ...envelope(view), ...extra }); return view } }
}

// Test-only exhaustive representatives: production code never searches for a layout or imports these fixtures.
const layouts = new Map<string, SwitchyardRotations>()
for (let encoded = 0; encoded < 4096; encoded += 1) {
  const rotations = Array.from({ length: 6 }, (_, index) => (encoded >> index * 2) & 3) as SwitchyardRotations
  const preview = previewSwitchyardRouting(rotations)
  if (preview.valid && !layouts.has(preview.poweredTerminals.join(','))) layouts.set(preview.poweredTerminals.join(','), rotations)
}

test('Switchyard physical digest covers routing and confirmed movement, never discovery or pending proposals', async () => {
  const p = player()
  const initial = p.store.physicalDigestForEvaluation(p.view.sessionId)
  await p.tool('observe_room')
  await p.inspect('switchyard.directory')
  assert.equal(p.store.physicalDigestForEvaluation(p.view.sessionId), initial)
  const proposal = await p.tool('move_to', { target: 'switchyard.to_transfer' })
  assert.equal(p.store.physicalDigestForEvaluation(p.view.sessionId), initial)
  await p.decide(proposal)
  const moved = p.store.physicalDigestForEvaluation(p.view.sessionId)
  assert.notEqual(moved, initial)
  await p.apply(layouts.get('amber')!)
  assert.notEqual(p.store.physicalDigestForEvaluation(p.view.sessionId), moved)
})

test('Switchyard exact owner decision is required; decline and duplicate confirms cannot execute extra moves', async () => {
  let commits = 0
  const p = player({ onRobotCommit: () => { commits += 1 } })
  await p.tool('observe_room')
  const denied = await p.tool('propose_move', { target: 'switchyard.to_service' })
  assert.equal(denied.ok, false)
  const pending = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  assert.equal(pending.code, 'awaiting_confirmation')
  await rejects(() => p.store.decideProposal(p.view.sessionId, decision(pending), 'other-owner'), 404)
  await rejects(() => p.store.decideProposal(p.view.sessionId, { ...decision(pending), arguments: { target: 'switchyard.to_service' } }, owner), 400)
  const declined = await p.decide(pending, 'decline')
  assert.equal(declined.proposal?.status, 'declined'); assert.equal(commits, 0)
  const fresh = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  assert.notEqual(fresh.proposal?.id, pending.proposal?.id)
  const payload = decision(fresh)
  const [first, duplicate] = await Promise.all([p.store.decideProposal(p.view.sessionId, payload, owner), p.store.decideProposal(p.view.sessionId, payload, owner)])
  assert.deepEqual(first, duplicate); assert.equal(first.proposal?.status, 'committed'); assert.equal(commits, 1)
  const later = await p.store.decideProposal(p.view.sessionId, { ...payload, requestId: randomUUID() }, owner)
  assert.deepEqual(first, later); assert.equal(commits, 1)
  await rejects(() => p.store.decideProposal(p.view.sessionId, { ...payload, requestId: randomUUID(), decision: 'decline' }, owner), 409)
})

test('superseding speech preserves the exact pending Switchyard confirmation while canceling queued work', async () => {
  const p = player()
  await p.tool('observe_room')
  const pending = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  const queuedEnvelope = request(p.view, 'inspect_object', { object: 'switchyard.directory' }, p.visit)
  const oldEpoch = p.view.actionEpoch
  await p.lifecycle('cancel', { reason: 'supersede' })
  assert.equal(p.view.actionEpoch, oldEpoch + 1)
  assert.equal(p.view.proposal?.status, 'awaiting_confirmation')
  assert.equal((await p.store.tool(p.view.sessionId, queuedEnvelope)).code, 'cancelled_before_execution')
  assert.equal((await p.decide(pending)).proposal?.status, 'committed')
})

test('routing edits and Pause invalidate proposals; unchanged Apply does not, and Resume cannot revive one', async () => {
  const p = player()
  await p.tool('observe_room')
  const pending = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  await p.apply(p.view.switchyardPanel!.appliedRotations)
  assert.equal(p.view.proposal?.status, 'awaiting_confirmation')
  const samePowerDifferentBoard = layouts.get('')!
  assert.notDeepEqual(samePowerDifferentBoard, p.view.switchyardPanel!.appliedRotations)
  assert.deepEqual(previewSwitchyardRouting(samePowerDifferentBoard).poweredTerminals, p.view.switchyardPanel!.poweredTerminals)
  await p.apply(samePowerDifferentBoard)
  assert.equal(p.view.proposal?.status, 'invalidated')
  assert.equal((await p.decide(pending)).ok, false)
  const fresh = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  await p.lifecycle('stop')
  assert.equal(p.view.proposal?.status, 'invalidated')
  await rejects(() => p.store.panel(p.view.sessionId, panel(p.view)), 409)
  await p.lifecycle('resume')
  assert.equal((await p.decide(fresh)).ok, false)
  const unresumed = p.store.get(p.view.sessionId)
  assert.equal(unresumed.completed, false)
})

test('panel endpoint validates exact shape, capacity, round and both revisions and retains retry identity', async () => {
  const p = player()
  const initial = p.view
  for (const malformed of [[0, 0], [0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0.5], { p1: 0 }, null]) {
    await rejects(() => p.store.panel(initial.sessionId, panel(initial, malformed)), 400)
  }
  await rejects(() => p.store.panel(initial.sessionId, { ...panel(initial), configuration: 'b' }), 400)
  await rejects(() => p.store.panel(initial.sessionId, { ...panel(initial), roundId: 'old' }), 409)
  await rejects(() => p.store.panel(initial.sessionId, { ...panel(initial), chapterEpoch: 3 }), 409)
  await rejects(() => p.store.panel(initial.sessionId, { ...panel(initial), revision: 1 }), 409)
  await rejects(() => p.store.panel(initial.sessionId, { ...panel(initial), panelRevision: 1 }), 409)
  const overloaded = Array.from({ length: 4096 }, (_, encoded) => Array.from({ length: 6 }, (_, index) => (encoded >> index * 2) & 3) as SwitchyardRotations).find(value => !previewSwitchyardRouting(value).valid)!
  await rejects(() => p.store.panel(initial.sessionId, panel(initial, overloaded)), 400)
  assert.deepEqual(p.store.get(initial.sessionId).switchyardPanel, initial.switchyardPanel)
  const payload = panel(initial, layouts.get('amber')!)
  const applied = await p.store.panel(initial.sessionId, payload)
  assert.equal(applied.revision, initial.revision + 1)
  assert.equal(applied.switchyardPanel!.panelRevision, initial.switchyardPanel!.panelRevision + 1)
  assert.deepEqual(await p.store.panel(initial.sessionId, payload), applied)
  await rejects(() => p.store.panel(initial.sessionId, { ...payload, rotations: layouts.get('blue')! }), 409)
  await rejects(() => p.store.panel(initial.sessionId, panel(initial)), 409)
  const rescue = p.store.create('classic', 'rescue', owner)
  await rejects(() => p.store.panel(rescue.sessionId, { ...envelope(rescue), revision: rescue.revision, panelRevision: 0, rotations: layouts.get('amber')! }), 409)
})

test('local discovery gates proposals; unavailable machinery fails only at confirmed commit without mutation', async () => {
  const p = player()
  assert.equal((await p.tool('propose_move', { target: 'switchyard.to_transfer' })).code, 'stale_scope')
  await p.tool('observe_room')
  await p.move('switchyard.to_transfer')
  await p.move('switchyard.to_lift')
  assert.equal((await p.tool('propose_interaction', { object: 'switchyard.lift', action: 'set_index_one' })).ok, false)
  const inspected = await p.inspect('switchyard.lift')
  assert.match(inspected.message, /Crescent/)
  assert.equal((await p.tool('propose_interaction', { object: 'switchyard.winch', action: 'seat_brace' })).ok, false)
  assert.equal((await p.tool('propose_interaction', { object: 'switchyard.lift', action: 'repair', approved: true })).ok, false)
  const before = p.store.physicalDigestForEvaluation(p.view.sessionId)
  const pending = await p.tool('propose_move', { target: 'switchyard.ride_lift' })
  assert.equal(pending.code, 'awaiting_confirmation')
  const failed = await p.decide(pending)
  assert.equal(failed.proposal?.status, 'failed'); assert.equal(failed.code, 'precondition_failed')
  assert.equal(p.store.physicalDigestForEvaluation(p.view.sessionId), before)
  assert.doesNotMatch(JSON.stringify(failed.view), /Crescent|liftIndex|liftTested|location|visitId|configuration/)
})

test('queued previous-visit work cannot acquire current scope, and old receipts cannot reseed observations', async () => {
  let hold: Promise<void> | undefined
  let unblock!: () => void
  const p = player({ beforeToolCommit: async () => { await hold } })
  await p.tool('observe_room')
  const oldVisit = p.visit!
  const oldView = p.view
  const move = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  hold = new Promise<void>(resolve => { unblock = resolve })
  const queued = p.store.tool(p.view.sessionId, request(oldView, 'inspect_object', { object: 'switchyard.directory' }, oldVisit))
  await Promise.resolve()
  hold = undefined
  const arrival = await p.decide(move)
  unblock()
  assert.equal((await queued).code, 'stale_scope')
  assert.notEqual(arrival.switchyardObservation?.visitId, oldVisit)
  assert.equal(arrival.switchyardObservation?.stateRevision, arrival.view.revision)
  await p.apply(layouts.get('amber')!)
  const status = await p.tool('get_action_status', { proposal_id: move.proposal!.id })
  assert.equal(status.proposal?.status, 'committed')
  assert.equal(status.switchyardObservation, undefined)
  assert.match(status.message, /^Historical action receipt/)
  await p.move('switchyard.to_lift')
  const oldStatus = await p.tool('get_action_status', { proposal_id: move.proposal!.id })
  assert.equal(oldStatus.switchyardObservation, undefined)
})

test('confirmation racing an applied panel checks fresh scope and cannot execute its old proposal', async () => {
  let hold: Promise<void> | undefined
  let unblock!: () => void
  let commits = 0
  const p = player({ beforeToolCommit: async () => { await hold }, onRobotCommit: () => { commits += 1 } })
  await p.tool('observe_room')
  const pending = await p.tool('propose_move', { target: 'switchyard.to_transfer' })
  hold = new Promise<void>(resolve => { unblock = resolve })
  const confirm = p.store.decideProposal(p.view.sessionId, decision(pending), owner)
  await Promise.resolve(); await Promise.resolve()
  await p.apply(layouts.get('amber')!)
  unblock()
  const result = await confirm
  assert.equal(result.ok, false); assert.equal(result.proposal?.status, 'invalidated'); assert.equal(commits, 0)
})

test('reset clears physical progress, proposal receipts and local discovery in a new independent round', async () => {
  const p = player()
  await p.tool('observe_room')
  const first = await p.move('switchyard.to_transfer')
  await p.apply(layouts.get('amber')!)
  const old = p.view
  await p.lifecycle('reset')
  assert.equal(p.view.missionKind, 'switchyard'); assert.notEqual(p.view.roundId, old.roundId)
  assert.deepEqual(p.view.switchyardPanel, { appliedRotations: [0, 0, 1, 0, 0, 0], panelRevision: 0, poweredTerminals: [] })
  assert.equal(p.view.proposal, null); assert.equal(p.view.completed, false)
  await rejects(() => p.store.panel(p.view.sessionId, panel(old)), 409)
  await rejects(() => p.store.decideProposal(p.view.sessionId, decision(first), owner), 409)
  assert.equal((await p.tool('get_action_status', { proposal_id: first.proposal!.id })).ok, false)
  assert.equal((await p.tool('inspect_object', { object: 'switchyard.directory' })).code, 'stale_scope')
})

test('human panel and robot recap maintain separate information; approach appears only after confirmed home', async () => {
  const p = player()
  assert.equal(p.view.switchyardApproach, undefined)
  await p.store.notebook(p.view.sessionId, { ...envelope(p.view), kind: 'note', text: 'PRIVATE INSTALLATION NOTE 98765' })
  await p.apply(layouts.get('blue')!)
  const recap = JSON.stringify(p.store.recap(p.view.sessionId, p.view.roundId))
  assert.doesNotMatch(recap, /PRIVATE INSTALLATION|98765|Routing applied|poweredTerminals|appliedRotations|Crescent|Rivet/)
  await p.tool('observe_room'); await p.move('switchyard.to_transfer'); await p.move('switchyard.to_lift')
  await p.inspect('switchyard.lift')
  await p.apply(layouts.get('')!)
  assert.equal((await p.interact('switchyard.lift', 'set_index_one')).ok, true)
  await p.apply(layouts.get('blue')!)
  assert.equal((await p.interact('switchyard.lift', 'test_lift')).ok, true)
  await p.apply(layouts.get('amber,blue')!)
  await p.move('switchyard.ride_lift')
  assert.equal(p.view.completed, false); assert.equal(p.view.switchyardApproach, undefined)
  await p.inspect('switchyard.return')
  const home = await p.interact('switchyard.return', 'depart')
  assert.equal(home.view.completed, true); assert.equal(home.view.switchyardApproach, 'lift')
  assert.match(home.message, /direct lift/)
  assert.doesNotMatch(JSON.stringify(home.view), /configuration|Crescent|liftIndex|liftTested|braceSeated|turntableAligned|location|visitId/)
  const timeline = p.store.record(p.view.sessionId, p.view.roundId).debrief!.timeline
  const routingEvents = timeline.filter(event => event.kind === 'panel')
  assert.equal(routingEvents.length, 4)
  assert(routingEvents.every(event => event.actor === 'human' && event.chapter === 'switchyard' && event.text.startsWith('Routing applied.')))
  assert.doesNotMatch(JSON.stringify(p.store.recap(p.view.sessionId, p.view.roundId)), /Routing applied|PRIVATE INSTALLATION|98765/)
  await rejects(() => p.store.panel(p.view.sessionId, panel(p.view)), 409)
})

test('HTTP routing and robot proposals require the browser owner and cannot select hidden configuration', async () => {
  let providerRequests = 0
  const server = createGameServer({ apiKey: '', store: new SessionStore({ switchyardConfiguration: 'b' }), fetch: async () => { providerRequests += 1; throw new Error('No provider permitted') } })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const post = (path: string, body: unknown, cookie = '') => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
    for (const body of [{ missionKind: 'switchyard', configuration: 'a' }, { missionKind: 'switchyard', optionalObjective: 'flight_recorder' }, { missionKind: 'switchyard', scenario: 'maintenance' }]) assert.equal((await post('/api/sessions', body)).status, 400)
    const created = await post('/api/sessions', { missionKind: 'switchyard', scenario: 'classic' })
    assert.equal(created.status, 201)
    const cookie = created.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))!.split(';')[0]!
    let view = await created.json() as HumanView
    const path = `/api/sessions/${view.sessionId}`
    assert.equal((await post(`${path}/routing-panel`, panel(view))).status, 404)
    assert.equal((await post(`${path}/tools`, request(view, 'observe_room'))).status, 404)
    assert.equal((await post(`${path}/routing-panel`, { ...panel(view), installedPlate: 'Kite' }, cookie)).status, 400)
    const applied = await post(`${path}/routing-panel`, panel(view, layouts.get('amber')!), cookie)
    assert.equal(applied.status, 200); view = await applied.json() as HumanView
    assert.equal((await post(`${path}/routing-panel`, { ...panel(view), panelRevision: 0 }, cookie)).status, 409)
    const observation = await (await post(`${path}/tools`, request(view, 'observe_room'), cookie)).json() as ToolResponse
    const pending = await (await post(`${path}/tools`, request(view, 'move_to', { target: 'switchyard.to_transfer' }, observation.switchyardObservation!.visitId), cookie)).json() as ToolResponse
    assert.equal(pending.code, 'awaiting_confirmation')
    assert.equal((await post(`${path}/proposal-decision`, decision(pending))).status, 404)
    const commit = await (await post(`${path}/proposal-decision`, decision(pending), cookie)).json() as ToolResponse
    assert.equal(commit.proposal?.status, 'committed')
    assert.equal(commit.switchyardObservation?.location.label, 'Transfer Table')
    for (const suffix of ['state', 'switchyard-state', 'configuration', 'human-move']) assert.equal((await post(`${path}/${suffix}`, {}, cookie)).status, 404)
    assert.equal(providerRequests, 0)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
