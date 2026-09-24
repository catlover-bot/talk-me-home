# Goal 004 release-candidate validation

Date: September 24, 2026. The owner reports that basic functional verification is complete; this release accepted that report and prioritized implemented artwork, product flow, and deployable delivery. Earlier Goal 001–003 reports and screenshots remain unchanged.

## Release identity

- Branch: `work/goal-004-release-candidate`.
- Baseline: `a212857e00c8ad75a3b630af2b8e0435c48ad899`, the latest local and fetched Goal 003 feature work at preflight. Initial worktree was clean. Starter-only `main` was not used.
- Implementation: `0000b6c` (illustrated experience and connection flow), `8fb25db` (production service and bounded Live). Packaging follows in a separate commit. No main merge, PR, visibility change, public deployment, billing change, or submission was performed.
- Public demo: **NOT DEPLOYED**. URL: **NOT PROVIDED**. One prepared deployment path: [OWNER_ACTIONS.md](../OWNER_ACTIONS.md) and [render.game.yaml](../render.game.yaml).

## What changed in the running game

Original vector artwork now gives Mission Control a station-window title scene, a consistent repaired UNIT 04 character, distinct Cargo drafting/Gallery atlas/Dock energy documents, and a recovery-bay ending after server-confirmed home. The title uses actual accessible text and buttons. The ending is lazy-loaded and labelled as an illustration rather than an observed route.

Human controls precede expandable documents; private notes collapse, map annotations are reversible keyboard controls, and history shows readable records alongside current captions, Pip, map, and Pause/Resume at 1280×720. Public accepted controls receive a short visual acknowledgement; pending requests retain their last accepted value. Dock unavailable-state explanations use only existing public energy/readiness instruments, and revoked permission is distinguished from retained energy.

Live begins with an intentional local readiness dialog. The microphone meter uses local samples and releases tracks/timers on close. Output can be checked with a local tone or deliberately kept as captions. Access errors offer explicit Text/Practice choices; loading, settings, credits, replay and title art never obtain a token. Settings expose voice/effect volume and reduced motion; effects are suppressed during Live capture. Privacy copy distinguishes provider-backed modes, bounded memory, and the absence of durable autosave or app recordings.

All three chapters, both fixed Gallery configurations, Classic/Maintenance Training, and all three modes remain. Hidden obstructions, local observations, selector settings and private notes are absent from automatic artwork/telemetry. Raw captions and their original source/chapter remain intact. Only validated completion opens the ending; Pause and interruption revoke authorization without undoing committed progress. The compact existing runtime prompt already met the requested dialogue policy and was preserved.

## Focused local checks

Environment: WSL Ubuntu 24.04, Linux x64, Node.js **24.20.0**, npm **11.19.0**, Playwright headless Chromium. These results do not certify Windows rendering speed, physical microphone quality, or audible playback.

| Check | Observed result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | **162 passed**, zero failed/skipped/cancelled |
| `npm run build:game` | Passed; browser bundle and compiled Node server produced |
| `npm run test:e2e` | **76 passed** across 1280×720 and 1440×900, including final rendered contrast and replay/Training paths |
| `git diff --check` | Passed |
| Actual `npm run start:game` | Served the Rescue title, all three documents and validated home from one origin; no Vite preview or Minimal agent |
| Static/API/security | Health, types/cache, traversal/source/secret exclusions, API errors, strict origin, every session-route ownership, code exchange, rate limiting, atomic admission, busy/exhaustion, conservative failures and restart/corruption checked offline |
| Communication regressions | Injected provider/audio only: delayed tool/reply correlation, stale chapter work, cancellation, recap privacy, source provenance, playback signals, permission failure, explicit ending, 540/600-second behavior and final-response watchdog retained |
| Visual/layout | Actual title, Cargo, Gallery, Dock, paused history and homecoming inspected; 1920×1080, 390px, 200% zoom, keyboard and reduced-motion checks retained |
| Contrast | Final computed styles and sampled title-image background tested: ordinary text at least 4.5:1 and selected essential route/annotation marks at least 3:1. This is scoped measurement, not accessibility certification |

The full browser suite now starts the actual compiled production service. Rescue configuration fixtures inject their local deterministic server; fake transport tests cannot silently fall back to AssemblyAI. A separate production smoke and `scripts/capture-release.mjs` completed the full mission using the real cookie-bound production API and actual communicated Practice observations. The test/capture processes use finite waits and cleanup; no forced exit hides unresolved test handles.

## Evidence and limits

| Evidence category | Status |
| --- | --- |
| Practice text/tools | Full server-validated missions, both authored configurations and recoveries passed |
| Injected fake provider/audio | Passed; not actual Live evidence |
| Local microphone meter | Fake audio devices exercised activation, level sampling and cleanup |
| Human speech on physical microphone | Not newly witnessed in Goal 004; owner baseline report accepted |
| Human-audible Pip playback | Not newly witnessed; a local/fake tone check is not proof of physical output |
| Full natural Live clear | Not claimed from automated Practice or injected transport |
| Enjoyment | Not measured or fabricated |
| Automatic provider usage | **0 seconds**; no token/provider calls, voice auditions, live probe, or agent publishing |

The narrow remaining device check is one owner Live connection on the intended browser: microphone, audible Pip output, and immediate End. No new comprehensive acceptance recording is a prerequisite for this implemented release. The submission video itself remains owner-created evidence.

New curated captures and provenance are in [submission/assets](../submission/assets/README.md): title and five gameplay/history/ending views at the stated viewports. They are deterministic typed Practice, never fake Live. Before comparisons remain in `docs/screenshots/goal-003/briefing-chromium-1280.png`, `cargo-initial-chromium-1280.png`, and `homecoming-chromium-1280.png`. The 16:9 cover is explicitly an illustration.

## Download sizes and production limits

[Exact byte report](goal-004-asset-sizes.json) is produced by `scripts/measure-release.mjs` using Node gzip level 9. The main JavaScript is approximately **95.2 kB gzip**, CSS **16.1 kB gzip**, standalone title/icon SVGs **2.2 kB gzip** combined, and the lazy ending chunk **3.6 kB gzip**. Inline vectors are already counted in JavaScript. Submission PNGs are not first-load game assets. These are compressed-size measurements, not a claim that the local server transfers gzip or that a Windows network benchmark was run.

Mission state remains in process memory; refresh or restart can require a new mission. Only the conservative admission ledger persists on the prepared host disk. Public Live defaults disabled, requires an owner-approved allowance/access code and persistent storage, and reserves a full 600 seconds for every attempted token without refunds. One process/instance is required. These application limits are not a verified AssemblyAI billing cap and cannot account for unrelated uses of the same key.

## Packaging and owner actions

The [submission package](../submission/release-checklist.md) contains a counted English title/summary/219-word description, a 2:40 owner recording plan, a six-slide outline, cover/icon/UI assets, and honest status fields. A slide outline is not a finished deck. Video, actual demo URL, judge repository access, event-form cutoff and final submission remain owner actions. No new license grant was added; original source history/notices and ignored `.env`/historical provider ledger were preserved.

Owner steps are limited to deploying/enabling the prepared bounded demo if approved, then recording/filling the actual submission fields and submitting. The exact event cutoff must be checked in the logged-in form; September 29 is the internal target.

## Pushed CI

Release/package commit **`bfe54521b421be6a83ed08c3ad9b0fe7fe1bc451`** was pushed to `work/goal-004-release-candidate`. [GitHub Actions run 35981728684](https://github.com/catlover-bot/talk-me-home/actions/runs/35981728684) completed **successfully** for that exact SHA, including typecheck, all 162 unit tests, production build, and all 76 browser cases. No jobs or assertions were skipped to obtain this result.

This evidence update is a documentation-only follow-up; the delivery report identifies its final pushed SHA and separately checks that head's CI too. For deployment, use the final head of the named release branch, whose application/assets are identical to the tested release commit above. Never substitute starter-only `main`.

Owned production/capture servers and browser processes were closed; the local capture port was checked closed. The working tree was clean after packaging. Ignored credentials and the historical Live budget ledger were not changed or printed, and no automatic provider time was used.
