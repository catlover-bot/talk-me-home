# Image provenance

All files here were produced from the implemented game on September 24, 2026. No external image generation service, stock art, purchased asset, or copied robot design was used. Fonts use system fallbacks; no font file is redistributed. Upstream notices remain intact; this document grants no new license to upstream work.

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

UI images are 1280×720 or 1440×900 viewport captures, not stitched marketing mockups. Environment: WSL Ubuntu 24.04, Node.js 24.20.0, Playwright headless Chromium, reduced motion, real local production server and its in-memory API. There are **no actual Live or human-speech captures** in this package. No image is evidence of speech recognition, audible output, natural human completion, or enjoyment.

The small screenshot set is reproducible after building and running the local production service on port 4180 with Live disabled:

```sh
node scripts/capture-release.mjs
node scripts/capture-identity.mjs
```

Both scripts reject non-loopback origins and forbid token/provider access. The chapter script follows actual Practice observations for either authored Gallery configuration, then confirms the real ending. Neither script imports hidden state or bypasses the authoritative rules.

Before images remain in `docs/screenshots/goal-003/`; those are historical Practice/fake-provider evidence as documented there. New captures do not overwrite the historical files.
