import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Exact non-secret accounting bytes from the preserved September 26 failure.
// Fixtures are created only in isolated temporary directories, never real accounting.
export function writeGoal004CHistory(directory: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'campaign.jsonl'), '{"type":"campaign","version":1,"maxAttempts":2,"reservationSeconds":670,"capacitySeconds":1340,"maxSessionSeconds":600,"planningDollars":1.68,"disconnectGraceSeconds":30,"hourlyRate":4.5,"createdAt":1790359048582}\n'
    + '{"type":"reserved","attempt":1,"name":"text-mission","reservedAt":1790359091837,"reservedSeconds":670,"gracefulAt":1790359661837,"hardAt":1790359671837,"leaseUntil":1790359761837}\n'
    + '{"type":"result","attempt":1,"finishedAt":1790359163459,"endAcknowledged":true,"connectedSeconds":71.08180000000074,"outcome":"failed"}\n'
    + '{"type":"closed","attempt":1,"closedAt":1790359165690}\n')
  writeFileSync(join(directory, 'allowance.jsonl'), '{"version":1,"allowanceSessions":2,"maxSessionSeconds":600}\n{"reservedAt":1790359091852,"leaseUntil":1790359761852}\n')
}

// Exact additional failed Text attempt preserved before the Goal 004D retest.
export function writeGoal004CAmendedHistory(directory: string) {
  writeGoal004CHistory(directory)
  writeFileSync(join(directory, 'amendment-final-acceptance.jsonl'), '{"type":"amendment","version":1,"id":"goal-004c-final-acceptance-2026-09-27","originalCampaignSha256":"72391b60ceba2b56da77336a4b54d7c8e6d184bb6aca26ef24fcd1217451b0e0","originalAllowanceSha256":"0c870762bf49809f26ee8bba0861fdafe36a8c890fab98722eb6c3bed9530a24","historicalAttempts":1,"maxNewAttempts":2,"newCapacitySeconds":1340,"maxAttempts":3,"reservationSeconds":670,"capacitySeconds":2010,"maxSessionSeconds":600,"planningDollars":2.52,"disconnectGraceSeconds":30,"hourlyRate":4.5,"createdAt":1790468540938}\n'
    + '{"type":"reserved","attempt":2,"name":"text-mission","reservedAt":1790468663467,"reservedSeconds":670,"gracefulAt":1790469233467,"hardAt":1790469243467,"leaseUntil":1790469333467,"identitySha256":"db5f90c88478ab28ed9a685973c5d99bac848d1a8fab3fc46dad0aa0959c1c90"}\n'
    + '{"type":"result","attempt":2,"finishedAt":1790468708795,"endAcknowledged":true,"connectedSeconds":44.61229999999702,"outcome":"failed"}\n'
    + '{"type":"closed","attempt":2,"closedAt":1790468710967}\n')
  writeFileSync(join(directory, 'amendment-final-acceptance-allowance.jsonl'), '{"version":1,"allowanceSessions":3,"maxSessionSeconds":600}\n'
    + '{"reservedAt":1790359091852,"leaseUntil":1790359761852}\n'
    + '{"reservedAt":1790468663487,"leaseUntil":1790469333487}\n')
}

// Exact third failed Text attempt. This fixture never reads or changes real ledgers.
export function writeGoal004DRetestHistory(directory: string) {
  writeGoal004CAmendedHistory(directory)
  writeFileSync(join(directory, 'amendment-runtime-retest.jsonl'), '{"type":"amendment","version":1,"id":"goal-004d-runtime-retest-2026-09-28","originalCampaignSha256":"8c9c0f4c94c8f8e400769fdbc62aa20a7b6c232fcf4bf5cfffc992bd28ef70d0","originalAllowanceSha256":"4cc324d8dc43d7bd4ff57986e43dc5f0d37ead592117b53d49fff7bf6a455152","historicalAttempts":2,"maxNewAttempts":2,"newCapacitySeconds":1340,"maxAttempts":4,"reservationSeconds":670,"capacitySeconds":2680,"maxSessionSeconds":600,"planningDollars":3.35,"disconnectGraceSeconds":30,"hourlyRate":4.5,"createdAt":1790586761153,"previousAmendmentId":"goal-004c-final-acceptance-2026-09-27"}\n'
    + '{"type":"reserved","attempt":3,"name":"text-mission","reservedAt":1790586887051,"reservedSeconds":670,"gracefulAt":1790587457051,"hardAt":1790587467051,"leaseUntil":1790587557051,"identitySha256":"ef52d507f8931ea3517be9f723560c74e96e56258c344c89dc0492703eea8c73"}\n'
    + '{"type":"result","attempt":3,"finishedAt":1790586927294,"endAcknowledged":true,"connectedSeconds":38.00119999998808,"outcome":"failed"}\n'
    + '{"type":"closed","attempt":3,"closedAt":1790586929420}\n')
  writeFileSync(join(directory, 'amendment-runtime-retest-allowance.jsonl'), '{"version":1,"allowanceSessions":4,"maxSessionSeconds":600}\n'
    + '{"reservedAt":1790359091852,"leaseUntil":1790359761852}\n'
    + '{"reservedAt":1790468663487,"leaseUntil":1790469333487}\n'
    + '{"reservedAt":1790586887067,"leaseUntil":1790587557067}\n')
}
