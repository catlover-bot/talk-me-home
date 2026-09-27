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
