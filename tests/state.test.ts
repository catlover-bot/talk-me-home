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
    assert.deepEqual(Object.keys(projection).sort(), ['sessionId', 'roundId', 'revision', 'actionEpoch', 'powerOn', 'status', 'completed'].sort())
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
