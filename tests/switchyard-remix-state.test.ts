import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { REMIX_PANELS, REMIX_PROFILES, REMIX_LIFT_ROWS, REMIX_SERVICE_ROWS, REMIX_SCHEMATICS, createRunSpec } from '../game/server/remix-catalog.js'
import { SWITCHYARD_DIRECTIONS, type SwitchyardPanelSpec, type SwitchyardTerminal } from '../game/shared/switchyard.js'
import { initialSwitchyardState, switchyardHumanView } from '../game/server/switchyard.js'
import { REMIX_RULE_SOURCES, REMIX_COMPILED_RULES, R1_EXECUTION_SOURCES, sha256, verifyCertificateSources, verifyCompiledCertificate, type RemixCertificate } from '../game/server/remix-certificates.js'
import { canonicalMechanical, canonicalPanel, canonicalSpatial } from '../scripts/switchyard-canonical.js'
import { validatePanel, validateProfile, resolvedProfileIdentity, assertPinnedR1 } from '../scripts/validate-switchyard-remix.js'

const panels = new Map(Object.keys(REMIX_PANELS).map(id => [id, validatePanel(id as keyof typeof REMIX_PANELS)]))
test('three real panels retain all seven safe supplies under exhaustive reciprocal and mutation checks', () => {
  assert.equal(panels.size, 3)
  assert.equal(new Set([...panels.values()].map(panel => panel.signature)).size, 3)
  for (const panel of panels.values()) {
    assert.equal(Object.values(panel.counts).reduce((sum, count) => sum + count, 0), 4096)
    assert.equal(panel.representatives.size, 7); assert.equal(panel.starts.length, 16)
    for (const [from, destinations] of Object.entries(panel.rotationDistances)) {
      assert.equal(destinations[from], 0)
      for (const [to, distance] of Object.entries(destinations)) assert.equal(distance, panel.rotationDistances[to]![from])
    }
  }
})

function transformed(panel: SwitchyardPanelSpec, symmetry: number): SwitchyardPanelSpec {
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
  const transform = (x: number, y: number): [number, number] => { if (symmetry >= 4) x = -x; for (let i = 0; i < symmetry % 4; i++) [x, y] = [-y, x]; return [x, y] }
  const direction = (side: typeof SWITCHYARD_DIRECTIONS[number]) => { const vector = vectors[SWITCHYARD_DIRECTIONS.indexOf(side)]!; const [x, y] = transform(vector[0], vector[1]); return SWITCHYARD_DIRECTIONS[vectors.findIndex(candidate => candidate[0] === x && candidate[1] === y)]! }
  return { ...panel, pieces: panel.pieces.map(piece => { const [column, row] = transform(piece.column, piece.row); return { ...piece, id: `renamed-${piece.id}`, column: column + 9, row: row - 4, ports: piece.ports.map(direction) } }).reverse(), source: { pieceId: `renamed-${panel.source.pieceId}`, side: direction(panel.source.side) }, terminals: panel.terminals.map(terminal => ({ ...terminal, label: 'Cosmetic label', pieceId: `renamed-${terminal.pieceId}`, side: direction(terminal.side) })).reverse() }
}
test('canonical forms remove D4 rotations/reflections, piece IDs, output labels and independently turnable base orientations', () => {
  for (const panel of Object.values(REMIX_PANELS)) for (let symmetry = 0; symmetry < 8; symmetry++) {
    const changed = transformed(panel, symmetry)
    assert.equal(canonicalPanel(changed), canonicalPanel(panel))
    const localZero = { ...changed, pieces: changed.pieces.map((piece, index) => ({ ...piece, ports: piece.ports.map(side => SWITCHYARD_DIRECTIONS[(SWITCHYARD_DIRECTIONS.indexOf(side) + index) % 4]!) })) }
    assert.equal(canonicalPanel(localZero), canonicalPanel(panel))
  }
})
test('joint output renaming preserves mechanical signatures while dependency and functional spatial order remain distinct', () => {
  const rename: Record<SwitchyardTerminal, SwitchyardTerminal> = { amber: 'blue', blue: 'white', white: 'amber' }
  for (const profile of REMIX_PROFILES) {
    const lift = REMIX_LIFT_ROWS[profile.liftRow]; const service = REMIX_SERVICE_ROWS[profile.serviceRow]
    const changed = { ...profile, index: 999, panel: { ...profile.panel, terminals: profile.panel.terminals.map(terminal => ({ ...terminal, id: rename[terminal.id], label: 'Renamed' })) } }
    assert.equal(canonicalMechanical(profile), canonicalMechanical(changed, { lift: { test: rename[lift.test], run: lift.run.map(terminal => rename[terminal]) }, service: { winch: rename[service.winch], align: rename[service.align], bridge: service.bridge.map(terminal => rename[terminal]) } }))
    for (let symmetry = 0; symmetry < 8; symmetry++) assert.equal(canonicalMechanical(profile), canonicalMechanical({ ...profile, panel: transformed(profile.panel, symmetry) }))
    assert.notEqual(canonicalMechanical(profile), canonicalMechanical({ ...profile, procedure: profile.procedure === 'deploy_then_align' ? 'align_then_deploy' : 'deploy_then_align' }))
    assert.notEqual(canonicalMechanical(profile), canonicalMechanical({ ...profile, layout: profile.layout === 'hub' ? 'chain' : 'hub' }))
  }
  assert.equal(new Set(REMIX_PROFILES.map(profile => canonicalMechanical(profile))).size, 48)
  const original = REMIX_SCHEMATICS.hub
  const roles = { control_bay: 'start_directory', transfer: 'alignment', lift_station: 'calibration', service_gallery: 'bridge_preparation', return_platform: 'departure' }
  const schematic = { ...original, revision: 'Cosmetic', nodes: original.nodes.map(node => ({ ...node, id: `x${node.id}`, label: 'Other', x: 999 })), edges: original.edges.map(edge => ({ ...edge, from: `x${edge.to}`, to: `x${edge.from}`, label: 'Other' })).reverse() }
  assert.equal(canonicalSpatial(schematic, Object.fromEntries(Object.entries(roles).map(([id, role]) => [`x${id}`, role]))), canonicalSpatial(original))
})
for (const profile of REMIX_PROFILES) test(`profile ${profile.index}: exhaustive active-state recovery, three assignments and both actor limitations`, t => {
  const proof = validateProfile(profile, panels.get(profile.panelId)!)
  assert.equal(Object.keys(proof.goals).length, 6)
  assert.equal(proof.assignmentEquivalentTransitions, proof.attemptedTransitions * 2)
  assert(proof.goals['service_restoration/lift']!.minimumConfirmedActions > proof.goals['rescue/lift']!.minimumConfirmedActions)
  assert(proof.goals['lift_survey/bypass']!.minimumConfirmedActions > proof.goals['rescue/bypass']!.minimumConfirmedActions)
  t.diagnostic(`${proof.states} states; ${proof.successfulTransitions} non-self edges; all six goal sets recoverable.`)
})
test('an incomplete finite search is an error, never a partial certificate', () => {
  assert.throws(() => validateProfile(REMIX_PROFILES[0]!, panels.get('branch')!, { maxStates: 1 }), /Incomplete search/)
})
test('hidden independent installations do not change the initial human projection or expose premature assignment progress', () => {
  for (let base = 0; base < 48; base += 4) {
    const initialViews = REMIX_PROFILES.slice(base, base + 4).map(profile => {
      const state = initialSwitchyardState('a', createRunSpec(profile.index, panels.get(profile.panelId)!.starts[0]!, 'rescue', 0, { code: 'developer', recentToken: 'developer' }))
      const view = switchyardHumanView(state)
      assert(!('journey' in view)); assert(!('installation' in view)); assert(!('location' in view)); assert(!('runSpec' in view))
      return view
    })
    for (const view of initialViews) assert.deepEqual(view, initialViews[0])
  }
})
test('source changes and missing or changed compiled rule bytes invalidate certification', () => {
  const root = mkdtempSync(join(tmpdir(), 'tmh-remix-proof-'))
  try {
    const sourceHashes = Object.fromEntries(REMIX_RULE_SOURCES.map(path => {
      mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), path); return [path, sha256(path)]
    }))
    const certificate: RemixCertificate = { schema: 'switchyard-certificate-v1', catalogVersion: 'R1', profileCount: 48, canonicalFamilies: 48, sourceHashes, starts: Object.fromEntries([...panels].map(([id, proof]) => [id, proof.starts])) as RemixCertificate['starts'], profileDefinitions: REMIX_PROFILES.map(resolvedProfileIdentity), executionHashes: Object.fromEntries(R1_EXECUTION_SOURCES.map(path => [path, sourceHashes[path]!])), coverageSha256: 'a'.repeat(64) }
    assert(verifyCertificateSources(certificate, root))
    for (const path of REMIX_RULE_SOURCES) { writeFileSync(join(root, path), 'changed'); assert.equal(verifyCertificateSources(certificate, root), false, path); writeFileSync(join(root, path), path) }
    assert.equal(verifyCompiledCertificate(certificate, root), false)
    const compiledHashes = Object.fromEntries(REMIX_COMPILED_RULES.map(path => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), path); return [path, sha256(path)] }))
    writeFileSync(join(root, 'server/remix-certified.json'), JSON.stringify({ schema: 'switchyard-compiled-certificate-v1', certificateSha256: sha256(JSON.stringify(certificate)), compiledHashes }))
    assert(verifyCompiledCertificate(certificate, root))
    for (const path of REMIX_COMPILED_RULES) { writeFileSync(join(root, path), 'changed'); assert.equal(verifyCompiledCertificate(certificate, root), false, path); writeFileSync(join(root, path), path) }
    assert.equal(verifyCompiledCertificate({ ...certificate, catalogVersion: 'R2' } as unknown as RemixCertificate, root), false)
    assert.doesNotThrow(() => assertPinnedR1(certificate, certificate))
    assert.throws(() => assertPinnedR1(certificate, { ...certificate, profileDefinitions: [...certificate.profileDefinitions].reverse() }), /resolved profile definitions changed/)
    assert.throws(() => assertPinnedR1(certificate, { ...certificate, executionHashes: {} }), /implementation changed/)
    assert.throws(() => assertPinnedR1(certificate, { ...certificate, starts: { ...certificate.starts, branch: [...certificate.starts.branch].reverse() } }), /start order changed/)
    const original = REMIX_PROFILES[0]!
    assert.notEqual(resolvedProfileIdentity(original), resolvedProfileIdentity({ ...original, panel: { ...original.panel, pieces: original.panel.pieces.map((piece, index) => index ? piece : { ...piece, ports: piece.ports.map(port => SWITCHYARD_DIRECTIONS[(SWITCHYARD_DIRECTIONS.indexOf(port) + 1) % 4]!) }) } }))
  } finally { rmSync(root, { recursive: true, force: true }) }
})
