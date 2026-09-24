# Goal 004B autonomous release QA

Date: September 24, 2026. Branch: `work/goal-004b-autonomous-qa`. Release baseline: `99bec1634eb3a1e49a2707a6c72f5b775785d12e` on `work/goal-004-release-candidate`, not starter-only `main`.

This campaign exercises the compiled production game, then its real microphone/provider/playback path with an isolated synthetic player. It preserves the artwork, three Rescue chapters, both authored Gallery configurations, Training, raw ASR, local authority checks, and private human information boundaries. Earlier validation reports remain historical records.

**Release acceptance verdict: FAIL.** The three authorized real attempts did not complete Rescue. Real microphone capture, ASR, tools, continuation, and digital rendering were demonstrated; the third attempt verified the protocol-stall repair but remained in Cargo Bay. The final cancellation-wording prompt and bounded Cargo-retry improvement were added after the last attempt and have no real-provider verification. The campaign is exhausted; no fourth call or replacement ledger was created.

## Environment and repeatable entry points

WSL Ubuntu 24.04, Node.js 24.20.0, npm 11.19.0, Playwright 1.63.0, headless Chromium 153.0.8010.12 with the Chromium sandbox enabled. Generic English fixtures use the already installed Microsoft Zira Desktop voice through offline Windows System.Speech. No physical input device, personal browser profile, external TTS, or additional model is used.

```sh
npm run qa:release                         # offline; compiled production and regression suite
npm run qa:live                            # dry run; local speech fixtures only
npm run qa:live -- --inspect               # local accounting inspection only
npm run qa:live -- --live --scenario canary # explicit authorized real attempt
npm run qa:live -- --live --scenario mission
node scripts/qa-evidence.mjs --output artifacts/goal-004b/live --mux
```

The Live commands reuse the same persistent campaign. They cannot replenish attempts. They require WSL/Linux supervision and the existing private `.env` credential, which is parsed as data and passed only to the owned production child. The production entry remains `npm run build:game` / `npm run start:game`. An ephemeral loopback port, exact origin, random QA-only access code, browser ownership cookie, and normal production admission are retained. The original `npm start` still launches the upstream starter.

## Layer A: offline production regression

Final typecheck, **195 unit cases, 78 compiled-production browser cases**, production build, fresh-context Practice smoke, and `git diff --check` passed. Results and exact runtime identity are retained in [the offline summary](../artifacts/goal-004b/offline-summary.json) and [runtime manifest](../artifacts/goal-004b/final-runtime.json). The suite began at `dda1a5d` with the final prompt already present as an uncommitted change; that same application source was committed as `b0849b7` during the run. The original checkout/dirty metadata is preserved. Earlier intermediate runs had 184 and 188 unit cases; they are not substituted for the final suite. No skipped, cancelled, or failing cases are counted as passing. The offline runner hashes sorted paths and raw bytes; the Live runner hashes a sorted per-file SHA-256 manifest. Those digest algorithms intentionally differ and are identified in their records.

Coverage includes both Gallery configurations and backtracking, Classic/Maintenance, real final-home validation, source history/private notes/recap, keyboard/focus/layout, 540/600-second lifecycle, delayed tools and chapter races, every session-route ownership check, access expiry/restart, missing/wrong code, disabled/busy/exhausted/corrupt admission, concurrency, invalid origin, and static/API source exclusions. Denial tests explicitly count zero provider calls. Throwaway offline ledgers are separate from real campaign accounting.

Actual title, Gallery, Dock, homecoming, 390px reflow, and 200% zoom captures were inspected. Existing browser cases also retain 1280×720 and 1440×900 layouts, presentation/history, long captions/errors, reduced motion, and other release regressions. This is scoped browser verification, not a general accessibility certification.

## Budget and independent cleanup

The owner authorized at most three token attempts. Each consumes a durable 670-second reservation before its production token request; the total envelope is 2,010 seconds. The production allowance is separately initialized to exactly three attempts and retains its 600-second session cap. Neither ledger refunds early endings or failed requests. An exclusive OS lock prevents concurrent campaign drivers.

An independent watchdog records owned process identities and remains effective if the driver hangs, crashes, or its parent supervisor dies. It is armed and acknowledged before the token request proceeds. The mission requests graceful shutdown at 570 seconds and hard cleanup at 580 seconds; even the allowed maximum hard cutoff of 600 seconds plus the documented 30-second disconnect grace fits within 670 seconds. Thirteen offline supervisor tests exercised durable reservations, corrupt/partial files, concurrent locks, exceptions, detached children, supervisor death, and an actually blocked driver event loop.

Current official pricing was checked at **$4.50/hour**. A fully consumed conservative envelope estimates **$2.5125**, below the $2.52 planning ceiling. These are campaign estimates, not invoices or an account-wide cap. No authorized balance surface was available; balance and unrelated account usage are unknown. No billing setting changed.

## Observed defects and repairs

1. **End handshake:** the first real canary sent `session.end`, then reached the old 1.5-second close fallback without receiving `session.ended`. A clean WebSocket close is not remote termination evidence. The runtime now keeps the receive window open for at most five seconds while capture, playback, and local actions stop immediately. Tests cover a delayed acknowledgement, clean closure without acknowledgement, finite missing-ack fallback, and no reconnect. The final-response watchdog remains eight seconds.
2. **QA wait assumption:** one natural two-sentence synthetic wait was recognized as two user turns. The second interrupted the first reply; a late provider final correctly stayed out of visible history and playback. The runner had incorrectly required a delivered reply for a wait. The observed sequence is now a deterministic regression; the application still rejects stale interrupted output. Fixture text and raw recognized text are retained separately.
3. **QA evidence and parsing:** remote Playwright video needed explicit `saveAs`; the first canary has no saved video and is not relabelled as having one. The saving path was verified offline. The player also now distinguishes an open gate from a physically clear opening, asks bounded clarifications, and correlates each new user final with its completed response before proceeding. These are test-driver repairs, not simplified game rules.
4. **Split-speech tool stall:** attempt 2 recognized the wiring explanation and requested action as separate turns. The provider retained the interrupted reply ID, then sent a tool call and `reply.done(completed)`. Silently discarding that call left the provider waiting for a result. The fix returns one sanitized cancellation error only after correlated completion and confirmed local cancellation. It never executes interrupted arguments or restores late speech. Fresh calls still use current authoritative context. Attempt 3 actually exercised two such rejections followed by fresh provider replies; the deadlock was repaired.
5. **False physical-failure explanation and incomplete retry:** in attempt 3 Pip described canceled requests as a failed lever or sensor scan. The existing prompt's generic instruction to explain rejection as a local obstacle was replaced with cause-accurate cancellation handling. The runner had bounded recovery for the Latch, which succeeded, but stopped on its missing Gallery checkpoint before clarifying the canceled crossing scan. Cargo now has one status clarification and one conditional rephrased retry, with tests preventing further crossing after a public checkpoint. These last wording/runner changes are offline-only, not a claimed real clear.
6. **Actual CI launch failure:** run [36003833985](https://github.com/catlover-bot/talk-me-home/actions/runs/36003833985) at `fdc27eb96be4c6025277e03186df8b93698f652a` failed before any browser page because Ubuntu 24's AppArmor profile did not permit the downloaded Chromium sandbox. CI now selects the runner's installed Chrome with its existing profile and retains `chromiumSandbox: true`. No system security setting or assertion was disabled. Run [36004593020](https://github.com/catlover-bot/talk-me-home/actions/runs/36004593020) passed for the exact repair head `dda1a5dadfcdad6508725f11d2e1a258401e7213`; the final delivery separately checks its pushed head.

## Real attempt results

All three were fresh, continuous **synthetic-microphone-only** calls. No real Live Text, typed fallback, resume, forced Gallery variant, or developer-level game mutation was used. Gallery and Dock were not reached in real play, so no real Gallery route or obstruction is claimed. Both configurations, all three chapters, and confirmed home were completed in offline Practice/browser tests.

| Attempt | Tested app ancestry and manifest hash | Observed local duration | End acknowledgement | Result |
| --- | --- | --- | --- | --- |
| 1: canary | `99bec16`; `89a3f77269393a169d0808f8ef7106cd7154d85ef8fde78b8b105a9731a9de47` | 52.921 s to socket close | Missing | Real observe/tool/audio chain; split wait and early end fallback exposed |
| 2: mission | `fdc27eb`; `378df0fe5961de1298769b03232b092245bafe50e9d3a4407b383da047ad05e4` | 72.475 s; provider reported 72.319293 s | Received, 288.4 ms after request | Cargo tool stall reproduced; explicit end verified once |
| 3: repair mission | `dda1a5d`; `5fea041c5173b090a471f5291b3e24b8681ef94059512553baf6816a8143053b` | Exact close duration unavailable; observed bounds below | Missing | Cancellation recovered; Latch engaged after bounded retry; stopped in Cargo before Gallery |

Attempt 3's last observed `session.end` was 187.8 seconds after socket open. Verified owned-process cleanup gives a derived local upper bound of 197.7 seconds; adding the documented disconnect grace gives a **227.7-second remote upper estimate**, not an observed invoice duration. The original null duration and missing acknowledgement remain unchanged in its ledger/report. Extending the receive window improved opportunity for acknowledgement but did not guarantee it; two of three endings remain remotely unconfirmed. Both had verified local process/audio cleanup.

Total accounting is **3 token requests / 3 connections / 2,010 reserved seconds / $2.5125 conservative planning estimate**, with **zero remaining attempts**. The shorter observed durations do not refund reservations. No balance or invoice was read, and unrelated account usage is outside this envelope. See [the immutable-campaign-derived summary](../artifacts/goal-004b/live/campaign-summary.json).

Across the campaign, 11 synthetic utterances produced 16 actual finalized ASR turns. There were 10 observed tool calls: seven successful results, two safe cancellation rejections, and one call left unresolved in the pre-repair stall. The actual playback worklet rendered 379,214 / 445,269 / 992,884 nonzero samples in the respective attempts. Provider and post-volume counters are separate in the metrics. These counts establish digital paths, not speaker audibility or response quality.

Timing samples, including split/negative waveform-end-to-ASR measurements, actual audio onset markers, and each tool call-to-result interval, are retained per utterance in the metrics. The first canary observation's waveform end to ASR final was 85.5 ms; its one observe call-to-result was 2,294.4 ms, including waiting for `reply.done`. These small samples are not an SLA. Render observer chunks have approximately 100 ms granularity. Only the initial Cargo Bay heading was observed in attempt 3; no real chapter transition or cleared checkpoint occurred.

The latest runtime prompt change at `b0849b7` is **not covered by these real attempts**. Final offline source/build identity is separate. A future real retry requires new explicit provider-budget authorization; the current scripts fail closed at the exhausted campaign.

## Evidence boundaries

The microphone chain is `offline WAV → genuine browser MediaStream → shipped capture/resampler → native provider socket → real ASR/model/tool call → authoritative game server → tool result continuation → real PCM → shipped playback worklet`. Only the physical source is substituted. No transcript, reply audio, tool call, tool result, or provider connection is faked in real attempts. The separate offline instrumentation tests use clearly labelled fake provider data and verify no output-to-input feedback.

The player reads rendered manuals and SVG atlas geometry, finalized visible Pip replies, acknowledged human controls, and public chapter checkpoints. It never reads the hidden Gallery variant, private position, application state, tool-result payloads, or an answer table to choose an action. Local inspection of hidden game state is not used to rescue the player. Clarifications and rephrased retries are bounded.

Provider PCM, rendered nonzero samples, and post-volume digital capture are reported separately. Physical microphone acoustics, installed speaker routing, room echo, human listening, a natural human clear, and enjoyment were not measured. These boundaries do not create a mandatory owner test phase.

Full local evidence stays under the ignored `.validation/` directories listed in [the evidence index](../artifacts/goal-004b/README.md). Committed summaries use a narrow allowlist and preserve raw recognition errors. No HAR, raw socket dump, token, resume token, access code, cookie, authorization header, configuration echo, or hidden tool-result payload belongs in the export. Large WAV/video/screenshots remain local.

The [readable final-attempt conversation](../artifacts/goal-004b/live/2026-09-24T13-18-41-410Z-mission-conversation.md) keeps provider finals separate from visible history; early history exports did not retain final/interrupted flags, so snippets are not silently certified as complete delivered replies. The [used-fixture manifest](../artifacts/goal-004b/live/used-speech-fixtures.json) validates source WAV hashes and explicitly labels Microsoft Zira Desktop as synthetic.

Attempts 2 and 3 have original silent WebM video and separately captured input/rendered/post-volume WAVs. Derived private MP4s were inspected with ffprobe: H.264 video plus AAC mono 24 kHz audio, 75.40 s and 198.72 s. Their audio combines actual captured input and rendered output at half gain each; it does not replace Pip's answer. Alignment is approximate from recorded browser page-creation timestamps (53.7 ms / 43.0 ms), not sample-accurate or physical sound. Attempt 1 has screenshots/WAV/transcripts but no saved video. Actual failure screenshots were inspected without masking errors.

All owned browser/server processes were stopped and supervisor cleanup recorded zero survivors. All three report zero remaining input tracks, sources, and application audio contexts. The original `.env`, historical budget, and existing allowances were preserved. Only the separately authorized QA allowance was created. No new public deployment, PR, main merge, visibility change, subscription, or billing action occurred.

Public hosting is **NOT DEPLOYED**. Only verification against a public HTTPS deployment is blocked by the absence of an approved URL. The same offline runner accepts `--target https://approved-origin` for a future assistant-executed Practice/security smoke; it does not enable Live or publish anything. No ordinary browser checklist is handed back to the owner.

## Official references checked

- [AssemblyAI documentation index](https://www.assemblyai.com/docs/llms.txt)
- [Browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), [events and ending semantics](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference), [client-side tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools)
- [Pricing](https://www.assemblyai.com/pricing), [billing](https://www.assemblyai.com/docs/billing-and-pricing)
- [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype), [BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [video saving](https://playwright.dev/docs/videos)
- [Chromium media switch implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/base/media_switches.cc)
