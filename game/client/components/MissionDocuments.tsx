import { useState } from "react";
import type { Chapter, HumanView, Scenario } from "../../shared/contracts";
import { GalleryDocument, type GalleryDocumentProps } from './GalleryDocument';
import { ReturnDockDocument } from './ReturnDockDocument';

/** Drafted geometry is fixed documentation, independent of current equipment state. */
function CargoMap() {
  return <svg className="cargo-map" viewBox="0 0 720 290" role="img" aria-labelledby="cargo-map-title cargo-map-description">
    <title id="cargo-map-title">Cargo bay route map</title>
    <desc id="cargo-map-description">A static document. The route crosses the Conveyor from the cargo platform, passes through the Door, and reaches the far side. Equipment symbols do not display live conditions.</desc>
    <defs>
      <pattern id="document-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#66786d" strokeWidth=".6" opacity=".16" /></pattern>
      <pattern id="cargo-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="m0 7 7-7" stroke="#52675c" strokeWidth=".8" opacity=".4" /></pattern>
      <pattern id="belt-lines" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M2 0V15" stroke="#6d8174" strokeWidth="2" /><path d="M5 0V15" stroke="#dce3d6" strokeWidth="1" /></pattern>
      <linearGradient id="belt-surface" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c8d0be" /><stop offset=".5" stopColor="#e6e9da" /><stop offset="1" stopColor="#c2cdbb" /></linearGradient>
    </defs>
    <rect width="720" height="290" fill="#f4f1e6" /><rect width="720" height="290" fill="url(#document-grid)" />
    <g className="draft-register" stroke="#7b897a" strokeWidth="1" fill="none"><path d="M18 39V18H40 M680 18H702V39 M18 251V272H40 M680 272H702V251" /><path d="M60 42H660 M60 37V47 M660 37V47" /><path d="M38 75V225 M33 75H43 M33 225H43" /></g>
    <text x="60" y="29" className="map-meta">CARGO TRANSIT / DECK 04</text><text x="660" y="29" textAnchor="end" className="map-meta">PLAN · NOT TO SCALE</text>
    <path d="M60 65H660V237H60Z" fill="#e0e4d8" stroke="#667769" strokeWidth="1.5" /><path d="M60 65H660V237H60Z" fill="url(#cargo-hatch)" />
    <path d="M74 79H645V222H74Z" fill="#f9f6eb" stroke="#52675b" strokeWidth="2.5" />
    <g fill="none" stroke="#9aab96" strokeWidth="1"><path d="M80 84H260V216H80Z M584 84H639V216H584Z" /><path d="M83 197H260 M94 204H249" /></g>
    <g fill="#ced7c5" stroke="#52675b" strokeWidth="1.5"><rect x="104" y="97" width="32" height="22" rx="1" /><rect x="141" y="97" width="49" height="22" rx="1" /><path d="M109 98V118 M131 98V118 M147 98V118 M184 98V118" /></g>
    <g className="cargo-conveyor">
      <rect x="284" y="92" width="218" height="111" rx="15" fill="#bbc8b6" stroke="#485f50" strokeWidth="2" />
      <rect x="290" y="99" width="206" height="97" rx="11" fill="url(#belt-surface)" stroke="#526b57" strokeWidth="2" />
      <rect x="298" y="101" width="190" height="93" fill="url(#belt-lines)" />
      <path d="M297 97H489 M297 198H489" stroke="#415b4b" strokeWidth="3" />
      <path d="M309 93V88H329V93 M457 93V88H477V93 M309 203V208H329V203 M457 203V208H477V203" stroke="#52675b" fill="none" strokeWidth="2" />
      <circle cx="291" cy="106" r="3" fill="#526b57" /><circle cx="495" cy="190" r="3" fill="#526b57" />
    </g>
    <g stroke="#394f45" fill="none"><path d="M548 79V121 M548 177V222" strokeWidth="9" /><path d="M541 116H556V182H541Z" strokeWidth="2" /><path d="M547 120V178 M553 120V178" strokeWidth="1.5" /><path d="M532 79H565V95H532Z M532 204H565V220H532Z" fill="#d3dacb" strokeWidth="1.5" /><path d="M539 82V92 M546 82V92 M553 82V92 M560 82V92" strokeWidth="1" /></g>
    <path d="M152 151H614" stroke="#9a542f" strokeWidth="2.5" strokeDasharray="7 6" /><circle cx="152" cy="151" r="5" fill="#f9f6eb" stroke="#9a542f" strokeWidth="2" /><path d="m607 145 8 6-8 6" fill="none" stroke="#9a542f" strokeWidth="2.5" />
    <g className="map-equipment-label" textAnchor="middle"><text x="167" y="185">Cargo platform</text><text x="393" y="135" className="draft-backed-label">Conveyor</text><text x="610" y="121">Far side</text><text x="548" y="270">Door</text></g>
    <g className="map-secondary-label"><text x="90" y="257">01 / NEAR SIDE</text><text x="382" y="181" textAnchor="middle" className="draft-backed-label">Transit route</text><text x="610" y="183" textAnchor="middle">Exit</text></g>
    <path d="M548 235V250" stroke="#6c7b69" /><path d="M645 250V269 M641 255 645 250 649 255" fill="none" stroke="#5a6c59" strokeWidth="1.5" /><text x="662" y="266" className="map-meta">N</text>
  </svg>;
}

function WiringNote() {
  return <div className="wiring-note shared-supply-note">
    <div className="supply-question"><span>Read together</span><strong>One switch.<br/>Two machines.</strong></div>
    <svg viewBox="0 0 340 88" role="img" aria-label="One Power supply branches to the Door and the Conveyor">
      <path d="M98 44H129V23H165 M129 44V68H165" fill="none" stroke="#526b57" strokeWidth="2.5" /><circle cx="129" cy="44" r="4" fill="#526b57" />
      <rect x="4" y="24" width="94" height="40" rx="2" fill="#e4ddc7" stroke="#63725b" strokeWidth="1.5" /><path d="M10 30H18 M10 58H18 M85 30H92 M85 58H92" stroke="#9c8d6e" />
      <rect x="165" y="5" width="168" height="36" rx="2" fill="#faf5e7" stroke="#63725b" /><rect x="165" y="50" width="168" height="36" rx="2" fill="#faf5e7" stroke="#63725b" />
      <g fill="#344b3d" fontSize="18" fontFamily="inherit" fontWeight="600" textAnchor="middle"><text x="51" y="50">Power</text><text x="249" y="29">Door</text><text x="249" y="74">Conveyor</text></g>
    </svg>
    <p><strong>One shared supply.</strong> The Door and Conveyor use the same Power. What changes on Pip's side?</p>
  </div>;
}

function ModuleMark({ shape }: { shape: "crescent" | "kite" }) {
  return (
    <svg
      viewBox="0 0 60 60"
      aria-hidden="true"
      focusable="false"
      className="module-mark"
    >
      {shape === "crescent" ? (
        <path
          d="M 40 7 A 24 24 0 1 0 40 53 A 27 27 0 0 1 40 7Z"
          fill="currentColor"
        />
      ) : (
        <>
          <path
            d="M 30 5 50 25 30 49 10 25Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M 30 5 V 49 M 10 25 H 50 M 30 49 q 9 4 3 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export function MissionDocuments({ scenario, chapter = 'cargo', returnDock, ...galleryProps }: {
  scenario: Scenario; chapter?: Chapter; returnDock?: HumanView['returnDock'];
} & GalleryDocumentProps) {
  const [tab, setTab] = useState<"map" | "manual">("map");
  if (chapter === 'gallery') return <GalleryDocument {...galleryProps} />;
  if (chapter === 'return_dock') return <ReturnDockDocument instruments={returnDock} />;
  return (
    <section
      className="mission-documents"
      aria-label="Mission Control documents"
    >
      <div className="document-heading">
        <div>
          <p className="section-kicker">Mission Control documents</p>
          <h2>{tab === "map" ? "The way through" : "Equipment manual"}</h2>
        </div>
        <span className="document-reference">
          04 / {scenario === "classic" ? "A" : "M"}
        </span>
      </div>
      <div
        className="document-tabs"
        role="tablist"
        aria-label="Choose a document"
      >
        <button
          id="map-tab"
          type="button"
          role="tab"
          aria-selected={tab === "map"}
          aria-controls="map-document"
          onClick={() => setTab("map")}
        >
          Route map
        </button>
        <button
          id="manual-tab"
          type="button"
          role="tab"
          aria-selected={tab === "manual"}
          aria-controls="manual-document"
          onClick={() => setTab("manual")}
        >
          Equipment manual
          {scenario === "maintenance" && (
            <span className="tab-detail"> + module guide</span>
          )}
        </button>
      </div>
      <div
        id="map-document"
        className="document-sheet"
        role="tabpanel"
        aria-labelledby="map-tab"
        hidden={tab !== "map"}
      >
        <WiringNote />
        <div className="cargo-drawing-scroll" role="region" aria-label="Cargo route drawing. Scroll horizontally on a narrow screen." tabIndex={0}><CargoMap /></div>
        <div className="document-caption">
          <span>
            <i className="route-swatch" aria-hidden="true" />
            Documented route
          </span>
          <span>Static plan · ask Pip for local conditions</span>
        </div>
      </div>
      <div
        id="manual-document"
        className="document-sheet manual-sheet"
        role="tabpanel"
        aria-labelledby="manual-tab"
        hidden={tab !== "manual"}
      >
        {scenario === "maintenance" ? (
          <>
            <p className="manual-intro">
              Match the mark Pip reports with this reference. Both module types
              are shown; the manual does not identify the fitted module.
            </p>
            <table className="module-table">
              <thead>
                <tr>
                  <th scope="col">Module mark</th>
                  <th scope="col">Holding setting</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <ModuleMark shape="crescent" />
                    <span>Crescent</span>
                  </th>
                  <td>Anchor</td>
                </tr>
                <tr>
                  <th scope="row">
                    <ModuleMark shape="kite" />
                    <span>Kite</span>
                  </th>
                  <td>Bridge</td>
                </tr>
              </tbody>
            </table>
            <p className="manual-footnote">
              Ask Pip about the local labels. Share the matching setting in your
              conversation.
            </p>
          </>
        ) : (
          <div className="classic-manual">
            <span className="manual-stamp">
              Cargo bay
              <br />
              Service note
            </span>
            <h3>Shared Power</h3>
            <p>
              The Door and Conveyor use one supply. Mission Control commands
              this Power remotely.
            </p>
            <p>
              This document does not show current local conditions. Ask Pip to
              inspect the equipment within reach.
            </p>
          </div>
        )}
        <WiringNote />
      </div>
    </section>
  );
}
