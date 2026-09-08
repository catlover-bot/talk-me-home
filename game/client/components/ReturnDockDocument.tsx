/** A static human procedure sheet. Live acknowledged instruments live in HumanControls. */
export function ReturnDockDocument() {
  return <section className="mission-documents return-document" aria-label="Mission Control documents">
    <div className="document-heading"><div><p className="section-kicker">Mission Control documents</p><h2>Return capsule procedure</h2></div><span className="document-reference">03 / RD</span></div>
    <div className="procedure-sheet">
      <div className="procedure-intro"><span className="procedure-stamp">RETURN<br />SERVICE</span><p>Prepare the energy supply, then authorize a safe departure. Pip checks the equipment at the Dock.</p></div>
      <svg className="return-schematic" viewBox="0 0 620 130" role="img" aria-labelledby="return-schematic-title return-schematic-desc">
        <title id="return-schematic-title">Return energy and authorization schematic</title>
        <desc id="return-schematic-desc">Charge feeds temporary energy through the local contact. Store retains the energy. A separate return interlock controls authorization. This is a static procedure diagram, not a reading of the equipment.</desc>
        <defs><pattern id="charge-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 0 8 8 0" stroke="#a68a60" strokeWidth="1" /></pattern></defs>
        <g fill="none" stroke="#69755b" strokeWidth="2"><path d="M 122 59 H 186 M 298 59 H 363 M 484 59 H 520" /><path d="m 174 54 8 5-8 5 m 177-5 8 5-8 5" /><path d="M 326 61 V 104 H 548 V 90" strokeDasharray="5 4" /></g>
        <rect x="7" y="32" width="115" height="55" rx="5" fill="#eee3ca" stroke="#7f765e" /><text x="64" y="64" textAnchor="middle" className="procedure-main-label">Charge</text>
        <rect x="186" y="32" width="112" height="55" rx="5" fill="url(#charge-hatch)" stroke="#7f765e" /><rect x="189" y="49" width="106" height="21" fill="#f7f0dd" /><text x="242" y="64" textAnchor="middle" className="procedure-main-label">Temporary</text>
        <rect x="363" y="32" width="121" height="55" rx="5" fill="#e1e5d5" stroke="#69775b" /><text x="423" y="64" textAnchor="middle" className="procedure-main-label">Stored</text>
        <g transform="translate(553 51)" fill="none" stroke="#61715a" strokeWidth="2.5"><path d="M -23 32 V -18 Q 0 -45 23 -18 V 32Z" /><rect x="-10" y="-13" width="20" height="19" rx="6" /><path d="M -23 14 H 23 M -23 25 -32 32 M 23 25 32 32" /></g>
        <g className="procedure-small-label" textAnchor="middle"><text x="155" y="24">Contact</text><text x="330" y="24">Store</text><text x="442" y="124">Return interlock → authorization</text></g>
      </svg>
      <ol className="procedure-notes"><li><span>01</span><div><h3>Charge is temporary</h3><p>Charge needs the local contact held. If contact is released before storage, that energy is lost.</p></div></li><li><span>02</span><div><h3>Store keeps the energy</h3><p>Store transfers primed energy while contact is still held. Stored energy survives disconnection.</p></div></li><li><span>03</span><div><h3>Authorize when ready</h3><p>The return interlock needs stored energy and Pip aboard. Authorization lets Pip confirm departure; it does not launch the capsule.</p></div></li></ol>
      <p className="procedure-footer">Authorization can be revoked. Pause or Interrupt clears it. Ask Pip to check readiness again when needed.</p>
    </div>
  </section>;
}
