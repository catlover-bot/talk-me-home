import { useEffect, useState } from 'react';
import type { ActionProposal } from '../../shared/contracts';

/** Descriptors come from the server's action allowlist, never model-authored HTML. */
export function ActionProposalStrip({ proposal, confirming, failed, enabled, onDecision }: {
  proposal?: ActionProposal | null;
  confirming: boolean;
  failed: boolean;
  enabled: boolean;
  onDecision(decision: 'confirm' | 'decline'): void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (proposal?.status !== 'awaiting_confirmation') return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, proposal.expiresAt - Date.now()) + 20);
    return () => clearTimeout(timer);
  }, [proposal?.id, proposal?.status, proposal?.expiresAt]);
  if (!proposal) return null;
  const status = confirming ? 'confirming' : failed ? 'failed'
    : proposal.status === 'awaiting_confirmation' && now >= proposal.expiresAt ? 'expired' : proposal.status;
  const copy = {
    awaiting_confirmation: 'Waiting for your confirmation — not executed',
    confirming: 'Checking your decision with the game server…',
    committed: 'Completed — confirmed by the game server',
    declined: 'Not yet — not executed',
    expired: 'Expired — ask Pip for a new proposal',
    invalidated: 'Cancelled — ask Pip for a new proposal',
    failed: failed ? 'Outcome unconfirmed — ask Pip to check this proposal’s status' : 'Not executed — the game server refused this action',
  }[status];
  return <section className="action-proposal" data-testid="action-proposal" data-proposal-id={proposal.id}
    data-status={status} aria-label="Pip's proposed action">
    <span className="proposal-kicker">Pip’s proposed action</span>
    <strong data-testid="proposal-label">{proposal.label}</strong>
    <p role="status">{copy}</p>
    {status === 'awaiting_confirmation' && <div className="proposal-buttons">
      <button className="primary-button" disabled={!enabled} onClick={() => onDecision('confirm')}>Confirm this action</button>
      <button className="secondary-button" disabled={!enabled} onClick={() => onDecision('decline')}>Not yet</button>
    </div>}
    {status === 'failed' && !failed && proposal.result?.message && <p className="proposal-result">{proposal.result.message}</p>}
  </section>;
}
