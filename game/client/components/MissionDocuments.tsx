import { useState } from "react";
import type { Chapter, GalleryAnnotation, Scenario } from "../../shared/contracts";
import { GalleryDocument, type AnnotationChange } from './GalleryDocument';
import { ReturnDockDocument } from './ReturnDockDocument';

function CargoMap() {
  return (
    <svg
      className="cargo-map"
      viewBox="0 0 720 270"
      role="img"
      aria-labelledby="cargo-map-title cargo-map-description"
    >
      <title id="cargo-map-title">Cargo bay route map</title>
      <desc id="cargo-map-description">
        A static document. The route crosses the Conveyor from the cargo
        platform, passes through the Door, and reaches the far side. Equipment
        symbols do not display live conditions.
      </desc>
      <defs>
        <pattern
          id="document-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 H 0 V 20"
            fill="none"
            stroke="#8e9486"
            strokeWidth=".65"
            opacity=".22"
          />
        </pattern>
        <pattern
          id="belt-lines"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 2 0 V 14" stroke="#8d9585" strokeWidth="1" opacity=".6" />
        </pattern>
      </defs>
      <rect width="720" height="270" fill="url(#document-grid)" />
      <g fill="none" stroke="#a0a596" strokeWidth="1">
        <path d="M 71 37 H 648 M 71 31 V 43 M 648 31 V 43" />
        <path d="M 675 60 V 34 m-5 7 5-7 5 7" />
      </g>
      <text x="359" y="27" textAnchor="middle" className="map-meta">
        Cargo transit · Deck 04
      </text>
      <text x="675" y="24" textAnchor="middle" className="map-meta">
        N
      </text>
      <path d="M 70 65 H 648 V 213 H 70Z" fill="#f9f6ec" />
      <path
        d="M 549 65 H 70 V 213 H 549 M 556 65 H 648 V 213 H 556 M 552 65 V 107 M 552 169 V 213"
        fill="none"
        stroke="#465a50"
        strokeWidth="5"
      />
      <rect
        x="300"
        y="81"
        width="197"
        height="116"
        rx="4"
        fill="#e4e6d8"
        stroke="#9aa28f"
      />
      <rect x="305" y="85" width="187" height="108" fill="url(#belt-lines)" />
      <path
        d="M 303 94 H 494 M 303 184 H 494"
        stroke="#7d8b76"
        strokeWidth="2"
      />
      <path
        d="M 166 139 H 602"
        stroke="#a56a40"
        strokeWidth="2.5"
        strokeDasharray="7 6"
      />
      <circle
        cx="166"
        cy="139"
        r="6"
        fill="#f9f6ec"
        stroke="#a56a40"
        strokeWidth="2"
      />
      <circle
        cx="603"
        cy="139"
        r="13"
        fill="#f9f6ec"
        stroke="#708879"
        strokeWidth="1.5"
      />
      <path
        d="M 545 110 V 168 M 559 110 V 168 M 540 110 H 564 M 540 168 H 564"
        stroke="#465a50"
        strokeWidth="2"
      />
      <path
        d="m 584 133 7 6-7 6"
        fill="none"
        stroke="#a56a40"
        strokeWidth="2"
      />
      <g className="map-equipment-label">
        <text x="169" y="107" textAnchor="middle">
          Cargo platform
        </text>
        <text x="397" y="121" textAnchor="middle">
          Conveyor
        </text>
        <text x="601" y="100" textAnchor="middle">
          Far side
        </text>
        <text x="552" y="253" textAnchor="middle">
          Door
        </text>
      </g>
      <g className="map-secondary-label">
        <text x="166" y="185" textAnchor="middle">
          Near side
        </text>
        <text x="399" y="173" textAnchor="middle">
          Transit route
        </text>
        <text x="602" y="185" textAnchor="middle">
          Exit
        </text>
      </g>
      <path d="M 552 220 V 234" stroke="#879480" />
      <path
        d="M 34 242 V 248 H 84 V 242 M 59 244 V 248"
        fill="none"
        stroke="#879480"
      />
    </svg>
  );
}

function WiringNote() {
  return (
    <div className="wiring-note">
      <svg
        viewBox="0 0 315 74"
        role="img"
        aria-label="One Power supply branches to the Door and the Conveyor"
      >
        <path
          d="M 95 37 H 124 M 124 17 V 57 M 124 17 H 152 M 124 57 H 152"
          fill="none"
          stroke="#71816b"
          strokeWidth="2"
        />
        <circle cx="124" cy="37" r="3" fill="#71816b" />
        <rect
          x="3"
          y="19"
          width="92"
          height="35"
          rx="3"
          fill="#ede8d8"
          stroke="#9fa793"
        />
        <rect
          x="152"
          y="1"
          width="150"
          height="32"
          rx="3"
          fill="#f8f5eb"
          stroke="#9fa793"
        />
        <rect
          x="152"
          y="41"
          width="150"
          height="32"
          rx="3"
          fill="#f8f5eb"
          stroke="#9fa793"
        />
        <g fill="#33483e" fontSize="16" fontFamily="inherit">
          <text x="49" y="42" textAnchor="middle">
            Power
          </text>
          <text x="227" y="23" textAnchor="middle">
            Door
          </text>
          <text x="227" y="63" textAnchor="middle">
            Conveyor
          </text>
        </g>
      </svg>
      <p>
        <strong>One shared supply.</strong> The Door and Conveyor use the same
        Power. Pip cannot see this diagram.
      </p>
    </div>
  );
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

export function MissionDocuments({ scenario, chapter = 'cargo', annotation, onAnnotation, busy = false }: {
  scenario: Scenario; chapter?: Chapter; annotation?: GalleryAnnotation;
  onAnnotation?(change: AnnotationChange): Promise<unknown>; busy?: boolean;
}) {
  const [tab, setTab] = useState<"map" | "manual">("map");
  if (chapter === 'gallery') return <GalleryDocument annotation={annotation} onAnnotation={onAnnotation} busy={busy} />;
  if (chapter === 'return_dock') return <ReturnDockDocument />;
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
        <CargoMap />
        <div className="document-caption">
          <span>
            <i className="route-swatch" aria-hidden="true" />
            Documented route
          </span>
          <span>Static plan · ask Pip for local conditions</span>
        </div>
        <WiringNote />
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
