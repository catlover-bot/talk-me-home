/** Cheap build gate; expensive physical searches run only in the offline validator. */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { certificateData, REMIX_COMPILED_RULES, sha256, verifyCertificateSources } from '../game/server/remix-certificates.js'

const root = process.cwd(); const target = resolve(root, 'dist/server/server/remix-certified.json')
const certificate = certificateData()
if (!certificate || !verifyCertificateSources(certificate, root)) {
  if (existsSync(target)) unlinkSync(target)
  // The rest of the product stays buildable; the runtime explains Remix unavailability.
  process.stdout.write('Remix certificate unavailable or stale; Remix remains disabled.\n')
} else {
  const compiledHashes = Object.fromEntries(REMIX_COMPILED_RULES.map(path => [path, sha256(readFileSync(resolve(root, 'dist/server', path)))]))
  writeFileSync(target, `${JSON.stringify({ schema: 'switchyard-compiled-certificate-v1', certificateSha256: sha256(JSON.stringify(certificate)), compiledHashes }, null, 2)}\n`)
  process.stdout.write('Remix certificate verified and bound to compiled rules.\n')
}
