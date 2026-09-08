import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { DockControl, HumanView, MessageRequest, Relay } from '../game/shared/contracts.js'
import { applyHumanPower, applyRobotTool, humanView, initialState, missionCompleted, robotView, type GameState } from '../game/server/state.js'
import { applyHumanRelay, type GalleryConfiguration } from '../game/server/gallery.js'
import { applyHumanDock, dockReady } from '../game/server/return-dock.js'
import { SessionStore } from '../game/server/sessions.js'

const fresh = (configuration: GalleryConfiguration = 'a') => initialState(undefined, 'classic', undefined, 'rescue', configuration)
const interact = (state: GameState, object: string, action: string) => applyRobotTool(state, 'interact_object', { object, action })
const move = (state: GameState, target: string) => applyRobotTool(state, 'move_to', { target })
const inspect = (state: GameState, object: string) => applyRobotTool(state, 'inspect_object', { object })
const envelope = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const call = (view: HumanView, name: string, args: Record<string, unknown> = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args })
const speech = (view: HumanView, extra: Partial<MessageRequest> = {}): MessageRequest => ({ roundId: view.roundId, chapter: view.chapter, chapterEpoch: view.chapterEpoch, messageId: randomUUID(), segmentId: 'practice:rescue', role: 'human', inputMethod: 'typed', origin: 'practice', text: 'Please check the local equipment.', interrupted: false, ...extra })
function gallery(configuration: GalleryConfiguration = 'a') {
  const state = fresh(configuration)
  interact(state, 'latch', 'latch_open'); applyHumanPower(state, false); move(state, 'far_side')
  return state
}
function dock(configuration: GalleryConfiguration = 'a') {
  const state = gallery(configuration)
  applyHumanRelay(state, 'beacon'); move(state, 'gallery.g1')
  if (configuration === 'a') { move(state, 'gallery.g4'); applyHumanRelay(state, 'harbor'); move(state, 'gallery.g5') }
  else { applyHumanRelay(state, 'harbor'); move(state, 'gallery.g2'); applyHumanRelay(state, 'beacon'); move(state, 'gallery.g3') }
  return state
}
function board(state: GameState) {
  interact(state, 'return.contact', 'hold_contact'); applyHumanDock(state, 'charge'); applyHumanDock(state, 'store')
  interact(state, 'return.contact', 'release_contact'); move(state, 'return.aboard')
}

type Action = (state: GameState) => unknown
const human: Action[] = [state => applyHumanPower(state, true), state => applyHumanPower(state, false),
  ...(['off', 'beacon', 'harbor'] as Relay[]).map(value => (state: GameState) => applyHumanRelay(state, value)),
  ...(['charge', 'store', 'authorize_return', 'revoke_return'] as DockControl[]).map(value => (state: GameState) => applyHumanDock(state, value))]
const robot: Action[] = [state => robotView(state), state => interact(state, 'latch', 'latch_open'), state => move(state, 'far_side'),
  ...[1, 2, 3, 4, 5].map(value => (state: GameState) => move(state, `gallery.g${value}`)),
  state => interact(state, 'return.contact', 'hold_contact'), state => interact(state, 'return.contact', 'release_contact'),
  state => move(state, 'return.aboard'), state => interact(state, 'return.capsule', 'confirm_return')]
const all = [...human, ...robot]
function physicalKey(state: GameState) {
  // IDs, clocks, revisions, transcript history, and generation counters cannot expand the search.
  return JSON.stringify([state.chapter, state.powerOn, state.doorLatched, state.robotLocation,
    state.gallery.room, state.gallery.relay, state.dock.location, state.dock.contactHeld, state.dock.energy, !!state.dock.grant])
}
function explore(start: GameState, actions: Action[]) {
  const pending = [structuredClone(start)], seen = new Map<string, GameState>()
  while (pending.length) {
    const state = pending.shift()!, key = physicalKey(state)
    if (seen.has(key)) continue
    seen.set(key, state)
    assert.ok(seen.size < 200, 'The physical search must remain finite and exclude arbitrary record history.')
    for (const action of actions) { const next = structuredClone(state); action(next); pending.push(next) }
  }
  return [...seen.values()]
}

for (const configuration of ['a', 'b'] as const) {
  test(`Rescue ${configuration}: all reachable mission states have a cooperative recovery and both actor sets are required`, () => {
    const states = explore(fresh(configuration), all)
    assert.equal(states.length, 24)
    assert.ok(states.some(missionCompleted))
    for (const state of states) {
      if (!missionCompleted(state)) assert.ok(explore(state, all).some(missionCompleted), `Recovery from ${physicalKey(state)}`)
      if (missionCompleted(state)) {
        assert.equal(state.chapter, 'return_dock'); assert.equal(state.dock.location, 'home')
        assert.equal(state.dock.contactHeld, false); assert.equal(state.dock.energy, 'stored'); assert.equal(state.dock.grant, null)
      }
    }
    for (const solo of [human, robot]) assert.ok(explore(fresh(configuration), solo).every(state => !missionCompleted(state)))
  })

  test(`Gallery ${configuration}: thirteen states, fixed obstruction, Off recovery, safe backtracking and no solo clear`, () => {
    const start = gallery(configuration), states = explore(start, all)
    // Chapter-local exploration treats its public exit checkpoint as terminal.
    const chapterActions = all.map(action => (state: GameState) => { if (state.chapter === 'gallery') action(state) })
    const local = explore(start, chapterActions)
    assert.equal(local.length, 13)
    assert.ok(states.some(missionCompleted))
    for (const state of local) {
      assert.equal(state.gallery.configuration, configuration)
      if (state.chapter === 'gallery') assert.ok(explore(state, chapterActions).some(candidate => candidate.chapter === 'return_dock'))
      const projection = JSON.stringify(humanView(state))
      assert.doesNotMatch(projection, /configuration|gallery\.g|obstructed|"room"|"contactHeld"/)
    }
    for (const solo of [human, robot]) assert.ok(explore(start, solo).every(state => state.chapter === 'gallery'))
    const wrong = gallery(configuration)
    applyHumanRelay(wrong, 'beacon'); move(wrong, 'gallery.g1')
    if (configuration === 'a') { applyHumanRelay(wrong, 'harbor'); move(wrong, 'gallery.g2') }
    else move(wrong, 'gallery.g4')
    const gate = configuration === 'a' ? 'gallery.g3' : 'gallery.g5'
    const observation = inspect(wrong, gate)
    assert.equal(observation.ok, true); assert.match(observation.message, /Cargo blocks/)
    assert.doesNotMatch(observation.message, /Leaf|Sail|Configuration|Beacon|Harbor/)
    const before = structuredClone(wrong)
    assert.equal(move(wrong, gate).ok, false); assert.deepEqual(wrong, before)
    applyHumanRelay(wrong, 'off'); assert.equal(move(wrong, configuration === 'a' ? 'gallery.g2' : 'gallery.g4').ok, false)
    applyHumanRelay(wrong, configuration === 'a' ? 'harbor' : 'beacon')
    assert.equal(move(wrong, configuration === 'a' ? 'gallery.g2' : 'gallery.g4').ok, true)
    assert.equal(wrong.gallery.room, 'fork')
    assert.ok(explore(wrong, all).some(missionCompleted))
  })
}

test('Cargo and Gallery checkpoint crossings are nonterminal; Training crossing remains terminal', () => {
  const first = gallery(), second = dock()
  assert.equal(first.chapterEpoch, 1); assert.deepEqual(humanView(first).chaptersCleared, ['cargo']); assert.equal(missionCompleted(first), false)
  assert.equal(second.chapterEpoch, 2); assert.deepEqual(humanView(second).chaptersCleared, ['cargo', 'gallery']); assert.equal(missionCompleted(second), false)
  assert.equal(applyHumanPower(first, true).ok, false)
  const training = initialState(); interact(training, 'latch', 'latch_open'); applyHumanPower(training, false); move(training, 'far_side')
  assert.equal(missionCompleted(training), true); assert.equal(training.chapter, 'cargo')
})

test('initial human and robot projections do not identify the hidden Gallery configuration or future graph', () => {
  const a = fresh('a'), b = fresh('b'); b.sessionId = a.sessionId; b.roundId = a.roundId
  assert.deepEqual(humanView(a), humanView(b)); assert.deepEqual(robotView(a), robotView(b))
  for (const state of [a, b]) assert.doesNotMatch(JSON.stringify(robotView(state)), /Ring|Fork|Sail|Leaf|gallery\.g|Beacon|Harbor|return\.contact|stored/)
  const ga = gallery('a'), gb = gallery('b')
  assert.deepEqual(robotView(ga), robotView(gb))
  assert.match(robotView(ga).message, /Ring emblem.*East gate \(gallery.g1\) is closed/)
  assert.doesNotMatch(robotView(ga).message, /Fork|Sail|Leaf|gallery\.g[2-5]|Beacon|Harbor|configuration/i)
})

test('Gallery gate compass labels match the fixed map orientation on both service branches', () => {
  const state = gallery()
  applyHumanRelay(state, 'beacon'); move(state, 'gallery.g1')
  assert.match(robotView(state).message, /West gate \(gallery.g1\).*Northeast gate \(gallery.g2\).*Southeast gate \(gallery.g4\)/)
  move(state, 'gallery.g4')
  assert.match(robotView(state).message, /Northwest gate \(gallery.g4\).*Northeast gate \(gallery.g5\)/)
  move(state, 'gallery.g4'); applyHumanRelay(state, 'harbor'); move(state, 'gallery.g2')
  assert.match(robotView(state).message, /Southwest gate \(gallery.g2\).*Southeast gate \(gallery.g3\)/)
})

test('all Gallery human projections are independent of hidden configuration and surveys reveal only adjacent gates', () => {
  const local = explore(gallery(), all.map(action => state => { if (state.chapter === 'gallery') action(state) }))
  const visible: Record<string, string[]> = { ring: ['g1'], fork: ['g1', 'g2', 'g4'], sail: ['g2', 'g3'], leaf: ['g4', 'g5'] }
  for (const state of local.filter(state => state.chapter === 'gallery')) {
    const alternative = structuredClone(state); alternative.gallery.configuration = 'b'
    assert.deepEqual(humanView(state), humanView(alternative))
    assert.deepEqual(robotView(state), robotView(alternative))
    const result = robotView(state).message
    const observed = [...result.matchAll(/gallery\.(g[1-5])/g)].map(match => match[1])
    assert.deepEqual(observed, visible[state.gallery.room])
    assert.doesNotMatch(result, /Beacon|Harbor|configuration|return\.contact|return\.capsule/)
    for (const object of ['gallery.configuration', 'gallery.map', 'return.contact', 'far_side']) {
      const before = structuredClone(state)
      assert.equal(inspect(state, object).ok, false)
      assert.deepEqual(state, before)
      assert.doesNotMatch(inspect(state, object).message, /Beacon|Harbor|Sail|Leaf|blocked|configuration/)
    }
  }
})

test('a saturated request cache still permits bounded safety commands and Restart without evicting action receipts', async () => {
  const store = new SessionStore(), initial = store.create('classic', 'rescue')
  const first = call(initial, 'observe_room'), original = await store.tool(initial.sessionId, first)
  for (let index = 1; index < 1000; index += 1) await store.tool(initial.sessionId, call(initial, 'observe_room'))
  assert.throws(() => store.tool(initial.sessionId, call(initial, 'observe_room')), /request limit/)
  let view = initial
  for (let index = 0; index < 66; index += 1) view = await store.lifecycle(view.sessionId, 'cancel', envelope(view))
  view = await store.lifecycle(view.sessionId, 'stop', envelope(view))
  assert.equal(view.status, 'stopped')
  view = await store.lifecycle(view.sessionId, 'end', envelope(view))
  assert.equal(view.status, 'ended')
  assert.deepEqual(await store.tool(view.sessionId, first), original)
  assert.throws(() => store.tool(view.sessionId, call(view, 'observe_room')), /request limit/)
  const reset = await store.lifecycle(view.sessionId, 'reset', envelope(view))
  assert.notEqual(reset.roundId, initial.roundId)
  assert.equal((await store.tool(reset.sessionId, call(reset, 'observe_room'))).ok, true)
  assert.throws(() => store.tool(reset.sessionId, first), /earlier round/)
})

test('Return Dock has eight physical states, universal cooperative recovery and no solo completion', () => {
  const start = dock(), states = explore(start, all)
  assert.equal(states.length, 8)
  for (const state of states) if (!missionCompleted(state)) assert.ok(explore(state, all).some(missionCompleted))
  for (const solo of [human, robot]) assert.ok(explore(start, solo).every(state => !missionCompleted(state)))
})

test('early contact release loses only primed energy; stored charge survives release and holding prevents boarding', () => {
  const state = dock()
  assert.equal(applyHumanDock(state, 'charge').ok, false); assert.equal(applyHumanDock(state, 'store').ok, false)
  interact(state, 'return.contact', 'hold_contact'); applyHumanDock(state, 'charge')
  assert.equal(state.dock.energy, 'primed'); assert.equal(move(state, 'return.aboard').ok, false)
  interact(state, 'return.contact', 'release_contact'); assert.equal(state.dock.energy, 'empty')
  assert.equal(move(state, 'return.aboard').ok, false)
  interact(state, 'return.contact', 'hold_contact'); applyHumanDock(state, 'charge'); applyHumanDock(state, 'store')
  assert.equal(state.dock.energy, 'stored'); assert.equal(move(state, 'return.aboard').ok, false)
  interact(state, 'return.contact', 'release_contact'); assert.equal(state.dock.energy, 'stored')
  assert.equal(move(state, 'return.aboard').ok, true); assert.equal(missionCompleted(state), false)
  assert.equal(interact(state, 'return.capsule', 'confirm_return').ok, false)
  assert.equal(applyHumanDock(state, 'authorize_return').ok, true); assert.equal(missionCompleted(state), false)
  assert.equal(interact(state, 'return.capsule', 'confirm_return').ok, true); assert.equal(missionCompleted(state), true)
  assert.equal(interact(state, 'return.capsule', 'confirm_return').ok, false)
})

test('return grants bind round, chapter, and readiness; read-only inspection leaves valid authorization intact', () => {
  for (const field of ['roundId', 'chapterEpoch', 'readinessVersion'] as const) {
    const state = dock(); board(state); applyHumanDock(state, 'authorize_return')
    const before = structuredClone(state)
    if (field === 'roundId') state.dock.grant!.roundId = 'other-round'
    else state.dock.grant![field] += 1
    const invalid = structuredClone(state)
    assert.equal(interact(state, 'return.capsule', 'confirm_return').ok, false); assert.deepEqual(state, invalid)
    assert.equal(dockReady(before), true)
  }
  const valid = dock(); board(valid); applyHumanDock(valid, 'authorize_return')
  const grant = structuredClone(valid.dock.grant)
  inspect(valid, 'return.capsule'); robotView(valid)
  assert.deepEqual(valid.dock.grant, grant)
  applyHumanDock(valid, 'revoke_return'); assert.equal(interact(valid, 'return.capsule', 'confirm_return').ok, false)
})

test('chapter-specific objects and forged array actions never operate another chapter or role', () => {
  for (const state of [fresh(), gallery(), dock()]) {
    for (const [name, args] of [['power', { powerOn: false }], ['relay', { relay: 'beacon' }],
      ['interact_object', { object: 'return.contact', action: ['hold_contact'] }],
      ['interact_object', { object: ['return.contact'], action: 'release_contact' }],
      ['move_to', { target: 'return.aboard', role: 'human' }], ['inspect_object', { object: 'gallery.g5', sessionId: 'other' }]] as const) {
      const before = structuredClone(state)
      assert.equal(applyRobotTool(state, name, args).ok, false)
      assert.deepEqual(state, before)
    }
  }
  assert.equal(move(gallery(), 'gallery.g3').ok, false)
  assert.equal(interact(dock(), 'latch', 'latch_open').ok, false)
})

async function enterGallery(store: SessionStore, initial = store.create('classic', 'rescue')) {
  let view = (await store.tool(initial.sessionId, call(initial, 'interact_object', { object: 'latch', action: 'latch_open' }))).view
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }))
  return (await store.tool(view.sessionId, call(view, 'move_to', { target: 'far_side' }))).view
}
async function enterDock(store: SessionStore) {
  let view = await enterGallery(store)
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }))
  for (const target of ['gallery.g1', 'gallery.g4']) view = (await store.tool(view.sessionId, call(view, 'move_to', { target }))).view
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'harbor' }))
  return (await store.tool(view.sessionId, call(view, 'move_to', { target: 'gallery.g5' }))).view
}
async function boarded(store: SessionStore) {
  let view = await enterDock(store)
  view = (await store.tool(view.sessionId, call(view, 'interact_object', { object: 'return.contact', action: 'hold_contact' }))).view
  for (const action of ['charge', 'store']) view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action }))
  view = (await store.tool(view.sessionId, call(view, 'interact_object', { object: 'return.contact', action: 'release_contact' }))).view
  return (await store.tool(view.sessionId, call(view, 'move_to', { target: 'return.aboard' }))).view
}

test('a committed chapter-advancing result deduplicates once and queued previous-chapter calls are rejected', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' })
  let view = store.create('classic', 'rescue')
  view = (await store.tool(view.sessionId, call(view, 'interact_object', { object: 'latch', action: 'latch_open' }))).view
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }))
  const transition = call(view, 'move_to', { target: 'far_side' }), queued = call(view, 'observe_room')
  const crossed = store.tool(view.sessionId, transition), stale = store.tool(view.sessionId, queued)
  const result = await crossed
  assert.equal(result.ok, true); assert.equal(result.view.chapter, 'gallery'); assert.equal(result.view.completed, false)
  await assert.rejects(stale, /earlier chapter/)
  assert.deepEqual(await store.tool(view.sessionId, transition), result)
  assert.equal(store.recap(view.sessionId, view.roundId).entries.filter(entry => /checkpoint confirms/.test(entry.text)).length, 1)
  assert.equal(store.record(view.sessionId, view.roundId).debrief, null)
  const stopped = await store.lifecycle(view.sessionId, 'stop', envelope(view))
  assert.equal(stopped.status, 'stopped'); assert.equal(stopped.chapter, 'gallery')
})

test('Rescue actions require chapter generations and stale human controls, annotations and hints are rejected', async () => {
  const store = new SessionStore(), initial = store.create('classic', 'rescue')
  await assert.rejects(store.tool(initial.sessionId, { ...call(initial, 'observe_room'), chapterEpoch: undefined }), /chapter generation/)
  const current = await enterGallery(store, initial)
  await assert.rejects(store.power(current.sessionId, envelope(initial, { revision: current.revision, powerOn: true })), /earlier chapter/)
  await assert.rejects(store.control(current.sessionId, 'relay', envelope(initial, { revision: current.revision, relay: 'beacon' })), /earlier chapter/)
  await assert.rejects(store.hint(current.sessionId, envelope(initial, { level: 1 })), /earlier chapter/)
  await assert.rejects(store.annotate(current.sessionId, envelope(initial, { kind: 'location', target: 'fork' })), /earlier chapter/)
  assert.throws(() => store.control(current.sessionId, 'relay', { ...envelope(current, { revision: current.revision, relay: 'beacon' }), role: 'robot' }), /supported human/)
})

test('Return Dock pause, interruption and revoke invalidate grants; supersede and captions preserve them', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' })
  let view = await boarded(store)
  view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'authorize_return' }))
  await store.message(view.sessionId, speech(view, { text: 'Please confirm the authorized return.' }))
  view = await store.lifecycle(view.sessionId, 'cancel', envelope(view, { reason: 'supersede' }))
  assert.equal(view.returnDock?.returnAuthorized, true)
  await store.tool(view.sessionId, call(view, 'inspect_object', { object: 'return.capsule' }))
  assert.equal(store.get(view.sessionId).returnDock?.returnAuthorized, true)
  for (const action of ['cancel', 'stop'] as const) {
    view = await store.lifecycle(view.sessionId, action, envelope(view))
    assert.equal(view.returnDock?.returnAuthorized, false); assert.equal(view.returnDock?.energy, 'stored'); assert.equal(view.returnDock?.readyForReturn, true)
    if (action === 'stop') view = await store.lifecycle(view.sessionId, 'resume', envelope(view))
    assert.equal((await store.tool(view.sessionId, call(view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' }))).ok, false)
    view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'authorize_return' }))
  }
  const confirm = call(view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' })
  const first = await store.tool(view.sessionId, confirm), duplicate = await store.tool(view.sessionId, confirm)
  assert.deepEqual(first, duplicate); assert.equal(first.view.completed, true)
  assert.equal(store.record(view.sessionId, view.roundId).debrief!.timeline.filter(event => event.kind === 'completion').length, 1)
})

test('delayed final confirmation cannot commit after accepted revoke even if authorization is granted again', async () => {
  let hold = false, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const store = new SessionStore({ galleryConfiguration: 'a', beforeToolCommit: async () => { if (hold) await gate } })
  let view = await boarded(store)
  view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'authorize_return' }))
  hold = true
  const pending = store.tool(view.sessionId, call(view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' }))
  await new Promise<void>(resolve => setImmediate(resolve))
  view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'revoke_return' }))
  view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'authorize_return' }))
  release()
  assert.equal((await pending).ok, false); assert.equal(store.get(view.sessionId).completed, false)
  assert.equal((await store.tool(view.sessionId, call(view, 'interact_object', { object: 'return.capsule', action: 'confirm_return' }))).ok, true)
})

test('Gallery movement rechecks the latest Relay selection immediately before a delayed commit', async () => {
  let hold = false, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const store = new SessionStore({ galleryConfiguration: 'b', beforeToolCommit: async () => { if (hold) await gate } })
  let view = await enterGallery(store)
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }))
  hold = true
  const pending = store.tool(view.sessionId, call(view, 'move_to', { target: 'gallery.g1' }))
  await new Promise<void>(resolve => setImmediate(resolve))
  try {
    view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'off' }))
  } finally { release() }
  const result = await pending
  assert.equal(result.ok, false); assert.match(result.message, /gate is closed/)
  assert.equal(result.view.revision, view.revision)
  const observation = await store.tool(view.sessionId, call(view, 'observe_room'))
  assert.match(observation.message, /Ring emblem/)
  assert.equal(store.recap(view.sessionId, view.roundId).entries.filter(entry => entry.kind === 'action' && entry.chapter === 'gallery').length, 0)
})

test('two queued moves cannot bounce through one Gallery gate; a newly requested return remains valid', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' })
  let view = await enterGallery(store)
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }))
  const first = call(view, 'move_to', { target: 'gallery.g1' }), stale = call(view, 'move_to', { target: 'gallery.g1' })
  const [moved, rejected] = await Promise.all([store.tool(view.sessionId, first), store.tool(view.sessionId, stale)])
  assert.equal(moved.ok, true); assert.match(moved.message, /Fork emblem/)
  assert.equal(rejected.ok, false); assert.match(rejected.message, /canceled before it committed/)
  assert.equal(rejected.view.revision, moved.view.revision)
  assert.deepEqual(await store.tool(view.sessionId, first), moved)
  const returned = await store.tool(view.sessionId, call(moved.view, 'move_to', { target: 'gallery.g1' }))
  assert.equal(returned.ok, true); assert.match(returned.message, /Ring emblem/)
  assert.equal(store.recap(view.sessionId, view.roundId).entries.filter(entry => entry.kind === 'action' && entry.chapter === 'gallery').length, 2)
})

test('chapter-aware recap byte limits preserve whole faithful quotes and never admit private hints or annotations', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' })
  const cargo = store.create('classic', 'rescue'), current = await enterGallery(store, cargo)
  const text = String.fromCharCode(0x22, 0x5c, 0x01).repeat(500)
  for (let index = 0; index < 4; index += 1) await store.message(current.sessionId, speech(index % 2 ? current : cargo, { messageId: `expanded-${index}`, text: `${index}:${text}` }))
  await store.annotate(current.sessionId, envelope(current, { kind: 'blocked_gate', target: 'g5', marked: true }))
  await store.hint(current.sessionId, envelope(current, { level: 3 }))
  const recap = store.recap(current.sessionId, current.roundId)
  assert.equal(recap.chapter, 'gallery')
  assert.ok(Buffer.byteLength(JSON.stringify(recap), 'utf8') <= 11_000)
  assert.deepEqual(recap.entries.map(entry => entry.messageId), ['expanded-2', 'expanded-3'])
  assert.deepEqual(recap.entries.map(entry => entry.chapter), ['cargo', 'gallery'])
  assert.deepEqual(recap.entries.map(entry => entry.text), [`2:${text}`, `3:${text}`])
  assert.doesNotMatch(JSON.stringify(recap), /blockedGates|Either service bay|gallery\.g5/)
})

test('chapter-aware records retain historical conversation but exclude private map annotations, notes and unobserved graph', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' })
  const first = store.create('classic', 'rescue'), oldCaption = speech(first, { text: 'My manual says the Door and Conveyor share Power.' })
  let view = await enterGallery(store, first)
  const saved = await store.message(view.sessionId, oldCaption)
  assert.equal(saved.chapter, 'cargo')
  await assert.rejects(store.message(view.sessionId, { ...oldCaption, chapter: 'gallery', chapterEpoch: 1 }), /different communicated/)
  await assert.rejects(store.message(view.sessionId, speech(view, { chapter: 'return_dock', chapterEpoch: 2 })), /already reached/)
  await store.annotate(view.sessionId, envelope(view, { kind: 'location', target: 'leaf' }))
  await store.annotate(view.sessionId, envelope(view, { kind: 'blocked_gate', target: 'g3', marked: true }))
  await store.notebook(view.sessionId, envelope(view, { kind: 'note', text: 'PRIVATE_ROUTE_PLAN' }))
  for (const level of [1, 2, 3]) await store.hint(view.sessionId, envelope(view, { level }))
  const recap = store.recap(view.sessionId, view.roundId)
  assert.equal(recap.chapter, 'gallery'); assert.equal(recap.chapterEpoch, 1)
  assert.ok(recap.entries.some(entry => entry.chapter === 'cargo' && entry.text === oldCaption.text))
  assert.doesNotMatch(JSON.stringify(recap), /PRIVATE_ROUTE_PLAN|blockedGates|"location"|gallery\.g[2-5]|Configuration|Sail|Leaf/)
  const record = store.record(view.sessionId, view.roundId)
  assert.deepEqual(record.annotations, { chapter: 'gallery', location: 'leaf', blockedGates: ['g3'] })
  assert.deepEqual(record.hintUses, [1, 2, 3].map(level => ({ chapter: 'gallery', level })))
  const before = store.get(view.sessionId)
  await store.annotate(view.sessionId, envelope(view, { kind: 'blocked_gate', target: 'g3', marked: true }))
  assert.deepEqual(store.get(view.sessionId), before)
  view = await store.lifecycle(view.sessionId, 'stop', envelope(view))
  view = await store.lifecycle(view.sessionId, 'resume', envelope(view))
  assert.equal(view.chapter, 'gallery'); assert.equal(view.relay, 'off')
  const reset = await store.lifecycle(view.sessionId, 'reset', envelope(view))
  assert.equal(reset.chapter, 'cargo'); assert.equal(reset.chapterEpoch, 0)
  assert.deepEqual(store.record(reset.sessionId, reset.roundId).annotations, { chapter: 'gallery', location: null, blockedGates: [] })
  assert.deepEqual(store.recap(reset.sessionId, reset.roundId).entries, [])
})
