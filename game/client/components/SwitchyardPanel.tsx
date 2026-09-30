import { useEffect, useId, useRef, useState } from 'react';
import {
  SWITCHYARD_PANEL, previewSwitchyardRouting, switchyardPorts,
  type SwitchyardDirection, type SwitchyardPanelView, type SwitchyardRotations, type SwitchyardRotation,
} from '../../shared/switchyard';
import '../switchyard.css';

export interface SwitchyardPanelProps {
  roundId: string;
  applied: SwitchyardPanelView;
  enabled: boolean;
  pending?: boolean;
  error?: string;
  onApply(rotations: SwitchyardRotations): Promise<boolean>;
}

const clone = (rotations: SwitchyardRotations): SwitchyardRotations => [...rotations];
const equal = (a: SwitchyardRotations, b: SwitchyardRotations) => a.every((value, index) => value === b[index]);
const endpoints: Record<SwitchyardDirection, string> = { north: '50 0', east: '100 50', south: '50 100', west: '0 50' };

function Conductor({ id, rotation }: { id: string; rotation: SwitchyardRotation }) {
  const ports = switchyardPorts(id, rotation);
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <rect className="switchyard-piece-face" x="3" y="3" width="94" height="94" rx="10"/>
    <path className="switchyard-conductor-bed" d={ports.map(port => `M50 50L${endpoints[port]}`).join(' ')}/>
    <path className="switchyard-conductor" d={ports.map(port => `M50 50L${endpoints[port]}`).join(' ')}/>
    <circle className="switchyard-rotor-ring" cx="50" cy="50" r="15"/>
    <circle className="switchyard-rotor-center" cx="50" cy="50" r="7"/>
    <path className="switchyard-rotor-slot" d="M46 54L54 46"/>
  </svg>;
}

/** A new round gets a fresh local draft, independent of any pending old callback. */
export function SwitchyardPanel({ roundId, ...props }: SwitchyardPanelProps) {
  return <SwitchyardPanelDraft key={roundId} {...props}/>;
}

/** Reads public panel geometry and acknowledged routing only; no robot-local state. */
function SwitchyardPanelDraft({ applied, enabled, pending = false, error, onApply }: Omit<SwitchyardPanelProps, 'roundId'>) {
  const titleId = useId(); const helpId = useId();
  const [draft, setDraft] = useState(() => ({ rotations: clone(applied.appliedRotations), base: clone(applied.appliedRotations),
    revision: applied.panelRevision, undo: [] as SwitchyardRotations[] }));
  const [applying, setApplying] = useState(false);
  const [localError, setLocalError] = useState('');
  const busy = useRef(false);
  const submitted = useRef<SwitchyardRotations | null>(null);
  const mounted = useRef(true);
  const acknowledgedKey = applied.appliedRotations.join(',');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const ownAcknowledgement = submitted.current !== null && equal(submitted.current, applied.appliedRotations);
    setDraft(previous => {
      if (previous.revision === applied.panelRevision) return previous;
      // A different acknowledged layout never silently overwrites a player's edits.
      if (!ownAcknowledgement && !equal(previous.rotations, previous.base)) return previous;
      return { rotations: clone(applied.appliedRotations), base: clone(applied.appliedRotations), revision: applied.panelRevision, undo: [] };
    });
    if (ownAcknowledgement) submitted.current = null;
  }, [applied.panelRevision, acknowledgedKey]);

  const preview = previewSwitchyardRouting(draft.rotations);
  const changed = !equal(draft.rotations, draft.base);
  const stale = draft.revision !== applied.panelRevision;
  const locked = applying || pending;
  const canApply = enabled && !locked && changed && !stale && preview.valid;
  const turn = (index: number, direction = 1) => {
    if (locked || busy.current) return;
    setLocalError('');
    setDraft(previous => {
      const next = clone(previous.rotations);
      next[index] = ((next[index]! + direction + 4) % 4) as SwitchyardRotation;
      return { ...previous, rotations: next, undo: [...previous.undo.slice(-99), clone(previous.rotations)] };
    });
  };
  const undo = () => {
    if (locked || busy.current) return;
    setLocalError('');
    setDraft(previous => previous.undo.length ? { ...previous, rotations: previous.undo.at(-1)!, undo: previous.undo.slice(0, -1) } : previous);
  };
  const reset = () => {
    if (locked || busy.current) return;
    submitted.current = null; setLocalError('');
    setDraft({ rotations: clone(applied.appliedRotations), base: clone(applied.appliedRotations), revision: applied.panelRevision, undo: [] });
  };
  const apply = async () => {
    if (!canApply || busy.current) return;
    busy.current = true; setApplying(true); setLocalError('');
    submitted.current = clone(draft.rotations);
    try {
      const accepted = await onApply(clone(draft.rotations));
      if (!mounted.current) return;
      if (!accepted) { submitted.current = null; setLocalError('Routing was not applied. Your draft is kept; check the response before trying again.'); }
    } catch {
      if (mounted.current) { submitted.current = null; setLocalError('The routing response was not confirmed. Your draft is kept; check the applied panel before trying again.'); }
    } finally {
      busy.current = false;
      if (mounted.current) setApplying(false);
    }
  };

  return <section className="switchyard-panel" aria-labelledby={titleId} aria-busy={locked} data-testid="switchyard-panel">
    <header className="switchyard-panel-heading"><div><p className="section-kicker">Mission Control · routing cabinet</p><h2 id={titleId}>Make a circuit.</h2></div><span className="switchyard-panel-stamp">SY / 02 × 03</span></header>
    <p className="switchyard-panel-intro" id={helpId}>Turn the six pieces to join their contacts. Click or press Enter to turn clockwise; Left and Right turn either way. Draft edits stay on your desk until Apply.</p>
    <div className="switchyard-panel-workbench">
      <div className="switchyard-draft-board">
        <div className="switchyard-board-label"><strong>Draft layout</strong><span>↻ quarter turns</span></div>
        <div className="switchyard-board" role="group" aria-label="Draft routing pieces" aria-describedby={helpId}>
          <span className="switchyard-terminal switchyard-terminal-source" aria-label="Fixed supply, west of P1">IN<span aria-hidden="true">→</span></span>
          {SWITCHYARD_PANEL.terminals.map(terminal => <span key={terminal.id} className={`switchyard-terminal switchyard-terminal-${terminal.id}`} data-connected={preview.poweredTerminals.includes(terminal.id)}>{terminal.label}</span>)}
          {SWITCHYARD_PANEL.pieces.map((piece, index) => {
            const rotation = draft.rotations[index]!;
            const ports = switchyardPorts(piece.id, rotation);
            return <button key={piece.id} type="button" className="switchyard-piece" disabled={locked}
              style={{ gridRow: piece.row + 2, gridColumn: piece.column + 2 }}
              data-piece={piece.id} data-rotation={rotation} data-connected={preview.energizedPieces.includes(piece.id)}
              data-edited={rotation !== draft.base[index]}
              aria-label={`${piece.id.toUpperCase()} ${piece.kind}, ${rotation * 90} degrees, contacts ${ports.join(', ')}. Rotate clockwise`}
              onClick={() => turn(index)} onKeyDown={event => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); turn(index, event.key === 'ArrowLeft' ? -1 : 1); }
              }}>
              <Conductor id={piece.id} rotation={rotation}/><span className="switchyard-piece-id">{piece.id.toUpperCase()}</span><span className="switchyard-piece-angle">{rotation * 90}°</span>
            </button>;
          })}
        </div>
        <p className="switchyard-board-caption">Fixed supply and terminals · unused sockets are insulated</p>
      </div>
      <div className="switchyard-routing-readout">
        <table aria-label="Draft terminal connections and applied terminal power">
          <thead><tr><th scope="col">Terminal</th><th scope="col">Draft</th><th scope="col">Applied</th></tr></thead>
          <tbody>{SWITCHYARD_PANEL.terminals.map(terminal => <tr key={terminal.id}>
            <th scope="row"><span className={`switchyard-terminal-mark switchyard-mark-${terminal.id}`} aria-hidden="true"/>{terminal.label}</th>
            <td data-testid={`draft-${terminal.id}`}>{preview.poweredTerminals.includes(terminal.id) ? 'Connected' : 'Isolated'}</td>
            <td data-testid={`applied-${terminal.id}`}><span className="switchyard-applied-lamp" data-powered={applied.poweredTerminals.includes(terminal.id)} aria-hidden="true"/>{applied.poweredTerminals.includes(terminal.id) ? 'Powered' : 'Off'}</td>
          </tr>)}</tbody>
        </table>
        <div className="switchyard-load" data-valid={preview.valid}><strong>Draft load {preview.load} / {preview.capacity}</strong><span>{preview.valid ? 'Within the two-terminal supply limit.' : 'Over capacity. Disconnect at least one terminal.'}</span></div>
        <div className="switchyard-applied-layout"><strong>Applied rotors <span>#{applied.panelRevision}</span></strong><ol aria-label="Acknowledged piece orientations">{SWITCHYARD_PANEL.pieces.map((piece, index) => <li key={piece.id}><Conductor id={piece.id} rotation={applied.appliedRotations[index]!}/><span>{piece.id.toUpperCase()} <b>{applied.appliedRotations[index]! * 90}°</b></span></li>)}</ol></div>
        <p className="switchyard-readout-boundary">These are panel connections. Ask Pip whether the local machinery is ready and the passage is clear.</p>
      </div>
    </div>
    <div className="switchyard-draft-actions"><button type="button" className="secondary-button" disabled={locked || !draft.undo.length} onClick={undo}>Undo turn</button><button type="button" className="secondary-button" disabled={locked || (!changed && !stale && !draft.undo.length)} onClick={reset}>Reset draft</button><button type="button" className="primary-button" disabled={!canApply} onClick={() => { void apply(); }}>{locked ? 'Applying…' : 'Apply routing'}</button></div>
    <p className="switchyard-panel-status" role="status" data-testid="switchyard-panel-status">{locked ? 'Waiting for the server to acknowledge the complete layout.' : stale ? 'Applied routing changed while you were planning. Your draft is kept. Reset draft to use the acknowledged layout before applying.' : !enabled ? 'You can plan while paused. Resume communication to apply routing.' : changed ? 'Draft changes are not applied. Apply submits all six orientations together.' : `Applied routing acknowledged · revision ${applied.panelRevision}.`}</p>
    {(error || localError) && <p className="switchyard-panel-error" role="alert">{error || localError}</p>}
  </section>;
}
