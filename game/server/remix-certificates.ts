import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSwitchyardLayout, previewSwitchyardRouting, type SwitchyardRotations } from '../shared/switchyard.js'
import { REMIX_PANELS, REMIX_PROFILES, type RemixPanelId } from './remix-catalog.js'
import { REMIX_CERTIFICATE } from './remix-certificate-data.js'

export interface RemixCertificate {
  schema: 'switchyard-certificate-v1'
  catalogVersion: 'R1'
  profileCount: number
  canonicalFamilies: number
  sourceHashes: Record<string, string>
  starts: Record<RemixPanelId, SwitchyardRotations[]>
  profileDefinitions: string[]
  executionHashes: Record<string, string>
  coverageSha256: string
}
export const REMIX_RULE_SOURCES = [
  'game/shared/switchyard.ts', 'game/shared/remix.ts', 'game/shared/contracts.ts',
  'game/server/switchyard.ts', 'game/server/remix-catalog.ts', 'game/server/remix.ts', 'game/server/state.ts',
  'game/server/remix-certificates.ts', 'scripts/switchyard-canonical.ts',
  'scripts/validate-switchyard-remix.ts', 'scripts/verify-remix-certificate.ts',
] as const
export const REMIX_COMPILED_RULES = ['shared/switchyard.js', 'shared/remix.js', 'shared/contracts.js', 'server/switchyard.js', 'server/remix-catalog.js', 'server/remix.js', 'server/state.js', 'server/remix-certificates.js', 'server/remix-certificate-data.js'] as const
export const R1_EXECUTION_SOURCES = ['game/shared/switchyard.ts', 'game/shared/remix.ts', 'game/server/switchyard.ts', 'game/server/remix-catalog.ts', 'game/server/remix.ts'] as const
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex')
let checkedCertificate: RemixCertificate | undefined
export function certificateData(): RemixCertificate | null {
  if (checkedCertificate) return checkedCertificate
  const value = REMIX_CERTIFICATE as RemixCertificate | null
  if (!value || value.schema !== 'switchyard-certificate-v1' || value.catalogVersion !== 'R1' || value.profileCount !== REMIX_PROFILES.length || value.canonicalFamilies < 12) return null
  if (REMIX_RULE_SOURCES.some(path => !/^[0-9a-f]{64}$/.test(value.sourceHashes?.[path] ?? ''))) return null
  if (value.profileDefinitions?.length !== REMIX_PROFILES.length || value.profileDefinitions.some(hash => !/^[0-9a-f]{64}$/.test(hash))) return null
  if (R1_EXECUTION_SOURCES.some(path => value.executionHashes?.[path] !== value.sourceHashes[path])) return null
  for (const panel of ['branch', 'mesh', 'crown'] as const) {
    const starts = value.starts?.[panel]
    if (!Array.isArray(starts) || starts.length !== 16 || new Set(starts.map(layout => JSON.stringify(layout))).size !== 16) return null
    if (starts.some(layout => !isSwitchyardLayout(layout) || layout.every(rotation => rotation === 0) || previewSwitchyardRouting(layout, REMIX_PANELS[panel]).poweredTerminals.length !== 0)) return null
  }
  return checkedCertificate = value
}
export function verifyCertificateSources(certificate: RemixCertificate, root: string): boolean {
  try { return REMIX_RULE_SOURCES.every(path => sha256(readFileSync(resolve(root, path))) === certificate.sourceHashes[path]) } catch { return false }
}
export function verifyCompiledCertificate(certificate: RemixCertificate, compiledRoot: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(resolve(compiledRoot, 'server/remix-certified.json'), 'utf8')) as { schema?: string; certificateSha256?: string; compiledHashes?: Record<string, string> }
    return manifest.schema === 'switchyard-compiled-certificate-v1' && manifest.certificateSha256 === sha256(JSON.stringify(certificate)) && REMIX_COMPILED_RULES.every(path => sha256(readFileSync(resolve(compiledRoot, path))) === manifest.compiledHashes?.[path])
  } catch { return false }
}
let certified: boolean | undefined
export function remixCatalogCertified(): boolean {
  if (certified !== undefined) return certified
  const certificate = certificateData()
  if (!certificate) return certified = false
  const ownFile = fileURLToPath(import.meta.url)
  if (ownFile.endsWith('.ts')) return certified = verifyCertificateSources(certificate, resolve(dirname(ownFile), '../..'))
  return certified = verifyCompiledCertificate(certificate, resolve(dirname(ownFile), '..'))
}
export function certifiedStarts(panelId: RemixPanelId): readonly SwitchyardRotations[] {
  if (!remixCatalogCertified()) return []
  // Return copies: selection cannot mutate the version-pinned start order.
  return certificateData()!.starts[panelId].map(layout => [...layout])
}
