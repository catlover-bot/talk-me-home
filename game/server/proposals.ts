import type { ProposedAction } from '../shared/contracts.js'
import { localGateDirection, recorderIsObservedLocally } from './gallery.js'
import { exactObject, type GameState } from './state.js'

export function proposalLocation(state: GameState): string {
  return state.chapter === 'cargo' ? state.robotLocation : state.chapter === 'gallery' ? state.gallery.room : state.dock.location
}

/** Validate only the proposed local operation. Physical conditions are checked at confirmation. */
export function describeProposal(state: GameState, name: string, args: Record<string, unknown>): { action: ProposedAction; label: string } | null {
  if (state.status !== 'active') return null
  if (name === 'propose_move' || name === 'move_to') {
    if (!exactObject(args, ['target']) || typeof args.target !== 'string') return null
    let label: string | undefined
    if (state.chapter === 'cargo' && state.robotLocation === 'near_side' && args.target === 'far_side') label = 'Move to the far-side platform'
    if (state.chapter === 'gallery') {
      const direction = localGateDirection(state, args.target)
      if (direction) label = `Move through the ${direction.toLowerCase()} gate`
    }
    if (state.chapter === 'return_dock' && state.dock.location === 'platform' && args.target === 'return.aboard') label = 'Board the recovery capsule'
    return label ? { action: { kind: 'move', target: args.target }, label } : null
  }
  if (!['propose_interaction', 'interact_object'].includes(name) || !exactObject(args, ['object', 'action']) || typeof args.object !== 'string' || typeof args.action !== 'string') return null
  let label: string | undefined
  if (args.object === 'flight_recorder' && args.action === 'pick_up' && recorderIsObservedLocally(state)) label = 'Secure the flight recorder'
  if (state.chapter === 'cargo' && state.robotLocation === 'near_side' && args.object === 'latch') {
    if (args.action === 'latch_open') label = 'Engage the Latch'
    if (state.scenario === 'maintenance' && ['select_neutral', 'select_anchor', 'select_bridge'].includes(args.action)) {
      const setting = args.action.slice(7)
      label = `Set the Latch selector to ${setting[0]!.toUpperCase()}${setting.slice(1)}`
    }
  }
  if (state.chapter === 'return_dock') {
    if (state.dock.location === 'platform' && args.object === 'return.contact') {
      if (args.action === 'hold_contact') label = 'Hold the charging contact'
      if (args.action === 'release_contact') label = 'Release the charging contact'
    }
    if (state.dock.location === 'aboard' && args.object === 'return.capsule' && args.action === 'confirm_return') label = 'Confirm the authorized return'
  }
  return label ? { action: { kind: 'interaction', object: args.object, action: args.action }, label } : null
}
