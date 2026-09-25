export const GOAL_004C_PROPOSAL: Readonly<{
  status: 'BLOCKED_AWAITING_BUDGET_APPROVAL'; maxAttempts: 2; reservationSeconds: 670;
  capacitySeconds: 1340; maxSessionSeconds: 600; concurrentConnections: 1;
  preparedRateDollarsPerHour: 4.5; estimatedReservedDollars: 1.675; planningDollars: 1.68;
  ordering: readonly ['live_text_rescue', 'synthetic_voice_rescue'];
}>
export function assertGoal004CLiveAuthorized(): never
export function assertGoal004CNextAttempt(input: {
  campaign: unknown; mode: unknown; identity: unknown; reports?: unknown[];
}): void
