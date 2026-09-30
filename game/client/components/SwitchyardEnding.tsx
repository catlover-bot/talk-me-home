import type { ReactNode } from 'react';
import type { HumanView, MissionRecord } from '../../shared/contracts';
import { PipPortrait } from './PipPortrait';

export function SwitchyardEnding({ view, record, closingCaption, onReplay, onBriefing, busy, practice }: {
  view: HumanView; record: MissionRecord | null; closingCaption: ReactNode; onReplay(): void; onBriefing(): void; busy: boolean; practice: boolean;
}) {
  const lift = view.switchyardApproach === 'lift';
  const bypass = view.switchyardApproach === 'bypass';
  return <section className="debrief switchyard-ending" aria-labelledby="switchyard-home-title">
    {(lift || bypass) && <figure className="switchyard-departure" data-testid="switchyard-departure" data-approach={view.switchyardApproach}>
      <svg viewBox="0 0 420 126" role="img" aria-label={lift ? 'Direct lift departure confirmed' : 'Maintenance crossing departure confirmed'}>
        <rect className="departure-paper" x="1" y="1" width="418" height="124" rx="8"/>
        {lift ? <>
          <path className="departure-guide" d="M88 93V29H326"/>
          <path className="departure-lift-rail" d="M71 99V19M105 99V19"/>
          <g className="departure-lift-car"><rect x="70" y="17" width="36" height="26" rx="3"/><image href="/icon.svg" x="76" y="20" width="24" height="20"/></g>
          <text x="136" y="61">Test passed. Running circuit restored.</text>
          <text x="34" y="116">LIFT STATION</text>
        </> : <>
          <path className="departure-guide departure-crossing" d="M49 81H148V45H326"/>
          <path className="departure-bridge" d="M68 94H139M75 85V100M99 85V100M123 85V100M150 57H316"/>
          <g className="departure-crossing-marker"><image href="/icon.svg" x="-13" y="-13" width="26" height="26"/></g>
          <text x="168" y="85">Brace, bridge and alignment held.</text>
          <text x="21" y="116">SERVICE CROSSING</text>
        </>}
        <circle className="departure-home" cx="342" cy={lift ? 29 : 45} r="18"/><path className="departure-check" d={lift ? 'M334 29l6 6 10-12' : 'M334 45l6 6 10-12'}/>
        <text className="departure-home-label" x="365" y={lift ? 34 : 50}>HOME</text>
      </svg>
      <figcaption>Confirmed departure / {lift ? 'direct lift' : 'maintenance bypass'}</figcaption>
    </figure>}
    <PipPortrait state="success" compact/>
    <p className="section-kicker">The Switchyard / Confirmed rescue</p>
    <h1 id="switchyard-home-title">Pip is home.</h1>
    <h2>{lift ? 'The direct lift restored' : bypass ? 'The maintenance bypass restored' : 'The Switchyard rescue complete'}</h2>
    <p>{lift ? 'You matched the fitted lift plate, calibrated its index, and separated its test supply from its running circuit.' : bypass ? 'You braced and deployed the service bridge, returned to align the transfer turntable, then routed the crossing supply.' : 'Pip returned safely. This record does not specify the restored approach.'}</p>
    <p className="switchyard-reflection"><span>Mission reflection / authored</span>{lift ? 'A plate, a test, then a running circuit. Your electrical work made the short ride possible.' : bypass ? 'You prepared a route in stages. The bridge and alignment held while you moved the supply to the crossing.' : 'Departure and return are confirmed.'}</p>
    {closingCaption}
    {(lift || bypass) && <p className="switchyard-replay-invitation" data-testid="switchyard-replay-invitation">{lift ? 'You brought Pip home by lift. Try preparing the maintenance bypass next.' : 'You brought Pip home by the maintenance bypass. Try identifying and calibrating the direct lift next.'} Both are complete rescues. Choose a new mission when you want to try again.</p>}
    <div className="dialog-actions"><button className="primary-button" disabled={busy} onClick={onReplay}>Try the other approach</button><button disabled={busy} onClick={onBriefing}>Back to missions</button></div>
    <p className="source-label">{practice ? 'Local/scripted play. ' : ''}Real Voice has not been verified for this mission. A replay starts a new authored installation.</p>
    <details><summary>This mission's event log</summary><ol>{record?.debrief?.timeline.map(event => <li key={event.id}>{event.text}</li>)}</ol></details>
  </section>;
}
