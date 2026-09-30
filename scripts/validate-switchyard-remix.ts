/** Developer-only exhaustive proof over the shipped transition functions. No network or browser. */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { previewSwitchyardRouting, SWITCHYARD_DIRECTIONS, type SwitchyardRotations, type SwitchyardPanelSpec, type SwitchyardAssignment, type SwitchyardApproach } from '../game/shared/switchyard.js'
import { REMIX_PANELS, REMIX_PROFILES, REMIX_LIFT_ROWS, REMIX_SERVICE_ROWS, REMIX_SCHEMATICS, createRunSpec, type RemixPanelId, type RemixProfile } from '../game/server/remix-catalog.js'
import { applySwitchyardPanel, applySwitchyardTool, initialSwitchyardState, switchyardHumanView, type SwitchyardState } from '../game/server/switchyard.js'
import { REMIX_RULE_SOURCES, R1_EXECUTION_SOURCES, sha256, type RemixCertificate } from '../game/server/remix-certificates.js'
import { REMIX_CERTIFICATE } from '../game/server/remix-certificate-data.js'
import { canonicalPanel, canonicalMechanical, CANONICAL_SCHEMA } from './switchyard-canonical.js'

export const VALIDATOR_SCHEMA = 'switchyard-reachable-quotient-v1'
const assignments: readonly SwitchyardAssignment[] = ['rescue', 'lift_survey', 'service_restoration']
const approaches: readonly SwitchyardApproach[] = ['lift', 'bypass']
const dispatch = { code: 'developer-validation', recentToken: 'developer-validation' }
const encoding = (rotations: readonly number[]) => rotations.reduce((value, rotation, index) => value | rotation << (index * 2), 0)
export const decodeLayout = (value: number): SwitchyardRotations => Array.from({ length: 6 }, (_, index) => (value >> (index * 2)) & 3) as SwitchyardRotations
const terminalKey = (terminals: readonly string[]) => [...terminals].sort().join(',')
const clone = (state: SwitchyardState): SwitchyardState => ({ ...state, appliedRotations: [...state.appliedRotations], inspectedDevices: [...state.inspectedDevices] })
const assigned = (s: SwitchyardState, assignment: SwitchyardAssignment) => assignment === 'rescue' || (assignment === 'lift_survey' ? s.liftSurveyed : s.serviceRestored)

/** Independent circuit oracle checks reciprocal contacts, not a second mechanical evaluator. */
export function reciprocalPower(panel: SwitchyardPanelSpec, rotations: SwitchyardRotations): string[] {
  const ports = panel.pieces.map((piece, index) => new Set(piece.ports.map(port => (SWITCHYARD_DIRECTIONS.indexOf(port) + rotations[index]!) % 4)))
  const source = panel.pieces.findIndex(piece => piece.id === panel.source.pieceId)
  if (!ports[source]!.has(SWITCHYARD_DIRECTIONS.indexOf(panel.source.side))) return []
  const active = new Set([source]); const pending = [source]
  const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
  while (pending.length) {
    const index = pending.pop()!; const piece = panel.pieces[index]!
    for (const direction of ports[index]!) {
      const [dx, dy] = steps[direction]!
      const next = panel.pieces.findIndex(candidate => candidate.column === piece.column + dx && candidate.row === piece.row + dy)
      if (next >= 0 && ports[next]!.has((direction + 2) % 4) && !active.has(next)) { active.add(next); pending.push(next) }
    }
  }
  return panel.terminals.filter(terminal => {
    const index = panel.pieces.findIndex(piece => piece.id === terminal.pieceId)
    return active.has(index) && ports[index]!.has(SWITCHYARD_DIRECTIONS.indexOf(terminal.side))
  }).map(terminal => terminal.id).sort()
}
export interface PanelProof {
  id: RemixPanelId
  signature: string
  counts: Record<string, number>
  representatives: Map<string, SwitchyardRotations>
  powers: string[]
  starts: SwitchyardRotations[]
  rotationDistances: Record<string, Record<string, number>>
  startDistanceRanges: Record<string, [number, number]>
}
export function validatePanel(id: RemixPanelId, pinnedStarts?: readonly SwitchyardRotations[]): PanelProof {
  const panel = REMIX_PANELS[id]; const profile = REMIX_PROFILES.find(candidate => candidate.panelId === id)!
  const counts: Record<string, number> = {}; const representatives = new Map<string, SwitchyardRotations>(); const powers: string[] = []
  const safeIsolated: SwitchyardRotations[] = []
  for (let encoded = 0; encoded < 4096; encoded++) {
    const rotations = decodeLayout(encoded); const preview = previewSwitchyardRouting(rotations, panel); const key = terminalKey(preview.poweredTerminals)
    assert.deepEqual([...preview.poweredTerminals].sort(), reciprocalPower(panel, rotations), `${id}: reciprocal contacts at ${encoded}`)
    assert.deepEqual(preview, previewSwitchyardRouting([...rotations], panel), `${id}: deterministic preview`)
    assert.equal(preview.valid, preview.poweredTerminals.length <= panel.capacity)
    counts[key] = (counts[key] ?? 0) + 1; powers.push(key)
    // Construct safely, then submit every board through the real mutation boundary.
    const state = initialSwitchyardState('a', createRunSpec(profile.index, [0, 0, 0, 0, 0, 0], 'rescue', 0, dispatch))
    const before = clone(state); const result = applySwitchyardPanel(state, rotations)
    assert.equal(result.ok, preview.valid)
    if (preview.valid) {
      assert.deepEqual(switchyardHumanView(state).poweredTerminals, preview.poweredTerminals)
      if (!representatives.has(key)) representatives.set(key, rotations)
      if (!key && encoded !== 0) safeIsolated.push(rotations)
    } else assert.deepEqual(state, before, `${id}: overload must preserve all accepted state`)
  }
  assert.deepEqual([...representatives.keys()].sort(), ['', 'amber', 'amber,blue', 'amber,white', 'blue', 'blue,white', 'white'])
  const starts = pinnedStarts ? pinnedStarts.map(layout => [...layout] as SwitchyardRotations)
    : Array.from({ length: 16 }, (_, index) => safeIsolated[Math.floor(index * safeIsolated.length / 16)]!)
  assert.equal(starts.length, 16); assert.equal(new Set(starts.map(encoding)).size, 16)
  for (const start of starts) { assert.notEqual(encoding(start), 0); assert.equal(powers[encoding(start)], ''); assert(previewSwitchyardRouting(start, panel).valid) }
  const rotationDistances: PanelProof['rotationDistances'] = {}; const startDistanceRanges: PanelProof['startDistanceRanges'] = {}
  for (const target of representatives.keys()) {
    // Multi-source shortest paths in the six-piece quarter-turn cube (both turn directions).
    const distances = new Int16Array(4096).fill(-1); const queue: number[] = []
    for (let i = 0; i < powers.length; i++) if (powers[i] === target) { distances[i] = 0; queue.push(i) }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor]!
      for (let piece = 0; piece < 6; piece++) for (const change of [1, 3]) {
        const shift = piece * 2; const rotation = (current >> shift) & 3
        const next = (current & ~(3 << shift)) | ((rotation + change) % 4) << shift
        if (distances[next] === -1) { distances[next] = distances[current]! + 1; queue.push(next) }
      }
    }
    assert.equal(queue.length, 4096)
    for (const source of representatives.keys()) {
      const values = powers.flatMap((power, index) => power === source ? [distances[index]!] : [])
      ;(rotationDistances[source] ??= {})[target] = Math.min(...values)
    }
    const values = starts.map(start => distances[encoding(start)]!)
    startDistanceRanges[target] = [Math.min(...values), Math.max(...values)]
  }
  return { id, signature: canonicalPanel(panel), counts, representatives, powers, starts, rotationDistances, startDistanceRanges }
}

type Command = { kind: 'apply'; rotations: SwitchyardRotations } | { kind: 'move'; target: string } | { kind: 'interact'; object: string; action: string }
interface Edge { to: number; command: Command }
function keyOf(state: SwitchyardState, panel: PanelProof): string {
  return JSON.stringify([state.location, panel.powers[encoding(state.appliedRotations)], state.liftIndex, state.liftTested, state.liftSurveyed, state.braceSeated, state.bridgeDeployed, state.turntableAligned, state.serviceRestored, state.approach, state.completed])
}
function inspect(state: SwitchyardState) {
  const observed = applySwitchyardTool(state, 'observe_room', {}).switchyardObservation!
  const result = applySwitchyardTool(state, 'inspect_object', { object: observed.devices[0]!.id }, { visitId: state.visitId })
  assert(result.ok, result.message)
  return result
}
function execute(state: SwitchyardState, command: Command) {
  if (command.kind === 'apply') return applySwitchyardPanel(state, command.rotations)
  return command.kind === 'move'
    ? applySwitchyardTool(state, 'move_to', { target: command.target }, { visitId: state.visitId })
    : applySwitchyardTool(state, 'interact_object', { object: command.object, action: command.action }, { visitId: state.visitId })
}
function cost(command: Command, metric: 'applies' | 'confirmedActions' | 'traversals'): number {
  return Number(metric === 'applies' ? command.kind === 'apply' : metric === 'confirmedActions' ? command.kind !== 'apply' : command.kind === 'move')
}
function distances(edges: Edge[][], metric: 'applies' | 'confirmedActions' | 'traversals') {
  const result = new Float64Array(edges.length).fill(Infinity); result[0] = 0
  const queue = [0]; const queued = new Set([0])
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const from = queue[cursor]!; queued.delete(from)
    for (const edge of edges[from]!) {
      const distance = result[from]! + cost(edge.command, metric)
      if (distance < result[edge.to]!) { result[edge.to] = distance; if (!queued.has(edge.to)) { queued.add(edge.to); queue.push(edge.to) } }
    }
  }
  return result
}
export interface ProfileProof {
  profile: number
  panel: RemixPanelId
  procedure: string
  layout: string
  liftRow: string
  serviceRow: string
  canonicalSignature: string
  states: number
  activeStates: number
  successfulTransitions: number
  attemptedTransitions: number
  assignmentEquivalentTransitions: number
  allActiveReachBothApproachesWithEveryAssignment: true
  actorsAloneCannotFinish: true
  cluesReachableWithoutMechanicalPrerequisites: string[]
  goals: Record<string, { minimumMeaningfulApplies: number; minimumConfirmedActions: number; minimumTraversals: number; witnessBacktracks: number; witnessDistinctInspectionLocations: number; requiredReportFacts: string[] }>
}
export function validateProfile(profile: RemixProfile, panel: PanelProof, options: { maxStates?: number; witnesses?: Record<string, unknown> } = {}): ProfileProof {
  const specs = assignments.map(assignment => createRunSpec(profile.index, panel.starts[0]!, assignment, 0, dispatch))
  const start = initialSwitchyardState('a', specs[0]); const states = [start]; const ids = new Map([[keyOf(start, panel), 0]])
  const edges: Edge[][] = [[]]; const reverse: number[][] = [[]]; const parent: ({ from: number; command: Command } | null)[] = [null]
  let attempted = 0; let equivalent = 0; let successful = 0
  for (let cursor = 0; cursor < states.length; cursor++) {
    const state = states[cursor]!; if (state.completed) continue
    const ready = clone(state); const report = inspect(ready); const observed = report.switchyardObservation!
    const commands: Command[] = [...panel.representatives.values()].map(rotations => ({ kind: 'apply', rotations }))
    commands.push(...observed.exits.map(exit => ({ kind: 'move' as const, target: exit.target })))
    for (const device of observed.devices) for (const action of device.actions ?? []) commands.push({ kind: 'interact', object: device.id, action: action.action })
    for (const command of commands) {
      const next = clone(ready); const result = execute(next, command); attempted++
      const nextKey = keyOf(next, panel)
      if (!result.ok) assert.equal(nextKey, keyOf(ready, panel), 'A refused operation cannot consume physical progress.')
      // Exhaustively check assignment invariance on every attempted transition, including refusals.
      for (const spec of specs.slice(1)) {
        const alternate = clone(ready); alternate.runSpec = spec
        const alternativeResult = execute(alternate, command)
        assert.equal(alternativeResult.ok, result.ok); assert.equal(keyOf(alternate, panel), nextKey)
        if (alternate.completed) assert.equal(switchyardHumanView(alternate).journey?.status, assigned(alternate, spec.assignment) ? 'completed' : 'skipped')
        equivalent++
      }
      if (!result.ok) continue
      let to = ids.get(nextKey)
      if (to === undefined) {
        to = states.length; ids.set(nextKey, to); states.push(next); edges.push([]); reverse.push([]); parent.push({ from: cursor, command })
        assert(states.length <= (options.maxStates ?? 50000), 'Incomplete search: state bound exceeded; no certificate may be produced.')
      }
      if (to === cursor) continue // No-op operations neither improve a minimum nor affect reachability.
      edges[cursor]!.push({ to, command }); reverse[to]!.push(cursor); successful++
    }
  }
  const active = states.filter(state => !state.completed).length
  const metrics = { applies: distances(edges, 'applies'), confirmedActions: distances(edges, 'confirmedActions'), traversals: distances(edges, 'traversals') }
  const goals: ProfileProof['goals'] = {}
  for (const assignment of assignments) for (const approach of approaches) {
    const ends = states.flatMap((state, index) => state.completed && state.approach === approach && assigned(state, assignment) ? [index] : [])
    assert(ends.length > 0, `Profile ${profile.index}: ${assignment}/${approach} has no home witness.`)
    const reachable = new Set(ends); const queue = [...ends]
    while (queue.length) for (const predecessor of reverse[queue.pop()!]!) if (!reachable.has(predecessor)) { reachable.add(predecessor); queue.push(predecessor) }
    assert.equal(states.filter((state, index) => !state.completed && !reachable.has(index)).length, 0, `Profile ${profile.index}: a reachable active state prevents ${assignment}/${approach}.`)
    const witness: Command[] = []; let current = ends[0]!
    while (parent[current]) { const step = parent[current]!; witness.push(step.command); current = step.from }
    witness.reverse()
    const replay = initialSwitchyardState('a', specs[assignments.indexOf(assignment)]); const visits = new Set<string>(); let backtracks = 0; const traversed = new Set<string>()
    for (const command of witness) {
      if (command.kind !== 'apply') { inspect(replay); visits.add(replay.location) }
      const previous = replay.location; const result = execute(replay, command); assert(result.ok, result.message)
      if (command.kind === 'move') { const edge = [previous, replay.location].sort().join(':'); if (traversed.has(edge)) backtracks++; traversed.add(edge) }
    }
    assert(replay.completed); assert.equal(replay.approach, approach); assert.equal(switchyardHumanView(replay).journey?.status, 'completed')
    const goal = `${assignment}/${approach}`
    goals[goal] = { minimumMeaningfulApplies: Math.min(...ends.map(index => metrics.applies[index]!)), minimumConfirmedActions: Math.min(...ends.map(index => metrics.confirmedActions[index]!)), minimumTraversals: Math.min(...ends.map(index => metrics.traversals[index]!)), witnessBacktracks: backtracks, witnessDistinctInspectionLocations: visits.size,
      requiredReportFacts: [...(approach === 'lift' || assignment === 'lift_survey' ? ['fitted lift plate'] : []), ...(approach === 'bypass' || assignment === 'service_restoration' ? ['fitted service plate', 'fitted service operation order'] : [])] }
    assert(goals[goal]!.minimumMeaningfulApplies >= 2 && goals[goal]!.minimumMeaningfulApplies <= 8, 'Accepted catalog Apply proxy must remain between 2 and 8.')
    assert(goals[goal]!.minimumConfirmedActions >= 5 && goals[goal]!.minimumConfirmedActions <= 24, 'Accepted catalog confirmed-action proxy must remain between 5 and 24.')
    assert(goals[goal]!.minimumTraversals >= 2 && goals[goal]!.minimumTraversals <= 18, 'Accepted catalog traversal proxy must remain between 2 and 18.')
    if (options.witnesses) options.witnesses[goal] = witness
  }
  for (const actor of ['human', 'robot'] as const) {
    const reached = new Set([0]); const queue = [0]
    for (let cursor = 0; cursor < queue.length; cursor++) for (const edge of edges[queue[cursor]!]!) {
      if ((edge.command.kind === 'apply') !== (actor === 'human')) continue
      if (!reached.has(edge.to)) { reached.add(edge.to); queue.push(edge.to) }
    }
    assert(![...reached].some(index => states[index]!.completed), `${actor} alone must not finish from an isolated certified start.`)
  }
  // Traverse only ordinary corridors, while power is isolated and no machinery has been prepared.
  const inspected = new Map<string, string>(); const clueQueue = [clone(start)]
  for (let cursor = 0; cursor < clueQueue.length; cursor++) {
    const state = clueQueue[cursor]!; if (inspected.has(state.location)) continue
    const report = inspect(state); inspected.set(state.location, report.message)
    for (const exit of report.switchyardObservation!.exits) {
      if (!exit.target.startsWith('switchyard.to_')) continue
      const next = clone(state); const result = execute(next, { kind: 'move', target: exit.target }); assert(result.ok, result.message)
      if (!inspected.has(next.location)) clueQueue.push(next)
    }
  }
  assert.deepEqual([...inspected.keys()].sort(), ['control_bay', 'lift_station', 'service_gallery', 'transfer'])
  assert(inspected.get('lift_station')!.includes(specs[0]!.installation.lift.plate))
  for (const location of ['service_gallery', 'transfer']) {
    assert(inspected.get(location)!.includes(specs[0]!.installation.service.plate))
    assert(inspected.get(location)!.includes(profile.procedure === 'align_then_deploy' ? 'Alignment-first' : 'Detent-first'))
  }
  return { profile: profile.index, panel: profile.panelId, procedure: profile.procedure, layout: profile.layout, liftRow: profile.liftRow, serviceRow: profile.serviceRow, canonicalSignature: canonicalMechanical(profile), states: states.length, activeStates: active, successfulTransitions: successful, attemptedTransitions: attempted, assignmentEquivalentTransitions: equivalent, allActiveReachBothApproachesWithEveryAssignment: true, actorsAloneCannotFinish: true, cluesReachableWithoutMechanicalPrerequisites: [...inspected.keys()].sort(), goals }
}

/** Code identity is stricter than novelty: zero angles, ordered pieces and calibration index matter. */
export function resolvedProfileIdentity(profile: RemixProfile): string {
  const { panel } = profile; const lift = REMIX_LIFT_ROWS[profile.liftRow]; const service = REMIX_SERVICE_ROWS[profile.serviceRow]
  const piece = (id: string) => panel.pieces.findIndex(candidate => candidate.id === id)
  return sha256(JSON.stringify({ capacity: panel.capacity, pieces: panel.pieces.map(item => ({ row: item.row, column: item.column, ports: item.ports })), source: { piece: piece(panel.source.pieceId), side: panel.source.side }, terminals: panel.terminals.map(terminal => ({ id: terminal.id, piece: piece(terminal.pieceId), side: terminal.side, load: terminal.load })),
    lift: { index: lift.index, test: lift.test, run: lift.run }, service: { winch: service.winch, align: service.align, bridge: service.bridge }, procedure: profile.procedure,
    adjacency: REMIX_SCHEMATICS[profile.layout].edges.map(edge => [edge.from, edge.to, edge.kind]).sort(), assignments: ['rescue:any_home', 'lift_survey:monotonic_passing_test', 'service_restoration:monotonic_bridge_and_alignment'] }))
}
export function assertPinnedR1(previous: RemixCertificate, next: Pick<RemixCertificate, 'profileDefinitions' | 'executionHashes' | 'starts'>) {
  assert.deepEqual(next.profileDefinitions, previous.profileDefinitions, 'R1 resolved profile definitions changed. Introduce an explicit supported catalog version; never reinterpret old codes.')
  assert.deepEqual(next.executionHashes, previous.executionHashes, 'R1 transition/routing implementation changed. Explicit catalog-version review is required, even for a conservative nonsemantic source edit.')
  assert.deepEqual(next.starts, previous.starts, 'R1 start order changed. Never remap an existing code to a different initial layout.')
}
export function generateCertificate(root = process.cwd(), write = false) {
  const hashesBefore = Object.fromEntries(REMIX_RULE_SOURCES.map(path => [path, sha256(readFileSync(resolve(root, path)))]))
  // Even a stale or now-unsafe R1 certificate pins its original start order. Never silently replace it.
  const previous = REMIX_CERTIFICATE as RemixCertificate | null
  if (previous) { assert.equal(previous.catalogVersion, 'R1'); assert.equal(previous.schema, 'switchyard-certificate-v1'); assert(previous.starts) }
  const panels = (Object.keys(REMIX_PANELS) as RemixPanelId[]).map(id => validatePanel(id, previous?.starts[id]))
  const identity = { profileDefinitions: REMIX_PROFILES.map(resolvedProfileIdentity), executionHashes: Object.fromEntries(R1_EXECUTION_SOURCES.map(path => [path, hashesBefore[path]!])), starts: Object.fromEntries(panels.map(panel => [panel.id, panel.starts])) as RemixCertificate['starts'] }
  if (previous) assertPinnedR1(previous, identity)
  assert.equal(new Set(panels.map(panel => panel.signature)).size, 3, 'Cosmetic or globally symmetric panels cannot count as new structure.')
  const witnesses: Record<string, unknown> = {}; const profiles = REMIX_PROFILES.map(profile => {
    const localWitnesses: Record<string, unknown> = {}
    const proof = validateProfile(profile, panels.find(panel => panel.id === profile.panelId)!, { witnesses: localWitnesses })
    witnesses[String(profile.index)] = localWitnesses
    process.stdout.write(`Validated profile ${profile.index + 1}/${REMIX_PROFILES.length}: ${proof.states} states, ${proof.successfulTransitions} transitions.\n`)
    return proof
  })
  const canonicalFamilies = new Set(profiles.map(profile => profile.canonicalSignature)).size
  assert(canonicalFamilies >= 12)
  const receipt = { schema: VALIDATOR_SCHEMA, canonicalSchema: CANONICAL_SCHEMA, catalogVersion: 'R1', panelCount: panels.length, rawProfiles: profiles.length, canonicalMechanicalFamilies: canonicalFamilies, certifiedStartsPerPanel: 16, assignmentGoalsPerProfile: 6,
    panels: panels.map(({ id, signature, counts, rotationDistances, startDistanceRanges }) => ({ id, canonicalSignature: signature, orientations: 4096, counts, rotationDistances, certifiedStartRotationDistanceRanges: startDistanceRanges })), profiles,
    scope: { physicalQuotient: 'Power class, location, index, passing test, monotonic survey/restoration facts, brace, bridge, alignment, last approach and completion; read-only current-visit admission is recoverable.', assignments: 'Every attempted edge cross-checked using all three real assignment RunSpecs; all active states reverse-reachable to each of six completed goal sets.', initialRotations: 'All 4096 actual panel submissions checked. Mechanics depend only on power class, never orientation/revision identity. All 16 pinned starts are distinct nonzero isolated layouts.', actorDependence: 'Human Apply-only and robot tool-only reachable subgraphs cannot complete from any certified isolated start. This is not an epistemic proof against guessing or reading source.', proxies: 'Three independent weighted minima, not a single jointly optimal plan. Witness backtracks/inspection locations describe one shortest-edge witness. Required report facts are authored prerequisites checked obtainable, not an epistemic lower-bound proof. Rotation edits are quarter turns in draft; an intermediate draft may overload but is not applied.', limits: { minimumMeaningfulApplies: [2, 8], minimumConfirmedActions: [5, 24], minimumTraversals: [2, 18] }, rejectedCandidates: [], limitations: 'Developer-only mechanical proof and design proxies; HTTP authority, ordinary partial-information UI play, human enjoyment and real Voice are separate evidence.' } }
  const coverageSha256 = sha256(JSON.stringify(receipt))
  const certificate: RemixCertificate = { schema: 'switchyard-certificate-v1', catalogVersion: 'R1', profileCount: profiles.length, canonicalFamilies, sourceHashes: hashesBefore, ...identity, coverageSha256 }
  for (const path of REMIX_RULE_SOURCES) assert.equal(sha256(readFileSync(resolve(root, path))), hashesBefore[path], `Rules changed during proof: ${path}. No certificate written.`)
  if (write) {
    const privateDir = resolve(root, '.validation/goal-010', `finite-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    assert(!existsSync(privateDir)); mkdirSync(privateDir, { recursive: true })
    writeFileSync(resolve(privateDir, 'witnesses.json'), `${JSON.stringify(witnesses, null, 2)}\n`)
    writeFileSync(resolve(privateDir, 'coverage.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    mkdirSync(resolve(root, 'artifacts/goal-010'), { recursive: true })
    writeFileSync(resolve(root, 'artifacts/goal-010/finite-coverage.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    writeFileSync(resolve(root, 'game/server/remix-certificate-data.ts'), `/** Generated offline. R1 start order is immutable; no solution witnesses. */\nexport const REMIX_CERTIFICATE: unknown = ${JSON.stringify(certificate, null, 2)}\n`)
    process.stdout.write(`Certificate written: ${canonicalFamilies} canonical families; private witnesses retained under ${privateDir}.\n`)
  }
  return { certificate, receipt }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.slice(2).every(argument => argument === '--write'), 'Only --write is supported; default is read-only validation.')
  generateCertificate(process.cwd(), process.argv.includes('--write'))
}
