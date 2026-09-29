import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { SessionStore } from '../game/server/sessions.js'
import { applyRobotTool, initialState, robotView } from '../game/server/state.js'
import { gateDirections, type HumanView, type ToolResponse } from '../game/shared/contracts.js'
import { localToolDiagnosticSink, type ToolDiagnostic } from '../game/server/tool-diagnostics.js'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createGameServer } from '../game/server/http.js'

const owner = 'direction-inspection-owner'
const envelope = (view: HumanView, extra = {}) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID(), ...extra })
const call = (store: SessionStore, view: HumanView, name: string, args = {}, extra = {}) => store.tool(view.sessionId, {
  roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name, arguments: args, ...extra,
})
const confirm = (store: SessionStore, result: ToolResponse) => store.decideProposal(result.view.sessionId, {
  roundId: result.view.roundId, requestId: randomUUID(), proposalId: result.proposal!.id, decision: 'confirm',
}, owner)
async function enter(store: SessionStore) {
  let view = store.create('classic', 'rescue', owner)
  view = (await confirm(store, await call(store, view, 'propose_interaction', { object: 'latch', action: 'latch_open' }))).view
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }))
  return confirm(store, await call(store, view, 'propose_move', { target: 'far_side' }))
}

test('constructed baseline: observed direction inspection is read-only and preserves open versus passage facts', async () => {
  const store = new SessionStore(); const entry = await enter(store)
  const before = store.physicalDigestForEvaluation(entry.view.sessionId)
  const result = await call(store, entry.view, 'inspect_gate', { direction: 'east' }, { inspectionScope: { visitId: entry.perception!.visitId } })
  assert.equal(result.ok, true)
  assert.deepEqual(result.perception?.gates[0], { handle: 'gallery.g1', direction: 'East', power: 'unpowered', door: 'closed', passage: 'clear' })
  assert.equal(store.physicalDigestForEvaluation(entry.view.sessionId), before)
  assert.equal(result.proposal, undefined)
})

test('constructed baseline: invalid, unknown and nonlocal Gallery inspections have distinct useful recovery', () => {
  const state = initialState(undefined, 'classic', undefined, 'rescue', 'a'); state.chapter = 'gallery'; state.chapterEpoch = 1
  robotView(state)
  for (const [args, code] of [[{}, 'invalid_arguments'], [{ object: 'made-up-gate' }, 'unknown_target'], [{ object: 'gallery.g5' }, 'nonlocal_target']] as const) {
    const result = applyRobotTool(state, 'inspect_object', args)
    assert.equal(result.code, code)
    assert.equal(result.recovery, 'observe_room')
    assert.doesNotMatch(result.message, /Mission Control.*(?:ID|label)|Leaf|Sail|configuration/)
  }
})

test('all observed local directions resolve exactly in both layouts; closed gates can be clear and open gates blocked', () => {
  const local = { ring: { east: 'gallery.g1' }, fork: { west: 'gallery.g1', northeast: 'gallery.g2', southeast: 'gallery.g4' },
    sail: { southwest: 'gallery.g2', southeast: 'gallery.g3' }, leaf: { northwest: 'gallery.g4', northeast: 'gallery.g5' } }
  let inspected = 0
  for (const configuration of ['a', 'b'] as const) for (const room of ['ring', 'fork', 'sail', 'leaf'] as const) for (const relay of ['off', 'beacon', 'harbor'] as const) {
    const state = initialState(undefined, 'classic', undefined, 'rescue', configuration)
    state.chapter = 'gallery'; state.chapterEpoch = 1; state.gallery.room = room; state.gallery.relay = relay
    const survey = robotView(state, 1000)
    assert.ok(survey.perception!.gates.every(gate => gate.passage === 'unchecked'))
    for (const direction of gateDirections) {
      const result = applyRobotTool(state, 'inspect_gate', { direction }, 1001, { visitId: state.gallery.visitId })
      const target = (local[room] as Record<string, string>)[direction]
      if (!target) { assert.equal(result.code, 'direction_unavailable'); assert.equal(result.perception, undefined); continue }
      inspected += 1; assert.equal(result.ok, true)
      const gate = result.perception!.gates.find(candidate => candidate.handle === target)!
      assert.equal(gate.passage, target === (configuration === 'a' ? 'gallery.g3' : 'gallery.g5') ? 'blocked' : 'clear')
      const powered = relay === (['gallery.g1', 'gallery.g3', 'gallery.g4'].includes(target) ? 'beacon' : 'harbor')
      assert.equal(gate.power, powered ? 'powered' : 'unpowered'); assert.equal(gate.door, powered ? 'open' : 'closed')
      assert.ok(result.perception!.gates.filter(candidate => candidate.handle !== target).every(candidate => candidate.passage === 'unchecked'))
      assert.equal(state.gallery.room, room); assert.equal(state.revision, 0); assert.equal(state.actionEpoch, 0)
    }
  }
  assert.equal(inspected, 48)
})

test('unobserved, ambiguous, missing and forged direction inputs never select a fallback gate', () => {
  const state = initialState(undefined, 'classic', undefined, 'rescue', 'a'); state.chapter = 'gallery'
  const scope = { visitId: state.gallery.visitId }
  assert.equal(applyRobotTool(state, 'inspect_gate', { direction: 'east' }, 1000, scope).code, 'target_unobserved')
  robotView(state, 1000)
  state.gallery.observed!.gates.push({ ...state.gallery.observed!.gates[0]! })
  assert.equal(applyRobotTool(state, 'inspect_gate', { direction: 'east' }, 1000, scope).code, 'direction_ambiguous')
  robotView(state, 1000)
  for (const args of [{}, { direction: 'EAST' }, { direction: 'east or west' }, { direction: 'east', room: 'fork' }, { direction: 'east', approved: true }]) {
    assert.equal(applyRobotTool(state, 'inspect_gate', args, 1000, scope).code, 'invalid_arguments')
  }
  state.gallery.visitId = randomUUID()
  assert.equal(applyRobotTool(state, 'inspect_gate', { direction: 'east' }, 1000, scope).code, 'stale_scope')
  assert.equal(applyRobotTool(state, 'inspect_gate', { direction: 'east' }, 1000, { visitId: state.gallery.visitId }).code, 'target_unobserved')
  assert.equal(state.revision, 0); assert.equal(state.gallery.room, 'ring')
})

test('delayed direction inspection cannot bind to a new visit, even after returning to the same room', async () => {
  let hold = false; let release: (() => void) | undefined
  const diagnostics: ToolDiagnostic[] = []
  const store = new SessionStore({ onToolDiagnostic: event => diagnostics.push(event), beforeToolCommit: async () => {
    if (hold) { hold = false; await new Promise<void>(resolve => { release = resolve }) }
  } })
  const entry = await enter(store)
  let view = await store.control(entry.view.sessionId, 'relay', envelope(entry.view, { revision: entry.view.revision, relay: 'beacon' }))
  const scope = { inspectionScope: { visitId: entry.perception!.visitId } }
  hold = true
  const pending = call(store, view, 'inspect_gate', { direction: 'east' }, scope)
  await new Promise(resolve => setImmediate(resolve))
  view = (await confirm(store, await call(store, view, 'propose_move', { target: 'gallery.g1' }))).view
  const returned = await confirm(store, await call(store, view, 'propose_move', { target: 'gallery.g1' }))
  assert.notEqual(returned.perception!.visitId, entry.perception!.visitId)
  release!()
  const stale = await pending
  assert.equal(stale.code, 'stale_scope'); assert.equal(stale.perception, undefined)
  assert.equal(diagnostics.at(-1)!.scope.visit, false); assert.equal(diagnostics.at(-1)!.scope.action, false)
  // Even forged current public generations cannot refresh an old robot-only visit.
  assert.equal((await call(store, returned.view, 'inspect_gate', { direction: 'east' }, scope)).code, 'stale_scope')
  assert.equal((await call(store, returned.view, 'inspect_gate', { direction: 'east' }, { inspectionScope: { visitId: returned.perception!.visitId } })).ok, true)
})

test('scope rejects chapter/action changes and stopped missions; same-visit Relay changes do not require redundant surveys', async () => {
  const store = new SessionStore({ galleryConfiguration: 'a' }); const entry = await enter(store)
  let view = entry.view; const scope = { inspectionScope: { visitId: entry.perception!.visitId } }
  assert.equal((await call(store, view, 'inspect_gate', { direction: 'east' })).code, 'stale_scope')
  assert.equal((await call(store, view, 'inspect_gate', { direction: 'east' }, { ...scope, chapterEpoch: 0 })).code, 'stale_scope')
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }))
  const fresh = await call(store, view, 'inspect_gate', { direction: 'east' }, scope)
  assert.equal(fresh.perception?.gates[0]?.door, 'open')
  view = await store.lifecycle(view.sessionId, 'cancel', envelope(view, { reason: 'supersede' }))
  assert.equal((await call(store, entry.view, 'inspect_gate', { direction: 'east' }, scope)).code, 'stale_scope')
  assert.equal((await call(store, view, 'inspect_gate', { direction: 'east' }, scope)).ok, true)
  view = await store.lifecycle(view.sessionId, 'stop', envelope(view))
  const stopped = await call(store, view, 'inspect_gate', { direction: 'east' }, scope)
  assert.equal(stopped.code, 'mission_stopped'); assert.equal(stopped.recovery, 'resume_mission')
  const cargo = store.create('classic', 'training', owner)
  assert.equal((await call(store, cargo, 'inspect_gate', { direction: 'east' })).code, 'tool_unavailable')
  assert.equal((await call(store, cargo, 'inspect_object', { object: 'latch' })).ok, true)
  const rescueCargo = store.create('classic', 'rescue', owner)
  assert.equal((await call(store, rescueCargo, 'inspect_gate', { direction: 'east' })).code, 'tool_unavailable')
  assert.equal((await call(store, rescueCargo, 'inspect_gate', { direction: 'east' }, { chapterEpoch: 1 })).code, 'stale_scope')
  view = await store.lifecycle(view.sessionId, 'resume', envelope(view))
  for (const target of ['gallery.g1', 'gallery.g4']) view = (await confirm(store, await call(store, view, 'propose_move', { target }))).view
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'harbor' }))
  view = (await confirm(store, await call(store, view, 'propose_move', { target: 'gallery.g5' }))).view
  assert.equal(view.chapter, 'return_dock')
  assert.equal((await call(store, view, 'inspect_gate', { direction: 'east' })).code, 'tool_unavailable')
  assert.equal((await call(store, view, 'inspect_gate', { direction: 'east' }, { ...scope, chapterEpoch: 1 })).code, 'stale_scope')
  assert.equal((await call(store, view, 'inspect_object', { object: 'return.contact' })).ok, true)
})

test('inspection retries preserve exact confirmation isolation, one observation and private human projections', async () => {
  const store = new SessionStore(); const entry = await enter(store); const view = entry.view
  const pending = await call(store, view, 'propose_move', { target: 'gallery.g1' })
  const before = store.physicalDigestForEvaluation(view.sessionId)
  const args = { roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name: 'inspect_gate', arguments: { direction: 'east' }, inspectionScope: { visitId: entry.perception!.visitId } }
  const [first, duplicate] = await Promise.all([store.tool(view.sessionId, args), store.tool(view.sessionId, args)])
  assert.deepEqual(duplicate, first)
  assert.equal(store.physicalDigestForEvaluation(view.sessionId), before)
  assert.equal(first.proposal, undefined); assert.equal(first.view.proposal?.id, pending.proposal!.id)
  assert.equal(first.view.proposal?.status, 'awaiting_confirmation')
  assert.equal(store.recap(view.sessionId, view.roundId).entries.filter(item => item.observationOrigin === 'gate_inspection').length, 1)
  assert.doesNotMatch(JSON.stringify([first.view, store.record(view.sessionId, view.roundId)]), /visitId|perception|Ring|Fork|gallery\.g[2-5]/)
})

test('private validation diagnostics classify actual boundary checks and hash unexpected target strings', async () => {
  const events: ToolDiagnostic[] = []; const store = new SessionStore({ onToolDiagnostic: event => events.push(event) }); const entry = await enter(store)
  events.length = 0
  const unexpected = 'https://credential:secret@example.invalid/private?token=secret'
  const result = await call(store, entry.view, 'inspect_object', { object: unexpected })
  assert.equal(result.code, 'unknown_target'); assert.equal(events.length, 1)
  assert.equal(events[0]!.stage, 'target_resolution'); assert.equal(events[0]!.target, undefined)
  assert.match(events[0]!.targetSha256!, /^[0-9a-f]{64}$/)
  assert.equal(events[0]!.scope.round, true); assert.equal(events[0]!.scope.chapter, true)
  assert.ok(events[0]!.finishedAtMs >= events[0]!.startedAtMs)
  assert.equal(events[0]!.elapsedMs, events[0]!.finishedAtMs - events[0]!.startedAtMs)
  assert.throws(() => call(store, entry.view, 'inspect_gate', { direction: 'east' }, { inspectionScope: { visitId: entry.perception!.visitId, room: 'fork' } }), /local tool request/)
  assert.equal(events[1]!.stage, 'request_schema'); assert.equal(events[1]!.code, 'invalid_arguments')
  assert.doesNotMatch(JSON.stringify(events), /credential|secret|example|"arguments":|"room":|Fork|Ring|configuration|cookie|token/)
  assert.doesNotMatch(JSON.stringify(result.view), /diagnostic|targetSha256|visitId/)
})

test('diagnostic output is explicit, loopback-only, bounded and never overwrites old artifacts', t => {
  const directory = resolve('.validation', `inspection-diagnostic-test-${randomUUID()}`); mkdirSync(directory, { recursive: true })
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = resolve(directory, 'events.jsonl')
  assert.equal(localToolDiagnosticSink(undefined, '0.0.0.0', 'https://example.invalid'), undefined)
  assert.throws(() => localToolDiagnosticSink(file, '0.0.0.0', 'http://127.0.0.1:3001'), /loopback/)
  assert.throws(() => localToolDiagnosticSink(file, '127.0.0.1', 'https://example.invalid'), /loopback/)
  assert.throws(() => localToolDiagnosticSink(resolve('outside.jsonl'), '127.0.0.1', 'http://127.0.0.1:3001'), /validation/)
  assert.equal(existsSync(file), false)
  const sink = localToolDiagnosticSink(file, '127.0.0.1', 'http://127.0.0.1:3001')!
  const event: ToolDiagnostic = { tool: 'inspect_gate', target: 'east', sessionSha256: 'a'.repeat(64), scope: { round: true, chapter: true, action: true, visit: true }, stage: 'complete', code: 'ok', startedAtMs: 1, finishedAtMs: 2, elapsedMs: 1 }
  for (let i = 0; i < 2001; i++) sink(event)
  assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 2000)
  assert.throws(() => localToolDiagnosticSink(file, '127.0.0.1', 'http://127.0.0.1:3001'), /existing evidence/)
  const linked = resolve(directory, 'linked'); symlinkSync(directory, linked)
  assert.throws(() => localToolDiagnosticSink(resolve(linked, 'new.jsonl'), '127.0.0.1', 'http://127.0.0.1:3001'), /symbolic/)
})

test('actual HTTP errors retain classified schema and stale-scope recovery without exposing diagnostic payloads', async () => {
  let providerCalls = 0
  const diagnostics: ToolDiagnostic[] = []
  const store = new SessionStore({ onToolDiagnostic: event => diagnostics.push(event) })
  const server = createGameServer({ store, apiKey: '', fetch: (async () => { providerCalls++; throw new Error('Provider calls are forbidden in this test.') }) as typeof fetch })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    let cookie = ''
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
    const created = await post('/api/sessions', { missionKind: 'rescue', scenario: 'classic' })
    cookie = created.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))!.split(';')[0]!
    const view = await created.json() as HumanView
    const request = { roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: randomUUID(), name: 'inspect_gate', arguments: { direction: 'east' } }
    const invalid = await post(`/api/sessions/${view.sessionId}/tools`, { ...request, arguments: 'bad-schema' })
    assert.equal(invalid.status, 400)
    assert.deepEqual(await invalid.json(), { error: 'A local tool request requires the current round, call identifier, action epoch, tool name, and object arguments.', code: 'invalid_arguments', recovery: 'observe_room' })
    const stale = await post(`/api/sessions/${view.sessionId}/tools`, { ...request, roundId: randomUUID() })
    assert.equal(stale.status, 409)
    const body = await stale.json()
    assert.equal(body.code, 'stale_scope'); assert.equal(body.recovery, 'observe_room')
    assert.equal(diagnostics.at(-1)!.scope.round, false)
    assert.doesNotMatch(JSON.stringify(body), /Sha256|diagnostic|visitId|configuration/)
    assert.equal(providerCalls, 0)
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
