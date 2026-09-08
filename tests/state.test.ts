import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { HumanView, ToolRequest } from '../game/shared/contracts.js'
import { applyHumanPower, applyRobotTool, conveyorRunning, doorOpen, humanView, initialState, robotView, type GameState } from '../game/server/state.js'
import { GameError, SessionStore } from '../game/server/sessions.js'

const latch = (state: GameState) => applyRobotTool(state, 'interact_object', { object: 'latch', action: 'latch_open' })
const cross = (state: GameState) => applyRobotTool(state, 'move_to', { target: 'far_side' })
const command = (view: HumanView, fields = {}) => ({ roundId: view.roundId, requestId: randomUUID(), ...fields })
const tool = (view: HumanView, fields: Partial<ToolRequest> = {}): ToolRequest => ({ roundId: view.roundId, callId: randomUUID(), actionEpoch: view.actionEpoch, name: 'interact_object', arguments: { object: 'latch', action: 'latch_open' }, ...fields })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('initial state derives an open Door and running Conveyor from shared Power', () => {
  const state = initialState()
  assert.equal(state.powerOn, true)
  assert.equal(state.doorLatched, false)
  assert.equal(state.robotLocation, 'near_side')
  assert.equal(doorOpen(state), true)
  assert.equal(conveyorRunning(state), true)
  assert.equal(applyHumanPower(state, false).ok, true)
  assert.equal(doorOpen(state), false)
  assert.equal(conveyorRunning(state), false)
  assert.equal(state.revision, 1)
})

test('a closed Door cannot be latched and rejection does not mutate state', () => {
  const state = initialState()
  applyHumanPower(state, false)
  const before = { ...state }
  assert.equal(latch(state).ok, false)
  assert.deepEqual(state, before)
})

test('cooperation reaches authoritative arrival without a failure or spoken phrase', () => {
  const state = initialState()
  assert.equal(latch(state).ok, true)
  assert.equal(applyHumanPower(state, false).ok, true)
  assert.equal(doorOpen(state), true)
  assert.equal(conveyorRunning(state), false)
  assert.equal(humanView(state).completed, false)
  assert.equal(cross(state).ok, true)
  assert.equal(humanView(state).completed, true)
  assert.equal(cross(state).ok, false)
})

test('a running Conveyor cannot be crossed even with an open latched Door', () => {
  const state = initialState()
  assert.equal(cross(state).ok, false)
  latch(state)
  const before = { ...state }
  assert.equal(cross(state).ok, false)
  assert.deepEqual(state, before)
})

test('early Power OFF is recoverable by restoring Power', () => {
  const state = initialState()
  applyHumanPower(state, false)
  assert.equal(cross(state).ok, false)
  assert.equal(latch(state).ok, false)
  applyHumanPower(state, true)
  assert.equal(latch(state).ok, true)
  applyHumanPower(state, false)
  assert.equal(cross(state).ok, true)
})

type Action = (state: GameState) => void
const humanActions: Action[] = [(state) => { applyHumanPower(state, true) }, (state) => { applyHumanPower(state, false) }]
const robotActions: Action[] = [(state) => { latch(state) }, (state) => { cross(state) }, (state) => { applyRobotTool(state, 'observe_room', {}) }]
function explore(actions: Action[]): GameState[] {
  const pending = [initialState()]
  const seen = new Map<string, GameState>()
  while (pending.length) {
    const current = pending.shift()!
    const key = JSON.stringify([current.powerOn, current.doorLatched, current.robotLocation])
    if (seen.has(key)) continue
    seen.set(key, current)
    for (const action of actions) {
      const next = { ...current }
      action(next)
      pending.push(next)
    }
  }
  return [...seen.values()]
}

test('neither human actions nor robot actions can independently finish', () => {
  for (const actions of [humanActions, robotActions]) {
    const states = explore(actions)
    assert.equal(states.length, 2)
    assert.ok(states.every((state) => !humanView(state).completed))
  }
})

test('exhaustive exploration covers all five reachable physical states without shortcuts', () => {
  const states = explore([...humanActions, ...robotActions])
  assert.equal(states.length, 5)
  for (const state of states) {
    assert.equal(doorOpen(state), state.powerOn || state.doorLatched)
    assert.equal(conveyorRunning(state), state.powerOn)
    if (state.robotLocation === 'far_side') {
      assert.equal(state.powerOn, false)
      assert.equal(state.doorLatched, true)
    }
  }
})

test('human projection never streams unreported local state', () => {
  for (const state of explore([...humanActions, ...robotActions])) {
    const projection = humanView(state)
    assert.deepEqual(Object.keys(projection).sort(), ['sessionId', 'roundId', 'revision', 'actionEpoch', 'powerOn', 'status', 'completed', 'scenario', 'missionKind', 'chapter', 'chapterEpoch', 'chaptersCleared'].sort())
    assert.doesNotMatch(JSON.stringify(projection), /latch|conveyor|doorOpen|robotLocation/i)
  }
})

test('robot projections and all local result paths contain no wiring document or answer sequence', () => {
  for (const state of explore([...humanActions, ...robotActions])) {
    const outputs = [robotView(state), ...['door', 'conveyor', 'latch', 'power', 'map', 'anything'].map((object) => applyRobotTool({ ...state }, 'inspect_object', { object })), latch({ ...state }), cross({ ...state })]
    for (const output of outputs) {
      assert.doesNotMatch(JSON.stringify(output), /shared power|same power|wiring|switch.*off.*cross|powerOn|sessionId|roundId|revision/i)
    }
  }
})

test('unknown or ambiguous objects, tools, destinations and forged role arguments are rejected', () => {
  const state = initialState()
  const requests = [
    ['power', { powerOn: false }], ['observe_room', { role: 'human' }],
    ['inspect_object', { object: 'door and conveyor' }], ['inspect_object', { object: 'latch', sessionId: 'other' }],
    ['interact_object', { object: 'latch', action: 'latch_open', role: 'robot' }],
    ['interact_object', { object: 'power', action: 'off' }], ['move_to', { target: 'escape' }],
    ['move_to', { target: 'far_side', roundId: 'other' }],
  ] as const
  for (const [name, args] of requests) {
    const before = { ...state }
    assert.equal(applyRobotTool(state, name, args).ok, false)
    assert.deepEqual(state, before)
  }
})

test('explicit desired Power state is idempotent', () => {
  const state = initialState()
  applyHumanPower(state, false)
  const before = { ...state }
  applyHumanPower(state, false)
  assert.deepEqual(state, before)
})

test('session identity, schema and stale rounds are validated outside model arguments', async () => {
  const store = new SessionStore()
  const view = store.create()
  assert.throws(() => store.get('invalid'), GameError)
  assert.throws(() => store.tool(view.sessionId, { ...tool(view), role: 'human' }), GameError)
  assert.throws(() => store.power(view.sessionId, { ...command(view), revision: 0, powerOn: false, role: 'robot' }), GameError)
  const reset = await store.lifecycle(view.sessionId, 'reset', command(view))
  assert.notEqual(reset.roundId, view.roundId)
  assert.throws(() => store.tool(view.sessionId, tool(view)), /earlier round/)
  assert.throws(() => store.power(view.sessionId, command(view, { revision: 0, powerOn: false })), /earlier round/)
})

test('concurrent duplicate calls commit once and identifier conflicts are rejected', async () => {
  const store = new SessionStore()
  const view = store.create()
  const request = tool(view)
  const [first, second] = await Promise.all([store.tool(view.sessionId, request), store.tool(view.sessionId, { ...request })])
  assert.deepEqual(first, second)
  assert.equal(first.view.revision, 1)
  assert.throws(() => store.tool(view.sessionId, { ...request, name: 'observe_room', arguments: {} }), /different request/)
})

test('duplicate Power retries return their original result and out-of-order revisions cannot overwrite', async () => {
  const store = new SessionStore()
  const view = store.create()
  const request = command(view, { revision: view.revision, powerOn: false })
  const first = await store.power(view.sessionId, request)
  assert.deepEqual(await store.power(view.sessionId, request), first)
  await assert.rejects(store.power(view.sessionId, command(view, { revision: 0, powerOn: true })), /changed before/)
  assert.equal(store.get(view.sessionId).powerOn, false)
})

test('latest preconditions are checked after a delayed tool reaches its commit boundary', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const store = new SessionStore({ beforeToolCommit: () => gate })
  const view = store.create()
  const pending = store.tool(view.sessionId, tool(view))
  await tick()
  await store.power(view.sessionId, command(view, { revision: 0, powerOn: false }))
  release()
  const result = await pending
  assert.equal(result.ok, false)
  assert.match(result.message, /closed Door/)
  assert.equal(result.view.revision, 1)
})

test('accepted cancellation discards pending actions while preserving committed actions', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const store = new SessionStore({ beforeToolCommit: () => gate })
  const view = store.create()
  const pending = store.tool(view.sessionId, tool(view))
  await tick()
  const canceled = await store.lifecycle(view.sessionId, 'cancel', command(view))
  release()
  const result = await pending
  assert.equal(result.ok, false)
  assert.match(result.message, /canceled before/)
  const committed = await store.tool(view.sessionId, tool(canceled))
  assert.equal(committed.ok, true)
  const again = await store.lifecycle(view.sessionId, 'cancel', command(committed.view))
  const observation = await store.tool(view.sessionId, tool(again, { name: 'inspect_object', arguments: { object: 'latch' } }))
  assert.match(observation.message, /Latch is engaged/)
})

test('reset rejects a delayed previous-round action and does not mix independent sessions', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const store = new SessionStore({ beforeToolCommit: () => gate })
  const first = store.create()
  const second = store.create()
  const pending = store.tool(first.sessionId, tool(first))
  await tick()
  const reset = await store.lifecycle(first.sessionId, 'reset', command(first))
  release()
  await assert.rejects(pending, /earlier round/)
  assert.deepEqual(store.get(first.sessionId), reset)
  assert.deepEqual(store.get(second.sessionId), second)
  assert.throws(() => store.tool(second.sessionId, tool(reset)), /earlier round/)
})

test('stop blocks pending and new actions; resume permits fresh calls; end requires reset', async () => {
  const store = new SessionStore()
  const view = store.create()
  const stopped = await store.lifecycle(view.sessionId, 'stop', command(view))
  assert.equal((await store.tool(view.sessionId, tool(stopped))).ok, false)
  await assert.rejects(store.power(view.sessionId, command(stopped, { revision: stopped.revision, powerOn: false })), /stopped/)
  const resumed = await store.lifecycle(view.sessionId, 'resume', command(stopped))
  assert.equal((await store.tool(view.sessionId, tool(resumed))).ok, true)
  const ended = await store.lifecycle(view.sessionId, 'end', command(resumed))
  assert.equal(ended.status, 'ended')
  await assert.rejects(store.lifecycle(view.sessionId, 'resume', command(ended)), /has ended/)
  assert.equal((await store.lifecycle(view.sessionId, 'reset', command(ended))).status, 'active')
})

test('stop and end accepted before commit discard delayed robot actions', async () => {
  for (const action of ['stop', 'end'] as const) {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const store = new SessionStore({ beforeToolCommit: () => gate })
    const view = store.create()
    const pending = store.tool(view.sessionId, tool(view))
    await tick()
    const stopped = await store.lifecycle(view.sessionId, action, command(view))
    release()
    assert.equal((await pending).ok, false)
    assert.deepEqual(store.get(view.sessionId), stopped)
  }
})

test('session memory is bounded and idle sessions expire', () => {
  let now = 0
  const store = new SessionStore({ now: () => now, maxSessions: 1, idleMilliseconds: 100 })
  const view = store.create()
  assert.throws(() => store.create(), /session limit/)
  now = 101
  assert.throws(() => store.get(view.sessionId), /unavailable/)
  assert.ok(store.create().sessionId)
})

const select = (state: GameState, position: 'neutral' | 'anchor' | 'bridge') => applyRobotTool(state, 'interact_object', { object: 'latch', action: `select_${position}` })
const maintenanceRobotActions: Action[] = [...robotActions, ...(['neutral', 'anchor', 'bridge'] as const).map((position) => (state: GameState) => { select(state, position) })]

function reachableFrom(start: GameState, actions: Action[]): GameState[] {
  const pending = [{ ...start }]
  const seen = new Map<string, GameState>()
  while (pending.length) {
    const current = pending.shift()!
    const key = JSON.stringify([current.scenario, current.maintenanceProfile, current.powerOn, current.doorLatched, current.selector, current.robotLocation])
    if (seen.has(key)) continue
    seen.set(key, current)
    for (const action of actions) {
      const next = { ...current }
      action(next)
      pending.push(next)
    }
  }
  return [...seen.values()]
}

for (const [profile, correct, wrong] of [['crescent', 'anchor', 'bridge'], ['kite', 'bridge', 'anchor']] as const) {
  test(`Maintenance ${profile}: Neutral and wrong catches fail; correction and Power recovery work without restart`, () => {
    const state = initialState(undefined, 'maintenance', profile)
    assert.equal(state.selector, 'neutral')
    assert.equal(state.doorLatched, false)
    const initial = { ...state }
    assert.equal(latch(state).ok, false)
    assert.deepEqual(state, initial)
    select(state, wrong)
    const wrongState = { ...state }
    const failure = latch(state)
    assert.equal(failure.ok, false)
    assert.match(failure.message, /catch did not seat/)
    assert.ok(!failure.message.toLowerCase().includes(correct))
    assert.deepEqual(state, wrongState)
    applyHumanPower(state, false)
    assert.equal(cross(state).ok, false)
    assert.equal(select(state, correct).ok, true)
    assert.equal(state.doorLatched, false)
    assert.equal(latch(state).ok, false)
    applyHumanPower(state, true)
    assert.equal(latch(state).ok, true)
    const engaged = { ...state }
    assert.equal(select(state, wrong).ok, false)
    assert.equal(select(state, correct).ok, false)
    assert.deepEqual(state, engaged)
    assert.equal(cross(state).ok, false)
    applyHumanPower(state, false)
    assert.equal(cross(state).ok, true)
    assert.equal(humanView(state).completed, true)
  })

  test(`Maintenance ${profile}: all nine physical states preserve traversal and every nonterminal state is recoverable`, () => {
    const state = initialState(undefined, 'maintenance', profile)
    const actions = [...humanActions, ...maintenanceRobotActions]
    const states = reachableFrom(state, actions)
    assert.equal(states.length, 9)
    for (const reachable of states) {
      if (reachable.robotLocation === 'far_side') {
        assert.equal(conveyorRunning(reachable), false)
        assert.equal(doorOpen(reachable), true)
        assert.equal(reachable.doorLatched, true)
        assert.equal(reachable.selector, correct)
      } else assert.ok(reachableFrom(reachable, actions).some((candidate) => humanView(candidate).completed))
      const projection = humanView(reachable)
      assert.equal(projection.scenario, 'maintenance')
      assert.doesNotMatch(JSON.stringify(projection), /crescent|kite|anchor|bridge|neutral|selector|profile|doorLatched|conveyorRunning/i)
    }
    for (const solo of [humanActions, maintenanceRobotActions]) assert.ok(reachableFrom(state, solo).every((candidate) => !humanView(candidate).completed))
  })
}

test('Classic every reachable nonterminal state has a cooperative recovery path', () => {
  const actions = [...humanActions, ...robotActions]
  for (const state of reachableFrom(initialState(), actions)) {
    if (!humanView(state).completed) assert.ok(reachableFrom(state, actions).some((candidate) => humanView(candidate).completed))
  }
})

test('Maintenance plate is learned only on inspection and never includes the manual mapping', () => {
  for (const profile of ['crescent', 'kite'] as const) {
    const state = initialState(undefined, 'maintenance', profile)
    assert.doesNotMatch(robotView(state).message, /crescent|kite|anchor|bridge|selector/i)
    const inspection = applyRobotTool(state, 'inspect_object', { object: 'latch' })
    assert.match(inspection.message, new RegExp(profile, 'i'))
    assert.ok(!inspection.message.toLowerCase().includes(profile === 'crescent' ? 'kite' : 'crescent'))
    assert.match(inspection.message, /Neutral, Anchor, and Bridge/)
    assert.doesNotMatch(inspection.message, /Crescent.{0,20}Anchor|Kite.{0,20}Bridge|holdingSetting|powerOn/)
  }
})

test('scenario and hidden plate remain fixed across pause and resume; only reset selects a new scenario', async () => {
  const store = new SessionStore()
  let view = store.create('maintenance')
  const before = await store.tool(view.sessionId, tool(view, { name: 'inspect_object', arguments: { object: 'latch' } }))
  view = await store.lifecycle(view.sessionId, 'stop', command(view))
  view = await store.lifecycle(view.sessionId, 'resume', command(view))
  assert.equal(view.scenario, 'maintenance')
  const after = await store.tool(view.sessionId, tool(view, { name: 'inspect_object', arguments: { object: 'latch' } }))
  assert.equal(before.message, after.message)
  assert.throws(() => store.lifecycle(view.sessionId, 'resume', command(view, { scenario: 'classic' })), /Only Restart/)
  const reset = await store.lifecycle(view.sessionId, 'reset', command(view, { scenario: 'classic' }))
  assert.equal(reset.scenario, 'classic')
  assert.notEqual(reset.roundId, view.roundId)
  const classic = await store.tool(view.sessionId, tool(reset, { name: 'inspect_object', arguments: { object: 'latch' } }))
  assert.doesNotMatch(classic.message, /selector|crescent|kite/i)
})

test('Maintenance revalidates selector immediately before a delayed latch commits', async () => {
  let release!: () => void
  let calls = 0
  const gate = new Promise<void>((resolve) => { release = resolve })
  const store = new SessionStore({ beforeToolCommit: async () => { if (++calls === 3) await gate } })
  let view = store.create('maintenance')
  const inspection = await store.tool(view.sessionId, tool(view, { name: 'inspect_object', arguments: { object: 'latch' } }))
  const correct = inspection.message.includes('Crescent') ? 'anchor' : 'bridge'
  const wrong = correct === 'anchor' ? 'bridge' : 'anchor'
  view = (await store.tool(view.sessionId, tool(view, { arguments: { object: 'latch', action: `select_${correct}` } }))).view
  const pending = store.tool(view.sessionId, tool(view))
  await tick()
  const changed = await store.tool(view.sessionId, tool(view, { arguments: { object: 'latch', action: `select_${wrong}` } }))
  release()
  const result = await pending
  assert.equal(result.ok, false)
  assert.match(result.message, /catch did not seat/)
  assert.equal(result.view.revision, changed.view.revision)
  assert.equal(result.view.completed, false)
})
