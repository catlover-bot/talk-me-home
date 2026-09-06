import { randomUUID } from 'node:crypto'
import type { HumanView, SessionStatus, ToolResult } from '../shared/contracts.js'

/** This type and all derived local state are server-only. */
export interface GameState {
  sessionId: string
  roundId: string
  revision: number
  actionEpoch: number
  powerOn: boolean
  doorLatched: boolean
  robotLocation: 'near_side' | 'far_side'
  status: SessionStatus
}

export function initialState(sessionId: string = randomUUID()): GameState {
  return {
    sessionId, roundId: randomUUID(), revision: 0, actionEpoch: 0,
    powerOn: true, doorLatched: false, robotLocation: 'near_side', status: 'active',
  }
}

export const doorOpen = (state: GameState) => state.powerOn || state.doorLatched
export const conveyorRunning = (state: GameState) => state.powerOn

export function humanView(state: GameState): HumanView {
  return {
    sessionId: state.sessionId, roundId: state.roundId, revision: state.revision,
    actionEpoch: state.actionEpoch, powerOn: state.powerOn, status: state.status,
    completed: state.robotLocation === 'far_side',
  }
}

/** A fresh local observation, obtained through observe_room, never pushed to the human. */
export function robotView(state: GameState): ToolResult {
  if (state.robotLocation === 'far_side') {
    return { ok: true, message: 'You are on the far-side safe platform. Your arrival is confirmed.' }
  }
  return {
    ok: true,
    message: `You are on the near-side safe platform. The Door (door) is ${doorOpen(state) ? 'open' : 'closed'}. The Conveyor (conveyor) is ${conveyorRunning(state) ? 'running' : 'stopped'}. A Latch lever (latch) stands within reach on your safe platform, connected to the Door by a mechanical rod. You can inspect these objects. The far-side safe platform is the destination far_side.`,
  }
}

export function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

const reject = (message: string): ToolResult => ({ ok: false, message })

/** Atomic validation and commit. Callers bind actor identity outside model arguments. */
export function applyRobotTool(state: GameState, name: string, args: unknown): ToolResult {
  if (state.status !== 'active') return reject('The mission is stopped. Wait for Mission Control to reconnect.')
  if (name === 'observe_room') {
    return exactObject(args, []) ? robotView(state) : reject('Observation takes no arguments.')
  }
  if (name === 'inspect_object') {
    if (!exactObject(args, ['object']) || typeof args.object !== 'string') return reject('Choose one local object to inspect.')
    if (!['door', 'conveyor', 'latch'].includes(args.object)) return reject('That object is not available here. Observe your surroundings or clarify the object.')
    if (state.robotLocation !== 'near_side') return reject('That object is no longer within reach from your platform.')
    if (args.object === 'door') return { ok: true, message: `The Door is ${doorOpen(state) ? 'open' : 'closed'}. Its local Latch lever (latch) is within reach from your safe platform.` }
    if (args.object === 'conveyor') return { ok: true, message: `The Conveyor is ${conveyorRunning(state) ? 'running and unsafe to cross' : 'stopped'}. It lies between your platform and the Door.` }
    return { ok: true, message: `The Latch is ${state.doorLatched ? 'engaged' : 'not engaged'}. Its plate reads: "Holds an open Door in place. Engage only while the Door is open." The lever is reachable from your safe platform. The local interaction is latch_open on latch.` }
  }
  if (name === 'interact_object') {
    if (!exactObject(args, ['object', 'action']) || typeof args.object !== 'string' || typeof args.action !== 'string') return reject('Choose one local object and its available action.')
    if (args.object !== 'latch' || args.action !== 'latch_open') return reject('That local interaction is not available. Inspect the intended object first.')
    if (state.robotLocation !== 'near_side') return reject('The Latch is not within reach from your current platform.')
    if (!doorOpen(state)) return reject('The Door is closed. The Latch cannot engage on a closed Door.')
    if (state.doorLatched) return { ok: true, message: 'The Latch is already engaged. The Door remains held open.' }
    state.doorLatched = true
    state.revision += 1
    return { ok: true, message: 'You engaged the Latch. It is holding the Door open.' }
  }
  if (name === 'move_to') {
    if (!exactObject(args, ['target']) || typeof args.target !== 'string') return reject('Choose one observed destination.')
    if (args.target !== 'far_side') return reject('That destination is not available from here. Observe your surroundings or clarify the destination.')
    if (state.robotLocation !== 'near_side') return reject('You have already arrived on the far-side safe platform.')
    if (conveyorRunning(state)) return reject('The Conveyor is running. Crossing is unsafe; you remain on the safe platform.')
    if (!doorOpen(state)) return reject('The Door is closed. You remain on the safe platform.')
    state.robotLocation = 'far_side'
    state.revision += 1
    return { ok: true, message: 'You crossed the stopped Conveyor and passed through the open Door. Arrival on the far-side safe platform is confirmed.' }
  }
  return reject('That tool is not available. Use an implemented local game tool.')
}

export function applyHumanPower(state: GameState, powerOn: boolean): ToolResult {
  if (state.status !== 'active') return reject('The mission is stopped. Resume the mission before changing Power.')
  if (state.robotLocation === 'far_side') return reject('The mission is complete. Restart to begin another round.')
  if (state.powerOn !== powerOn) {
    state.powerOn = powerOn
    state.revision += 1
  }
  return { ok: true, message: `Power command set to ${powerOn ? 'ON' : 'OFF'}.` }
}
