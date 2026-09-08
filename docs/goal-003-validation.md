# Goal 003 validation

Date: 2026-09-08. Goal 003 automatic real-provider use: **0 seconds**. All execution described here is local/offline unless explicitly called a documentation or GitHub request. Historical provider evidence and the ignored accounting ledger were not reset or reused as a new allowance.

## Baseline and environment

The inspected baseline is `40583a9f3aad714fe1941591f74eb99c9867ba68` on `work/goal-002-companion-polish`, descending from the preserved AssemblyAI starter. Its [GitHub Actions run 34049420484](https://github.com/catlover-bot/talk-me-home/actions/runs/34049420484) completed successfully. Work continues on `work/goal-003-rescue-mission`; starter-only main was not used as the base or modified.

Local execution uses Ubuntu 24.04 under WSL, Node.js 24.20.0 and npm 11.19.0. Browser automation uses Linux headless Chromium 153.0.8010.12 through Playwright 1.63.0. The target owner browser remains Windows Chrome/Edge at `http://localhost:5173`; automated Linux runs are not Windows microphone or rendering certification.

Baseline commands were executed with the actual CI Live guard and finite process limits:

```sh
timeout --signal=TERM --kill-after=5s 60s env GAME_DISABLE_LIVE=1 npm test
timeout --signal=TERM --kill-after=5s 180s env GAME_DISABLE_LIVE=1 npm run test:e2e
```

Baseline: **115/115 offline tests**, **48/48 browser cases** (24 unique tests across two viewports, 24.4 seconds). No skips, provider calls or forced exits were used to manufacture a passing result. Baseline browser tests used the existing development server; Goal 003 changes the harness to a frozen production build.

## Final local checks

Final source/build commit: `37bc1c78be36e9aa7cda5c878bfc71e3604781b2` (following state split `318c7b1532715e8e90f3e72dbe1a9889b43c2125`). Typecheck and build passed; **152/152 offline tests passed** (1,351.9 ms), and **64/64 browser cases passed** (34.4 seconds), with zero failures, cancellations or skips in the final run. `git diff --check` passed. Commands:

```sh
npm run typecheck
timeout --signal=TERM --kill-after=5s 60s env GAME_DISABLE_LIVE=1 npm test
npm run build
timeout --signal=TERM --kill-after=5s 180s env GAME_DISABLE_LIVE=1 npm run test:e2e
git diff --check
npm audit --json
```

The browser command itself runs `npm run build` once, then starts the game server and Vite preview. No HMR or source changes are used while taking evidence. `GAME_DISABLE_LIVE=1` and an empty fixture key are set by the harness. A/B cases use a private per-test server constructor, never a production hidden-profile selector. Provider peers are intercepted locally and never call `connectToServer()`.

A separate `timeout --signal=TERM --kill-after=5s 20s node .validation/goal003-dev-smoke.mjs` check launched the ordinary development runner, fetched its UI and proxied Rescue session API, sent SIGINT, and verified both ports 5173 and 3001 closed. It passed without provider calls. This temporary local smoke driver remains ignored; the supported owner command is `npm run dev`.

## Mechanical and boundary evidence

The retained Classic and Maintenance suite covers shared Power, Latch conditions, near/far crossing, selector/manual exchange, early Power recovery and role dependence. New `rescue-state.test.ts` and `rescue-http.test.ts` cover both complete Rescue configurations, nonterminal checkpoints, private projections, exact schemas, grant readiness, wrong routes/backtracking, Relay Off, early contact release, held-contact boarding rejection, pause/resume, revoke/reauthorize races, concurrent receipts, stale rounds/chapters, queued old-room intent and same-call retries.

Finite-state exploration excludes IDs, counters, timestamps, transcripts and logs from physical-state keys. Each A/B configuration has **24 reachable composed mission states**, **13 Gallery states** (including the chapter exit), and Return Dock has **8 states** (including home). Every reachable nonterminal physical state has a cooperative path forward. Neither actor alone clears its fresh chapter or the composed mission. This proves mechanical dependence and recovery, not that guessing is impossible. Lifecycle and generation validity are tested separately. [Gameplay](goal-003-gameplay.md) records the exact rules and solver scope.

Projection tests compare different hidden configurations and all Gallery room/Relay projections; the human view stays independent of the hidden obstruction/location. Local surveys disclose adjacent gates only. Notes, annotations, unrequested hints, full graph and unseen state stay out of Pip's recap. Actually communicated player text remains an untrusted quote. Mixed-chapter recap checks enforce whole-entry truncation within 16 entries, 6,000 text characters and 11,000 serialized UTF-8 bytes. Safety operations retain their own bounded receipt cache so saturation cannot prevent stopping or restarting.

Voice/audio tests preserve ordinary active reply IDs and delayed `tool.call` after `reply.done`, faithful partial/final transcript handling, stale PCM cancellation, separate microphone/playback signals, permission/device/configuration failures, sanitized errors, call-ID correlation, one final reply, end acknowledgement/fallback and zero-provider injected transport isolation. New chapter context capture preserves late final captions from the old chapter. A new idle input can retain valid return authorization; an actual interruption revokes it. The fake clock verifies the warning at 540 seconds and stop at 600 without an automatic reconnect.

## Browser coverage and repaired failures

There are **32 unique browser tests**, repeated at **1280×720 and 1440×900** for **64 cases**: 11 mission/UI tests, 6 record/lifecycle tests, 3 Rescue Practice tests, 5 Rescue fake-provider tests and 7 retained fake-provider voice tests. Viewport repetitions are not distinct gameplay designs. Gallery layout testing also visits 1920×1080, 390-pixel width and 200% CSS enlargement with reduced motion and keyboard interaction.

Practice completes A and B through the same server state machine, including wrong-route backtracking, early Cargo Power loss, Relay Off and Return Dock charge loss. It checks private mistaken map marks, report pinning, notes, history without a modal, public checkpoints versus final home and honest Presentation mode. The fake provider completes both configurations, maintains one connection across chapters, delivers each checkpoint result once, rejects queued stale chapter/room work, preserves late caption provenance, handles boarded pause/resume and reauthorization, and ends after final confirmation. Pagehide verifies its chapter-scoped HTTP 200 stop, authoritative grant removal, physical progress retention and provider/audio cleanup.

Intermediate failures were investigated and fixed, without skips, retries, timeout inflation or swallowed assertion failures:

- Training's last debrief row clipped at both desktop heights; the redundant single-chapter labels were removed and the Rescue finale now summarizes all three real chapter actions before its expandable full record.
- A Practice B fixture expected inspecting a blocked gate to fail. Inspection correctly succeeds with an obstruction report; the fixture now also asserts that attempted traversal fails and backtracking recovers.
- Audit found a missing `chapterEpoch` on the pagehide keepalive stop. The application now includes it. Playwright exposed HTTP 200 but did not resolve `response.json()` after synthetic pagehide; the regression checks the actual server projection instead of hanging on that detached response body.
- An offline fixture route outlived its test and attempted to fulfill a disposed response. Teardown now drains route handlers before closing the fixture server/context. The same-gate batch test also uses an ordered-message receipt barrier, so both tool contexts are captured before commit rather than relying on scheduler timing.
- Adding the optional Quick guide changed the last focused element. The briefing test's old final Tab assertion then intentionally tabbed out of the page. The initial keyboard-access assertion now runs before guide interaction; native Enter/Space guide open/close assertions remain and pass.

## Visual and performance evidence

The **16 curated screenshots** in [screenshots/goal-003](screenshots/goal-003/) are actual browser output from the final production bundle. Rescue/fake-provider/briefing captures disable animation for stable evidence; preserved Training screenshots use the ordinary screenshot helper. Fake-provider captures visibly say **SIMULATED PROVIDER / OFFLINE TEST** and use fake audio devices. They do not prove sound or natural conversation. [Goal 002 active Cargo](screenshots/goal-002/g2-classic-chromium-1280.png) remains the before image for [Goal 003 Training Cargo](screenshots/goal-003/training-classic-chromium-1280.png). No concept artwork is presented as test evidence.

Visual review covers Gallery, Return Dock, history during play, a blocked-route recovery, final debrief, narrow/enlarged layouts and Presentation. Gallery text was enlarged; history now occupies portrait space with a compact Pip identity and scroll cue; current captions and call controls remain accessible; the finale includes the actual closing caption. At narrow widths, the layout intentionally scrolls and exposes a textual gate table. Enlarged captions/history scroll within labelled areas. CSS enlargement is not native browser or OS zoom.

Remaining visual tradeoffs: narrow/enlarged layouts require scrolling between documents and the communication console; private notebook entries increase that distance. At 1280×720 an expanded annotation drawer can move Relay below the initial viewport; closing it restores the compact task layout. Long history entries and their Pin buttons require scrolling within the visibly marked history region. These need owner usability feedback; no complete accessibility certification is claimed.

Selected source-bound contrast tests measure normal text at or above 4.5:1 and essential diagram marks at or above 3:1: Gallery gate text 8.445, secondary text 4.740, tracks 3.491, private marker 5.249; Dock prose 5.390, schematic 4.602, instrument text 7.421, authorization button 6.381; checkpoint text 4.562. Tests cover selected opaque declarations and their known media variants, not every composition or a complete accessibility audit.

Asset measurement uses Node `gzipSync` with the same defaults for both builds. Baseline values come from the preserved preflight production assets, not a newly rebuilt baseline. Vite's own printed gzip estimate uses a different compression setting and is not mixed into this comparison.

| Asset | Goal 002 raw / gzip bytes | Goal 003 raw / gzip bytes | Raw / gzip change |
| --- | --- | --- | --- |
| JavaScript | 271,645 / 82,436 | 305,109 / 91,212 | +12.32% / +10.65% |
| CSS | 31,550 / 7,471 | 51,483 / 11,213 | +63.18% / +50.09% |

Growth includes the three chapter documents, original SVG finale, private map controls, new lifecycle/Practice logic and responsive presentation rules. No dependency or external font/media download was added. Final hashed assets are `index-BH2erb3C.js` and `index-BXvttxsD.css`.

The local render test takes 90 `requestAnimationFrame` timestamps after the Gallery is displayed (89 intervals) in reduced-motion, headless Linux Chromium at 1920×1080. It records only user agent, viewport, DOM element count and durations; no conversation or secrets. Navigation DOMContentLoaded includes local cold navigation, while frame intervals sample the already rendered idle Gallery. These numbers are not human interaction latency, a sustained stress test or a Windows 60-fps claim.

The two final project samples each had **332 DOM elements**, median frame intervals **16.7 ms**, p95 **16.8 / 16.7 ms**, maximum **16.8 / 16.8 ms**, and DOMContentLoaded **42.7 / 43.4 ms**. The allowlisted raw measurements are saved beside the screenshots. No comparable baseline render measurement was taken, so this is not a measured performance improvement claim.

## Provider and human acceptance

| Evidence category | Goal 003 status |
| --- | --- |
| Practice complete Rescue, A/B and recoveries | Automated offline browser coverage |
| Fake-provider real server tool calls and whole campaign | Automated offline browser coverage; simulated voice peer |
| Real AssemblyAI API/tool sessions | **Not run; 0 connected seconds authorized/used** |
| Actual human microphone capture | Pending owner test |
| Human-audible replies/interruption | Pending owner test; fake audio and PCM tests are different evidence |
| Natural human-and-Pip full clear | Pending owner test |
| First-clear duration, enjoyment and usability | Pending; 6–8 minutes is a design target, not a measurement |

The [owner Live acceptance sheet](goal-003-live-acceptance.md) and [110-second recording outline](demo-script.md) give the next manual steps. No provider balance, bill, credit amount or measured conversational pass rate is claimed. The owner's prior Goal 002 recording remains earlier user-reported evidence.

## Secrets, English, dependencies, CI and cleanup

The source-safety suite scans authored game/UI/comments/docs/tests for unintended Japanese text, checks client credential/storage boundaries and compares ignored credential values in memory against source and built assets without printing them. Raw player transcripts are preserved; deliberately non-English raw test input uses escaped text and is not rewritten. Prompts remain compact English with no hidden map, solution, future object list or generic assistant services. All new assets, copy, comments and documents are English; this developer delivery report may be Japanese.

Preflight/final in-memory hash comparisons preserve `.env` and `.live-test-budget.json` unchanged. Historical validation documents, upstream deployment code, original starter commands, package manifest/lockfile and runtime selection remain unchanged. `npm audit --json` reported **0 vulnerabilities** at all severities; no dependency upgrades or forced fixes were made. Original SVG/CSS assets and upstream attribution remain in [assets](assets.md) and [sources](sources.md); no new license grant is inferred.

The existing GitHub workflow runs typecheck, offline unit tests, build and browser tests under `GAME_DISABLE_LIVE=1`, with finite job/step limits and no secrets or paid calls. Only the Goal 003 branch is pushed. The exact pushed commit and its actual CI conclusion are recorded in the final delivery report; no main merge, PR, visibility change or public deployment is performed.

All owned test servers, fixture listeners, browser contexts and provider fakes are terminated after validation. Checkpoints remain memory-only; a server restart or expiry loses them. Solo role separation is not authentication or a complete anti-cheat boundary against browser developer tools. Page-leave termination remains best effort when a browser/network is already closing.
