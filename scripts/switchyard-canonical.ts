/** Developer-only equivalence checks. Never import this module from the game client. */
import { createHash } from 'node:crypto'
import { SWITCHYARD_DIRECTIONS, type SwitchyardDirection, type SwitchyardPanelSpec, type SwitchyardSchematic, type SwitchyardTerminal } from '../game/shared/switchyard.js'
import { REMIX_LIFT_ROWS, REMIX_SERVICE_ROWS, REMIX_SCHEMATICS, type RemixProfile } from '../game/server/remix-catalog.js'

export const CANONICAL_SCHEMA = 'switchyard-mechanical-d4-v1'
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
function transform(x: number, y: number, symmetry: number): [number, number] {
  if (symmetry >= 4) x = -x
  for (let i = 0; i < symmetry % 4; i++) [x, y] = [-y, x]
  return [x, y]
}
function side(direction: SwitchyardDirection, symmetry: number): number {
  const vector = vectors[SWITCHYARD_DIRECTIONS.indexOf(direction)]!
  const [x, y] = transform(vector[0], vector[1], symmetry)
  return vectors.findIndex(candidate => candidate[0] === x && candidate[1] === y)
}
function portOrbit(ports: readonly SwitchyardDirection[], symmetry: number): string {
  // A piece can turn independently: its authored zero-angle is not a new mechanism.
  const transformed = ports.map(port => side(port, symmetry))
  return Array.from({ length: 4 }, (_, rotation) => transformed.map(port => (port + rotation) % 4).sort().join('')).sort()[0]!
}
function panelForm(panel: SwitchyardPanelSpec, symmetry: number) {
  const transformed = panel.pieces.map(piece => ({ piece, position: transform(piece.column, piece.row, symmetry) }))
  const minX = Math.min(...transformed.map(item => item.position[0])); const minY = Math.min(...transformed.map(item => item.position[1]))
  const location = new Map(transformed.map(({ piece, position }) => [piece.id, [position[0] - minX, position[1] - minY]]))
  const site = (pieceId: string, direction: SwitchyardDirection) => [...location.get(pieceId)!, side(direction, symmetry)]
  const outputs = panel.terminals.map(terminal => ({ id: terminal.id, site: [...site(terminal.pieceId, terminal.side), terminal.load] })).sort((a, b) => JSON.stringify(a.site).localeCompare(JSON.stringify(b.site)))
  return { panel: { capacity: panel.capacity, pieces: transformed.map(({ piece }) => [...location.get(piece.id)!, portOrbit(piece.ports, symmetry)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), source: site(panel.source.pieceId, panel.source.side), outputs: outputs.map(output => output.site) }, terminalIndex: new Map(outputs.map((output, index) => [output.id, index])) }
}
export function canonicalPanel(panel: SwitchyardPanelSpec): string {
  return digest(Array.from({ length: 8 }, (_, symmetry) => JSON.stringify(panelForm(panel, symmetry).panel)).sort()[0]!)
}
const roles: Readonly<Record<string, string>> = { control_bay: 'start_directory', transfer: 'alignment', lift_station: 'calibration', service_gallery: 'bridge_preparation', return_platform: 'departure' }
export function canonicalSpatial(schematic: SwitchyardSchematic, roleByNode: Readonly<Record<string, string>> = roles): string {
  // Preserve equipment-function placement. Erasing it would incorrectly identify the two station arrangements.
  return JSON.stringify(schematic.edges.map(edge => [edge.kind, ...[roleByNode[edge.from], roleByNode[edge.to]].sort()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
}
export function canonicalMechanical(profile: RemixProfile, supplies?: { lift: { test: SwitchyardTerminal; run: readonly SwitchyardTerminal[] }; service: { winch: SwitchyardTerminal; align: SwitchyardTerminal; bridge: readonly SwitchyardTerminal[] } }): string {
  const lift = supplies?.lift ?? REMIX_LIFT_ROWS[profile.liftRow]; const service = supplies?.service ?? REMIX_SERVICE_ROWS[profile.serviceRow]
  const forms = Array.from({ length: 8 }, (_, symmetry) => {
    const form = panelForm(profile.panel, symmetry)
    const supply = (terminals: readonly SwitchyardTerminal[]) => terminals.map(terminal => form.terminalIndex.get(terminal)!).sort()
    return JSON.stringify({ schema: CANONICAL_SCHEMA, panel: form.panel, lift: { test: supply([lift.test]), run: supply(lift.run) }, service: { winch: supply([service.winch]), align: supply([service.align]), crossing: supply(service.bridge) }, dependency: profile.procedure === 'deploy_then_align' ? ['brace>deploy', 'deploy>align'] : ['brace>deploy', 'align>deploy'], spatial: canonicalSpatial(REMIX_SCHEMATICS[profile.layout]) })
  })
  // Output renaming is removed jointly with every machine supply relation, never independently.
  return digest(forms.sort()[0]!)
}
