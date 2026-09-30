import assert from 'node:assert/strict'
import test from 'node:test'
import { isSwitchyardLayout, previewSwitchyardRouting, type SwitchyardRotations, type SwitchyardTerminal } from '../game/shared/switchyard.js'
import { applySwitchyardPanel, applySwitchyardTool, describeSwitchyardProposal, initialSwitchyardState, switchyardHumanView, switchyardObservation, type SwitchyardConfiguration, type SwitchyardState } from '../game/server/switchyard.js'

// Exhaustive evaluator data stays in tests. Neither the companion nor client imports a solution.
const boards = new Map<string, SwitchyardRotations>()
const counts = new Map<string, number>()
for (let encoded = 0; encoded < 4096; encoded++) {
  const layout = Array.from({ length: 6 }, (_, index) => (encoded >> (index * 2)) & 3) as SwitchyardRotations
  const preview = previewSwitchyardRouting(layout)
  const key = preview.poweredTerminals.join(',')
  counts.set(key, (counts.get(key) ?? 0) + 1)
  if (preview.valid && !boards.has(key)) boards.set(key, layout)
}
const row = (config: SwitchyardConfiguration) => config === 'a'
  ? { index: 'set_index_one', test: ['blue'], run: ['amber', 'blue'], winch: ['white'], align: ['amber'], bridge: ['amber', 'white'] }
  : { index: 'set_index_two', test: ['white'], run: ['amber', 'white'], winch: ['blue'], align: ['white'], bridge: ['blue', 'white'] }
function panel(s: SwitchyardState, terminals: string[]) {
  const result = applySwitchyardPanel(s, boards.get(terminals.join(',')))
  assert.equal(result.ok, true, result.message)
}
function inspect(s: SwitchyardState) {
  const observation = switchyardObservation(s).switchyardObservation!
  const result = applySwitchyardTool(s, 'inspect_object', { object: observation.devices[0]!.id }, { visitId: s.visitId })
  assert.equal(result.ok, true, result.message)
  return result
}
function act(s: SwitchyardState, action: string) {
  const observed = inspect(s).switchyardObservation!
  const result = applySwitchyardTool(s, 'interact_object', { object: observed.devices[0]!.id, action }, { visitId: s.visitId })
  assert.equal(result.ok, true, result.message)
  return result
}
function move(s: SwitchyardState, target: string) {
  switchyardObservation(s)
  const result = applySwitchyardTool(s, 'move_to', { target }, { visitId: s.visitId })
  assert.equal(result.ok, true, result.message)
  return result
}
function restoreLift(s: SwitchyardState) {
  const rules = row(s.configuration)
  move(s, 'switchyard.to_transfer'); move(s, 'switchyard.to_lift')
  panel(s, []); act(s, rules.index); panel(s, rules.test); act(s, 'test_lift')
  panel(s, rules.run); move(s, 'switchyard.ride_lift')
}
function restoreBypass(s: SwitchyardState, fromTransfer = false) {
  const rules = row(s.configuration)
  if (!fromTransfer) move(s, 'switchyard.to_transfer')
  move(s, 'switchyard.to_service'); panel(s, []); act(s, 'seat_brace')
  panel(s, rules.winch); act(s, 'deploy_bridge'); move(s, 'switchyard.to_transfer')
  panel(s, rules.align); act(s, 'align_turntable'); move(s, 'switchyard.to_service')
  inspect(s); panel(s, rules.bridge); move(s, 'switchyard.cross_bridge')
}

test('all 4096 board orientations are deterministic; every safe supply subset exists and all overloads are harmless', () => {
  assert.deepEqual(Object.fromEntries([...counts].sort()), { '': 3304, amber: 520, 'amber,blue': 66, 'amber,blue,white': 4, 'amber,white': 40, blue: 66, 'blue,white': 4, white: 92 })
  assert.equal(boards.size, 7)
  for (let encoded = 0; encoded < 4096; encoded++) {
    const layout = Array.from({ length: 6 }, (_, index) => (encoded >> (index * 2)) & 3) as SwitchyardRotations
    const preview = previewSwitchyardRouting(layout)
    assert.deepEqual(preview, previewSwitchyardRouting([...layout]))
    const state = initialSwitchyardState('a'); const before = structuredClone(state)
    const result = applySwitchyardPanel(state, layout)
    assert.equal(result.ok, preview.valid)
    if (preview.valid) assert.deepEqual(switchyardHumanView(state).poweredTerminals, preview.poweredTerminals)
    else assert.deepEqual(state, before)
  }
})

test('panel rejects malformed pieces, sparse arrays, extra properties and terminal substitution without mutation', () => {
  const sparse = [0, 0, 0, 0, 0, 0]; delete sparse[2]; Object.assign(sparse, { forged: 0 })
  const extra = Object.assign([0, 0, 0, 0, 0, 0], { capacity: 3 })
  for (const invalid of [null, {}, [], [0, 0, 0], [0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0.5], [0, 0, 0, 0, 0, '0'], [0, 0, 0, 0, 0, null], sparse, extra, { rotations: [0, 0, 0, 0, 0, 0], terminals: [] }]) {
    const state = initialSwitchyardState('b'); const before = structuredClone(state)
    assert.equal(isSwitchyardLayout(invalid), false)
    assert.equal(applySwitchyardPanel(state, invalid).ok, false)
    assert.deepEqual(state, before)
  }
})

for (const config of ['a', 'b'] as const) {
  test(`configuration ${config}: both mechanically different approaches reach the same confirmed home`, () => {
    const lift = initialSwitchyardState(config); restoreLift(lift)
    assert.equal(lift.completed, false); assert.equal(lift.approach, 'lift')
    assert.equal(lift.bridgeDeployed, false); assert.equal(lift.turntableAligned, false)
    act(lift, 'depart'); assert.equal(lift.completed, true)
    const bypass = initialSwitchyardState(config); restoreBypass(bypass)
    assert.equal(bypass.completed, false); assert.equal(bypass.approach, 'bypass')
    assert.equal(bypass.liftIndex, 0); assert.equal(bypass.liftTested, false)
    act(bypass, 'depart'); assert.equal(bypass.completed, true)
    const before = structuredClone(bypass)
    assert.equal(applySwitchyardTool(bypass, 'interact_object', { object: 'switchyard.return', action: 'depart' }, { visitId: bypass.visitId }).ok, false)
    assert.equal(applySwitchyardPanel(bypass, boards.get('')).ok, false)
    assert.deepEqual(bypass, before)
  })

  test(`configuration ${config}: wrong calibration and a late route revision retain safe reversible progress`, () => {
    const s = initialSwitchyardState(config); const rules = row(config)
    move(s, 'switchyard.to_transfer'); move(s, 'switchyard.to_lift')
    act(s, config === 'a' ? 'set_index_two' : 'set_index_one'); panel(s, rules.test)
    const before = structuredClone(s)
    assert.equal(applySwitchyardTool(s, 'interact_object', { object: 'switchyard.lift', action: 'test_lift' }, { visitId: s.visitId }).ok, false)
    assert.deepEqual(s, before)
    panel(s, []); act(s, rules.index); panel(s, rules.test); act(s, 'test_lift'); panel(s, rules.run)
    move(s, 'switchyard.ride_lift'); panel(s, [])
    move(s, 'switchyard.back_lift'); move(s, 'switchyard.to_transfer')
    restoreBypass(s, true); assert.equal(s.liftTested, true); assert.equal(s.approach, 'bypass')
    act(s, 'depart'); assert.equal(s.completed, true)
  })
}

test('local discovery, current visit and exact arguments constrain inspection, movement and proposals', () => {
  const s = initialSwitchyardState('a')
  assert.equal(describeSwitchyardProposal(s, { kind: 'move', target: 'switchyard.to_transfer' }), null)
  assert.equal(applySwitchyardTool(s, 'move_to', { target: 'switchyard.to_transfer' }, { visitId: s.visitId }).code, 'target_unobserved')
  const observed = switchyardObservation(s); const oldVisit = s.visitId
  assert.equal(observed.switchyardObservation?.stateRevision, s.revision)
  assert.equal(observed.switchyardObservation?.devices[0]?.actions, undefined)
  const unchanged = structuredClone(s)
  assert.equal(describeSwitchyardProposal(s, { kind: 'move', target: 'switchyard.to_transfer' }), 'Go to Transfer Table')
  assert.deepEqual(s, unchanged)
  assert.equal(applySwitchyardTool(s, 'inspect_object', { object: 'switchyard.lift' }, { visitId: s.visitId }).code, 'nonlocal_target')
  assert.equal(applySwitchyardTool(s, 'observe_room', { solution: true }).code, 'invalid_arguments')
  move(s, 'switchyard.to_transfer')
  assert.equal(applySwitchyardTool(s, 'inspect_object', { object: 'switchyard.turntable' }, { visitId: oldVisit }).code, 'stale_scope')
  assert.equal(describeSwitchyardProposal(s, { kind: 'interaction', object: 'switchyard.turntable', action: 'align_turntable' }), null)
  const report = inspect(s)
  assert.match(report.message, /Align the turntable/)
  assert.equal(describeSwitchyardProposal(s, { kind: 'interaction', object: 'switchyard.turntable', action: 'align_turntable' }), 'Align the turntable')
  assert.equal(describeSwitchyardProposal(s, { kind: 'interaction', object: 'switchyard.turntable', action: 'depart' }), null)
  const before = structuredClone(s)
  assert.equal(applySwitchyardTool(s, 'interact_object', { object: 'switchyard.return', action: 'depart' }, { visitId: s.visitId }).code, 'nonlocal_target')
  assert.equal(applySwitchyardTool(s, 'move_to', { target: 'switchyard.to_lift', configuration: 'b' }, { visitId: s.visitId }).code, 'invalid_arguments')
  assert.deepEqual(s, before)
})

test('human panel projection contains no installed plate, room, machine readiness or premature ending', () => {
  const a = initialSwitchyardState('a'); const b = initialSwitchyardState('b')
  assert.deepEqual(switchyardHumanView(a), switchyardHumanView(b))
  restoreLift(a)
  assert.deepEqual(Object.keys(switchyardHumanView(a)).sort(), ['appliedRotations', 'panelRevision', 'poweredTerminals'])
  const view = switchyardHumanView(a); view.appliedRotations[0] = (view.appliedRotations[0] + 1) % 4 as 0 | 1 | 2 | 3
  assert.notDeepEqual(view.appliedRotations, a.appliedRotations)
  assert.equal(JSON.stringify(view).includes('Crescent'), false)
})

function physicalKey(s: SwitchyardState): string {
  return JSON.stringify([s.location, previewSwitchyardRouting(s.appliedRotations).poweredTerminals, s.liftIndex, s.liftTested, s.braceSeated, s.bridgeDeployed, s.turntableAligned, s.approach, s.completed])
}
for (const config of ['a', 'b'] as const) test(`configuration ${config}: all reachable physical states can still reach both endings before departure`, t => {
  // Board orientations are quotiented by their seven powered-terminal sets. Every mechanical guard reads only that set.
  // Current observations/inspections are always recoverable read-only operations; visit IDs and revisions carry no puzzle resources.
  const start = initialSwitchyardState(config); const queue: SwitchyardState[] = [start]; const ids = new Map([[physicalKey(start), 0]])
  const reverse: number[][] = [[]]; let edges = 0
  for (let index = 0; index < queue.length; index++) {
    const s = queue[index]!
    if (s.completed) continue
    const candidates: SwitchyardState[] = []
    for (const layout of boards.values()) { const next = structuredClone(s); if (applySwitchyardPanel(next, layout).ok) candidates.push(next) }
    const ready = structuredClone(s); const observation = inspect(ready).switchyardObservation!
    for (const exit of observation.exits) {
      const next = structuredClone(ready)
      if (applySwitchyardTool(next, 'move_to', { target: exit.target }, { visitId: next.visitId }).ok) candidates.push(next)
    }
    for (const device of observation.devices) for (const action of device.actions ?? []) {
      const next = structuredClone(ready)
      if (applySwitchyardTool(next, 'interact_object', { object: device.id, action: action.action }, { visitId: next.visitId }).ok) candidates.push(next)
    }
    for (const next of candidates) {
      const key = physicalKey(next)
      let nextId = ids.get(key)
      if (nextId === undefined) { nextId = queue.length; ids.set(key, nextId); queue.push(next); reverse.push([]) }
      reverse[nextId]!.push(index); edges += 1
    }
    assert(queue.length < 50000, 'The finite state search must remain bounded without silently truncating coverage.')
  }
  for (const approach of ['lift', 'bypass'] as const) {
    const reachable = new Set(queue.flatMap((s, i) => s.completed && s.approach === approach ? [i] : [])); const pending = [...reachable]
    assert(reachable.size > 0)
    while (pending.length) for (const predecessor of reverse[pending.pop()!]!) if (!reachable.has(predecessor)) { reachable.add(predecessor); pending.push(predecessor) }
    const stranded = queue.flatMap((s, i) => !s.completed && !reachable.has(i) ? [i] : [])
    assert.deepEqual(stranded, [], `Every active physical state retains a path to the ${approach} ending.`)
  }
  t.diagnostic(`Complete reachable-state quotient: ${queue.length} states, ${edges} transitions, seven safe routing classes; no active state prevents either ending.`)
})
