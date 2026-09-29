export const GOAL_004C_PROPOSAL: Readonly<{
  status: 'AUTHORIZED_BOUNDED_CAMPAIGN'; maxAttempts: 2; reservationSeconds: 670;
  capacitySeconds: 1340; maxSessionSeconds: 600; concurrentConnections: 1;
  preparedRateDollarsPerHour: 4.5; estimatedReservedDollars: 1.675; planningDollars: 1.68;
  ordering: readonly ['live_text_rescue', 'synthetic_voice_rescue'];
}>
export const GOAL_004C_AUTHORIZATION: Readonly<{
  approvedOnJst: '2026-09-26'; reviewedCommit: '35ced22e0fbba070f2533bb4e3eaeca30ea3723c';
  campaignPath: '.validation/goal-004c-live'; existingBalanceOnly: true; automaticReplenishment: false;
  limits: typeof GOAL_004C_PROPOSAL;
}>
export function assertGoal004CLiveAuthorized(): void
export const GOAL_004C_AMENDMENT: Readonly<Record<string, unknown>>
export const GOAL_004C_FROZEN_FILE: string
export function assertGoal004CAmendedNextAttempt(input: { campaign: unknown; mode: unknown; identity: unknown; reports?: unknown[] }): void
export function assertGoal004CReservationAuthorized(input: { directory: string; mode: unknown; identity: unknown }): void
export const GOAL_004D_AMENDMENT: Readonly<Record<string, unknown>>
export const GOAL_004D_FROZEN_FILE: string
export const GOAL_004D_RUNTIME_SHA256: string
export const GOAL_004D_SESSION_UPDATE_SHA256: string
export const GOAL_004D_CANARY_INPUTS: readonly string[]
export function assertGoal004DLiveAuthorized(): void
export function assertGoal004DNextAttempt(input: { campaign: unknown; mode: unknown; identity: unknown; reports?: unknown[] }): void
export function assertGoal004DReservationAuthorized(input: { directory: string; mode: unknown; identity: unknown }): void
export const GOAL_004E_AMENDMENT: Readonly<Record<string, unknown>>
export const GOAL_004E_FROZEN_FILE: string
export const GOAL_004E_RUNTIME_SHA256: string
export const GOAL_004E_SESSION_UPDATE_SHA256: string
export const GOAL_004E_CANARY_INPUTS: readonly string[]
export function assertGoal004ELiveAuthorized(): void
export function assertGoal004ENextAttempt(input: { campaign: unknown; mode: unknown; identity: unknown; offline: unknown }): void
export function assertGoal004EReservationAuthorized(input: { directory: string; mode: unknown; identity: unknown }): void
export const GOAL_004E_RECHECK_AMENDMENT: Readonly<Record<string, unknown>>
export const GOAL_004E_RECHECK_FROZEN_FILE: string
export const GOAL_004E_RECHECK_RUNTIME_SHA256: string
export const GOAL_004E_RECHECK_SESSION_UPDATE_SHA256: string
export const GOAL_004E_RECHECK_FIXTURE_SHA256: string
export function assertGoal004ERecheckLiveAuthorized(): void
export function assertGoal004ERecheckNextAttempt(input: { campaign: unknown; mode: unknown; identity: unknown; activation: unknown }): void
export function assertGoal004ERecheckReservationAuthorized(input: { directory: string; mode: unknown; identity: unknown }): void
export function assertGoal004CNextAttempt(input: {
  campaign: unknown; mode: unknown; identity: unknown; reports?: unknown[];
}): void

export const GOAL_005_AMENDMENT: Readonly<Record<string, unknown>>
export const GOAL_005_HARNESS_FILES: readonly string[]
export function goal005FrozenFile(attempt: number, commit: string): string
export function assertGoal005LiveAuthorized(): void
export function assertGoal005CurrentIdentity(identity: unknown): void
export function assertGoal005NextAttempt(input: { campaign: unknown; mode: unknown; identity: unknown; exerciseRecovery?: boolean; diagnosticReason?: string | null; now?: number }): void
export function assertGoal005ReservationAuthorized(input: { directory: string; mode: unknown; identity: unknown; exerciseRecovery?: boolean; diagnosticReason?: string | null }): void

export function assertGoal005Validation(input: { validation: unknown; identity: unknown; firstAttempt?: boolean }): void
export function readGoal005Validation(path: string, identity: unknown, firstAttempt?: boolean): { path: string; sha256: string }
