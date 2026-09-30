import { randomInt, randomUUID } from 'node:crypto'
import type { ProposedAction, ToolResult } from '../shared/contracts.js'
import { isSwitchyardLayout, previewSwitchyardRouting, type SwitchyardApproach, type SwitchyardLocalObservation, type SwitchyardPanelView, type SwitchyardRotations, type SwitchyardTerminal } from '../shared/switchyard.js'

export type SwitchyardConfiguration = 'a' | 'b'
export type SwitchyardLocation = 'control_bay' | 'transfer' | 'lift_station' | 'service_gallery' | 'return_platform'
/** Hidden installation, current position and mechanical state never enter the panel projection. */
export interface SwitchyardState {
  configuration: SwitchyardConfiguration
  location: SwitchyardLocation
  visitId: string
  observedVisitId: string | null
  inspectedDevices: string[]
  appliedRotations: SwitchyardRotations
  panelRevision: number
  revision: number
  liftIndex: 0 | 1 | 2
  liftTested: boolean
  braceSeated: boolean
  bridgeDeployed: boolean
  turntableAligned: boolean
  approach: SwitchyardApproach | null
  completed: boolean
}
export interface SwitchyardToolResult extends ToolResult { switchyardObservation?: SwitchyardLocalObservation }
/** Authored installations. The human manual lists both rows; only local inspection identifies the installed row. */
const installations = {
  a: { liftPlate: 'Crescent', index: 1, test: 'blue', run: ['amber', 'blue'], servicePlate: 'Rivet', winch: 'white', align: 'amber', bridge: ['amber', 'white'] },
  b: { liftPlate: 'Kite', index: 2, test: 'white', run: ['amber', 'white'], servicePlate: 'Slot', winch: 'blue', align: 'white', bridge: ['blue', 'white'] },
} as const
const labels: Record<SwitchyardLocation, string> = { control_bay: 'Control Bay', transfer: 'Transfer Table', lift_station: 'Lift Station', service_gallery: 'Service Gallery', return_platform: 'Return Platform' }
const devices: Record<SwitchyardLocation, { id: string; label: string; actions: { action: string; label: string }[] }> = {
  control_bay: { id: 'switchyard.directory', label: 'Route directory', actions: [] },
  transfer: { id: 'switchyard.turntable', label: 'Transfer turntable', actions: [{ action: 'align_turntable', label: 'Align the turntable' }] },
  lift_station: { id: 'switchyard.lift', label: 'Lift console', actions: [{ action: 'set_index_one', label: 'Set index one' }, { action: 'set_index_two', label: 'Set index two' }, { action: 'test_lift', label: 'Test the lift' }] },
  service_gallery: { id: 'switchyard.winch', label: 'Bridge winch', actions: [{ action: 'seat_brace', label: 'Seat the bridge brace' }, { action: 'deploy_bridge', label: 'Deploy the bridge' }] },
  return_platform: { id: 'switchyard.return', label: 'Departure console', actions: [{ action: 'depart', label: 'Depart for home' }] },
}
const normalExits: Record<Exclude<SwitchyardLocation, 'return_platform'>, { target: string; label: string; destination: SwitchyardLocation }[]> = {
  control_bay: [{ target: 'switchyard.to_transfer', label: 'Go to Transfer Table', destination: 'transfer' }],
  transfer: [{ target: 'switchyard.to_control', label: 'Return to Control Bay', destination: 'control_bay' }, { target: 'switchyard.to_lift', label: 'Go to Lift Station', destination: 'lift_station' }, { target: 'switchyard.to_service', label: 'Go to Service Gallery', destination: 'service_gallery' }],
  lift_station: [{ target: 'switchyard.to_transfer', label: 'Return to Transfer Table', destination: 'transfer' }, { target: 'switchyard.ride_lift', label: 'Ride the direct lift', destination: 'return_platform' }],
  service_gallery: [{ target: 'switchyard.to_transfer', label: 'Return to Transfer Table', destination: 'transfer' }, { target: 'switchyard.cross_bridge', label: 'Cross the maintenance bridge', destination: 'return_platform' }],
}
function localExits(s: SwitchyardState): { target: string; label: string; destination: SwitchyardLocation }[] {
  if (s.location !== 'return_platform') return normalExits[s.location]
  return s.approach === 'lift'
    ? [{ target: 'switchyard.back_lift', label: 'Return to Lift Station', destination: 'lift_station' }]
    : [{ target: 'switchyard.back_service', label: 'Return to Service Gallery', destination: 'service_gallery' }]
}
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
const reject = (message: string, code?: ToolResult['code']): SwitchyardToolResult => ({ ok: false, message, ...(code ? { code } : {}) })
const powered = (s: SwitchyardState) => previewSwitchyardRouting(s.appliedRotations).poweredTerminals
const exactlyPowered = (s: SwitchyardState, expected: readonly SwitchyardTerminal[]) => {
  const actual = powered(s)
  return actual.length === expected.length && expected.every(terminal => actual.includes(terminal))
}

export function initialSwitchyardState(configuration?: SwitchyardConfiguration): SwitchyardState {
  return { configuration: configuration ?? (randomInt(2) === 0 ? 'a' : 'b'), location: 'control_bay', visitId: randomUUID(), observedVisitId: null, inspectedDevices: [],
    appliedRotations: [0, 0, 1, 0, 0, 0], panelRevision: 0, revision: 0, liftIndex: 0, liftTested: false,
    braceSeated: false, bridgeDeployed: false, turntableAligned: false, approach: null, completed: false }
}

export function switchyardHumanView(s: SwitchyardState): SwitchyardPanelView {
  return { appliedRotations: [...s.appliedRotations], panelRevision: s.panelRevision, poweredTerminals: powered(s) }
}

/** Callers enforce owner, mission status, round and expected global revision before this atomic operation. */
export function applySwitchyardPanel(s: SwitchyardState, layout: unknown): SwitchyardToolResult {
  if (s.completed) return reject('The rescue is complete. Start another mission before changing its panel.', 'mission_stopped')
  const preview = previewSwitchyardRouting(layout)
  if (!preview.valid || !isSwitchyardLayout(layout)) return reject(preview.message, 'invalid_arguments')
  if (layout.some((rotation, index) => rotation !== s.appliedRotations[index])) {
    s.appliedRotations = [...layout]; s.panelRevision += 1; s.revision += 1
  }
  return { ok: true, message: `Routing applied. ${preview.message}` }
}

/** This payload is robot-local. It is communicated by a report, never pushed into HumanView. */
export function switchyardObservation(s: SwitchyardState): SwitchyardToolResult {
  if (s.completed) return { ok: true, message: 'You are safely home. The Switchyard rescue is complete.' }
  s.observedVisitId = s.visitId
  const device = devices[s.location]
  const inspected = s.inspectedDevices.includes(device.id)
  const local: SwitchyardLocalObservation = { visitId: s.visitId, stateRevision: s.revision, location: { id: s.location, label: labels[s.location] },
    devices: [{ id: device.id, label: device.label, ...(inspected ? { actions: device.actions.map(action => ({ ...action })) } : {}) }],
    exits: localExits(s).map(exit => ({ target: exit.target, label: exit.label })) }
  const actionText = inspected && device.actions.length ? ` Inspected controls: ${device.actions.map(action => `${action.label} (${action.action})`).join('; ')}.` : ''
  return { ok: true, switchyardObservation: local,
    message: `You are at ${labels[s.location]}. Within reach: ${device.label} (${device.id}). Local routes: ${local.exits.map(exit => `${exit.label} (${exit.target})`).join('; ')}.${actionText} ${s.location === 'control_bay' ? 'I can read the route directory; what does your installation drawing show?' : 'An electrical connection alone does not prove equipment ready or a passage clear. Inspect the local equipment before choosing an action.'}` }
}

/** Exact-proposal labels use only targets already observed/inspected on this visit. Never mutates discovery or mechanics. */
export function describeSwitchyardProposal(s: SwitchyardState, action: ProposedAction): string | null {
  if (s.completed || s.observedVisitId !== s.visitId) return null
  if (action.kind === 'move') {
    const exit = localExits(s).find(candidate => candidate.target === action.target)
    if (!exit) return null
    if (action.target === 'switchyard.ride_lift' && !s.inspectedDevices.includes('switchyard.lift')) return null
    if (action.target === 'switchyard.cross_bridge' && !s.inspectedDevices.includes('switchyard.winch')) return null
    return exit.label
  }
  const device = devices[s.location]
  if (action.object !== device.id || !s.inspectedDevices.includes(device.id)) return null
  return device.actions.find(candidate => candidate.action === action.action)?.label ?? null
}

function scoped(s: SwitchyardState, inspectionScope?: { visitId: string }): SwitchyardToolResult | null {
  if (!inspectionScope || inspectionScope.visitId !== s.visitId) return { ...reject('That request belongs to an earlier or unobserved visit. Ask for a fresh look here.', 'stale_scope'), recovery: 'observe_room' }
  if (s.observedVisitId !== s.visitId) return { ...reject('Observe this location before selecting a local target.', 'target_unobserved'), recovery: 'observe_room' }
  return null
}
function inspectedReport(s: SwitchyardState, text: string): SwitchyardToolResult {
  const observation = switchyardObservation(s)
  return { ...observation, message: `${text} ${observation.message}` }
}
function inspection(s: SwitchyardState): SwitchyardToolResult {
  const installed = installations[s.configuration]
  const device = devices[s.location]
  if (!s.inspectedDevices.includes(device.id)) s.inspectedDevices.push(device.id)
  if (s.location === 'control_bay') return inspectedReport(s, 'The directory describes two ways to the same Return Platform. The direct lift needs a local index and test before its running supply: fewer walks, more electrical deduction. The maintenance bypass needs a bridge brace and winch on the service side, then an alignment at Transfer Table: more walking, no lift calibration. Both have safe ways back before departure. Mission Control has the installation table; I can read the fitted plates locally.')
  if (s.location === 'lift_station') return inspectedReport(s, `The Lift console plate reads ${installed.liftPlate}. Index is ${s.liftIndex === 0 ? 'unset' : s.liftIndex}; its last self-test is ${s.liftTested ? 'passed' : 'not passed'}. The index can be set only with all output power isolated. The test uses its dedicated supply alone; running uses the paired supply in your manual. The lift landing is clear. What does your ${installed.liftPlate} row specify?`)
  if (s.location === 'service_gallery') return inspectedReport(s, `The Bridge winch plate reads ${installed.servicePlate}. Its brace is ${s.braceSeated ? 'seated' : 'unseated'} and bridge is ${s.bridgeDeployed ? 'deployed into its retaining detent' : 'retracted'}. Seat the brace with all output power isolated. Deployment uses the winch supply alone; the far turntable must be aligned afterwards at Transfer Table. Crossing uses the paired service supply. The walkway itself is clear. The mechanical detent retains progress if power changes. What does your ${installed.servicePlate} row specify?`)
  if (s.location === 'transfer') return inspectedReport(s, `The Transfer turntable service plate reads ${installed.servicePlate}. Its alignment is ${s.turntableAligned ? 'locked' : 'not locked'}. The service bridge must first be deployed from Service Gallery. Alignment uses its own supply alone, different from the winch supply. The lock retains alignment when power changes. Consult the ${installed.servicePlate} service row; the lift route does not need this operation.`)
  return inspectedReport(s, `The Departure console confirms arrival by the ${s.approach === 'lift' ? 'direct lift' : 'maintenance bypass'}. Depart for home is the final local action. Until you confirm departure, the marked return walkway allows a safe retreat even without power. You may still change plans; both approaches reach the same home.`)
}

/** Read-only tools run immediately; physical tools run only after exact owner confirmation, when their current prerequisites are checked. */
export function applySwitchyardTool(s: SwitchyardState, name: string, args: unknown, inspectionScope?: { visitId: string }): SwitchyardToolResult {
  if (name === 'observe_room') return exact(args, []) ? switchyardObservation(s) : reject('Observation takes no arguments.', 'invalid_arguments')
  if (s.completed) return reject('The rescue is already complete. No additional departure or equipment action is possible.', 'mission_stopped')
  if (!['inspect_object', 'interact_object', 'move_to'].includes(name)) return reject('Use an implemented local observation, inspection, interaction or movement tool.', 'tool_unavailable')
  const keys = name === 'move_to' ? ['target'] : name === 'inspect_object' ? ['object'] : ['object', 'action']
  if (!exact(args, keys) || keys.some(key => typeof args[key] !== 'string')) return reject('Use exactly the fields for one observed local target and action.', 'invalid_arguments')
  const failure = scoped(s, inspectionScope)
  if (failure) return failure
  if (name === 'move_to') {
    const exit = localExits(s).find(candidate => candidate.target === args.target)
    if (!exit) return reject('That destination is not a reachable local route. Ask for a fresh look; no alternative was selected.', 'nonlocal_target')
    const installed = installations[s.configuration]
    if (args.target === 'switchyard.ride_lift') {
      if (!s.inspectedDevices.includes('switchyard.lift')) return reject('Inspect the Lift console on this visit before requesting the lift.', 'target_unobserved')
      if (!s.liftTested) return reject('The lift has no passing calibration test. You remain safely at Lift Station.')
      if (!exactlyPowered(s, installed.run)) return reject('The lift running-supply indicators are not both ready, or an unrelated circuit is energized. Check the fitted plate against your manual; no movement occurred.')
      s.approach = 'lift'
    }
    if (args.target === 'switchyard.cross_bridge') {
      if (!s.inspectedDevices.includes('switchyard.winch')) return reject('Inspect the Bridge winch on this visit before requesting a crossing.', 'target_unobserved')
      if (!s.bridgeDeployed || !s.turntableAligned) return reject('The bridge and far turntable are not both mechanically ready. You remain on the safe service platform; inspect the local mechanism.')
      if (!exactlyPowered(s, installed.bridge)) return reject('The service crossing indicators do not show the required paired supply. You remain safe; compare the fitted module with your manual.')
      s.approach = 'bypass'
    }
    s.location = exit.destination; s.visitId = randomUUID(); s.observedVisitId = null; s.inspectedDevices = []; s.revision += 1
    return inspectedReport(s, `You completed ${exit.label.toLowerCase()}. Arrival is confirmed. ${s.location === 'return_platform' ? 'The route is restored; departure is still a separate confirmed decision.' : 'Committed equipment preparation is retained.'}`)
  }
  const device = devices[s.location]
  if (args.object !== device.id) return reject('That object is not within reach here. No different object was selected.', 'nonlocal_target')
  if (name === 'inspect_object') return inspection(s)
  if (!s.inspectedDevices.includes(device.id)) return reject('Inspect that device during this visit before requesting a physical action.', 'target_unobserved')
  if (!device.actions.some(action => action.action === args.action)) return reject('That action is not one of this inspected device’s controls. No substitute action was selected.', 'invalid_arguments')
  const installed = installations[s.configuration]
  if (args.action === 'set_index_one' || args.action === 'set_index_two') {
    if (!exactlyPowered(s, [])) return reject('Isolate all output power before setting the lift index. The current index is unchanged.')
    const index = args.action === 'set_index_one' ? 1 : 2
    if (s.liftIndex !== index) { s.liftIndex = index; s.liftTested = false; s.revision += 1 }
    return inspectedReport(s, `You set lift index ${index}. ${s.liftTested ? 'The unchanged index retains its passing test; running still requires the paired supply and a separate confirmed ride.' : 'A separate local test is still required; this setting alone does not authorize travel.'}`)
  }
  if (args.action === 'test_lift') {
    if (!exactlyPowered(s, [installed.test])) return reject('The isolated test-supply indicator is not ready. The test did not run; the lift remains safely parked.')
    if (s.liftIndex !== installed.index) return reject('The test gauge did not align with its reference. No damage occurred. Isolate power, compare the fitted plate with the index table, and revise the setting.')
    if (!s.liftTested) { s.liftTested = true; s.revision += 1 }
    return inspectedReport(s, 'The lift self-test passed. That shared reading made the setting meaningful. The calibrated index is retained; running still requires its paired supply and a separate confirmed ride.')
  }
  if (args.action === 'seat_brace') {
    if (!exactlyPowered(s, [])) return reject('Isolate all output power before seating the bridge brace. No mechanical progress was lost.')
    if (!s.braceSeated) { s.braceSeated = true; s.revision += 1 }
    return inspectedReport(s, 'You seated the bridge brace. The winch can now deploy the walkway when its own supply is ready. The brace remains secured during later routing changes.')
  }
  if (args.action === 'deploy_bridge') {
    if (!s.braceSeated) return reject('Seat the bridge brace before using the winch. The platform remains safe.')
    if (!exactlyPowered(s, [installed.winch])) return reject('The winch’s dedicated supply is not ready on its own. Compare its module plate with the service table; no movement occurred.')
    if (!s.bridgeDeployed) { s.bridgeDeployed = true; s.revision += 1 }
    return inspectedReport(s, 'You deployed the bridge into its retaining detent. The route is not yet aligned at the far end. Return to Transfer Table for its separate local alignment; you can leave this mechanism without holding it.')
  }
  if (args.action === 'align_turntable') {
    if (!s.bridgeDeployed) return reject('There is no deployed bridge for the turntable to meet. Prepare the service-side mechanism first; both approaches remain possible.')
    if (!exactlyPowered(s, [installed.align])) return reject('The turntable’s dedicated alignment supply is not ready on its own. Its lock and any bridge preparation are unchanged.')
    if (!s.turntableAligned) { s.turntableAligned = true; s.revision += 1 }
    return inspectedReport(s, 'You aligned the turntable and its mechanical lock engaged. The service approach now has a continuous clear walkway. Rejoin it at Service Gallery and check the paired crossing supply.')
  }
  s.completed = true; s.revision += 1
  return { ok: true, message: `You departed from the Return Platform and arrived safely home by the ${s.approach === 'lift' ? 'direct lift' : 'maintenance bypass'}. The rescue is confirmed. Both routes were valid choices.` }
}
