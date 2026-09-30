// Hosted operator commands only. The application never runs these at startup/build/deploy.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_ALLOCATION_PATH, RELEASE_GRANT_ID, initializeReleaseAllocation, ReleaseAdmission, releaseRuntimeFingerprint } from '../dist/server/server/release-admission.js'

try {
  if (process.env.GAME_RELEASE_PROFILE !== 'goal-007' || process.env.GAME_RELEASE_ALLOCATION_FILE !== RELEASE_ALLOCATION_PATH
    || process.env.GAME_LIVE_ALLOWANCE_FILE || process.env.GAME_LIVE_CONCURRENT_LIMIT !== '1') throw new Error('Use the protected hosted release configuration')
  const binding = { origin: process.env.GAME_ORIGIN ?? '', serviceId: process.env.RENDER_SERVICE_ID ?? '', runtimeSha256: releaseRuntimeFingerprint(resolve('dist')) }
  const admission = new ReleaseAdmission(RELEASE_ALLOCATION_PATH, binding)
  const [command, argument, extra] = process.argv.slice(2)
  if (extra) throw new Error('Unexpected command arguments')
  if (command === 'inspect' && !argument) {
    if (!existsSync(RELEASE_ALLOCATION_PATH)) console.log(JSON.stringify({ grantId: RELEASE_GRANT_ID, state: 'missing', initialized: false, binding }))
    else {
      const ledger = admission.inspect()
      console.log(JSON.stringify({ grantId: ledger.grant.id, state: ledger.halt ? 'halted' : 'present', binding,
        ledgerSha256: createHash('sha256').update(readFileSync(RELEASE_ALLOCATION_PATH)).digest('hex'),
        qaUsed: ledger.reservations.filter(row => row.purpose === 'qa').length,
        reviewerUsed: ledger.reservations.filter(row => row.purpose === 'reviewer').length,
        textUsed: ledger.reservations.filter(row => row.purpose === 'qa' && row.mode === 'text').length,
        reservedSeconds: ledger.reservations.length * 970,
        conservativeEstimatedUsd: ledger.reservations.length * 970 * ledger.grant.hourlyUsd / 3600,
        leaseUntil: Math.max(0, ...ledger.reservations.map(row => row.leaseUntil)),
        currentRuntimeAccepted: ledger.acceptances.some(row => row.runtimeSha256 === binding.runtimeSha256), halt: ledger.halt ?? null,
        reservations: ledger.reservations.map(({ browserHash: _privateBrowserHash, ...row }) => row),
      }))
    }
  } else if (command === 'initialize' && argument) {
    // The owner approval is recorded in Goal 007. This timestamp records a separate current pricing review.
    const result = initializeReleaseAllocation(RELEASE_ALLOCATION_PATH, binding, argument)
    console.log(JSON.stringify({ grantId: RELEASE_GRANT_ID, result, allowanceChanged: result === 'created' }))
  } else if (command === 'accept-pair' && argument) {
    const evidence = JSON.parse(readFileSync(argument, 'utf8'))
    if (!evidence || Object.keys(evidence).sort().join(',') !== 'ordinary,recorderRecovery') throw new Error('Use the two reviewed acceptance receipts')
    console.log(JSON.stringify({ grantId: RELEASE_GRANT_ID, result: admission.acceptPair(evidence.ordinary, evidence.recorderRecovery), runtimeSha256: binding.runtimeSha256 }))
  } else if (command === 'halt' && ['provider_credit_refused', 'provider_credential_or_account_refused'].includes(argument)) {
    admission.halt(argument)
    console.log(JSON.stringify({ grantId: RELEASE_GRANT_ID, state: 'halted', reason: argument }))
  } else throw new Error('Choose inspect, initialize with the current pricing-check timestamp, accept-pair with a private evidence file, or halt with a supported reason')
} catch {
  // Never print parsed files, service secrets, or upstream account diagnostics.
  console.error('The hosted release allocation command was refused. Check the protected configuration, existing ledger and lock, and the command arguments. Nothing was reset or replenished.')
  process.exitCode = 1
}
