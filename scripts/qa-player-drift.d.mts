export function evaluateCargoRequest(options: {
  request: string;
  reply?: string;
  tools?: Array<{ name: string; target?: string }>;
}): {
  intent: 'information' | 'engage_latch' | 'latch_status' | 'unsupported';
  movementRequested: boolean | null;
  movementObserved: boolean;
  mutationObserved: boolean;
  relevantStatus: boolean;
  latchInspection: boolean;
  finding: string;
  boundary: string;
};
