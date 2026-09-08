import { useState } from 'react';
import type { GalleryAnnotation } from '../../shared/contracts';

export type AnnotationChange = { kind: 'location'; target: GalleryAnnotation['location'] } | { kind: 'blocked_gate'; target: string; marked: boolean };
type Room = Exclude<GalleryAnnotation['location'], null>;
const rooms: { id: Room; label: string; x: number; y: number }[] = [
  { id: 'ring', label: 'Ring', x: 75, y: 145 }, { id: 'fork', label: 'Fork', x: 245, y: 145 },
  { id: 'sail', label: 'Sail', x: 425, y: 57 }, { id: 'leaf', label: 'Leaf', x: 425, y: 233 },
  { id: 'dock', label: 'Dock', x: 610, y: 145 },
];
const gates = [
  { id: 'g1', from: 'ring', to: 'fork', circuit: 'Beacon', label: 'Ring – Fork', x: 160, y: 145 },
  { id: 'g2', from: 'fork', to: 'sail', circuit: 'Harbor', label: 'Fork – Sail', x: 335, y: 101 },
  { id: 'g3', from: 'sail', to: 'dock', circuit: 'Beacon', label: 'Sail – Dock', x: 518, y: 101 },
  { id: 'g4', from: 'fork', to: 'leaf', circuit: 'Beacon', label: 'Fork – Leaf', x: 335, y: 189 },
  { id: 'g5', from: 'leaf', to: 'dock', circuit: 'Harbor', label: 'Leaf – Dock', x: 518, y: 189 },
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
  const save = async (change: AnnotationChange) => {
    if (!onAnnotation || saving) return;
    setSaving(true);
    try { await onAnnotation(change); } finally { setSaving(false); }
  };
  return <section className="mission-documents gallery-document" aria-label="Mission Control documents">
    <div className="document-heading"><div><p className="section-kicker">Mission Control documents</p><h2>Relay Gallery atlas</h2></div><span className="document-reference">02 / RG</span></div>
    <div className="atlas-key"><span><i className="beacon-swatch" aria-hidden="true" />B · Beacon circuit</span><span><i className="harbor-swatch" aria-hidden="true" />H · Harbor circuit</span><span>Gates work both ways</span></div>
    <svg className="gallery-map" viewBox="0 0 700 295" role="img" aria-labelledby="gallery-map-title gallery-map-desc">
      <title id="gallery-map-title">Relay Gallery documented routes and emblems</title>
      <desc id="gallery-map-desc">Ring connects to Fork through Beacon. Fork connects to Sail through Harbor and Leaf through Beacon. Sail connects to Dock through Beacon. Leaf connects to Dock through Harbor. All gates work both ways. This static atlas does not show Pip’s location or obstructions. Dashed circles and crosses, if present, are your private guesses.</desc>
      <defs><pattern id="atlas-grid" width="21" height="21" patternUnits="userSpaceOnUse"><path d="M 21 0 H 0 V 21" fill="none" stroke="#7b8a79" strokeWidth=".7" opacity=".18" /></pattern></defs>
      <rect width="700" height="295" fill="url(#atlas-grid)" />
      <g className="atlas-compass" transform="translate(657 38)"><path d="M 0 19 V -12 M -5 -5 0 -12 5 -5 M -10 5 H 10" fill="none" stroke="currentColor" strokeWidth="1.5" /><text y="-19" textAnchor="middle">N</text><text x="17" y="10">E</text></g>
      {gates.map(gate => {
        const from = rooms.find(room => room.id === gate.from)!; const to = rooms.find(room => room.id === gate.to)!;
        const marked = annotation?.blockedGates.includes(gate.id);
        return <g key={gate.id} className={`atlas-gate ${gate.circuit.toLowerCase()}`}><path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} className="atlas-track" /><g transform={`translate(${gate.x} ${gate.y})`}><rect x="-38" y="-13" width="76" height="26" rx="3" /><text className="gate-full-name" textAnchor="middle" y="6">{gate.circuit}</text><text className="gate-short-name" textAnchor="middle" y="7" aria-hidden="true">{gate.circuit[0]}</text>{marked && <g className="private-path-mark" aria-label={`Your suspected obstruction: ${gate.label}`}><circle cy="-27" r="12" /><path d="M -5 -32 5 -22 M -5 -22 5 -32" /></g>}</g></g>;
      })}
      {rooms.map(room => <g key={room.id} transform={`translate(${room.x} ${room.y})`} className="atlas-room"><circle r="31" className="room-disc" /><g className="room-emblem"><RoomEmblem room={room.id} /></g><text className="room-name" textAnchor="middle" y={room.id === 'sail' ? -38 : 50}>{room.label}</text>{annotation?.location === room.id && <><circle className="private-location-mark" r="38" /><text className="private-marker-label" y={room.id === 'sail' ? 51 : -45} textAnchor="middle">YOUR MARK</text></>}</g>)}
      <text className="atlas-route-note" x="75" y="215" textAnchor="middle">Entry</text><text className="atlas-route-note" x="610" y="215" textAnchor="middle">To Return Dock</text>
    </svg>
    <div className="document-caption"><span>Static atlas · ask Pip about local emblems and gates</span><span>No live location or obstruction feed</span></div>
    <div className="atlas-route-reference"><table><caption>Documented gate reference</caption><thead><tr><th scope="col">Connects</th><th scope="col">Circuit</th></tr></thead><tbody>{gates.map(gate => <tr key={gate.id}><th scope="row">{gate.label}</th><td>{gate.circuit}</td></tr>)}</tbody></table></div>
    <details className="private-map-notes"><summary>Mark your map <span className="source-label">Private inference</span></summary>
      <p>Your marks are guesses. They do not move Pip, verify a gate, or send anything to Pip.</p>
      <div className="annotation-location"><label htmlFor="map-location">Where I think Pip is</label><select id="map-location" value={annotation?.location ?? ''} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'location', target: event.target.value ? event.target.value as Room : null }); }}><option value="">No location marked</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.label}</option>)}</select></div>
      <fieldset className="blocked-gate-choices"><legend>Paths I suspect are obstructed</legend>{gates.map(gate => <label key={gate.id}><input type="checkbox" checked={annotation?.blockedGates.includes(gate.id) ?? false} disabled={busy || saving || !onAnnotation} onChange={event => { void save({ kind: 'blocked_gate', target: gate.id, marked: event.target.checked }); }} /><span>{gate.label}<small>{gate.circuit}</small></span></label>)}</fieldset>
      {saving && <p role="status">Saving your private mark…</p>}
    </details>
  </section>;
}
