import { randomUUID } from 'node:crypto'
import { gateDirections, type GateDirection, type Relay, type RobotLocalPerception, type ToolRequest, type ToolResult } from '../shared/contracts.js'
import { exactObject, type GameState } from './state.js'

export type GalleryConfiguration = 'a' | 'b'
export type GalleryRoom = 'ring' | 'fork' | 'sail' | 'leaf' | 'dock'
export interface GalleryState {
  room: GalleryRoom; relay: Relay; configuration: GalleryConfiguration; visitId: string; observationRevision: number
  /** Server-authored observed exits; never a model-selected room or a human map projection. */
  observed?: { visitId: string; gates: { handle: string; direction: GateDirection }[] }
}
type Direction = 'East' | 'West' | 'Northeast' | 'Southwest' | 'Southeast' | 'Northwest'
interface Gate { id: string; from: GalleryRoom; to: GalleryRoom; circuit: Exclude<Relay, 'off'>; outward: Direction; inward: Direction }

/** Server-only topology. Never include this table in agent context. */
const gates: Gate[] = [
  { id: 'gallery.g1', from: 'ring', to: 'fork', circuit: 'beacon', outward: 'East', inward: 'West' },
  { id: 'gallery.g2', from: 'fork', to: 'sail', circuit: 'harbor', outward: 'Northeast', inward: 'Southwest' },
  { id: 'gallery.g3', from: 'sail', to: 'dock', circuit: 'beacon', outward: 'Southeast', inward: 'Northwest' },
  { id: 'gallery.g4', from: 'fork', to: 'leaf', circuit: 'beacon', outward: 'Southeast', inward: 'Northwest' },
  { id: 'gallery.g5', from: 'leaf', to: 'dock', circuit: 'harbor', outward: 'Northeast', inward: 'Southwest' },
]
const adjacent = (room: GalleryRoom) => gates.filter(gate => gate.from === room || gate.to === room)
const direction = (gate: Gate, room: GalleryRoom) => gate.from === room ? gate.outward : gate.inward
/** Only one locally reachable direction may appear in a communicated proposal. */
export const localGateDirection = (state: GameState, target: string): string | null => {
  const gate = adjacent(state.gallery.room).find(candidate => candidate.id === target)
  return gate ? direction(gate, state.gallery.room) : null
}
const obstructed = (state: GameState, gate: Gate) => gate.id === (state.gallery.configuration === 'a' ? 'gallery.g3' : 'gallery.g5')
const reject = (message: string): ToolResult => ({ ok: false, message })
const inspectionReject = (code: ToolResult['code'], message: string): ToolResult => ({ ok: false, code, message, recovery: 'observe_room' })

function localPerception(state: GameState, origin: RobotLocalPerception['origin'], observedAt: number, inspectedGate?: string): RobotLocalPerception {
  const { room, relay, visitId } = state.gallery
  const emblems = { ring: 'Ring', fork: 'Fork', sail: 'Sail', leaf: 'Leaf' } as const
  if (room === 'dock') throw new Error('Gallery perception cannot describe the Return Dock.')
  state.gallery.observed = { visitId, gates: adjacent(room).map(gate => ({ handle: gate.id, direction: direction(gate, room).toLowerCase() as GateDirection })) }
  return { origin, roundId: state.roundId, chapter: 'gallery', chapterEpoch: state.chapterEpoch, visitId,
    observationRevision: ++state.gallery.observationRevision, stateRevision: state.revision, actionEpoch: state.actionEpoch, observedAt,
    emblem: emblems[room], compass: 'north', gates: adjacent(room).map(gate => ({ handle: gate.id, direction: direction(gate, room),
      power: relay === gate.circuit ? 'powered' : 'unpowered', door: relay === gate.circuit ? 'open' : 'closed',
      passage: gate.id === inspectedGate ? obstructed(state, gate) ? 'blocked' : 'clear' : 'unchecked' })) }
}

export function perceptionIsCurrent(state: GameState, perception: RobotLocalPerception): boolean {
  return state.status === 'active' && state.roundId === perception.roundId && state.chapter === perception.chapter
    && state.chapterEpoch === perception.chapterEpoch && state.gallery.visitId === perception.visitId
    && state.revision === perception.stateRevision && state.actionEpoch === perception.actionEpoch
    && state.gallery.observationRevision === perception.observationRevision
}

export function galleryView(state: GameState, origin: RobotLocalPerception['origin'] = 'local_survey', observedAt = Date.now()): ToolResult {
  const { room, relay } = state.gallery
  const emblem = room[0]!.toUpperCase() + room.slice(1)
  return { ok: true, perception: localPerception(state, origin, observedAt), message: `You are in a safe room with the ${emblem} emblem. A fixed compass mark points north. ${adjacent(room).map(gate => `${direction(gate, room)} gate (${gate.id}) is ${relay === gate.circuit ? 'open' : 'closed'}.`).join(' ')} Inspect a reachable gate to check the opening. Use its exact observed gate identifier as a movement target. You cannot see Mission Control's route map.` }
}

export function applyGalleryTool(state: GameState, name: string, args: unknown, observedAt = Date.now(), inspectionScope?: ToolRequest['inspectionScope']): ToolResult {
  if (name === 'observe_room') return exactObject(args, []) ? galleryView(state, 'local_survey', observedAt) : inspectionReject('invalid_arguments', 'Observation takes no arguments. Call observe_room without arguments.')
  if (name === 'inspect_gate') {
    if (!exactObject(args, ['direction']) || typeof args.direction !== 'string' || !gateDirections.includes(args.direction as GateDirection)) return inspectionReject('invalid_arguments', 'Inspect one compass direction using the direction enum. Observe the current room if the direction is uncertain.')
    if (!inspectionScope || inspectionScope.visitId !== state.gallery.visitId) return inspectionReject('stale_scope', 'The inspection has no matching current-visit scope. Observe the current room, then inspect the requested direction again.')
    const observed = state.gallery.observed
    if (!observed || observed.visitId !== state.gallery.visitId) return inspectionReject('target_unobserved', 'The exits have not been observed during this visit. Observe the current room, then inspect the requested direction.')
    const local = adjacent(state.gallery.room).filter(gate => direction(gate, state.gallery.room).toLowerCase() === args.direction)
    if (local.length === 0) return inspectionReject('direction_unavailable', 'There is no local gate in that direction. Observe the current room and report the available directions; do not substitute another gate.')
    const matches = observed.gates.filter(gate => gate.direction === args.direction)
    if (local.length !== 1 || matches.length > 1) return inspectionReject('direction_ambiguous', 'That direction does not identify one observed local gate. Observe the current room and clarify the direction; no gate was selected.')
    if (matches.length !== 1 || matches[0]!.handle !== local[0]!.id) return inspectionReject('target_unobserved', 'That local exit has not been observed during this visit. Observe the current room, then inspect the requested direction.')
    return inspectGate(state, local[0]!, observedAt)
  }
  if (name === 'inspect_object' || name === 'move_to') {
    const key = name === 'inspect_object' ? 'object' : 'target'
    if (!exactObject(args, [key]) || typeof args[key] !== 'string') return inspectionReject('invalid_arguments', 'Choose one gate visible from your current room. For a read-only inspection, use inspect_gate with its observed direction.')
    const gate = adjacent(state.gallery.room).find(gate => gate.id === args[key])
    if (!gate) return inspectionReject(gates.some(candidate => candidate.id === args[key]) ? 'nonlocal_target' : 'unknown_target', 'That gate target is unavailable here. Observe the current room, then inspect the intended local direction. Do not ask Mission Control for internal identifiers.')
    if (name === 'inspect_object') return inspectGate(state, gate, observedAt)
    if (obstructed(state, gate)) return reject('Cargo blocks this gate opening. You remain in the safe room. The other reachable gates can still be checked.')
    if (state.gallery.relay !== gate.circuit) return reject('This gate is closed. You remain in the safe room. Ask Mission Control about its circuit, then check again.')
    state.gallery.room = gate.from === state.gallery.room ? gate.to : gate.from
    state.gallery.visitId = randomUUID()
    state.gallery.observed = undefined
    state.revision += 1
    // A queued intent from the previous room must not turn into an accidental backtrack.
    state.actionEpoch += 1
    if (state.gallery.room === 'dock') return { ok: true, message: 'You passed through the open gate. The Relay Gallery checkpoint confirms arrival at the Return Dock. The rescue continues. Observe the equipment within reach before acting.' }
    const survey = galleryView(state, 'confirmed_arrival', observedAt)
    return { ...survey, message: `You passed through the open gate. ${survey.message}` }
  }
  if (name === 'interact_object') return reject('There is no local gate circuit switch. Inspect one reachable gate or ask Mission Control to change the Relay.')
  return inspectionReject('tool_unavailable', 'That tool is not available. Use an implemented local game tool.')
}

function inspectGate(state: GameState, gate: Gate, observedAt: number): ToolResult {
  return { ok: true, perception: localPerception(state, 'gate_inspection', observedAt, gate.id), message: `${direction(gate, state.gallery.room)} gate (${gate.id}) is ${state.gallery.relay === gate.circuit ? 'open' : 'closed'}. ${obstructed(state, gate) ? 'Cargo blocks this gate opening. You remain in the safe room. The other reachable gates can still be checked.' : 'The opening is clear of cargo. A remote circuit controls it; there is no local circuit switch. It is a reachable movement target.'}` }
}

export function applyHumanRelay(state: GameState, relay: Relay): ToolResult {
  if (state.status !== 'active') return reject('The mission is stopped. Resume before changing the Relay.')
  if (state.chapter !== 'gallery') return reject('The Relay controller is available only in the Relay Gallery.')
  if (!['off', 'beacon', 'harbor'].includes(relay)) return reject('Choose Off, Beacon, or Harbor for the Relay.')
  if (state.gallery.relay !== relay) { state.gallery.relay = relay; state.revision += 1 }
  return { ok: true, message: `Relay command set to ${relay === 'off' ? 'Off' : relay === 'beacon' ? 'Beacon' : 'Harbor'}.` }
}
