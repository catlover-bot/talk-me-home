import { SwitchyardGuideControls, SwitchyardGuideCue } from './SwitchyardGuide';
import { useId, useRef, useState } from 'react';
import '../switchyard.css';
import type { Caption } from '../useMission';
import { originLabel } from '../useMission';
import { latestSwitchyardPlate, switchyardReportAge } from '../switchyard-report';

const tabs = [{ id: 'plan', label: 'Site plan' }, { id: 'lift', label: 'Lift plates' }, { id: 'service', label: 'Service modules' }] as const;
type Tab = typeof tabs[number]['id'];

/** Authored human-only installation document. No location marker or selected variant. */
function SitePlan() {
  const title = useId(); const description = useId();
  return <div className="switchyard-map-scroll" tabIndex={0} aria-label="Switchyard site plan. Scroll horizontally on a narrow screen.">
    <svg className="switchyard-site-plan" viewBox="0 0 680 245" role="img" aria-labelledby={`${title} ${description}`}>
      <title id={title}>The Switchyard installation plan</title>
      <desc id={description}>Static reference, not a live position. Control Bay joins Transfer Table. Transfer Table joins Lift Station and Service Gallery. The lift and service bridge each reach Return Platform. Ordinary corridors and a return walkway permit backtracking.</desc>
      <defs><pattern id={`${title}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#607954" strokeWidth=".6" opacity=".15"/></pattern></defs>
      <rect width="680" height="245" fill={`url(#${title}-grid)`}/>
      <text x="20" y="22" className="switchyard-map-note">SWITCHYARD / ACCESS &amp; TRANSFER</text><text x="660" y="22" textAnchor="end" className="switchyard-map-note">STATIC PLAN · NO POSITION FEED</text>
      <path className="switchyard-map-route" d="M98 123H249L411 69H573V123"/>
      <path className="switchyard-map-route switchyard-map-service" d="M249 123L411 184H573V123"/>
      <rect className="switchyard-map-room" x="30" y="102" width="132" height="43" rx="3"/>
      <rect className="switchyard-map-room" x="188" y="100" width="127" height="47" rx="3"/>
      <rect className="switchyard-map-room" x="351" y="47" width="124" height="43" rx="3"/>
      <rect className="switchyard-map-room" x="345" y="163" width="137" height="43" rx="3"/>
      <rect className="switchyard-map-room" x="516" y="99" width="143" height="48" rx="3"/>
      <g className="switchyard-map-label" textAnchor="middle"><text x="96" y="128">Control Bay</text><text x="251" y="128">Transfer Table</text><text x="413" y="73">Lift Station</text><text x="414" y="189">Service Gallery</text><text x="587" y="128">Return Platform</text></g>
      <text x="501" y="57" className="switchyard-map-note">Direct lift</text><text x="500" y="206" className="switchyard-map-note">Service bridge</text>
      <text x="22" y="231" className="switchyard-map-note">Lines show documented connections. Pip checks current equipment and access.</text>
    </svg>
  </div>;
}

/** All candidate plate mappings stay visible; only actually communicated words are quoted. */
export function SwitchyardDocument({ captions, roundId, currentVisit, panelRevision, stateRevision }: {
  captions: readonly Caption[]; roundId: string;
  currentVisit: { visitId: string; locationLabel: string } | null; panelRevision: number; stateRevision: number;
}) {
  const id = useId(); const [active, setActive] = useState<Tab>('plan');
  const [plan, setPlan] = useState<'undecided' | 'lift' | 'bypass'>('undecided');
  const [revised, setRevised] = useState(false);
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const report = active !== 'plan' ? latestSwitchyardPlate(captions, roundId, active) : undefined;
  const changePlan = (next: typeof plan) => { if (next !== plan) { setRevised(plan !== 'undecided'); setPlan(next); } };
  return <section className="mission-documents switchyard-document" aria-labelledby={`${id}-heading`}>
    <header className="document-heading"><div><p className="section-kicker">Mission Control / private reference</p><h2 id={`${id}-heading`}>Choose a way home.</h2></div><span className="document-stamp">SY / 08</span></header>
    <SwitchyardGuideControls/>
    <fieldset className="switchyard-private-plan"><legend>My intended approach</legend>
      {([{ value: 'undecided', label: 'Undecided' }, { value: 'lift', label: 'Direct lift' }, { value: 'bypass', label: 'Maintenance bypass' }] as const).map(option => <label key={option.value}><input type="radio" name={`${id}-intention`} checked={plan === option.value} onChange={() => changePlan(option.value)}/>{option.label}</label>)}
      <p>Private plan / not sent to Pip. Neither route is selected for the game.</p>
    </fieldset>
    {revised && <p className="switchyard-plan-revision" role="status">Plan revised. Applied routing and confirmed actions are unchanged. Your draft is kept for review; each pending proposal still needs its own decision.</p>}
    <div className="document-tabs" role="tablist" aria-label="Switchyard documents">
      {tabs.map((tab, index) => <button type="button" key={tab.id} id={`${id}-${tab.id}`} role="tab" aria-selected={active === tab.id}
        aria-controls={`${id}-content`} tabIndex={active === tab.id ? 0 : -1} ref={element => { buttons.current[tab.id] = element; }}
        onClick={() => setActive(tab.id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
            : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : undefined;
          if (next) { event.preventDefault(); setActive(next.id); buttons.current[next.id]?.focus(); }
        }}>{tab.label}</button>)}
    </div>
    <SwitchyardGuideCue where="document"/>
    <div className="document-body" id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0}>
      {active === 'plan' ? <>
        <div className="switchyard-route-choices"><article><h3>Direct lift</h3><p>Less travel; identify and calibrate the fitted equipment. Separate its test circuit from its running supply.</p><span>Ask Pip for the lift plate. Compare both manual rows.</span></article><article><h3>Maintenance bypass</h3><p>More travel; brace and deploy a bridge, then return to align the transfer table. Mechanical locks retain this work.</p><span>Ask Pip for the service module. No lift calibration needed.</span></article></div>
        <p className="switchyard-uncertainty">The fitted equipment and current conditions are unknown until Pip reports them. Both approaches lead home; you can change plans before departure.</p>
        <details className="switchyard-reference-details"><summary>Installation drawing and safe return paths</summary><SitePlan/><p>Ordinary corridors remain accessible with power off. A return walkway leads back to the approach Pip arrived from.</p></details>
      </> : <>
        <div className="switchyard-reference-comparison">
          <aside className="switchyard-quoted-plate" aria-label="Reported plate for comparison" data-testid="switchyard-report-reference"
            data-visit-status={!report?.caption.switchyardContext ? 'unknown' : report.caption.switchyardContext.visitId === currentVisit?.visitId ? 'current' : 'earlier'}
            data-reading-status={report && report.caption.switchyardContext?.visitId === currentVisit?.visitId && currentVisit && report.caption.switchyardContext?.panelRevision === panelRevision && report.caption.switchyardContext?.stateRevision === stateRevision ? 'current' : 'historical'}>
            {report ? <>
              <div className="switchyard-quote-source"><strong>Pip</strong><span>{originLabel[report.caption.origin]} / quoted report</span><time dateTime={new Date(report.caption.timestamp).toISOString()}>{new Date(report.caption.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</time></div>
              <blockquote data-testid="switchyard-reference-quote" data-message-id={report.caption.id}>{report.quote}</blockquote>
              <p className="switchyard-quote-visit">{report.caption.switchyardContext?.locationLabel ?? 'Location not recorded'} / {report.caption.switchyardContext?.visitId === currentVisit?.visitId && currentVisit ? 'this visit' : 'earlier or unrecorded visit'}</p>
              <p data-testid="switchyard-report-age">{switchyardReportAge(report.caption, currentVisit, panelRevision, stateRevision)}</p>
              <details><summary>Full source report</summary><p>{report.caption.text}</p></details>
            </> : <><strong>No plate report yet</strong><p>Ask Pip to inspect the {active === 'lift' ? 'Lift console' : 'Bridge winch or Transfer turntable'} within reach. The manual does not identify the fitted installation.</p></>}
          </aside>
          {active === 'lift' ? <div className="switchyard-map-scroll" tabIndex={0} aria-label="Lift plate reference table"><table className="switchyard-manual-table">
            <caption>Both lift installations / compare Pip's quoted plate</caption>
            <thead><tr><th scope="col">Reported plate</th><th scope="col">Index</th><th scope="col">Self-test supply</th><th scope="col">Running supply</th></tr></thead>
            <tbody><tr><th scope="row">Crescent</th><td>1</td><td>Blue only</td><td>Amber + Blue</td></tr><tr><th scope="row">Kite</th><td>2</td><td>White only</td><td>Amber + White</td></tr></tbody>
          </table></div> : <div className="switchyard-map-scroll" tabIndex={0} aria-label="Service module reference table"><table className="switchyard-manual-table">
            <caption>Both service modules / compare Pip's quoted plate</caption>
            <thead><tr><th scope="col">Reported module</th><th scope="col">Bridge winch</th><th scope="col">Table alignment</th><th scope="col">Crossing supply</th></tr></thead>
            <tbody><tr><th scope="row">Rivet</th><td>White only</td><td>Amber only</td><td>Amber + White</td></tr><tr><th scope="row">Slot</th><td>Blue only</td><td>White only</td><td>Blue + White</td></tr></tbody>
          </table></div>}
        </div>
        <p className="switchyard-manual-note">{active === 'lift' ? 'Index with power off, then single-supply self-test, then running pair. Ask Pip about the local result before choosing the next operation.' : 'Brace and deploy at Service Gallery, align back at Transfer Table, then return to cross. Power changes retain secured mechanical work.'}</p>
      </>}
      <details className="switchyard-reference-details"><summary>Panel limits and action boundaries</summary><ul className="switchyard-constraints"><li>Supply capacity: two terminals, one load each. Use exactly the terminals listed for a test or operation.</li><li>Only facing contacts conduct. Unused sockets are insulated.</li><li>Apply changes all six pieces together and cancels proposals for the old routing. Draft edits and private plans do not change the station.</li><li>A connected terminal is not proof of ready machinery or a clear passage. Confirm each physical proposal separately.</li></ul></details>
    </div>
  </section>;
}
