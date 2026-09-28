import type { VerifiedDecisionReceipt } from '../../game/client/voice.ts';

/** Constructed owner decision; contains no captured provider payload. */
export function decisionReceipt(): VerifiedDecisionReceipt {
  return {
    event: { messageId: 'receipt-1', segmentId: 'receipt-1', roundId: 'round-1', chapter: 'cargo', chapterEpoch: 1,
      role: 'game', origin: 'game', inputMethod: 'game_event', text: 'Engage the Latch: completed after your confirmation.', interrupted: false, timestamp: 1000 },
    proposal: { id: 'proposal-1', roundId: 'round-1', chapter: 'cargo', chapterEpoch: 1,
      action: { kind: 'interaction', object: 'latch', action: 'latch_open' }, label: 'Engage the Latch', status: 'committed', expiresAt: 90_000 },
    result: { ok: true, message: 'You engaged the Latch. It is holding the Door open.' },
    checkpoint: { chapter: 'cargo', chapterEpoch: 1, completed: false },
  };
}
