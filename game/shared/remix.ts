import type { SwitchyardAssignment } from './switchyard.js'

/** Selection preferences only. The server owns every actual puzzle definition. */
export type RemixSetup =
  | { kind: 'new'; assignment: SwitchyardAssignment; recent: string[] }
  | { kind: 'replay'; code: string }
  | { kind: 'daily' }

export interface RemixAvailability {
  available: boolean
  message?: string
  daily?: { date: string; code: string }
}

export const REMIX_HISTORY_LIMIT = 12
/** Syntax only; checksum, version and supported selections are checked by the server. */
export const REMIX_CODE_PATTERN = /^R1-[0-9A-Z]{2}-[0-9A-Z]{2}-[012]-[0-9A-F]{8}-[0-9A-F]{8}$/
export const REMIX_RECENT_PATTERN = /^[0-9a-f]{32}$/
