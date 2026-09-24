import { useState } from 'react';
import type { GalleryAnnotation } from '../../shared/contracts';

export type AnnotationChange = { kind: 'location'; target: GalleryAnnotation['location'] } | { kind: 'blocked_gate'; target: string; marked: boolean };
type Room = Exclude<GalleryAnnotation['location'], null>;
const rooms: { id: Room; label: string; x: number; y: number }[] = [
  { id: 'ring', label: 'Ring', x: 75, y: 160 }, { id: 'fork', label: 'Fork', x: 245, y: 160 },
  { id: 'sail', label: 'Sail', x: 425, y: 73 }, { id: 'leaf', label: 'Leaf', x: 425, y: 247 },
  { id: 'dock', label: 'Dock', x: 640, y: 160 },
];
const gates = [
  { id: 'g1', from: 'ring', to: 'fork', circuit: 'Beacon', label: 'Ring – Fork', x: 160, y: 160 },
  { id: 'g2', from: 'fork', to: 'sail', circuit: 'Harbor', label: 'Fork – Sail', x: 335, y: 117 },
  { id: 'g3', from: 'sail', to: 'dock', circuit: 'Beacon', label: 'Sail – Dock', x: 530, y: 117 },
  { id: 'g4', from: 'fork', to: 'leaf', circuit: 'Beacon', label: 'Fork – Leaf', x: 335, y: 203 },
  { id: 'g5', from: 'leaf', to: 'dock', circuit: 'Harbor', label: 'Leaf – Dock', x: 530, y: 203 },
] as const;

function RoomEmblem({ room }: { room: Room }) {
  if (room === 'ring') return <circle r="12" fill="none" strokeWidth="5" />;
  if (room === 'fork') return <path d="M 0 14 V 0 M 0 0 -13 -13 M 0 0 13 -13" fill="none" strokeWidth="4" strokeLinecap="round" />;
  if (room === 'sail') return <><path d="M 0 -15 V 12 H 14 Z M -4 -10 -15 12 H -4 Z" strokeWidth="1.5" /><path d="M -16 17 H 15" strokeWidth="3" /></>;
  if (room === 'leaf') return <><path d="M -12 12 Q -19 -9 14 -16 Q 20 12 -12 12Z" fill="none" strokeWidth="3" /><path d="M -17 18 8 -8" strokeWidth="2.5" /></>;
  return <><path d="M -16 -5 H 16 V 13 H -16 Z M -10 -5 V -13 H 10 V -5" fill="none" strokeWidth="3" /><path d="M -20 18 H 20" strokeWidth="3" /></>;
}

export function GalleryDocument({ annotation, onAnnotation, busy = false }: {
  annotation?: GalleryAnnotation; onAnnotation?(change: AnnotationChange): Promise<unknown>; busy?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const save = async (change: AnnotationChange) => {
    if (!onAnnotation || saving) return;
    setSaving(true);
    setError('');
    try { await onAnnotation(change); } catch { setError('Your mark could not be saved. Try again.'); } finally { setSaving(false); }
  };
  return <section className="mission-documents gallery-document" aria-label="Mission Control documents">
    <div className="document-heading"><div><p className="section-kicker">Mission Control documents</p><h2>Relay Gallery atlas</h2></div><span className="document-reference">02 / RG</span></div>
    <div className="atlas-key"><span><i className="beacon-swatch" aria-hidden="true" />B · Beacon circuit</span><span><i className="harbor-swatch" aria-hidden="true" />H · Harbor circuit</span><span>Gates work both ways</span></div>
    <div className="atlas-scroll" role="region" aria-label="Gallery atlas. Scroll horizontally on a narrow screen." tabIndex={0}>
    <div className="atlas-surface" data-editing={editing}>
    <svg className="gallery-map" viewBox="0 0 720 320" role="img" aria-labelledby="gallery-map-title gallery-map-desc">
      <title id="gallery-map-title">Relay Gallery documented routes and emblems</title>
      <desc id="gallery-map-desc">Ring connects to Fork through Beacon. Fork connects to Sail through Harbor and Leaf through Beacon. Sail connects to Dock through Beacon. Leaf connects to Dock through Harbor. All gates work both ways. This static atlas does not show Pip’s location or obstructions. Dashed circles and crosses, if present, are your private guesses.</desc>
      <defs><pattern id="atlas-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#627969" strokeWidth=".5" opacity=".16" /></pattern><pattern id="atlas-engraving" width="5" height="5" patternUnits="userSpaceOnUse"><path d="m0 5 5-5" stroke="#456756" strokeWidth=".6" opacity=".35" /></pattern></defs>
      <rect width="720" height="320" fill="#edf0df" /><rect x="10" y="10" width="700" height="300" fill="url(#atlas-grid)" stroke="#a5b39c" />
      <path d="M24 68V24H150 M568 295H695V251" stroke="#71846d" fill="none" />
      <text className="atlas-imprint" x="32" y="44">RELAY GALLERY</text><text className="atlas-imprint" x="32" y="61">CIRCUIT &amp; WAYFINDING ATLAS</text>
      <g className="atlas-compass" transform="translate(665 49)"><circle r="18" fill="none" stroke="currentColor" opacity=".4" /><path d="M0 20V-15 M-5-7 0-15 5-7 M-12 0H12" fill="none" stroke="currentColor" strokeWidth="1.5" /><text y="-24" textAnchor="middle">N</text><text x="25" y="5">E</text></g>
      {gates.map(gate => {
        const from = rooms.find(room => room.id === gate.from)!; const to = rooms.find(room => room.id === gate.to)!;
        const marked = annotation?.blockedGates.includes(gate.id);
        return <g key={gate.id} className={`atlas-gate ${gate.circuit.toLowerCase()}`}><path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} className="atlas-track-bed" /><path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} className="atlas-track" /><g transform={`translate(${gate.x} ${gate.y})`}><rect x="-41" y="-15" width="82" height="30" rx="2" /><text className="gate-full-name" textAnchor="middle" y="6">{gate.circuit}</text><text className="gate-short-name" textAnchor="middle" y="7" aria-hidden="true">{gate.circuit[0]}</text>{marked && <g className="private-path-mark" aria-label={`Your suspected obstruction: ${gate.label}`}><circle cy="-29" r="12" /><path d="M-5-34 5-24 M-5-24 5-34" /></g>}</g></g>;
      })}
      {rooms.map(room => <g key={room.id} transform={`translate(${room.x} ${room.y})`} className="atlas-room"><path className="room-mount" d="M-26-32H26L34-24V24L26 32H-26L-34 24V-24Z" /><circle r="26" className="room-disc" /><circle r="22" className="room-inner-ring" /><g className="room-emblem"><RoomEmblem room={room.id} /></g><text className="room-name" textAnchor="middle" y={room.id === 'sail' ? -41 : 52}>{room.label}</text>{annotation?.location === room.id && <><circle className="private-location-mark" r="40" /><text className="private-marker-label" y={room.id === 'sail' ? 56 : -47} textAnchor="middle">YOUR MARK</text></>}</g>)}
      <text className="atlas-route-note" x="75" y="232" textAnchor="middle">Entry</text><text className="atlas-route-note" x="640" y="232" textAnchor="middle">To Return Dock</text><text className="atlas-imprint" x="31" y="293">ALL GATES · TWO-WAY</text>
    </svg>
    {editing && <div className="atlas-direct-marks" aria-label="Direct private map marks">
      {rooms.map(room => <button key={room.id} type="button" className="atlas-room-mark" style={{ left: `${room.x / 7.2}%`, top: `${room.y / 3.2}%` }} aria-label={`${annotation?.location === room.id ? 'Clear' : 'Mark'} ${room.label} as your inferred location`} aria-pressed={annotation?.location === room.id} disabled={busy || saving || !onAnnotation} onClick={() => { void save({ kind: 'location', target: annotation?.location === room.id ? null : room.id }); }}><span aria-hidden="true">?</span></button>)}
      {gates.map(gate => <button key={gate.id} type="button" className="atlas-gate-mark" style={{ left: `${gate.x / 7.2}%`, top: `${gate.y / 3.2}%` }} aria-label={`${annotation?.blockedGates.includes(gate.id) ? 'Clear' : 'Mark'} suspected obstruction on ${gate.label}`} aria-pressed={annotation?.blockedGates.includes(gate.id) ?? false} disabled={busy || saving || !onAnnotation} onClick={() => { void save({ kind: 'blocked_gate', target: gate.id, marked: !annotation?.blockedGates.includes(gate.id) }); }}><span aria-hidden="true">×</span></button>)}
    </div>}
    </div>
    </div>
    <div className="document-caption"><span>Static atlas · ask Pip about local emblems and gates</span><span>No live location or obstruction feed</span></div>
    <div className="atlas-route-reference"><table><caption>Documented gate reference</caption><thead><tr><th scope="col">Connects</th><th scope="col">Circuit</th></tr></thead><tbody>{gates.map(gate => <tr key={gate.id}><th scope="row">{gate.label}</th><td>{gate.circuit}</td></tr>)}</tbody></table></div>
    <details className="private-map-notes" onToggle={event => setEditing(event.currentTarget.open)}><summary>Mark your map <span className="source-label">Private inference</span></summary>
      <p>Your marks are guesses. Select an emblem or circuit on the map, or use the controls below. Select again to clear. Nothing is sent to Pip.</p>
      <div className="annotation-location"><label htmlFor="map-location">Where I think Pip is</label><select id="map-location" value={annotation?.location ?? ''} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'location', target: event.target.value ? event.target.value as Room : null }); }}><option value="">No location marked</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.label}</option>)}</select></div>
      <fieldset className="blocked-gate-choices"><legend>Paths I suspect are obstructed</legend>{gates.map(gate => <label key={gate.id}><input type="checkbox" checked={annotation?.blockedGates.includes(gate.id) ?? false} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'blocked_gate', target: gate.id, marked: event.target.checked }); }} /><span>{gate.label}<small>{gate.circuit}</small></span></label>)}</fieldset>
      {saving && <p role="status">Saving your private mark…</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  </section>;
}
