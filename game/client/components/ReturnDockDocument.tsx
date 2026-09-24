/** A static human procedure sheet. Live acknowledged instruments live in HumanControls. */
export function ReturnDockDocument() {
  return <section className="mission-documents return-document" aria-label="Mission Control documents">
    <div className="document-heading"><div><p className="section-kicker">Mission Control documents</p><h2>Return capsule procedure</h2></div><span className="document-reference">03 / RD</span></div>
    <div className="procedure-sheet">
      <div className="procedure-intro"><span className="procedure-stamp">RETURN<br />SERVICE</span><p>Prepare the energy supply together. The controller is yours; the local checks and departure are Pip’s.</p></div>
      <div className="return-drawing-scroll" role="region" aria-label="Return energy drawing. Scroll horizontally on a narrow screen." tabIndex={0}>
      <svg className="return-schematic" viewBox="0 0 720 235" role="img" aria-labelledby="return-schematic-title return-schematic-desc">
        <title id="return-schematic-title">Return energy and authorization schematic</title>
        <desc id="return-schematic-desc">Charge feeds temporary energy through the local contact. Store retains the energy. A separate return interlock controls authorization. This is a static procedure diagram, not a reading of the equipment.</desc>
        <defs>
          <pattern id="charge-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 7 0" stroke="#8b7451" strokeWidth="1" opacity=".4" /></pattern>
          <linearGradient id="capsule-ink" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#cdc7ad" /><stop offset=".45" stopColor="#faf1d9" /><stop offset="1" stopColor="#c8c5ad" /></linearGradient>
          <marker id="energy-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="m1 1 7 4-7 4" fill="none" stroke="#735f40" strokeWidth="1.6" /></marker>
        </defs>
        <rect x="1" y="1" width="718" height="233" fill="#f0e8d2" stroke="#c0b38f" />
        <g fill="none" stroke="#b1a180" strokeWidth=".7"><path d="M14 17H706 M14 215H706" /><path d="M19 13V22 M700 13V22 M19 210V219 M700 210V219" /></g>
        <g className="procedure-small-label"><text x="28" y="36">ENERGY TRANSFER / STATIC REFERENCE</text><text x="693" y="36" textAnchor="end">RD–04</text></g>
        <g stroke="#735f40" fill="none" strokeWidth="2.5" markerEnd="url(#energy-arrow)"><path d="M145 111H217" /><path d="M337 111H399" /><path d="M503 111H570" /></g>
        <g transform="translate(95 111)">
          <rect x="-54" y="-46" width="108" height="91" rx="7" fill="#dbd0b5" stroke="#746a51" strokeWidth="2" />
          <circle r="33" fill="#faf3df" stroke="#746a51" strokeWidth="2" /><circle r="26" fill="none" stroke="#aa9975" strokeWidth="1" />
          <path d="m5-23-18 27H0L-4 24 15-5H3Z" fill="#92704b" />
          <g fill="#76694f"><circle cx="-43" cy="-35" r="2" /><circle cx="43" cy="-35" r="2" /><circle cx="-43" cy="34" r="2" /><circle cx="43" cy="34" r="2" /></g>
        </g>
        <g transform="translate(279 111)" stroke="#77664a" fill="none">
          <rect x="-57" y="-37" width="114" height="74" rx="4" fill="url(#charge-hatch)" strokeWidth="1.5" />
          <path d="M-37-17V17 M-23-17V17 M-9-17V17 M5-17V17 M19-17V17 M33-17V17" strokeWidth="3" />
          <path d="M-57-30H-66V30H-57 M57-30H66V30H57" strokeWidth="2" />
        </g>
        <g transform="translate(451 111)">
          <rect x="-49" y="-42" width="98" height="84" rx="4" fill="#d3d9bd" stroke="#5f7055" strokeWidth="2" />
          <rect x="-39" y="-33" width="78" height="64" rx="2" fill="#e9edda" stroke="#798366" />
          <path d="M-19-19H19V18H-19Z M-7-19V-25H7V-19" fill="#c0cdb1" stroke="#5f7055" strokeWidth="2" />
          <path d="M-12 0H12 M0-12V12" stroke="#5f7055" strokeWidth="2" />
          <path d="M-38 39H38 M-26 43V49 M26 43V49" fill="none" stroke="#5f7055" strokeWidth="2" />
        </g>
        <g transform="translate(631 113)">
          <path d="M-38 38V-29Q-33-61 0-68Q33-61 38-29V38Z" fill="url(#capsule-ink)" stroke="#63664e" strokeWidth="2.5" />
          <path d="M-27 35V-26Q-22-49 0-52Q22-49 27-26V35" fill="none" stroke="#9e9a79" />
          <rect x="-16" y="-39" width="32" height="28" rx="11" fill="#7a8e76" stroke="#4d6352" strokeWidth="2" /><path d="M-10-32H10" stroke="#b5c1a0" />
          <path d="M-38 22H38 M-30 37-42 48 M30 37 42 48 M-13 28V35 M13 28V35" fill="none" stroke="#686851" strokeWidth="2.5" />
          <path d="M-3-61H3" stroke="#f8efd5" strokeWidth="2" />
        </g>
        <g className="procedure-main-label" textAnchor="middle"><text x="95" y="178">Charge</text><text x="279" y="178">Temporary</text><text x="451" y="178">Stored</text><text x="631" y="178">Capsule</text></g>
        <g className="procedure-small-label" textAnchor="middle"><text x="184" y="88">Held contact</text><text x="369" y="88">Store</text><text x="95" y="200">Human control</text><text x="279" y="200">Keep contact held</text><text x="451" y="200">Energy retained</text><text x="631" y="200">Pip confirms return</text></g>
      </svg>
      </div>
      <ol className="procedure-notes">
        <li><span>01</span><div><h3>Charge is temporary</h3><p>Charge needs the local contact held. If contact is released before storage, that energy is lost.</p></div></li>
        <li><span>02</span><div><h3>Store keeps the energy</h3><p>Store transfers primed energy while contact is still held. Stored energy survives disconnection.</p></div></li>
        <li><span>03</span><div><h3>Authorize when ready</h3><p>The return interlock needs stored energy and Pip aboard. Authorization lets Pip confirm departure; it does not launch the capsule.</p></div></li>
      </ol>
      <p className="procedure-footer"><strong>Permission and progress are separate.</strong> Pause or Interrupt clears authorization. Stored energy stays stored. Ask Pip to check readiness again when needed.</p>
    </div>
  </section>;
}
