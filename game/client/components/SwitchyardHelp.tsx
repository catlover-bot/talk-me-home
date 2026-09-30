import type { HintLevel } from '../../shared/contracts';

/** Human-only guidance. Reading it never sends a companion request or changes machinery. */
export function SwitchyardHelp({ hint, onHint, context }: {
  hint: string;
  onHint(level: HintLevel): void;
  /** Optional guidance derived only from information already visible to the human. */
  context?: string;
}) {
  return <details className="hint-panel switchyard-help">
    <summary>Need a nudge?</summary>
    <p>Optional guidance for you, not a Pip report. Reading help does not ask Pip or change the station.</p>
    {context && <p className="switchyard-help-context">{context}</p>}
    <div className="hint-actions">
      <button type="button" onClick={() => onHint(1)}>Nudge</button>
      <button type="button" onClick={() => onHint(2)}>Explain the rule</button>
      <button type="button" onClick={() => onHint(3)}>How to investigate</button>
    </div>
    {hint && <div><span className="source-label">Mission guide · The Switchyard · Private</span><p role="status" className="hint-copy">{hint}</p></div>}
    <p>When you want a report, choose an existing Ask Pip request or use Find our place in the conversation. That is a separate selected text request.</p>
  </details>;
}
