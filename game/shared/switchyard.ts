/** Public equipment geometry only. Installed machinery and solution sequences are server-only. */
export type SwitchyardDirection = 'north' | 'east' | 'south' | 'west'
export type SwitchyardRotation = 0 | 1 | 2 | 3
export type SwitchyardRotations = [SwitchyardRotation, SwitchyardRotation, SwitchyardRotation, SwitchyardRotation, SwitchyardRotation, SwitchyardRotation]
export type SwitchyardTerminal = 'amber' | 'blue' | 'white'
export type SwitchyardApproach = 'lift' | 'bypass'
export interface SwitchyardPanelView {
  appliedRotations: SwitchyardRotations
  panelRevision: number
  poweredTerminals: SwitchyardTerminal[]
}
export interface SwitchyardLocalObservation {
  visitId: string
  stateRevision: number
  location: { id: string; label: string }
  devices: { id: string; label: string; actions?: { action: string; label: string }[] }[]
  exits: { target: string; label: string }[]
}
export interface SwitchyardRoutingPreview {
  valid: boolean
  message: string
  poweredTerminals: SwitchyardTerminal[]
  energizedPieces: string[]
  load: number
  capacity: number
}
export const SWITCHYARD_DIRECTIONS: readonly SwitchyardDirection[] = ['north', 'east', 'south', 'west']
export const SWITCHYARD_PANEL = {
  rows: 2, columns: 3, capacity: 2,
  pieces: [
    { id: 'p1', row: 0, column: 0, kind: 'junction', ports: ['north', 'east', 'west'] },
    { id: 'p2', row: 0, column: 1, kind: 'junction', ports: ['north', 'east', 'west'] },
    { id: 'p3', row: 0, column: 2, kind: 'junction', ports: ['north', 'east', 'west'] },
    { id: 'p4', row: 1, column: 0, kind: 'elbow', ports: ['north', 'east'] },
    { id: 'p5', row: 1, column: 1, kind: 'junction', ports: ['north', 'east', 'west'] },
    { id: 'p6', row: 1, column: 2, kind: 'elbow', ports: ['north', 'west'] },
  ],
  source: { pieceId: 'p1', side: 'west' },
  terminals: [
    { id: 'amber', label: 'Amber', pieceId: 'p3', side: 'north', load: 1 },
    { id: 'blue', label: 'Blue', pieceId: 'p6', side: 'east', load: 1 },
    { id: 'white', label: 'White', pieceId: 'p4', side: 'south', load: 1 },
  ],
} as const

export function isSwitchyardLayout(value: unknown): value is SwitchyardRotations {
  return Array.isArray(value) && value.length === 6 && Object.keys(value).length === 6
    && Array.from({ length: 6 }, (_, index) => index).every(index => Object.prototype.hasOwnProperty.call(value, index)
      && Number.isInteger(value[index]) && value[index] >= 0 && value[index] <= 3)
}

export function switchyardPorts(pieceId: string, rotation: number): SwitchyardDirection[] {
  const piece = SWITCHYARD_PANEL.pieces.find(candidate => candidate.id === pieceId)
  if (!piece || !Number.isInteger(rotation) || rotation < 0 || rotation > 3) return []
  return piece.ports.map(direction => SWITCHYARD_DIRECTIONS[(SWITCHYARD_DIRECTIONS.indexOf(direction) + rotation) % 4]!)
}

/** Insulated unused sockets do not carry a load. Only reciprocal adjacent contacts conduct. */
export function previewSwitchyardRouting(layout: unknown): SwitchyardRoutingPreview {
  const empty = { poweredTerminals: [] as SwitchyardTerminal[], energizedPieces: [] as string[], load: 0, capacity: SWITCHYARD_PANEL.capacity }
  if (!isSwitchyardLayout(layout)) return { ...empty, valid: false, message: 'Submit all six fixed pieces with clockwise rotations from zero to three. Pieces and terminals cannot be moved.' }
  const ports = SWITCHYARD_PANEL.pieces.map((piece, index) => switchyardPorts(piece.id, layout[index]!))
  const reached = new Set<number>()
  if (ports[0]!.includes('west')) reached.add(0)
  const pending = [...reached]
  while (pending.length) {
    const index = pending.pop()!
    const piece = SWITCHYARD_PANEL.pieces[index]!
    for (const direction of ports[index]!) {
      const delta = { north: [-1, 0], east: [0, 1], south: [1, 0], west: [0, -1] }[direction]!
      const neighbor = SWITCHYARD_PANEL.pieces.findIndex(candidate => candidate.row === piece.row + delta[0]! && candidate.column === piece.column + delta[1]!)
      const opposite = SWITCHYARD_DIRECTIONS[(SWITCHYARD_DIRECTIONS.indexOf(direction) + 2) % 4]!
      if (neighbor >= 0 && !reached.has(neighbor) && ports[neighbor]!.includes(opposite)) { reached.add(neighbor); pending.push(neighbor) }
    }
  }
  const connected = SWITCHYARD_PANEL.terminals.filter(terminal => {
    const index = SWITCHYARD_PANEL.pieces.findIndex(piece => piece.id === terminal.pieceId)
    return reached.has(index) && ports[index]!.includes(terminal.side)
  })
  const load = connected.reduce((total, terminal) => total + terminal.load, 0)
  return { valid: load <= SWITCHYARD_PANEL.capacity, poweredTerminals: connected.map(terminal => terminal.id),
    energizedPieces: [...reached].sort((a, b) => a - b).map(index => SWITCHYARD_PANEL.pieces[index]!.id), load, capacity: SWITCHYARD_PANEL.capacity,
    message: load > SWITCHYARD_PANEL.capacity ? 'Three terminals exceed the two-load supply. Nothing was applied; disconnect at least one terminal.'
      : load === 0 ? 'No output terminal connects to the supply. Machinery power is isolated.'
        : `${connected.map(terminal => terminal.label).join(' and ')} connected to the supply. This shows electrical routing, not machinery readiness or clear passage.` }
}
