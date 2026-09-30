import type { ReactNode } from 'react';
import type { HumanView, MissionRecord } from '../../shared/contracts';
import { PipPortrait } from './PipPortrait';

export function SwitchyardEnding({ view, record, closingCaption, onReplay, onBriefing, busy, practice }: {
  view: HumanView; record: MissionRecord | null; closingCaption: ReactNode; onReplay(): void; onBriefing(): void; busy: boolean; practice: boolean;
}) {
  const lift = view.switchyardApproach === 'lift';
  const bypass = view.switchyardApproach === 'bypass';
  return <section className="debrief switchyard-ending" aria-labelledby="switchyard-home-title">
    <PipPortrait state="success" compact/>
    <p className="section-kicker">The Switchyard / Confirmed rescue</p>
    <h1 id="switchyard-home-title">Pip is home.</h1>
    <h2>{lift ? 'The direct lift restored' : bypass ? 'The maintenance bypass restored' : 'The Switchyard rescue complete'}</h2>
    <p>{lift ? 'You matched the fitted lift plate, calibrated its index, and separated its test supply from its running circuit.' : bypass ? 'You braced and deployed the service bridge, returned to align the transfer turntable, then routed the crossing supply.' : 'Pip returned safely. This record does not specify the restored approach.'}</p>
    <p>Departure and return confirmed. The route you restored brought Pip home.</p>
    {closingCaption}
    <div className="dialog-actions"><button className="primary-button" disabled={busy} onClick={onReplay}>Try the other approach</button><button disabled={busy} onClick={onBriefing}>Back to missions</button></div>
    <p className="source-label">{practice ? 'Local/scripted play. ' : ''}Real Voice has not been verified for this mission. A replay starts a new authored installation.</p>
    <details><summary>This mission's event log</summary><ol>{record?.debrief?.timeline.map(event => <li key={event.id}>{event.text}</li>)}</ol></details>
  </section>;
}
