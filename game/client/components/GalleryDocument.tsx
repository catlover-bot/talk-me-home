import { useState } from 'react';
import type { AnnotationRequest, GalleryAnnotation, MissionRecord, RecordedMessage } from '../../shared/contracts';
import { originLabel } from '../useMission';

type Change<T> = T extends unknown ? Omit<T, 'roundId' | 'chapterEpoch' | 'requestId'> : never;
export type AnnotationChange = Change<AnnotationRequest>;
type Room = Exclude<GalleryAnnotation['location'], null>;
const rooms: { id: Room; label: string; x: number; y: number }[] = [
  { id: 'ring', label: 'Ring', x: 75, y: 160 }, { id: 'fork', label: 'Fork', x: 245, y: 160 },
  { id: 'sail', label: 'Sail', x: 425, y: 73 }, { id: 'leaf', label: 'Leaf', x: 425, y: 247 },
  { id: 'dock', label: 'Dock', x: 640, y: 160 },
];
const gates = [
  { id: 'g1', from: 'ring', to: 'fork', circuit: 'Beacon', label: 'Ring – Fork', directions: 'east / west', x: 160, y: 160 },
  { id: 'g2', from: 'fork', to: 'sail', circuit: 'Harbor', label: 'Fork – Sail', directions: 'northeast / southwest', x: 335, y: 117 },
  { id: 'g3', from: 'sail', to: 'dock', circuit: 'Beacon', label: 'Sail – Dock', directions: 'southeast / northwest', x: 530, y: 117 },
  { id: 'g4', from: 'fork', to: 'leaf', circuit: 'Beacon', label: 'Fork – Leaf', directions: 'southeast / northwest', x: 335, y: 203 },
  { id: 'g5', from: 'leaf', to: 'dock', circuit: 'Harbor', label: 'Leaf – Dock', directions: 'northeast / southwest', x: 530, y: 203 },
] as const;

function RoomEmblem({ room }: { room: Room }) {
  if (room === 'ring') return <circle r="12" fill="none" strokeWidth="5" />;
  if (room === 'fork') return <path d="M 0 14 V 0 M 0 0 -13 -13 M 0 0 13 -13" fill="none" strokeWidth="4" strokeLinecap="round" />;
  if (room === 'sail') return <><path d="M 0 -15 V 12 H 14 Z M -4 -10 -15 12 H -4 Z" strokeWidth="1.5" /><path d="M -16 17 H 15" strokeWidth="3" /></>;
  if (room === 'leaf') return <><path d="M -12 12 Q -19 -9 14 -16 Q 20 12 -12 12Z" fill="none" strokeWidth="3" /><path d="M -17 18 8 -8" strokeWidth="2.5" /></>;
  return <><path d="M -16 -5 H 16 V 13 H -16 Z M -10 -5 V -13 H 10 V -5" fill="none" strokeWidth="3" /><path d="M -20 18 H 20" strokeWidth="3" /></>;
}

export interface GalleryDocumentProps {
  annotation?: GalleryAnnotation; record?: MissionRecord | null;
  optionalObjective?: 'flight_recorder';
  onAnnotation?(change: AnnotationChange): Promise<unknown>; busy?: boolean;
  onPin?(messageId: string): Promise<unknown>;
  onQuickRequest?(kind: 'surroundings' | 'repeat_report'): Promise<boolean>;
  requestEnabled?: boolean;
}

/** Uses only communicated, saved words. No inferred emblem or local tool payload enters the atlas. */
export function latestGalleryReport(record?: MissionRecord | null): RecordedMessage | undefined {
  return record?.messages.filter(message => message.roundId === record.roundId && message.chapter === 'gallery'
    && message.role === 'robot' && !message.interrupted).at(-1);
}

function RoomMount({ room }: { room: Room }) {
  if (room === 'ring') return <circle className="room-mount" r="34" />;
  if (room === 'fork') return <path className="room-mount" d="M-35 15V-15L-19-35 0-26 19-35 35-15V15L15 34H-15Z" />;
  if (room === 'sail') return <path className="room-mount" d="M-35 31-5-39 35 31Z" />;
  if (room === 'leaf') return <path className="room-mount" d="M-35 17Q-38-31 27-35Q43 18-17 35Z" />;
  return <path className="room-mount" d="M-36-29H36V19H18V34H-18V19H-36Z" />;
}

export function GalleryDocument({ annotation, record, optionalObjective, onAnnotation, busy = false, onPin, onQuickRequest, requestEnabled = false }: GalleryDocumentProps) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(true);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<AnnotationChange[][]>([]);
  const [focusedTarget, setFocusedTarget] = useState<string | null>(null);
  const [markMode, setMarkMode] = useState<'planned_gate' | 'explored_gate' | 'blocked_gate' | 'location'>('planned_gate');
  const [reportTarget, setReportTarget] = useState('');
  const [dynamic, setDynamic] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const latest = latestGalleryReport(record);
  const planned = annotation?.plannedGates ?? [];
  const explored = annotation?.exploredGates ?? [];
  const markedGates = markMode === 'planned_gate' ? planned : markMode === 'explored_gate' ? explored : annotation?.blockedGates ?? [];
  const disabled = busy || saving || !onAnnotation;
  const save = async (change: AnnotationChange) => {
    if (!onAnnotation || saving) return;
    setSaving(true);
    setError('');
    const inverse: AnnotationChange[] = change.kind === 'clear_plan' ? planned.map(target => ({ kind: 'planned_gate', target, marked: true }))
      : change.kind === 'location' ? [{ kind: 'location', target: annotation?.location ?? null }]
        : change.kind === 'planned_gate' || change.kind === 'explored_gate' || change.kind === 'blocked_gate'
          ? [{ ...change, marked: (change.kind === 'planned_gate' ? planned : change.kind === 'explored_gate' ? explored : annotation?.blockedGates ?? []).includes(change.target) }] : [];
    try {
      await onAnnotation(change);
      if (inverse.length) setUndo(previous => [...previous.slice(-19), inverse]);
      if ('target' in change && change.target && (change.kind === 'report_link' || annotation?.reportLinks?.some(link => link.target === change.target))) setFocusedTarget(change.target);
    } catch { setError('Your mark could not be saved. Try again.'); } finally { setSaving(false); }
  };
  const undoMark = async () => {
    const changes = undo.at(-1);
    if (!onAnnotation || saving || !changes) return;
    setSaving(true); setError('');
    try {
      // Reversing a cleared plan restores only the player's own ink, never game state.
      for (const change of changes) await onAnnotation(change);
      setUndo(previous => previous.slice(0, -1));
    } catch { setError('Your last mark could not be fully restored. Check the map and try again.'); }
    finally { setSaving(false); }
  };
  const quickRequest = async (kind: 'surroundings' | 'repeat_report') => {
    if (!onQuickRequest || requesting || !requestEnabled) return;
    setRequesting(true);
    try { await onQuickRequest(kind); } finally { setRequesting(false); }
  };
  const targetName = (target: string) => rooms.find(room => room.id === target)?.label ?? gates.find(gate => gate.id === target)?.label ?? 'Unknown association';
  const focus = focusedTarget ?? annotation?.reportLinks?.at(-1)?.target;
  const focusedReports = annotation?.reportLinks?.filter(link => link.target === focus) ?? [];
  return <section className="mission-documents gallery-document" aria-label="Mission Control documents">
    <div className="document-heading"><div><p className="section-kicker">Mission Control documents</p><h2>Relay Gallery atlas</h2></div><span className="document-reference">02 / RG</span></div>
    <div className="atlas-key"><span><i className="beacon-swatch" aria-hidden="true" />B · Beacon circuit</span><span><i className="harbor-swatch" aria-hidden="true" />H · Harbor circuit</span><span>Gates work both ways</span></div>
    <div className="atlas-planning-bar" aria-label="Private route planning"><button type="button" aria-pressed={editing && markMode === 'planned_gate'} onClick={() => { setMarkMode('planned_gate'); setEditing(true); }}>Plan route</button><button type="button" aria-pressed={editing && markMode === 'blocked_gate'} onClick={() => { setMarkMode('blocked_gate'); setEditing(true); }}>Cross out</button><button type="button" disabled={disabled || undo.length === 0} onClick={() => { void undoMark(); }}>Undo mark</button><button type="button" disabled={disabled || planned.length === 0} onClick={() => { void save({ kind: 'clear_plan' }); }}>Erase plan</button><span>Click a corridor. Pencil marks stay private.</span></div>
    {error && <p className="atlas-save-error" role="alert">{error}</p>}
    <div className="atlas-scroll" role="region" aria-label="Gallery atlas. Scroll horizontally on a narrow screen." tabIndex={0}>
    <div className="atlas-surface" data-editing={editing}>
    <svg className="gallery-map" viewBox="0 0 720 320" role="group" aria-labelledby="gallery-map-title gallery-map-desc">
      <title id="gallery-map-title">Relay Gallery documented routes and emblems</title>
      <desc id="gallery-map-desc">Ring connects to Fork through Beacon. Fork connects to Sail through Harbor and Leaf through Beacon. Sail connects to Dock through Beacon. Leaf connects to Dock through Harbor. All gates work both ways. This static atlas does not show Pip’s location or obstructions. Dashed circles and crosses, if present, are your private guesses.</desc>
      <defs><pattern id="atlas-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#627969" strokeWidth=".5" opacity=".16" /></pattern><pattern id="atlas-engraving" width="5" height="5" patternUnits="userSpaceOnUse"><path d="m0 5 5-5" stroke="#456756" strokeWidth=".6" opacity=".35" /></pattern></defs>
      <rect width="720" height="320" fill="#edf0df" /><rect x="10" y="10" width="700" height="300" fill="url(#atlas-grid)" stroke="#a5b39c" />
      <path d="M24 68V24H150 M568 295H695V251" stroke="#71846d" fill="none" />
      <text className="atlas-imprint" x="32" y="44">RELAY GALLERY</text><text className="atlas-imprint" x="32" y="61">CIRCUIT &amp; WAYFINDING ATLAS</text>
      <g className="atlas-compass" transform="translate(665 49)"><circle r="18" fill="none" stroke="currentColor" opacity=".4" /><path d="M0 20V-15 M-5-7 0-15 5-7 M-12 0H12" fill="none" stroke="currentColor" strokeWidth="1.5" /><text y="-24" textAnchor="middle">N</text><text x="25" y="5">E</text><text x="-32" y="5">W</text><text y="35" textAnchor="middle">S</text></g>
      {gates.map(gate => {
        const from = rooms.find(room => room.id === gate.from)!; const to = rooms.find(room => room.id === gate.to)!;
        const marked = annotation?.blockedGates.includes(gate.id);
        const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
        return <g key={gate.id} className={`atlas-gate ${gate.circuit.toLowerCase()}`}><path d={path} className="atlas-track-bed" /><path d={path} className="atlas-track" />{planned.includes(gate.id) && <path d={path} className="atlas-plan-mark" aria-label={`Planned: ${gate.label}`} />}{explored.includes(gate.id) && <path d={path} className="atlas-explored-mark" aria-label={`Player-marked explored: ${gate.label}`} />}<g transform={`translate(${gate.x} ${gate.y})`}><rect x="-41" y="-15" width="82" height="30" rx="2" /><text className="gate-full-name" textAnchor="middle" y="6">{gate.circuit}</text><text className="gate-short-name" textAnchor="middle" y="7" aria-hidden="true">{gate.circuit[0]}</text>{marked && <g className="private-path-mark" aria-label={`Your suspected obstruction: ${gate.label}`}><circle cy="-29" r="12" /><path d="M-5-34 5-24 M-5-24 5-34" /></g>}</g></g>;
      })}
      {rooms.map(room => <g key={room.id} transform={`translate(${room.x} ${room.y})`} className="atlas-room" data-focused={focus === room.id} role="button" tabIndex={0} aria-label={`Read attached reports for ${room.label}`} onClick={() => setFocusedTarget(room.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusedTarget(room.id); } }}><RoomMount room={room.id}/><circle r="26" className="room-disc" /><circle r="22" className="room-inner-ring" /><g className="room-emblem"><RoomEmblem room={room.id} /></g><text className="room-name" textAnchor="middle" y={room.id === 'sail' ? -41 : 52}>{room.label}</text>{optionalObjective === 'flight_recorder' && room.id === 'leaf' && <g className="archive-map-label"><path d="M38 10H75V35H38Z M38 17H75 M46 25H66" fill="none" stroke="currentColor" strokeWidth="1.5"/><text x="82" y="26">Archive</text></g>}{annotation?.location === room.id && <><circle className="private-location-mark" r="40" /><text className="private-marker-label" y={room.id === 'sail' ? 56 : -47} textAnchor="middle">YOUR MARK</text></>}</g>)}
      <text className="atlas-route-note" x="75" y="232" textAnchor="middle">Entry</text><text className="atlas-route-note" x="640" y="232" textAnchor="middle">To Return Dock</text><text className="atlas-imprint" x="31" y="293">ALL GATES · TWO-WAY</text>
    </svg>
    {editing && <div className="atlas-direct-marks" aria-label="Direct private map marks">
      {markMode === 'location' ? rooms.map(room => <button key={room.id} type="button" className="atlas-room-mark" style={{ left: `${room.x / 7.2}%`, top: `${room.y / 3.2}%` }} aria-label={`${annotation?.location === room.id ? 'Clear' : 'Mark'} ${room.label} as your inferred location`} aria-pressed={annotation?.location === room.id} disabled={disabled} onClick={() => { void save({ kind: 'location', target: annotation?.location === room.id ? null : room.id }); }}><span aria-hidden="true">?</span></button>) : gates.map(gate => <button key={gate.id} type="button" className="atlas-gate-mark" style={{ left: `${gate.x / 7.2}%`, top: `${gate.y / 3.2}%` }} aria-label={`${markedGates.includes(gate.id) ? 'Clear' : 'Mark'} ${markMode === 'planned_gate' ? 'planned route' : markMode === 'explored_gate' ? 'explored route' : 'suspected obstruction'} on ${gate.label}`} aria-pressed={markedGates.includes(gate.id)} disabled={disabled} onClick={() => { void save({ kind: markMode, target: gate.id, marked: !markedGates.includes(gate.id) }); }}><span aria-hidden="true">{markMode === 'planned_gate' ? '+' : markMode === 'explored_gate' ? '•' : '×'}</span></button>)}
    </div>}
    </div>
    </div>
    <div className="document-caption atlas-mark-key"><span><i className="planned-swatch"/>Planned</span><span><i className="explored-swatch"/>Player-marked explored</span><span>Location unknown until you mark it</span></div>
    <p className="atlas-reading-rule"><strong>Power opens a gate. A report checks the passage.</strong> Circuit lines never mean “clear”.</p>
    {optionalObjective === 'flight_recorder' && <p className="archive-document-note"><strong>Optional · Leaf archive.</strong> The archive register lists a small case: “Pip / flight notes.” Ask Pip to read its label when it is within reach. Bring it along if you choose; a direct rescue is complete too.</p>}
    {focus && <section className="map-associated-focus" aria-label={`Attached reports for ${targetName(focus)}`}><div><strong>{targetName(focus)}</strong><span>Your map association · not a position reading</span><button className="text-button" onClick={() => setFocusedTarget('')}>Clear focus</button></div>{focusedReports.length ? focusedReports.map(link => <article key={`${link.messageId}:${link.targetKind}:${link.target}`} data-historical={link.earlier}><blockquote tabIndex={0}>{link.text}</blockquote><p>{link.dynamic ? link.earlier ? 'Earlier gate conditions · recheck' : 'Reported conditions · not live' : 'Reported clue'} · {originLabel[link.origin]} · <time dateTime={new Date(link.reportedAt).toISOString()}>{new Date(link.reportedAt).toLocaleTimeString('en')}</time>{link.interrupted && ' · Interrupted / incomplete speech'}</p></article>) : <p>No quote attached here. Choose “Quote & attach to map” below to place Pip's exact words beside your plan.</p>}</section>}
    <section className="gallery-field-report" aria-label="Last communicated Gallery report">
      <div className="field-report-heading"><strong>Last report</strong>{latest ? <span>{originLabel[latest.origin]} · <time dateTime={new Date(latest.timestamp).toISOString()}>{new Date(latest.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></span> : <span>Unknown · ask Pip</span>}</div>
      {latest ? <blockquote data-testid="gallery-report-excerpt" tabIndex={0}>{latest.text}</blockquote> : <p>No complete Gallery report yet. The atlas does not know where Pip is.</p>}
      {latest?.reportContext && <p className="report-freshness" data-historical={latest.reportContext.earlier}>{latest.reportContext.earlier ? 'Earlier conditions — request a fresh check.' : 'Latest communicated report — not a live reading.'} Relay when reported: {latest.reportContext.relay === 'off' ? 'Off' : latest.reportContext.relay === 'beacon' ? 'Beacon' : 'Harbor'}.</p>}
      <div className="field-report-actions"><button disabled={!requestEnabled || requesting || !onQuickRequest} onClick={() => { void quickRequest('surroundings'); }}>Check surroundings</button><button disabled={!requestEnabled || requesting || !latest || !onQuickRequest} onClick={() => { void quickRequest('repeat_report'); }}>Repeat report</button><span>Selected requests · not microphone speech</span></div>
      {latest && <details className="report-association"><summary>Quote &amp; attach to map <span>Exact words · player association</span></summary><article id={`gallery-quote-${latest.messageId}`}><div className="caption-meta"><strong>Pip</strong><span className="source-label">{originLabel[latest.origin]}</span><time dateTime={new Date(latest.timestamp).toISOString()}>{new Date(latest.timestamp).toLocaleString('en')}</time></div><blockquote>{latest.text}</blockquote><p>Reported then, not a live reading. A new visit does not refresh this quote.</p><button disabled={!onPin} onClick={() => { void onPin?.(latest.messageId); }}>Pin exact report</button></article><div className="report-association-controls"><label>Attach report to<select aria-label="Attach report to" value={reportTarget} onChange={event => setReportTarget(event.target.value)}><option value="">Choose a room or corridor</option><optgroup label="Rooms">{rooms.map(room => <option key={room.id} value={room.id}>{room.label}</option>)}</optgroup><optgroup label="Corridors">{gates.map(gate => <option key={gate.id} value={gate.id}>{gate.label}</option>)}</optgroup></select></label><label><input type="checkbox" checked={dynamic} onChange={event => setDynamic(event.target.checked)}/>Gate conditions · recheck after Relay changes</label><button disabled={disabled || !reportTarget} onClick={() => { void save({ kind: 'report_link', messageId: latest.messageId, target: reportTarget, targetKind: rooms.some(room => room.id === reportTarget) ? 'room' : 'corridor', dynamic }); }}>Attach exact quote</button></div></details>}
      {(annotation?.reportLinks?.length ?? 0) > 0 && <details className="associated-reports"><summary>Map reports ({annotation?.reportLinks?.length})</summary><ul>{annotation?.reportLinks?.map(link => {
        const quote = link.text;
        return <li key={`${link.messageId}:${link.targetKind}:${link.target}`} data-historical={link.earlier}><strong>{targetName(link.target)}</strong><span className="source-label">Player-associated · {link.dynamic ? link.earlier ? 'Historical gate report — recheck' : 'Gate report — not live' : 'Stable clue — reported then'}</span><time dateTime={new Date(link.reportedAt).toISOString()}>{originLabel[link.origin]} · Reported {new Date(link.reportedAt).toLocaleTimeString('en')}</time>{quote ? <blockquote>{quote}</blockquote> : <p>Original quote is outside the current history window.</p>}{link.interrupted && <span className="earlier">Interrupted / incomplete speech</span>}<button className="text-button" disabled={disabled} onClick={() => { void save({ kind: 'report_unlink', messageId: link.messageId, target: link.target, targetKind: link.targetKind }); }}>Remove association</button></li>;
      })}</ul></details>}
    </section>
    <details className="atlas-directions"><summary>Compass &amp; corridor reference</summary><p>North stays at the top. Read directions from the first room to the second; the return direction follows the slash. Open does not mean clear: ask Pip to check the passage.</p><table><caption>Documented gate reference</caption><thead><tr><th scope="col">Connects</th><th scope="col">Circuit</th><th scope="col">Out / back</th></tr></thead><tbody>{gates.map(gate => <tr key={gate.id}><th scope="row">{gate.label}</th><td>{gate.circuit}</td><td>{gate.directions}</td></tr>)}</tbody></table></details>
    <details className="private-map-notes" onToggle={event => { if (event.currentTarget.open) setEditing(true); }}><summary>Mark your map <span className="source-label">Private inference</span></summary>
      <p>Your marks are guesses. Select an emblem or circuit on the map, or use the controls below. Select again to clear. Nothing is sent to Pip.</p>
      <label className="map-mark-mode">Map click marks<select aria-label="Map click marks" value={markMode} onChange={event => { setMarkMode(event.target.value as typeof markMode); setEditing(true); }}><option value="planned_gate">Intended route</option><option value="explored_gate">Player-marked explored route</option><option value="blocked_gate">Suspected obstruction</option><option value="location">Inferred location</option></select></label>
      <div className="annotation-location"><label htmlFor="map-location">Where I think Pip is</label><select id="map-location" value={annotation?.location ?? ''} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'location', target: event.target.value ? event.target.value as Room : null }); }}><option value="">No location marked</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.label}</option>)}</select></div>
      <fieldset className="blocked-gate-choices"><legend>Paths I suspect are obstructed</legend>{gates.map(gate => <label key={gate.id}><input type="checkbox" checked={annotation?.blockedGates.includes(gate.id) ?? false} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'blocked_gate', target: gate.id, marked: event.target.checked }); }} /><span>{gate.label}<small>{gate.circuit}</small></span></label>)}</fieldset>
      {saving && <p role="status">Saving your private mark…</p>}
    </details>
  </section>;
}
