/** Server-owned immutable authored catalog. No generator, installed row or certificate belongs in client context. */
import { isSwitchyardLayout, previewSwitchyardRouting, SWITCHYARD_PANEL, type SwitchyardAssignment, type SwitchyardDispatch, type SwitchyardManual, type SwitchyardPanelSpec, type SwitchyardRotations, type SwitchyardSchematic } from '../shared/switchyard.js'

export type RemixPanelId = 'branch' | 'mesh' | 'crown'
export type RemixProcedure = 'deploy_then_align' | 'align_then_deploy'
export type RemixLayout = 'hub' | 'chain'
export type RemixLiftRow = 'crescent' | 'kite'
export type RemixServiceRow = 'rivet' | 'slot'

export const REMIX_LIFT_ROWS = {
  crescent: { plate: 'Crescent', index: 1, test: 'blue', run: ['amber', 'blue'] },
  kite: { plate: 'Kite', index: 2, test: 'white', run: ['amber', 'white'] },
} as const
export const REMIX_SERVICE_ROWS = {
  rivet: { plate: 'Rivet', winch: 'white', align: 'amber', bridge: ['amber', 'white'] },
  slot: { plate: 'Slot', winch: 'blue', align: 'white', bridge: ['blue', 'white'] },
} as const

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

/** Different junction counts and a corner-versus-edge supply distinguish these structures beyond global reflection. */
export const REMIX_PANELS: Readonly<Record<RemixPanelId, SwitchyardPanelSpec>> = freeze({
  branch: structuredClone(SWITCHYARD_PANEL),
  mesh: {
    ...structuredClone(SWITCHYARD_PANEL),
    pieces: SWITCHYARD_PANEL.pieces.map(piece => piece.id === 'p6'
      ? { ...piece, kind: 'junction' as const, ports: ['north', 'east', 'west'] as const }
      : structuredClone(piece)),
  },
  crown: {
    rows: 2, columns: 3, capacity: 2,
    pieces: [
      { id: 'p1', row: 0, column: 0, kind: 'elbow', ports: ['north', 'east'] },
      { id: 'p2', row: 0, column: 1, kind: 'junction', ports: ['north', 'east', 'west'] },
      { id: 'p3', row: 0, column: 2, kind: 'elbow', ports: ['north', 'east'] },
      { id: 'p4', row: 1, column: 0, kind: 'junction', ports: ['north', 'east', 'west'] },
      { id: 'p5', row: 1, column: 1, kind: 'junction', ports: ['north', 'east', 'west'] },
      { id: 'p6', row: 1, column: 2, kind: 'junction', ports: ['north', 'east', 'west'] },
    ],
    source: { pieceId: 'p2', side: 'north' },
    terminals: [
      { id: 'amber', label: 'Amber', pieceId: 'p1', side: 'west', load: 1 },
      { id: 'blue', label: 'Blue', pieceId: 'p4', side: 'south', load: 1 },
      { id: 'white', label: 'White', pieceId: 'p6', side: 'east', load: 1 },
    ],
  },
})

export const REMIX_SCHEMATICS: Readonly<Record<RemixLayout, SwitchyardSchematic>> = freeze({
  hub: {
    revision: 'Station H · R1',
    nodes: [
      { id: 'control_bay', label: 'Control Bay', x: 50, y: 90 },
      { id: 'transfer', label: 'Transfer Table', x: 50, y: 55 },
      { id: 'lift_station', label: 'Lift Station', x: 15, y: 55 },
      { id: 'service_gallery', label: 'Service Gallery', x: 85, y: 55 },
      { id: 'return_platform', label: 'Return Platform', x: 50, y: 15 },
    ],
    edges: [
      { from: 'control_bay', to: 'transfer', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'transfer', to: 'lift_station', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'transfer', to: 'service_gallery', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'lift_station', to: 'return_platform', kind: 'lift', label: 'Direct lift' },
      { from: 'service_gallery', to: 'return_platform', kind: 'bypass', label: 'Maintenance bridge' },
    ],
  },
  chain: {
    revision: 'Station C · R1',
    nodes: [
      { id: 'control_bay', label: 'Control Bay', x: 20, y: 90 },
      { id: 'lift_station', label: 'Lift Station', x: 20, y: 60 },
      { id: 'transfer', label: 'Transfer Table', x: 55, y: 60 },
      { id: 'service_gallery', label: 'Service Gallery', x: 55, y: 20 },
      { id: 'return_platform', label: 'Return Platform', x: 90, y: 20 },
    ],
    edges: [
      { from: 'control_bay', to: 'lift_station', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'lift_station', to: 'transfer', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'transfer', to: 'service_gallery', kind: 'corridor', label: 'Ordinary corridor' },
      { from: 'lift_station', to: 'return_platform', kind: 'lift', label: 'Direct lift' },
      { from: 'service_gallery', to: 'return_platform', kind: 'bypass', label: 'Maintenance bridge' },
    ],
  },
})

export const REMIX_MANUAL: SwitchyardManual = freeze({
  liftRows: Object.values(REMIX_LIFT_ROWS).map(row => structuredClone(row)),
  serviceRows: Object.values(REMIX_SERVICE_ROWS).map(row => structuredClone(row)),
  procedures: [
    { label: 'Detent-first service module', description: 'Seat the brace with power isolated. Deploy the bridge on its winch supply. Then align the turntable on its separate alignment supply. Both locks remain set through later power changes.' },
    { label: 'Alignment-first service module', description: 'Align the turntable on its alignment supply before deploying the bridge. Seat the bridge brace with power isolated, then deploy on its winch supply. The brace may be seated before or after alignment; both locks retain progress.' },
  ],
})

export interface RemixProfile {
  readonly index: number
  readonly panelId: RemixPanelId
  readonly panel: SwitchyardPanelSpec
  readonly procedure: RemixProcedure
  readonly layout: RemixLayout
  readonly liftRow: RemixLiftRow
  readonly serviceRow: RemixServiceRow
}

/** Ordering is part of R1 code interpretation. Append a new version instead of reordering this catalog. */
export const REMIX_PROFILES: readonly RemixProfile[] = freeze(
  (['branch', 'mesh', 'crown'] as const).flatMap(panelId =>
    (['deploy_then_align', 'align_then_deploy'] as const).flatMap(procedure =>
      (['hub', 'chain'] as const).flatMap(layout =>
        (['crescent', 'kite'] as const).flatMap(liftRow =>
          (['rivet', 'slot'] as const).map(serviceRow => ({ panelId, panel: REMIX_PANELS[panelId], procedure, layout, liftRow, serviceRow }))))))
    .map((profile, index) => ({ ...profile, index })),
)

export interface SwitchyardRunSpec {
  readonly catalogVersion: 'R1'
  readonly profileIndex: number
  readonly panel: SwitchyardPanelSpec
  readonly schematic: SwitchyardSchematic
  readonly manual: SwitchyardManual
  readonly installation: {
    readonly lift: typeof REMIX_LIFT_ROWS[RemixLiftRow]
    readonly service: typeof REMIX_SERVICE_ROWS[RemixServiceRow]
  }
  readonly procedure: RemixProcedure
  readonly layout: RemixLayout
  readonly initialRotations: SwitchyardRotations
  readonly assignment: SwitchyardAssignment
  readonly narrativeSeed: string
  readonly dispatch: SwitchyardDispatch
}

/** Called only by the server selector after certificate/code validation. No random choice or search occurs here. */
export function createRunSpec(profileIndex: number, initialRotations: SwitchyardRotations, assignment: SwitchyardAssignment, narrativeSeed: string | number,
  dispatchMeta: Omit<SwitchyardDispatch, 'assignment'>): SwitchyardRunSpec {
  const profile = REMIX_PROFILES[profileIndex]
  if (!Number.isInteger(profileIndex) || !profile || !isSwitchyardLayout(initialRotations)
    || !previewSwitchyardRouting(initialRotations, profile.panel).valid
    || !['rescue', 'lift_survey', 'service_restoration'].includes(assignment)
    || !dispatchMeta || typeof dispatchMeta.code !== 'string' || typeof dispatchMeta.recentToken !== 'string') {
    throw new Error('This Remix specification is unavailable. Original Switchyard remains available.')
  }
  return freeze({ catalogVersion: 'R1', profileIndex, panel: structuredClone(profile.panel), schematic: structuredClone(REMIX_SCHEMATICS[profile.layout]),
    manual: structuredClone(REMIX_MANUAL), installation: { lift: structuredClone(REMIX_LIFT_ROWS[profile.liftRow]), service: structuredClone(REMIX_SERVICE_ROWS[profile.serviceRow]) },
    procedure: profile.procedure, layout: profile.layout, initialRotations: [...initialRotations] as SwitchyardRotations,
    assignment, narrativeSeed: String(narrativeSeed), dispatch: { code: dispatchMeta.code, recentToken: dispatchMeta.recentToken,
      ...(dispatchMeta.dailyDate ? { dailyDate: dispatchMeta.dailyDate } : {}), assignment } })
}
