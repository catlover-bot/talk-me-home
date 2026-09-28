import type { HumanView } from '../shared/contracts';

/** A delayed read must not restore a proposal after its decision or replacement. */
export function acceptsHumanViewSnapshot(previous: HumanView | null, next: HumanView): boolean {
  if (!previous || previous.sessionId !== next.sessionId || previous.roundId !== next.roundId) return true;
  return next.revision >= previous.revision
    && (next.proposalRevision ?? 0) >= (previous.proposalRevision ?? 0);
}
