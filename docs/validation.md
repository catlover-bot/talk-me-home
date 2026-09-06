# Goal 001 validation

Validation date: 2026-09-07 (Japan time). Upstream base: `11b4c9508bef682785e8bdf23d5170b30aafb7a6`. Working branch: `work/goal-001-first-door`.

## Environment

Ubuntu 24.04 under WSL, Node.js 24.20.0 and npm 11.19.0, using the existing executables under `~/.local/bin`. Windows PowerShell did not have Node/npm/Git on its PATH; commands ran through `wsl -d Ubuntu-24.04 -- bash -lc 'cd /home/mhirotaka/workspace/talk-me-home && ...'`. No Node reinstallation or version-manager installation was needed.

Dependencies are locked in `package-lock.json`. Playwright Chromium153 was installed with `npx playwright install chromium`. Initial browser launch reported the missing `libasound.so.2`; `ldd` identified that single missing library. Installed `libasound2t64` and its data package with `apt-get install -y --no-install-recommends libasound2t64`. No existing packages were upgraded. The original `.env` was preserved and is ignored by Git.

## Automated checks

All ordinary tests are credential-free. Real-provider checks are separate and are never run in CI.

| Command | Scope | Outcome |
| --- | --- | --- |
| `npm run typecheck` | Client, server, shared contracts, scripts, tests | Passed |
| `npm test` | State, HTTP, voice/audio fakes, English/secrets, Mock parser, budget/watchdog | 69 passed: 20 state, 10 HTTP, 24 voice/audio, 3 source-safety, 7 Mock, 5 live-check support |
| `npm run build` | Typecheck and Vite production bundle | Passed |
| `npm run test:e2e` | Seven scenarios at two viewports | 14 passed |
| `npm audit --json` | Installed dependency tree | 0 known vulnerabilities reported |
| `git diff --check` | Whitespace/conflict-marker check | Passed |

State tests cover the initial conditions, derived Door/Conveyor states, valid cooperation, premature Power loss and recovery, running-Conveyor rejection, and independence from a phrase or prior failure. Exhaustive exploration finds five reachable physical states; neither actor's action set alone can complete the puzzle. Additional tests cover role/session/schema forgery, unknown tools and objects, idempotency conflicts, stale revisions, parallel duplicate calls, current preconditions at commit, cancellation before versus after commit, stopped sessions, stale rounds, delayed reset responses, and independent sessions.

HTTP tests use real local requests against an ephemeral server. Provider token tests use a fake fetch to check secret sanitization, missing credentials, inline configuration, token start expiry versus connected duration, and reset/stop during token issuance.

Voice tests use fake sockets/devices and execute the worklet code in a VM. They verify transcript partial replacement/finalization, raw-input preservation, tool ordering/correlation, duplicate calls, interruption barriers, stale audio/results, credential/configuration/permission/network failures, explicit ending, track/context cleanup, 48-to-24-kHz capture resampling, and playback-buffer clearing. These tests do not establish human microphone quality or audible sound.

## Mock and browser inspection

`npm run test:e2e` launches the local dev command with `GAME_DISABLE_LIVE=1` and an empty API-key environment override. Scenarios: initial English interface and hidden-information boundary; cooperative arrival; premature Power loss/recovery/reset; captions and keyboard text entry; missing Live token with no silent fallback; stop/resume via keyboard; delayed robot response after Restart. Both 1280x720 and 1440x900 use Chromium under WSL.

Actual initial, observed, and completed browser screenshots were inspected. The first layout placed communication controls below the viewport; map geometry and spacing were adjusted, and viewport assertions now check primary controls. No initial Latch, hidden live-state feed, clipped primary controls, or overlapping game content was found in the final images. Small document metadata is secondary to the larger equipment labels. Long captions/errors can extend the document vertically and remain scrollable. These images are browser output, not concept art.

Saved evidence: [initial 1280](screenshots/initial-1280.png), [initial 1440](screenshots/initial-1440.png), [observed 1280](screenshots/observed-1280.png), [completed 1440](screenshots/complete-1440.png). These are full-document captures taken at the stated viewport widths and 720/900-pixel viewport heights; the footer may extend just below the viewport.

Windows `Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing` returned HTTP200 while the WSL dev server was running. This verifies Windows-to-WSL localhost access. Automated rendering used Linux Chromium, not the user's installed Windows Chrome/Edge profile.

## Real AssemblyAI validation

`npm run test:live` is an explicit paid test using a persistent ignored budget ledger, a short watchdog, provider duration cap, and `session.end`/`session.ended` cleanup. It prints only allowlisted counters and event metadata, never provider tokens, configuration echoes, authorization, or raw errors.

The first two attempts connected for 45.1 seconds each locally (90.2 total). Both accepted the inline configuration, sent typed English input, received a real tool request and audio events, but initially failed to return the tool result. Both watchdog terminations received `session.ended`. Provider-reported session durations were 44.933718 and 44.969714 seconds.

The live trace established that a tool's completed reply used the active response ID rather than the `fc-<call_id>` shape in the reference example. The adapter was corrected to correlate the active response and retain the documented shape. Documentation also permits `tool.call` after its `reply.done`; delayed captions must not reset the turn-state gate. Regression tests exercise these cases.

The third and final `npm run test:live` passed in 20.8 locally measured connected seconds. It accepted the actual game configuration, sent one paraphrased English text request, received one `observe_room` call, returned one successful authoritative tool result, and received one matching final robot response after that result. It also received 1,968 audio events and acknowledged `session.ended`. Provider-reported duration was 20.659526 seconds. This was an observation round trip, not a real-provider puzzle completion.

Aggregate locally measured connected time: **111.0 seconds**, below the 180-second goal limit. Aggregate provider-reported session duration: **110.562958 seconds**. All three sessions ended with acknowledgement. No billing balance or invoice was queried, estimated, or verified.

Budget accounting retains every original attempt reservation. Explicitly acknowledged sessions settle to the greater of measured/provider duration, rounded up plus one second; uncertain attempts keep the whole reservation. The final probe added an independent child-process watchdog (SIGTERM at 49 seconds, SIGKILL at 50 seconds), armed before opening the socket. Its 82-second reservation covers the 50-second hard limit, 30-second disconnect grace, and margin. Before that attempt, conservative accounting was 47 + 47 + 82 = 176 seconds. After clean termination it settled to 116 seconds. Offline tests verify settlement, uncertain reservations, process termination, and watchdog cleanup. The ledger was never deleted or reset to gain credit.

All probe sessions, supervisor processes, temporary HTTP servers, and browser test servers were terminated. The development server is not left running.

## Human speech and limitations

No person spoke through a microphone during automated validation. No one independently listened to the generated audio through the user's speakers. Audio-event receipt is not evidence of audible playback. A minimal real text/tool round trip is not a full natural-language cooperative playthrough. Use [the manual voice checks](demo-script.md) to verify those remaining physical and conversational aspects.

Application UI, accessible labels, authored errors, prompts, tool descriptions, comments, documentation, and test fixtures are English. A unit fixture contains escaped non-English raw player text solely to verify faithful transcript preservation. Browser/OS/third-party messages and actual player input are intentional exceptions. Static prompt checks do not prove live behavioral compliance; the short live evaluation table is in the demo document.

Source and built-bundle checks compare ignored local credential values in memory without printing them. Token/session metadata is not persisted by the game UI. The local server has no transcript database and loses missions when restarted. Gameplay roles are not an anti-cheat boundary against developer tools. There is no public deployment, new provider, billing-setting change, or stored-agent republishing in this goal.
