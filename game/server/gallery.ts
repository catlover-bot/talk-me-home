import type { Relay, ToolResult } from '../shared/contracts.js'
import { exactObject, type GameState } from './state.js'

export type GalleryConfiguration = 'a' | 'b'
export type GalleryRoom = 'ring' | 'fork' | 'sail' | 'leaf' | 'dock'
export interface GalleryState { room: GalleryRoom; relay: Relay; configuration: GalleryConfiguration }
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

export function galleryView(state: GameState): ToolResult {
  const { room, relay } = state.gallery
  const emblem = room[0]!.toUpperCase() + room.slice(1)
  return { ok: true, message: `You are in a safe room with the ${emblem} emblem. A fixed compass mark points north. ${adjacent(room).map(gate => `${direction(gate, room)} gate (${gate.id}) is ${relay === gate.circuit ? 'open' : 'closed'}.`).join(' ')} Inspect a reachable gate to check the opening. Use its exact observed gate identifier as a movement target. You cannot see Mission Control's route map.` }
}

export function applyGalleryTool(state: GameState, name: string, args: unknown): ToolResult {
  if (name === 'observe_room') return exactObject(args, []) ? galleryView(state) : reject('Observation takes no arguments.')
  if (name === 'inspect_object' || name === 'move_to') {
    const key = name === 'inspect_object' ? 'object' : 'target'
    if (!exactObject(args, [key]) || typeof args[key] !== 'string') return reject('Choose one gate that is visible from your current room.')
    const gate = adjacent(state.gallery.room).find(gate => gate.id === args[key])
    if (!gate) return reject('That gate is not reachable from this room. Observe the local gate labels and choose one.')
    if (obstructed(state, gate)) return { ok: name === 'inspect_object', message: 'Cargo blocks this gate opening. You remain in the safe room. The other reachable gates can still be checked.' }
    if (name === 'inspect_object') return { ok: true, message: `${direction(gate, state.gallery.room)} gate (${gate.id}) is ${state.gallery.relay === gate.circuit ? 'open' : 'closed'}. The opening is clear of cargo. A remote circuit controls it; there is no local circuit switch. It is a reachable movement target.` }
    if (state.gallery.relay !== gate.circuit) return reject('This gate is closed. You remain in the safe room. Ask Mission Control about its circuit, then check again.')
    state.gallery.room = gate.from === state.gallery.room ? gate.to : gate.from
    state.revision += 1
    // A queued intent from the previous room must not turn into an accidental backtrack.
    state.actionEpoch += 1
    if (state.gallery.room === 'dock') return { ok: true, message: 'You passed through the open gate. The Relay Gallery checkpoint confirms arrival at the Return Dock. The rescue continues. Observe the equipment within reach before acting.' }
    return { ok: true, message: `You passed through the open gate. ${galleryView(state).message}` }
  }
  if (name === 'interact_object') return reject('There is no local gate circuit switch. Inspect one reachable gate or ask Mission Control to change the Relay.')
  return reject('That tool is not available. Use an implemented local game tool.')
}

export function applyHumanRelay(state: GameState, relay: Relay): ToolResult {
  if (state.status !== 'active') return reject('The mission is stopped. Resume before changing the Relay.')
  if (state.chapter !== 'gallery') return reject('The Relay controller is available only in the Relay Gallery.')
  if (!['off', 'beacon', 'harbor'].includes(relay)) return reject('Choose Off, Beacon, or Harbor for the Relay.')
  if (state.gallery.relay !== relay) { state.gallery.relay = relay; state.revision += 1 }
  return { ok: true, message: `Relay command set to ${relay === 'off' ? 'Off' : relay === 'beacon' ? 'Beacon' : 'Harbor'}.` }
}
