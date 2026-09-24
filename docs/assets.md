# Assets and attribution

| Asset | Origin and use | License / attribution status |
| --- | --- | --- |
| Mission Control title landscape | Original authored SVG, `game/client/public/art/mission-control.svg` | Created for Goal 004; no external generation service, stock image, or reference robot used |
| Favicon and app icon | Original authored `game/client/public/icon.svg`; PNG export in `submission/assets/` | Derived from the project's UNIT 04 silhouette and repair patch |
| Goal 004 cover | `scripts/capture-identity.mjs` composes the actual title vector and Pip artwork at 1600×900 | Clearly labelled cover illustration, not gameplay; no claim of Live capture |
| Goal 004 UI captures | `scripts/capture-release.mjs`, against the real local production service | Typed deterministic Practice; 1280×720 and 1440×900, Linux headless Chromium; see `submission/assets/README.md` |
| Pip portrait and state drawings | Original SVG in `game/client/components/PipPortrait.tsx`, drawn for this project | No external image, icon pack, model, or generated cover used; no separate upstream license grant inferred |
| Route map, wiring, Crescent and Kite marks | Original application SVG in `MissionDocuments.tsx` | No stock assets; visual symbols are human documentation, not current telemetry |
| Relay Gallery atlas, room emblems, and private inference markers | Original SVG and HTML in `GalleryDocument.tsx` | Static human documentation and player-created annotations; no external icon set or hidden telemetry |
| Return Dock energy procedure | Original SVG and HTML in `ReturnDockDocument.tsx` | Human procedure illustration; live console instruments are separate |
| Homecoming capsule, station, and home beacon | Original SVG in `Homecoming.tsx`, shown after confirmed Rescue completion | Project-created celebration illustration, not a camera image, generated video, or browser evidence |
| UI tones | Original procedural sine tones in `game/client/effects.ts` | Synthesized locally; no recordings, music, speech service, or external samples |
| Fonts | System UI stack and locally available Georgia/serif fallback | No font files redistributed and no remote font request |
| `assemblyai.png` | Preserved upstream starter README artwork | Upstream attribution retained; not used as game art |
| Browser screenshots | Actual local Playwright output | Practice or explicitly stamped fake-provider evidence; no claim of human Live play |
| Browser audio implementation | Adapted from upstream `deployment/browser/server.mjs` | Existing attribution/history preserved; see [sources](sources.md) |

The inspected upstream checkout has no license file. This work does not invent a license grant for upstream code or add a blanket license. Dependency packages retain their shipped license notices in their distributions and lockfile versions. No external raster illustrations, 3D assets, sounds, or fonts were added for Goal 002 or Goal 003. Goal 003 refines the existing Pip drawing with small original SVG details and uses short CSS motion that respects reduced-motion preferences.
