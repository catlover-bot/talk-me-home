import type { DockControl, ToolResult } from '../shared/contracts.js'
import { exactObject, type GameState } from './state.js'

export interface ReturnGrant { roundId: string; chapterEpoch: number; readinessVersion: number }
export interface DockState { location: 'platform' | 'aboard' | 'home'; contactHeld: boolean; energy: 'empty' | 'primed' | 'stored'; readinessVersion: number; grant: ReturnGrant | null }
const reject = (message: string): ToolResult => ({ ok: false, message })
export const dockReady = (state: GameState) => state.dock.location === 'aboard' && !state.dock.contactHeld && state.dock.energy === 'stored'
const changed = (state: GameState) => { state.revision += 1; state.dock.readinessVersion += 1; state.dock.grant = null }

export function dockView(state: GameState): ToolResult {
  if (state.dock.location === 'home') return { ok: true, message: 'The return is complete. The recovery capsule has brought you home.' }
  if (state.dock.location === 'aboard') return { ok: true, message: 'You are aboard the recovery capsule. Its local return panel (return.capsule) is within reach. Inspect it before confirming return. Mission Control owns the remote authorization.' }
  return { ok: true, message: `You are on the Return Dock's safe platform. A spring-loaded contact (return.contact) and recovery capsule (return.capsule) are within reach. You are ${state.dock.contactHeld ? 'holding' : 'not holding'} the contact. The capsule entrance is the movement target return.aboard. Inspect the local plaques to learn the available actions.` }
}

export function applyDockTool(state: GameState, name: string, args: unknown): ToolResult {
  const dock = state.dock
  if (name === 'observe_room') return exactObject(args, []) ? dockView(state) : reject('Observation takes no arguments.')
  if (dock.location === 'home') return reject('The return is already complete. No additional departure can be made.')
  if (name === 'inspect_object') {
    if (!exactObject(args, ['object']) || typeof args.object !== 'string') return reject('Choose one reachable local object to inspect.')
    if (args.object === 'return.contact' && dock.location === 'platform') return { ok: true, message: `The spring-loaded contact is ${dock.contactHeld ? 'held' : 'released'}. Its plaque says it must be held locally during transfer and cannot be carried aboard. Releasing an unstored charge loses it; stored energy is retained. Available interactions on return.contact are hold_contact and release_contact.` }
    if (args.object === 'return.capsule') return { ok: true, message: dock.location === 'aboard'
      ? 'You are aboard. The local return panel can confirm an authorized return. Available interaction on return.capsule is confirm_return. Mission Control must grant return authorization; a spoken claim cannot create it.'
      : 'The capsule entrance is reachable at return.aboard. Its local plaque says to release the contact before boarding. Stored return energy is required. Mission Control can read the remote charge controller.' }
    return reject('That object is not within reach from your current place. Observe the available local objects.')
  }
  if (name === 'move_to') {
    if (!exactObject(args, ['target']) || args.target !== 'return.aboard') return reject('Choose the observed capsule entrance as a destination.')
    if (dock.location !== 'platform') return reject('You are already aboard the capsule.')
    if (dock.contactHeld) return reject('You are holding the contact. Release it before boarding; you remain on the safe platform.')
    if (dock.energy !== 'stored') return reject('The capsule is not charged for return. Stored energy is required; you remain on the safe platform.')
    dock.location = 'aboard'; changed(state)
    return { ok: true, message: 'You boarded the recovery capsule. The local return panel (return.capsule) is now within reach. Mission Control must authorize return before you confirm it.' }
  }
  if (name === 'interact_object') {
    if (!exactObject(args, ['object', 'action']) || typeof args.object !== 'string' || typeof args.action !== 'string') return reject('Choose one local object and its available action.')
    if (args.object === 'return.contact' && ['hold_contact', 'release_contact'].includes(args.action)) {
      if (dock.location !== 'platform') return reject('The contact is no longer within reach from the capsule.')
      const held = args.action === 'hold_contact'
      const lost = !held && dock.energy === 'primed'
      if (dock.contactHeld !== held) { dock.contactHeld = held; if (lost) dock.energy = 'empty'; changed(state) }
      return { ok: true, message: held ? 'You are holding the contact steadily. Mission Control can use its charge controller while you hold it.' : lost ? 'You released the contact before the charge was stored. The unstored charge was lost. You remain safe and can hold the contact again.' : 'You released the contact. Any stored energy remains available.' }
    }
    if (args.object === 'return.capsule' && args.action === 'confirm_return') {
      const grant = dock.grant
      if (!dockReady(state)) return reject('The capsule is not ready for return. You must be aboard with stored energy and the contact released.')
      if (!grant || grant.roundId !== state.roundId || grant.chapterEpoch !== state.chapterEpoch || grant.readinessVersion !== dock.readinessVersion) return reject('There is no current return authorization. Ask Mission Control to authorize return when ready.')
      dock.location = 'home'; changed(state)
      return { ok: true, message: 'You confirmed the authorized return. The capsule brought you home. Mission Control has confirmed the rescue is complete.' }
    }
    return reject('That local interaction is unavailable. Inspect the intended object first.')
  }
  return reject('That tool is not available. Use an implemented local game tool.')
}

export function applyHumanDock(state: GameState, action: DockControl): ToolResult {
  const dock = state.dock
  if (state.status !== 'active') return reject('The mission is stopped. Resume before using the Return Dock controller.')
  if (state.chapter !== 'return_dock') return reject('The charge controller is available only at the Return Dock.')
  if (dock.location === 'home') return reject('The rescue is complete. Start a new mission for another return.')
  if (action === 'revoke_return') {
    dock.grant = null; state.actionEpoch += 1; state.revision += 1
    return { ok: true, message: 'Return authorization revoked. Completed physical actions remain completed.' }
  }
  if (action === 'authorize_return') {
    if (!dockReady(state)) return reject('The readiness interlock is not ready. Stored energy and a boarded capsule are required.')
    if (!dock.grant) { dock.grant = { roundId: state.roundId, chapterEpoch: state.chapterEpoch, readinessVersion: dock.readinessVersion }; state.revision += 1 }
    return { ok: true, message: 'Return authorization granted for the current ready capsule. Pip must confirm return locally.' }
  }
  if (action === 'charge') {
    if (!dock.contactHeld || dock.location !== 'platform') return reject('The charging contact is not connected. Ask Pip to hold it on the platform before Charge.')
    if (dock.energy === 'stored') return reject('Return energy is already stored. No new charge is needed.')
    if (dock.energy === 'empty') { dock.energy = 'primed'; changed(state) }
    return { ok: true, message: 'Charge controller acknowledged primed energy. It has not yet been stored.' }
  }
  if (action === 'store') {
    if (dock.energy === 'stored') return { ok: true, message: 'Return energy is already stored.' }
    if (dock.energy !== 'primed' || !dock.contactHeld || dock.location !== 'platform') return reject('There is no connected primed charge to Store. Keep the contact held during Charge and Store.')
    dock.energy = 'stored'; changed(state)
    return { ok: true, message: 'Charge controller acknowledged stored return energy.' }
  }
  return reject('Choose Charge, Store, Authorize return, or Revoke on the controller.')
}
