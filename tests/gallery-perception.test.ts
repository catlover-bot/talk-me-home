import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { SessionStore } from '../game/server/sessions.js'
import type { HumanView, ToolResponse } from '../game/shared/contracts.js'

const owner = 'perception-test-owner'
const request = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const tool = (store: SessionStore, view: HumanView, name: string, args = {}) => store.tool(view.sessionId, { roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args })
const decide = (store: SessionStore, result: ToolResponse, decision: 'confirm' | 'decline' = 'confirm') => store.decideProposal(result.view.sessionId, { roundId: result.view.roundId, requestId: randomUUID(), proposalId: result.proposal!.id, decision }, owner)
const move = async (store: SessionStore, view: HumanView, target: string) => decide(store, await tool(store, view, 'propose_move', { target }))
async function enterGallery(store: SessionStore) {
  let view = store.create('classic', 'rescue', owner)
  view = (await decide(store, await tool(store, view, 'propose_interaction', { object: 'latch', action: 'latch_open' }))).view
  view = await store.power(view.sessionId, request(view, { revision: view.revision, powerOn: false }))
  return move(store, view, 'far_side')
}
const relay = (store: SessionStore, view: HumanView, value: 'beacon' | 'harbor' | 'off') => store.control(view.sessionId, 'relay', request(view, { revision: view.revision, relay: value }))

test('confirmed Gallery movement reuses its existing survey as scoped robot perception without human telemetry', async () => {
  const store = new SessionStore({ now: () => 12345, galleryConfiguration: 'a' })
  const entry = await enterGallery(store)
  const view = await relay(store, entry.view, 'beacon')
  const pending = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  assert.equal(pending.perception, undefined)
  const moved = await decide(store, pending)
  // This paragraph already existed in the delivered move result; the missing part was typed scope.
  assert.match(moved.message, /Fork emblem/)
  assert.ok(moved.perception, 'the existing arrival survey needs a typed robot-only projection')
  assert.equal(moved.perception.origin, 'confirmed_arrival')
  assert.equal(moved.perception.emblem, 'Fork'); assert.equal(moved.perception.compass, 'north')
  assert.equal(moved.perception.roundId, view.roundId); assert.equal(moved.perception.chapterEpoch, moved.view.chapterEpoch)
  assert.equal(moved.perception.stateRevision, moved.view.revision); assert.equal(moved.perception.actionEpoch, moved.view.actionEpoch)
  assert.equal(moved.perception.observedAt, 12345)
  assert.deepEqual(moved.perception.gates.map(gate => gate.direction), ['West', 'Northeast', 'Southeast'])
  assert.ok(moved.perception.gates.every(gate => gate.passage === 'unchecked'))
  assert.doesNotMatch(JSON.stringify([moved.view, moved.proposal, moved.decisionEvent, store.record(view.sessionId, view.roundId)]), /Fork|gallery\.g2|gallery\.g4|visitId|perception/)
})

test('entry, repeated confirmations and return visits preserve one arrival per commit with new visit identities', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' }); const entry = await enterGallery(store)
  assert.equal(entry.perception?.emblem, 'Ring'); assert.equal(entry.perception?.origin, 'confirmed_arrival')
  const view = await relay(store, entry.view, 'beacon')
  const pending = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  const moved = await decide(store, pending); const repeated = await decide(store, pending)
  assert.deepEqual(repeated, moved)
  assert.equal(store.recap(view.sessionId, view.roundId).entries.filter(item => item.kind === 'observation' && /Fork/.test(item.text)).length, 1)
  assert.equal(store.recap(view.sessionId, view.roundId).entries.find(item => item.kind === 'observation' && /Fork/.test(item.text))?.observationOrigin, 'confirmed_arrival')
  const returned = await move(store, moved.view, 'gallery.g1')
  assert.equal(returned.perception?.emblem, 'Ring')
  assert.notEqual(returned.perception?.visitId, entry.perception?.visitId)
  assert.notEqual(returned.perception?.visitId, moved.perception?.visitId)
  const departed = await tool(store, returned.view, 'get_action_status', { proposal_id: moved.proposal!.id })
  assert.equal(departed.perception, undefined); assert.equal(departed.proposal?.status, 'committed')
})

test('relay changes and pause invalidate a survey while completed action history remains available', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' }); const entry = await enterGallery(store)
  let view = await relay(store, entry.view, 'beacon'); const moved = await move(store, view, 'gallery.g1')
  const current = await tool(store, moved.view, 'get_action_status', { proposal_id: moved.proposal!.id })
  assert.ok(current.perception)
  view = await relay(store, moved.view, 'harbor')
  let old = await tool(store, view, 'get_action_status', { proposal_id: moved.proposal!.id })
  assert.equal(old.proposal?.status, 'committed'); assert.equal(old.perception, undefined); assert.match(old.message, /historical/i)
  const fresh = await tool(store, view, 'observe_room'); assert.equal(fresh.perception?.origin, 'local_survey')
  assert.equal(fresh.perception?.visitId, moved.perception?.visitId)
  assert.ok(fresh.perception!.observationRevision > moved.perception!.observationRevision)
  assert.equal((await tool(store, view, 'get_action_status', { proposal_id: moved.proposal!.id })).perception, undefined)
  view = await store.lifecycle(view.sessionId, 'stop', request(view))
  view = await store.lifecycle(view.sessionId, 'resume', request(view))
  old = await tool(store, view, 'get_action_status', { proposal_id: moved.proposal!.id })
  assert.equal(old.perception, undefined); assert.equal(old.proposal?.status, 'committed')
  assert.match(store.recap(view.sessionId, view.roundId).instruction, /Historical/)
})

test('open, powered and cargo blockage remain separate; unseen passages stay unchecked in both layouts', async () => {
  for (const configuration of ['a', 'b'] as const) {
    const store = new SessionStore({ galleryConfiguration: configuration }); const entry = await enterGallery(store)
    let view = await relay(store, entry.view, 'beacon'); view = (await move(store, view, 'gallery.g1')).view
    if (configuration === 'a') { view = await relay(store, view, 'harbor'); view = (await move(store, view, 'gallery.g2')).view; view = await relay(store, view, 'beacon') }
    else { view = (await move(store, view, 'gallery.g4')).view; view = await relay(store, view, 'harbor') }
    const blockedHandle = configuration === 'a' ? 'gallery.g3' : 'gallery.g5'
    const survey = await tool(store, view, 'observe_room')
    assert.equal(survey.perception?.gates.find(gate => gate.handle === blockedHandle)?.passage, 'unchecked')
    const inspected = await tool(store, view, 'inspect_object', { object: blockedHandle })
    const gate = inspected.perception?.gates.find(gate => gate.handle === blockedHandle)
    assert.deepEqual(gate && { power: gate.power, door: gate.door, passage: gate.passage }, { power: 'powered', door: 'open', passage: 'blocked' })
    assert.equal(inspected.perception?.origin, 'gate_inspection')
    assert.ok(inspected.perception?.gates.filter(gate => gate.handle !== blockedHandle).every(gate => gate.passage === 'unchecked'))
    const behind = await tool(store, view, 'inspect_object', { object: configuration === 'a' ? 'gallery.g2' : 'gallery.g4' })
    const closedClear = behind.perception?.gates.find(gate => gate.passage === 'clear')
    assert.deepEqual(closedClear && { power: closedClear.power, door: closedClear.door, passage: closedClear.passage }, { power: 'unpowered', door: 'closed', passage: 'clear' })
    const failed = await move(store, view, blockedHandle)
    assert.equal(failed.proposal?.status, 'failed'); assert.equal(failed.perception, undefined)
  }
})

test('decline, expiry and changed Relay never create an arrival and a stale proposal can be replaced', async () => {
  let now = 1000; const store = new SessionStore({ now: () => now, galleryConfiguration: 'a' }); const entry = await enterGallery(store)
  let view = await relay(store, entry.view, 'beacon')
  let pending = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  assert.equal((await decide(store, pending, 'decline')).perception, undefined)
  pending = await tool(store, view, 'propose_move', { target: 'gallery.g1' }); now += 90_001
  assert.equal((await decide(store, pending)).perception, undefined)
  pending = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  view = await relay(store, view, 'harbor'); view = await relay(store, view, 'beacon')
  const stale = await decide(store, pending)
  assert.equal(stale.proposal?.status, 'invalidated'); assert.equal(stale.perception, undefined)
  const replacement = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  assert.notEqual(replacement.proposal?.id, pending.proposal?.id)
  assert.equal((await decide(store, replacement)).perception?.emblem, 'Fork')
})

test('chapter transition and a pause winning confirmation never publish a Gallery destination survey', async () => {
  let pausedCommit = false; let release: (() => void) | undefined
  const store = new SessionStore({ galleryConfiguration: 'a', beforeToolCommit: async () => { if (pausedCommit) await new Promise<void>(resolve => { release = resolve }) } })
  const entry = await enterGallery(store); let view = await relay(store, entry.view, 'beacon')
  const proposal = await tool(store, view, 'propose_move', { target: 'gallery.g1' })
  pausedCommit = true; const pending = decide(store, proposal)
  await new Promise(resolve => setImmediate(resolve))
  view = await store.lifecycle(view.sessionId, 'stop', request(view)); release!(); pausedCommit = false
  const canceled = await pending
  assert.equal(canceled.perception, undefined); assert.equal(canceled.proposal?.status, 'invalidated')
  view = await store.lifecycle(view.sessionId, 'resume', request(view))
  view = (await move(store, view, 'gallery.g1')).view
  const leaf = await move(store, view, 'gallery.g4'); view = await relay(store, leaf.view, 'harbor')
  const dock = await move(store, view, 'gallery.g5')
  assert.equal(dock.view.chapter, 'return_dock'); assert.equal(dock.perception, undefined)
  const old = await tool(store, dock.view, 'get_action_status', { proposal_id: leaf.proposal!.id })
  assert.equal(old.perception, undefined); assert.equal(old.proposal?.status, 'committed')
})

test('map plans and exact report associations remain private and changing Relay back never refreshes old dynamic reports', async () => {
  let now = 1000; const store = new SessionStore({ now: () => now, galleryConfiguration: 'a' }); const entry = await enterGallery(store)
  let view = await relay(store, entry.view, 'beacon')
  const messageId = randomUUID()
  const recorded = await store.message(view.sessionId, { roundId: view.roundId, chapter: view.chapter, chapterEpoch: view.chapterEpoch,
    messageId, segmentId: randomUUID(), role: 'robot', origin: 'practice', inputMethod: 'robot', text: 'My report says the east opening looks clear.', interrupted: false })
  assert.deepEqual(recorded.reportContext, { relay: 'beacon', earlier: false })
  const annotate = (extra: Record<string, unknown>) => store.annotate(view.sessionId, request(view, extra))
  await annotate({ kind: 'planned_gate', target: 'g1', marked: true })
  await annotate({ kind: 'explored_gate', target: 'g2', marked: true })
  await annotate({ kind: 'report_link', messageId, target: 'g1', targetKind: 'corridor', dynamic: true })
  await annotate({ kind: 'report_link', messageId, target: 'ring', targetKind: 'room', dynamic: false })
  now += 20; view = await relay(store, view, 'harbor'); view = await relay(store, view, 'beacon')
  let record = store.record(view.sessionId, view.roundId)
  assert.deepEqual(record.annotations?.plannedGates, ['g1']); assert.deepEqual(record.annotations?.exploredGates, ['g2'])
  assert.equal(record.annotations?.location, null)
  assert.equal(record.annotations?.reportLinks?.find(link => link.dynamic)?.earlier, true)
  assert.equal(record.annotations?.reportLinks?.find(link => !link.dynamic)?.earlier, false)
  assert.equal(record.messages.find(message => message.messageId === messageId)?.reportContext?.earlier, true)
  // Delaying an association until after a control change cannot manufacture freshness.
  await annotate({ kind: 'report_link', messageId, target: 'g3', targetKind: 'corridor', dynamic: true })
  record = store.record(view.sessionId, view.roundId)
  assert.equal(record.annotations?.reportLinks?.find(link => link.target === 'g3')?.earlier, true)
  assert.equal(record.annotations?.reportLinks?.[0]?.reportedAt, 1000)
  assert.equal(record.annotations?.reportLinks?.[0]?.text, recorded.text)
  assert.doesNotMatch(JSON.stringify(store.recap(view.sessionId, view.roundId)), /My report says|plannedGates|reportLinks|exploredGates/)
  await annotate({ kind: 'planned_gate', target: 'g1', marked: false })
  await annotate({ kind: 'report_unlink', messageId, target: 'g1', targetKind: 'corridor' })
  record = store.record(view.sessionId, view.roundId)
  assert.deepEqual(record.annotations?.plannedGates, []); assert.equal(record.annotations?.reportLinks?.length, 2)
  await annotate({ kind: 'planned_gate', target: 'g1', marked: true }); await annotate({ kind: 'planned_gate', target: 'g3', marked: true })
  await annotate({ kind: 'clear_plan' })
  record = store.record(view.sessionId, view.roundId)
  assert.deepEqual(record.annotations?.plannedGates, []); assert.deepEqual(record.annotations?.exploredGates, ['g2']); assert.equal(record.annotations?.reportLinks?.length, 2)
  await assert.rejects(annotate({ kind: 'report_link', messageId: randomUUID(), target: 'g1', targetKind: 'corridor', dynamic: true }), /actual Pip report/)
  assert.throws(() => annotate({ kind: 'report_link', messageId, target: 'hidden', targetKind: 'room', dynamic: true }), /private|Annotate/)
})

test('selected quick requests keep human non-microphone provenance and cannot forge Game reports', async () => {
  const store = new SessionStore(); const entry = await enterGallery(store); const view = entry.view
  const input = { roundId: view.roundId, chapter: view.chapter, chapterEpoch: view.chapterEpoch, messageId: randomUUID(), segmentId: randomUUID(),
    role: 'human', origin: 'live_voice', inputMethod: 'quick_request', text: 'Please describe your surroundings.', interrupted: false }
  const recorded = await store.message(view.sessionId, input)
  assert.equal(recorded.inputMethod, 'quick_request'); assert.equal(recorded.role, 'human')
  assert.throws(() => store.message(view.sessionId, { ...input, role: 'game', origin: 'game' }), /finalized message/)
  await assert.rejects(store.annotate(view.sessionId, request(view, { kind: 'report_link', messageId: input.messageId, target: 'ring', targetKind: 'room', dynamic: false })), /actual Pip report/)
})
