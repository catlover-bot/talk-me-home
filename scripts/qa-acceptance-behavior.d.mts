export interface AcceptanceMessage { speaker: string; text: string; final?: boolean; interrupted?: boolean; historical?: boolean; messageId?: string | null; sourceLabel?: string | null; displayedAt?: string | null; historyIndex?: number | null; chapterLabel?: string | null }
export interface AcceptanceStep { turnId: string | number; utterance: string; startedAtMs: number; endedAtMs: number; settled: boolean; failureLayer?: string; messages?: AcceptanceMessage[]; agreedPlan?: { sourceTurnId: string | number; requestQuote: string; acceptedReplyQuote: string } }
export interface AcceptanceEvent { type: string; atMs: number; name?: string; callRef?: number; replyRef?: number; isError?: boolean }
export interface AcceptanceFinding { code: string; blocking?: boolean; [key: string]: unknown }
export function evaluateAcceptanceBehavior(options?: { steps?: AcceptanceStep[]; events?: AcceptanceEvent[] }): {
  status: 'pass' | 'blocked' | 'review_required'; materialDefects: AcceptanceFinding[]; uncertainties: AcceptanceFinding[];
  turns: Array<{ turnId: string | number; request: string; intent: string; sourceWindow: { startedAtMs: number; endedAtMs: number }; replies: Array<{ text: string; messageId: string | null; sourceLabel: string | null; displayedAt: string | null; historyIndex: number | null; chapterLabel: string | null; final: boolean; interrupted: boolean }>; tools: Array<{ name: string | null; callRef: number | null; replyRef: number | null; atMs: number; resultAtMs: number | null; outcome: string }>; agreedPlanSourceTurnId?: string | number }>;
  reviewedToolCalls: number; boundary: string;
};
