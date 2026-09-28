# Image provenance

The original files here were produced from the implemented game on September 24, 2026. The two `confirmed-*` images were added September 28 from the delivered Goal 004E production Practice build. No external image generation service, stock art, purchased asset, or copied robot design was used. Fonts use system fallbacks; no font file is redistributed. Upstream notices remain intact; this document grants no new license to upstream work.

| Files | Identity and source | Capture mode |
| --- | --- | --- |
| `cover-illustration-1600x900.png` | 16:9 composition of the original Mission Control SVG and actual UNIT 04 portrait, exported by `scripts/capture-identity.mjs` | Illustration, explicitly labelled **not gameplay** |
| `app-icon-512.png` | PNG export of original `game/client/public/icon.svg`, shared with the favicon | Identity illustration |
| `title-1280.png`, `title-1440.png` | Actual title UI with the integrated original landscape and accessible controls | No connection; title illustration within real UI |
| `cargo-practice-*.png` | Actual Cargo document, Power controller and communicated observation | Typed deterministic Practice |
| `gallery-practice-*.png` | Actual Gallery atlas, remote Relay and communicated room report | Typed deterministic Practice; map itself is static |
| `dock-practice-*.png` | Actual Return Dock with server-confirmed stored energy/readiness | Typed deterministic Practice |
| `history-paused-practice-1280.png` | Actual nonmodal history alongside atlas, caption, portrait and resume control | Paused typed deterministic Practice |
| `homecoming-practice-*.png` | Actual ending UI after a full server-validated rescue | Typed deterministic Practice; recovery bay is an ending illustration |
| `confirmed-actions-practice-1280.png` | Current Goal 004E exact pending action strip, map and remote controls; frozen execution candidate `bb6dfd2` | Actual production Practice + deliberate UI confirmation; full-page capture at a 1280×720 viewport |
| `confirmed-home-practice-1280.png` | Current Goal 004E server-confirmed home after nine exact confirmations | Actual production Practice + UI confirmation; full-page capture at a 1280×720 viewport |

Original UI images are 1280×720 or 1440×900 viewport captures; the new confirmed-action pair retains the full scrollable page. None is a stitched marketing mockup. Environment: WSL Ubuntu 24.04, Node.js 24.20.0, Playwright headless Chromium, reduced motion, real local production server and its in-memory API. There are **no actual Live or human-speech captures in this submission asset directory**. The failed synthetic Voice capture is separate in `artifacts/goal-004e/`. No submission image establishes speech recognition, audible output, natural human completion, or enjoyment.

The current confirmed-action screenshots can be captured without any provider request:

```sh
npm run build:game
GAME_DISABLE_LIVE=1 npm run qa:release -- --smoke-only
```

The smoke driver owns its local production service, forbids external/token requests, matches each intended visible proposal before confirming and writes `.validation/goal-004e-offline/screenshots/`. The earlier `capture-release.mjs` and `capture-identity.mjs` produced the historical September 24 assets; those old UI images are not new confirmed-action evidence. Identity artwork is unchanged.

Before images remain in `docs/screenshots/goal-003/`; those are historical Practice/fake-provider evidence as documented there. New captures do not overwrite the historical files.
