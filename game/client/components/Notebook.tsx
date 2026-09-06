import { useState, type FormEvent } from 'react';
import type { MissionRecord } from '../../shared/contracts';
import { originLabel } from '../useMission';

export function Notebook({ record, onNote }: { record: MissionRecord | null; onNote(text: string): Promise<boolean> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!text.trim() || saving) return;
    setSaving(true); if (await onNote(text)) setText(''); setSaving(false);
  };
  return <section className="notebook" aria-labelledby="notebook-heading">
    <div className="section-heading"><h2 id="notebook-heading">Field notebook</h2><span className="source-label">Yours to keep in mind</span></div>
    <p className="muted">Pin Pip's words from the caption or history. Reports are quotes, not current readings.</p>
    <ul className="notebook-list">
      {record?.notebook.map(entry => <li key={entry.id} className={'notebook-entry ' + (entry.kind === 'report' ? 'report' : 'private-note')}>
        <div className="caption-meta"><strong>{entry.kind === 'report' ? 'Robot report' : 'My note'}</strong>
          {entry.origin && <span className="source-label">{originLabel[entry.origin]}</span>}
          <time dateTime={new Date(entry.reportedAt ?? entry.timestamp).toISOString()}>{new Date(entry.reportedAt ?? entry.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        {entry.kind === 'report' ? <blockquote>{entry.text}</blockquote> : <p>{entry.text}</p>}
        {entry.interrupted && <span className="earlier">Interrupted / incomplete speech</span>}
        {entry.earlier && entry.kind === 'report' && <span className="earlier">Earlier report — recheck if needed</span>}
        {entry.kind === 'note' && <span className="source-label">Private. Not sent to Pip.</span>}
      </li>)}
    </ul>
    {!record?.notebook.length && <p className="notebook-empty">Nothing pinned yet.</p>}
    <form className="note-form" onSubmit={submit}>
      <label htmlFor="private-note">My note</label>
      <div className="input-row"><input id="private-note" maxLength={500} value={text} onChange={event => setText(event.target.value)} placeholder="For your eyes only" />
        <button type="submit" disabled={saving || !text.trim()}>{saving ? 'Saving…' : 'Add note'}</button></div>
    </form>
  </section>;
}
