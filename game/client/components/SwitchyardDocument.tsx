import { useId, useRef, useState } from 'react';
import '../switchyard.css';

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

/** All candidate plate mappings belong to the operator; fitted identity comes from Pip. */
export function SwitchyardDocument() {
  const id = useId(); const [active, setActive] = useState<Tab>('plan');
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  return <section className="mission-documents switchyard-document" aria-labelledby={`${id}-heading`}>
    <header className="document-heading"><div><p className="section-kicker">Mission Control documents · private reference</p><h2 id={`${id}-heading`}>Two ways to the same home.</h2></div><span className="document-stamp">SY / 08</span></header>
    <div className="document-tabs" role="tablist" aria-label="Switchyard documents">
      {tabs.map((tab, index) => <button type="button" key={tab.id} id={`${id}-${tab.id}`} role="tab" aria-selected={active === tab.id}
        aria-controls={`${id}-content`} tabIndex={active === tab.id ? 0 : -1} ref={element => { buttons.current[tab.id] = element; }}
        onClick={() => setActive(tab.id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
            : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : undefined;
          if (next) { event.preventDefault(); setActive(next.id); buttons.current[next.id]?.focus(); }
        }}>{tab.label}</button>)}
    </div>
    <div className="document-body" id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${active}`} tabIndex={0}>
      {active === 'plan' ? <>
        <p>You have the installation plan. Pip can read the fitted plates and check the machinery nearby. Compare both before choosing an approach.</p>
        <SitePlan/>
        <div className="switchyard-route-choices"><article><h3>Restore the direct lift</h3><p>Fewer traversals. Identify the fitted plate, set its index, test on its single supply, then provide its running pair.</p></article><article><h3>Open the maintenance bypass</h3><p>More travelling; a different mechanism. Prepare the service bridge, return to align the transfer table, then revisit the bridge with its crossing supply.</p></article></div>
        <p className="switchyard-manual-note">You can change plans before departure. Ordinary corridors remain accessible with power off. A return walkway leads back to the approach you arrived from; an experiment does not strand Pip.</p>
      </> : active === 'lift' ? <>
        <p>Ask Pip to inspect the lift plate. This reference shows both installations; it does not identify the one fitted. Tell Pip the matching index and agree when to test.</p>
        <div className="switchyard-map-scroll" tabIndex={0} aria-label="Lift plate reference table"><table className="switchyard-manual-table">
          <thead><tr><th scope="col">Reported plate</th><th scope="col">Index</th><th scope="col">Self-test supply</th><th scope="col">Running supply</th></tr></thead>
          <tbody><tr><th scope="row">Crescent</th><td>1</td><td>Blue only</td><td>Amber + Blue</td></tr><tr><th scope="row">Kite</th><td>2</td><td>White only</td><td>Amber + White</td></tr></tbody>
        </table></div>
        <p className="switchyard-manual-note">Index → single-supply self-test → running pair. A connected terminal is not a successful test or a clear route. Pip must inspect and act locally; confirm each physical proposal separately.</p>
      </> : <>
        <p>Ask Pip to inspect the service module. The winch and transfer table share an installation code. Both codes are listed below; the document does not select one.</p>
        <div className="switchyard-map-scroll" tabIndex={0} aria-label="Service module reference table"><table className="switchyard-manual-table">
          <thead><tr><th scope="col">Reported module</th><th scope="col">Bridge winch</th><th scope="col">Table alignment</th><th scope="col">Crossing supply</th></tr></thead>
          <tbody><tr><th scope="row">Rivet</th><td>White only</td><td>Amber only</td><td>Amber + White</td></tr><tr><th scope="row">Slot</th><td>Blue only</td><td>White only</td><td>Blue + White</td></tr></tbody>
        </table></div>
        <p className="switchyard-manual-note">Prepare the bridge at Service Gallery, align the table back at Transfer Table, then return to cross. This approach does not require the lift calibration. Ask Pip which local step is ready.</p>
      </>}
      <ul className="switchyard-constraints"><li>Supply capacity: two terminals, one load each. Use exactly the terminals listed for a test or operation.</li><li>Contacts conduct only when neighbouring ports face each other. Unused sockets are insulated.</li><li>Apply changes the whole panel together and cancels a physical proposal made for the old routing. Draft edits change nothing on the station.</li></ul>
    </div>
  </section>;
}
