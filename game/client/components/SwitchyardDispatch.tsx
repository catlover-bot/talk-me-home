import { useId, useRef, useState } from 'react';
import { REMIX_CODE_PATTERN, type RemixAvailability, type RemixSetup } from '../../shared/remix';
import type { SwitchyardAssignment, SwitchyardDispatch as Dispatch } from '../../shared/switchyard';
import type { JourneyEntry } from '../switchyard-history';

export const assignmentLabels: Record<SwitchyardAssignment, string> = {
  rescue: 'Rescue only', lift_survey: 'Lift survey', service_restoration: 'Service restoration',
};
export const journeyProvenanceLabel: Record<JourneyEntry['provenance'], string> = {
  practice: 'Local/scripted Practice', live_voice: 'Live Voice', live_text: 'Live Text', mixed: 'Mixed connection modes; see conversation sources',
};
const assignmentDetails: Record<SwitchyardAssignment, string> = {
  rescue: 'Bring Pip home by either approach.',
  lift_survey: 'Inspect, calibrate and successfully test the lift before home. Either escape approach still counts.',
  service_restoration: 'Secure the brace, deploy the bridge and align the turntable before home. Either escape approach still counts.',
};

export function DispatchCode({ code }: { code: string }) {
  const field = useRef<HTMLInputElement>(null); const [notice, setNotice] = useState('');
  return <div className="dispatch-code"><label>Mission code<input ref={field} value={code} readOnly onFocus={event => event.currentTarget.select()}/></label>
    <button type="button" onClick={() => {
      const fallback = () => { field.current?.focus(); field.current?.select(); setNotice('Code selected. Copy it with your device’s copy command.'); };
      if (!navigator.clipboard?.writeText) { fallback(); return; }
      void navigator.clipboard.writeText(code).then(() => setNotice('Mission code copied.')).catch(fallback);
    }}>Copy code</button><span role="status">{notice}</span></div>;
}

export function SwitchyardDispatchSetup({ value, onChange, availability, loading, busy, history, onClear, onRefresh }: {
  value?: RemixSetup; onChange(value?: RemixSetup): void; availability: RemixAvailability | null;
  loading: boolean; busy: boolean; history: readonly JourneyEntry[]; onClear(): void; onRefresh(): void;
}) {
  const id = useId();
  const [draftCode, setDraftCode] = useState(value?.kind === 'replay' ? value.code : '');
  const replayCode = value?.kind === 'replay' ? value.code : draftCode;
  const newDispatch = () => onChange({ kind: 'new', assignment: 'rescue', recent: [] });
  return <div className="switchyard-dispatch-setup" data-testid="switchyard-dispatch-setup">
    <fieldset><legend>Switchyard edition</legend><div className="dispatch-options">
      <label><input type="radio" name={`${id}-edition`} checked={!value} disabled={busy} onChange={() => onChange(undefined)}/>Original <small>The authored installation</small></label>
      <label><input type="radio" name={`${id}-edition`} checked={!!value} disabled={busy} onChange={newDispatch}/>Remix <small>New wiring and operating conditions</small></label>
    </div></fieldset>
    {value && <>
      <fieldset><legend>Your dispatch</legend><div className="dispatch-options">
        <label><input type="radio" name={`${id}-dispatch`} checked={value.kind === 'new'} disabled={busy} onChange={newDispatch}/>New dispatch</label>
        <label><input type="radio" name={`${id}-dispatch`} checked={value.kind === 'replay'} disabled={busy} onChange={() => onChange({ kind: 'replay', code: draftCode })}/>Replay a code</label>
        <label><input type="radio" name={`${id}-dispatch`} checked={value.kind === 'daily'} disabled={busy} onChange={() => onChange({ kind: 'daily' })}/>Daily dispatch</label>
      </div></fieldset>
      {value.kind === 'new' ? <><p>Start selects unfamiliar conditions from the validated catalog, considering up to twelve recent local journeys. This does not adjust difficulty to your performance.</p>
        <div className="dispatch-assignment"><label htmlFor={`${id}-assignment`}>Optional assignment</label><select id={`${id}-assignment`} value={value.assignment} disabled={busy} onChange={event => onChange({ ...value, assignment: event.target.value as SwitchyardAssignment })}>
          {(Object.keys(assignmentLabels) as SwitchyardAssignment[]).map(key => <option key={key} value={key}>{assignmentLabels[key]}</option>)}
        </select></div><p>{assignmentDetails[value.assignment]} Assignments never block rescue.</p></>
        : value.kind === 'replay' ? <><label className="dispatch-code-entry" htmlFor={`${id}-code`}>Replay mission code</label><input id={`${id}-code`} value={replayCode} maxLength={40} spellCheck={false} autoCapitalize="characters" disabled={busy} placeholder="R1-…" aria-describedby={`${id}-code-help`} onChange={event => { const code = event.target.value.trim().toUpperCase(); setDraftCode(code); onChange({ kind: 'replay', code }); }}/>
          <p id={`${id}-code-help`}>{replayCode && !REMIX_CODE_PATTERN.test(replayCode) ? 'Enter the complete supported R1 code. The server will check its checksum when you start.' : 'The code restores the initial conditions and assignment. Progress, notes and proposals start fresh.'}</p></>
        : <div className="dispatch-daily"><strong>{availability?.daily ? `UTC daily dispatch · ${availability.daily.date}` : 'UTC daily dispatch'}</strong>
          {availability?.daily && <DispatchCode code={availability.daily.code}/>}<p>One shared dispatch for the server’s UTC date. Local history does not change it; its assignment is fixed.</p></div>}
      <p className="dispatch-availability" role="status">{loading ? 'Checking dispatch availability…' : availability?.available ? 'Dispatch ready. Your mission starts only when you press Start.' : availability?.message ?? 'Dispatch availability has not been confirmed.'}</p>
      {!loading && !availability?.available && <button type="button" disabled={busy} onClick={onRefresh}>Check dispatch availability</button>}
      <details className="dispatch-history"><summary>Local journeys <span>{history.length} / 12</span></summary><p>Saved on this browser only. Codes and outcomes, never conversations. Interrupted starts remain marked Started; this is not a cloud save.</p>
        {history.length ? <><ol>{history.map(item => <li key={item.id}><span>{item.outcome === 'home' ? `Home by ${item.approach === 'lift' ? 'direct lift' : 'maintenance bypass'}` : 'Started · outcome not recorded'} · {journeyProvenanceLabel[item.provenance]}</span><small>{new Date(item.startedAt).toLocaleDateString('en')} · {assignmentLabels[item.assignment]}{item.assignmentStatus ? ` / ${item.assignmentStatus}` : ''}</small><button type="button" disabled={busy} onClick={() => { setDraftCode(item.code); onChange({ kind: 'replay', code: item.code }); }}>Prepare replay <span className="dispatch-history-code">{item.code}</span></button></li>)}</ol><button type="button" disabled={busy} onClick={onClear}>Clear local journeys</button></> : <p>No journeys saved yet. Play works even when browser storage is unavailable.</p>}
      </details>
    </>}
  </div>;
}

export function SwitchyardDispatchCard({ dispatch }: { dispatch: Dispatch }) {
  return <details className="switchyard-dispatch-card" data-testid="switchyard-dispatch-card"><summary>Remix dispatch · {assignmentLabels[dispatch.assignment]}</summary>
    {dispatch.dailyDate && <p>Daily dispatch · {dispatch.dailyDate} UTC</p>}<DispatchCode code={dispatch.code}/>
    <p>{assignmentDetails[dispatch.assignment]} {dispatch.assignment !== 'rescue' && 'You may leave it unfinished and still bring Pip home.'}</p>
    <p className="source-label">Accepted initial conditions · Human reference. A code is not a saved mission.</p>
  </details>;
}
