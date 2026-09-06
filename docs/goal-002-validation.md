# Goal 002 validation

This record concerns Goal 002 on `work/goal-002-companion-polish`, based on `b1be76ef0e2b28a52b3d59fe6a824af96bdfbe26`. Goal 001 provider evidence and its 111.0 measured connected seconds remain historical in [validation.md](validation.md); that document was not rewritten to cover this implementation.

## Environment and baseline

Ubuntu 24.04 under WSL; Node.js 24.20.0 and npm 11.19.0 from the existing installation. Windows Chrome/Edge are the target human browsers. Automated rendering uses Playwright's Linux Chromium.

Baseline commands used finite process timeouts: `timeout --signal=TERM --kill-after=5s 60s npm test` passed 69 tests; `timeout --signal=TERM --kill-after=5s 180s npm run test:e2e` passed 14 browser cases. Existing built assets were 232,808 bytes JavaScript and 15,997 bytes CSS (approximately 72.90 kB and 4.20 kB gzip). No tool reinstall, dependency upgrade, agent publication, or reset of credentials/budget records was needed.

## Investigated CI cancellation

The actual [Goal 001 run 34043586823](https://github.com/catlover-bot/talk-me-home/actions/runs/34043586823) was cancelled, not successful. Its log completed nine HTTP tests before waiting in the reset-during-token test. The build and browser steps were skipped. GitHub CLI initially defaulted to the upstream repository, so every subsequent CI query explicitly used `-R catlover-bot/talk-me-home`.

Reproduction: `timeout --signal=TERM --kill-after=5s 60s env GAME_DISABLE_LIVE=1 npm test`. CI's Live-disable flag also disabled the explicitly injected fake transport. The test awaited a fake fetch that was never entered. Normal local tests without that environment had hidden the issue.

The fix preserves production Live-disable behavior. Tests explicitly opt into an injected fake transport; the override requires a supplied fetch dependency. HTTP requests/gates have finite waits and cleanup, including assertion failures. Regression tests run under the exact CI flag. The workflow keeps its original ten-minute job limit and adds shorter unit/browser step limits; no blanket skips, forced process exits, larger timeout workaround, or CI provider calls were added.

## Final command results

Final local validation was performed on September 7, 2026. Intermediate failures were investigated and fixed; they are not reported as passes. The browser suite ran against frozen application source, with its local server managed and stopped by Playwright.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed, including browser fixtures |
| `GAME_DISABLE_LIVE=1 npm test` | 115 passed, zero failed/skipped/cancelled; about 1.4 seconds |
| `npm run build` | Passed: TypeScript and Vite production build, without provider credentials |
| `npm run test:e2e` | 48 passed, zero failed/skipped; 23.8 seconds, across two Chromium viewport projects |
| `npm audit --json` | Zero vulnerabilities at all severities; no dependency changes |
| `git diff --check` | Passed |

The final test processes also had outer limits: `timeout --signal=TERM --kill-after=5s 60s env GAME_DISABLE_LIVE=1 npm test` and `timeout --signal=TERM --kill-after=5s 180s npm run test:e2e`. Unit groups cover physical state, HTTP, records, deterministic Practice, voice protocol, audio effects, contrast, source/privacy/English checks, and the existing offline live-test watchdog/accounting tests. Running the latter does not open a provider connection.

The 48 browser cases are 24 journeys repeated at 1280×720 and 1440×900: 11 mission cases, six record/lifecycle cases, and seven intercepted voice-UI cases per viewport. Additional widths and zoom are exercised within those journeys.

## Checked remote CI and Git state

Implementation commit: `5984f7a817a25ccd3398f9d90e1e0ab60daf50e5`, based on `b1be76ef0e2b28a52b3d59fe6a824af96bdfbe26`, pushed to `origin/work/goal-002-companion-polish`. The [actual feature CI run 34049274253](https://github.com/catlover-bot/talk-me-home/actions/runs/34049274253) **succeeded** at that exact head. Its job ran from 2026-09-06 17:39:14 to 17:41:02 UTC (September 7 in Japan), using Node.js 24.20.0. Typecheck, all 115 tests, build, and all 48 Chromium browser cases passed. Unit duration was about 4.24 seconds; browser duration was reported as 1.1 minutes. No step was skipped or cancelled, and no provider credentials or calls were used.

The feature worktree was clean after push. This documentation follow-up records the completed remote result. Main remains at upstream `11b4c9508bef682785e8bdf23d5170b30aafb7a6`; no merge, force-push, visibility change, or pull request was made. Validation servers were stopped, and game ports were no longer listening. Existing unrelated processes were left alone.

## What the tests establish

- Classic has five reachable physical states. Each Maintenance profile has nine. Every reachable nonterminal physical state permits a cooperative recovery; either actor alone cannot complete a fresh round. Search keys exclude transcripts and event history.
- Wrong/Neutral Maintenance selection, locked engaged selectors, early Power loss, invalid targets, retries, stale rounds, delayed commits, and cancellation all preserve authoritative rules.
- Ordinary projections exclude hidden plate/selector/equipment state. Exact quotes retain provenance; private notes and unread documents stay out of recap. Old note, record, hint, and tool callbacks cannot populate a reset round.
- Protocol tests preserve the real previously observed ordinary reply-ID and delayed-call regressions. Received audio versus rendered playback, silent/muted output, partial replacement, interruption, fake permission denial, cleanup, startup deduplication, and time caps use fake devices/sockets.
- Browser tests cover both scenarios, recovery, Power acknowledgement/rejection, keyboard operation, notes/hints, pause/resume, server-memory loss, source history, fresh recap, one closing response, and the eight-second completion watchdog.
- Tests intercept token issuance and provider WebSockets. The fake peer never connects to AssemblyAI. Practice-only cases assert no token/provider requests. No token, configuration echo, microphone byte stream, or secret is included in screenshots.

Tests establish implemented behavior under these controlled conditions, not natural conversational intelligence or puzzle enjoyment.

## Visual evidence

Before: [Goal 001 initial 1280](screenshots/initial-1280.png), [initial 1440](screenshots/initial-1440.png), and [observed 1280](screenshots/observed-1280.png).

Goal 002 screenshots are actual local browser output. Fake-provider images carry a visible “SIMULATED PROVIDER · FAKE AUDIO DEVICES · OFFLINE TEST” stamp. They do not show a human microphone, audible hardware playback, or a paid provider run.

Inspection includes briefing at 1280×720 and 1440×900, active Classic, Maintenance manual plus legitimately pinned report, simulated listening/speaking/checking, error, pause/resume, Live-to-Practice history, confirmed debrief, reduced motion, keyboard focus, long captions, 200% CSS zoom, and 390-pixel reflow. CSS zoom exercises reflow, not browser/OS zoom certification.

The 32 final PNGs are in [screenshots/goal-002](screenshots/goal-002). Inspected examples:

| View | Actual browser evidence |
| --- | --- |
| Briefing | [1280](screenshots/goal-002/g2-briefing-chromium-1280.png), [1440](screenshots/goal-002/g2-briefing-chromium-1440.png) |
| Classic and Maintenance | [Classic](screenshots/goal-002/g2-classic-chromium-1280.png), [Maintenance with report](screenshots/goal-002/g2-maintenance-chromium-1440.png) |
| Simulated communication | [Listening](screenshots/goal-002/goal-002-simulated-listening-chromium-1280.png), [speaking](screenshots/goal-002/goal-002-simulated-speaking-chromium-1280.png), [checking](screenshots/goal-002/goal-002-simulated-checking-chromium-1280.png) |
| Failures | [Permission denied](screenshots/goal-002/goal-002-simulated-permission-error-chromium-1280.png), [connection rejected](screenshots/goal-002/goal-002-simulated-connection-error-chromium-1280.png) |
| Continuity and source | [Paused](screenshots/goal-002/g2-paused-chromium-1280.png), [resumed](screenshots/goal-002/g2-resumed-chromium-1280.png), [Live Voice to Practice history](screenshots/goal-002/goal-002-simulated-history-transition-chromium-1280.png), [fresh Live Text recap](screenshots/goal-002/goal-002-simulated-recap-chromium-1280.png) |
| Arrival | [Practice debrief](screenshots/goal-002/g2-debrief-chromium-1280.png), [simulated final response](screenshots/goal-002/goal-002-simulated-completion-chromium-1280.png) |
| Reflow and focus | [390-pixel width](screenshots/goal-002/g2-narrow-chromium-1280.png), [200% CSS zoom and keyboard focus](screenshots/goal-002/g2-zoom-chromium-1280.png) |

Review corrected a two-column overlap at 200% zoom, a clipped final debrief row, and a low-contrast History pin button; final screenshots were inspected again. Actual browser color pairs measured 10.20:1 for paper body text, 5.06:1 for secondary paper text, 11.15:1 for console body text, 8.13:1 for secondary console text, 5.00:1 for the primary button, and 6.16:1 for History's pin button. Automated token pairs meet 4.5:1. Primary controls target 44 pixels, keyboard focus is visible, and reduced motion is supported. This is not a complete accessibility certification.

Final production assets are 271,645 bytes JavaScript and 31,550 bytes CSS: approximately +16.7% and +97.2% against the preserved baseline assets. Vite reports about 83.25 kB and 7.55 kB gzip, approximately 13.7 kB more combined than the baseline's reported gzip sizes. No frame-rate benchmark was performed. Art is inline SVG, fonts are system fonts, and effects are small local procedural tones; no heavy media download or per-frame React animation was added.

An intermediate stylesheet write failed and briefly produced unstyled screenshots and an empty CSS bundle. Those images/builds are rejected as evidence. The stylesheet was restored, browser computed-style guards were added, and final assets/screenshots were regenerated from frozen source. Earlier selectors that targeted a hidden portrait label were updated to the visible arrival stamp; completion conditions were not weakened.

## Provider and human acceptance

**Goal 002 automatic real-provider usage: zero seconds, by policy.** No `test:live`, cloud speech synthesis, voice audition, agent publication, or provider connection was run. Fake WebSocket URLs are intercepted locally; they are not real connected seconds. The historical ignored budget ledger is preserved unchanged. No current balance or verified bill is claimed.

Human microphone capture, audible replies, a complete natural-language Classic round, a Maintenance round, and satisfaction are **pending**. The earlier user report of a Voice conversation does not establish a Goal 002 clear. Use the English [manual Live acceptance sheet](demo-script.md) to record these separately.

## Limits and preservation

Missions, notes, finalized records, and recap are held in server memory; current caption history also exists in browser memory. Neither is durable storage. Refreshing the browser does not restore its session identifier, and restarting the server loses all missions. This is gameplay role separation, not protection against developer tools. A network break may prevent a provider end acknowledgement, although local cleanup and session caps remain.

No dependency or lockfile upgrade, third-party asset download, new license grant, raw microphone recording, browser transcript/token storage, new secret, billing change, public deployment, main merge, or pull request was added. Original SVG and procedural tones are documented in [assets.md](assets.md). Secret checks compare existing credential values in memory without printing them. The original `.env`, budget ledger, and Goal 001 validation are preserved.

The `.env` and ignored budget ledger were compared with preflight file hashes without printing either contents or hashes; both are unchanged and remain ignored/untracked. The upstream starter files, lockfile, `.env.example`, and historical Goal 001 validation were also checked against the starting commit.

Manual launch remains:

```sh
cd ~/workspace/talk-me-home
npm run dev
```

Open http://localhost:5173 in Windows Chrome or Edge. Start with Practice; choose Live only when you intend to use provider time.
