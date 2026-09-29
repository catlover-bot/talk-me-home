# Goal 005 — Gallery and Live completion

**Final acceptance target not met: one of two required final-candidate Voice passes. The approved batch is exhausted; no retry remains.** Work is delivered on `work/goal-005-gallery-live-completion`, based on `d87a898bdc7fa1e6dcb6bbf1debe4be1e9930291`. The final ordinary sample (aggregate attempt 12) completed Rescue with real ASR, digital playback, exact confirmations, remote ending ACK and cleanup. The recovery sample (attempt 13) used the identical candidate but stopped in Gallery and received no ending ACK. `RELEASE_NOT_LIVE_VERIFIED` remains because the required final pair did not pass.

| Final measure | Actual result |
| --- | --- |
| Frozen execution candidate | `2edf7914a008143843923b04a9bf3a1fe41f1f68`; identical runtime, harness and speech fixtures for attempts 12 and 13 |
| Offline validation | 437 unit tests, 142 compiled-browser cases, typecheck, build, whitespace and fresh production Practice passed |
| Final-candidate acceptance | **1/2 passed**: ordinary passed; deliberate-recovery sample failed |
| Functional homes across all candidates | Attempts **9, 11 and 12**; earlier functional homes do not replace final-candidate acceptance |
| Missing remote-ending ACKs | Attempts **11 and 13**; provider durations remain unknown |
| Goal 005 allowance | **8/8 consumed**, 7,760 seconds / **USD 9.70** conservatively reserved; **0 remaining** |
| Linked C/D/E/005 accounting | 13 attempts, 11,110 seconds / USD 13.8875 reserved, including unchanged historical reservations |
| Public deployment / human evidence | Not deployed; physical-device quality, natural human play and enjoyment remain unverified |

The USD 10 ceiling applies to the additional Goal 005 batch, not the historical aggregate. No grant was reset, refunded or replenished. See [final accounting](../artifacts/goal-005/live/final-accounting.json), [preservation audit](../artifacts/goal-005/live/final-preservation.json), [copied offline receipt](../artifacts/goal-005/live/final-offline-validation.json), and the actual attempts below. These are planning and observed-duration records, not an invoice or refreshed account balance.

| Aggregate / batch attempt | Frozen commit | Furthest verified checkpoint | Automated result | Provider seconds | End ACK |
| --- | --- | --- | --- | --- | --- |
| 6 / 1 | `0723e57` | Return Dock; no home | Failed: four return exchanges exhausted | 562.556016 | Yes |
| 7 / 2 | `8351617` | Return Dock; no home | Failed: four return exchanges exhausted | 509.541203 | Yes |
| 8 / 3 | `61fdcbb` | Gallery, Fork; no home | Failed: empty completed reply left pacing unresolved | 205.216512 | Yes |
| 9 / 4 | `dd91633` | **Home verified** | Failed: post-home next-input waiter stopped on `session_ended`; raw `completion:false` retained | 645.664858 | Yes |
| 10 / 5 | `78fa583` | Gallery, Ring; no home | Failed: fresh Ring wording was not recognized within four exchanges | 183.183735 | Yes |
| 11 / 6 | `cc3537b` | **Home verified** | Failed: ending observation timed out; no remote ACK | Unknown | No |
| 12 / 7 | `2edf791` | **Home verified** | **Passed: ordinary sample** | 576.923132 | Yes |
| 13 / 8 | `2edf791` | Gallery, Fork; no home | Failed: southeast-passage recovery exceeded 120 seconds; no remote ACK | Unknown | No |

All eight were synthetic-microphone Voice runs. Attempt 13 included the deliberate decline exercise; it shared the exact final runtime, player and fixtures with attempt 12. The six ACK-bearing samples report **2,683.085456 provider seconds** in total. This is a partial observed sum: attempts 11 and 13 have unknown provider durations, so no total billed duration or actual billed cost is inferred.

## Authorization and acceptance

The owner's September 29 explicit approval authorizes one additional repair/test batch, identified as `goal-005-gallery-live-completion-2026-09-29`, linked to the five exhausted C/D/E attempts. It permits at most eight additional token/socket-attempt slots, one active connection, 900 connected seconds per attempt, a durable 970-second reservation per attempt, 7,760 new reserved seconds and USD 10.00 additional estimated usage. Ordinary failures permit recorded repairs between frozen candidates within this same batch. Failures consume slots; reruns reuse the same grant. There is no compulsory Text pass; at most two reasoned Text diagnostic attempts may use the same allowance.

The official [pricing page](https://www.assemblyai.com/pricing) and [token reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/api-spec/generate-voice-agent-token) were rechecked on September 29. The managed stack remains USD 4.50/hour, billed per connected second; native STT/LLM/TTS and configured prompting are included. The unchanged managed services and `anna` add no separately configured paid provider. One 970-second reservation estimates USD 1.2125; all eight estimate USD 9.70. The token API supports the approved 900-second session duration independently of token redemption expiry. Public/default duration stays 600 seconds.

The previous owner screenshot (Free plan, USD 1.02 spent, USD 48.98 remaining) is dated displayed-balance evidence, not a refreshed lookup or Auto-pay check. Actual insufficient-credit, mismatch or budget-limit errors stop spending. No purchase, billing change, public allowance, deployment, external upload, visibility change, PR/main merge or submission is authorized.

Acceptance requires two fresh full synthetic-microphone Voice + exact UI-confirmation Rescue completions on identical final runtime/player policy, including one deliberate recoverable event. Every pass requires Cargo, Gallery, Dock and server-confirmed home, real ASR, nonzero shipped playback, correct confirmations, explicit remote ending ACK and cleanup. Two samples do not certify statistical reliability, human enjoyment or physical devices.

## Baseline and integrated changes

The preserved September 29 fifth attempt crossed Cargo and one Gallery gate, then answered “What emblem is beside you now?” by asking permission to observe. This was not ASR failure or failed movement. The delivered `galleryView` already contributed arrival prose; the acknowledgement path requested only the action result. The new constructed adapter regression failed before the change because its supplied scoped observation was stripped. Server regressions also reproduced missing typed perception and a stale Relay-toggle proposal still committing. [Server before/after receipt](../artifacts/goal-005/perception-validation.json).

The server now returns robot-only local perception with round/chapter, visit, observation revision/time and physical-state scope, emblem, compass and local gate handles. Power/open state is separate from inspected passage safety. Confirmed arrivals reuse real local survey logic once; failed/proposed/declined/duplicate operations cannot create new arrivals. A committed action remains historical truth while its observation can expire. Human views, proposal summaries and game-event captions do not contain the robot survey.

The shipped client retains the eligible survey through HTTP mapping, safe tool-result projection and the documented one-shot decision context/reply scheduler. Interaction acknowledgement remains brief. A valid Gallery arrival requests one movement/orientation report without an extra tool chain. New speech suppresses a separate arrival reply; Interrupt/Pause/End remain authoritative. Late or stale observations cannot replace current scope. A locally sent message hash is not provider ingestion or comprehension.

The shared player now acquires location and passage reports with an initial request plus up to three purposeful exchanges, within 120 seconds per unresolved subgoal. It waits for real reply/playback boundaries, consumes communicated arrival reports, requests a survey when needed, resolves referents and never substitutes a desired destination. Departures clear navigation beliefs; Relay changes clear passage beliefs. Exact pending proposals remain matched by identity and operation; old terminal strips are retained history. Deliberate decline exercises the ordinary UI and a new spoken request. No robot-only payload or evaluator state enters player navigation.

Gallery presentation adds distinguishable room/emblem drawings, patterned circuits, private intended/explored route marks, exact source-linked field reports and player-selected report associations. Dynamic associations become historical after relevant Relay changes, while stable notes remain useful. Explicit quick requests have `Selected request` provenance and are not microphone speech. The Voice test does not use these shortcuts. Pip has a separate pending-confirmation state and normal read-only failure leaves the conversation recoverable.

## Verification and attempt record

The first integrated source build passed. Focused arrival/voice/recovery/speech/pacing checks passed 100 cases; the first complete unit run passed 413 tests. A compiled-browser UI test found that the new field report did not refresh after a saved spoken caption; the client now refreshes persisted report context after final robot speech. The failure remains in the local test log. The repaired UI passed eight distinct browser cases and four unit cases; desktop, narrow and 200% zoom screenshots were inspected. [UI receipt and captures](../artifacts/goal-005/ui/gallery-validation.json).

The compiled arrival/shared-player checks passed 17 distinct cases across the initial run and focused correction run. Five initial failures were synthetic-peer fixture omissions: missing normal post-tool reply, checking a removed terminal strip after home, and trying to click already-selected Power. The tests now preserve those actual lifecycle boundaries. Constructed peers cover both Gallery layouts, obstruction/backtracking, the fifth-attempt permission question, old/new and synonym emblem reports, deliberate proposal decline, four-exchange unknown-location exhaustion and exact safety rejections. Actual server perception reaches the serialized decision, one arrival instruction, constructed visible speech and playback drain. This establishes application dataflow, not real-model comprehension. Full clean-candidate regressions and Live identities/results follow below.

The first implementation commit is `2b3db8a`. Goal 005 local speech fixtures were prepared offline before connection; no paid synthesis or replacement transcripts are used. The evaluator also recognizes the new purposeful read-only and proposal requests while retaining wrong-target and unconfirmed-execution rejection.

The first clean full candidate, `b468405742d11106cb6e62d50e4ca674d6ed560a`, passed typecheck, 418 unit tests and production build. Browser coverage passed 134/136 cases; both failed cases exposed the same Practice backtracking regression. The richer blocked-gate inspection named its direction/handle, and the existing prose memory replaced all known gates with that single gate. The repair uses the admitted typed local perception's complete reachable gate set, replacing it on a new visit rather than merging rooms. A failing-first unit case reproduced the lost northwest backtrack and checks that a later Fork arrival discards the departed-room handles. No real attempt was spent on this regression.

The next clean candidate, `0723e57f075146d06d15e4bfab2fc0c7163dc402`, passed typecheck, 419 unit tests, production build, all 136 compiled-browser tests, whitespace checks and the fresh-context production Practice check. That exact candidate was frozen for the first Goal 005 Voice attempt. Its runtime SHA-256 is `f3cf1e1266a51030adabb2efab247a84eda3f8e96af2f775021927b944281fce`; its harness SHA-256 is `e37bd8362cc79f520f7ad5070cd81a3e23246c2b329da50020f8da44bc6303c8`. The [accounting and preservation receipt](../artifacts/goal-005/live/attempt-06-accounting.json) also records the fixture, exact `session.update`, frozen manifest and clean validation receipt hashes.

### First Goal 005 Voice attempt — failed, remotely ended

Aggregate attempt 6 was an ordinary synthetic-microphone sample, without the deliberate recovery exercise. It reached Cargo, Relay Gallery and Return Dock, committed eight exact UI-confirmed actions, and boarded the recovery capsule. It did **not** confirm the authorized return or reach server-confirmed home. Four purposeful return exchanges exhausted the bounded recovery policy: the robot referred back to boarding, a status check failed, and subsequent movement calls were rejected without producing the requested new return proposal. The final failure was `QA action recovery exhausted after 4 exchanges for Confirm the authorized return`.

The attempt also exposed incorrect unsolicited arrival narration: `far_side`, Square, Star and Moon were spoken as location/emblem reports. Fresh explicit surveys supplied usable Ring, Fork and Sail reports and then the Return Dock equipment, allowing the player to continue without substituting intended destinations. This is a real grounding/continuity failure. The coarse behavior report remained `review_required`, including a blocking unsettled-response window; its empty material-defect array does not establish correct arrival narration or a behavior pass. [Source-labelled conversation](../artifacts/goal-005/live/2026-09-29T09-03-52-791Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T09-03-52-791Z-voice-mission-metrics.json) retain the actual result.

| Observed measure | Result |
| --- | --- |
| Token requests / provider sockets | 1 / 1 |
| Synthetic input turns | 25 |
| Exact UI confirmations / physical commits | 8 / 8; matching receipts in both directions |
| Information-only three-input canary | Passed; no confirmation or physical commit |
| Local socket-open to remote ACK | 562.6221 seconds |
| Provider-reported session duration | 562.556016 seconds |
| Ending | One explicit `session.end`, one `session.ended` ACK, clean socket close |
| Cleanup | Zero active audio tracks/sources/contexts; browser and server closure observed; supervisor survivors 0 |
| Goal 005 reservation consumed | 1 slot, 970 seconds, USD 1.2125 estimated |
| Same-batch capacity remaining | 7 slots, 6,790 reserved seconds, USD 8.4875 estimated |

Real ASR and nonzero input, provider, rendered and post-volume digital audio were observed. These receipts do not establish physical microphone/speaker performance, human listening, enjoyment or a full Rescue clear. The reservation remains consumed regardless of the shorter actual connection. Aggregate linked accounting is now six attempts and six production reservations, 4,320 reserved seconds and USD 5.40 estimated. The five previous attempts and all 15 historical accounting/cleanup journals remain unchanged. All 30 checked raw run/accounting files were unchanged by this compact export. The durable result and independent supervisor closure release concurrency; they do not refund capacity. No account-refusal stop was recorded. Remaining attempts still require a repaired, clean, validated frozen candidate and supervised admission under the existing grant. [Campaign accounting](../artifacts/goal-005/live/campaign-summary.json).

Raw evidence remains local at `.validation/goal-004c-live/2026-09-29T09-03-52-791Z-voice-mission/`, including `report.json`, `lifecycle.jsonl`, the original silent browser recording and digital audio. The immutable attempt manifest is `.validation/goal-004c-live/goal-005-attempt-6-0723e57f075146d06d15e4bfab2fc0c7163dc402.json`; the clean offline receipt is `.validation/goal-005-offline/0723e57f075146d06d15e4bfab2fc0c7163dc402-2026-09-29T09-00-04-175Z.json`. Nothing was uploaded or overwritten.

The ensuing offline repair tests the hypothesis that the arrival reply needs current local facts directly in its one-shot instruction. The client now includes dispatch-validated emblem, compass, local gate direction, Power, Door and passage facts with the exact decision status in the documented `reply.create.instructions` field; observations are omitted after an incompatible revision change. A failing-first test reproduced the absent inline facts, followed by 29/29 passing acknowledgement, confirmed-client and authority tests. Local logs are `.validation/goal-005/arrival-grounding-before.log` and `.validation/goal-005/arrival-grounding-after.log`. The [official event reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference) explicitly supports this one-shot instruction field and system conversation messages. The test proves payload grounding, not provider ingestion or model compliance; a subsequent frozen Live result is still required.

The shared player's final request now asks for a fresh capsule inspection and the separate local return operation, using the visible Ready/Granted instrument. Its first recovery asks for that inspection rather than a missing boarding receipt. A known, exactly confirmed boarding receipt remains history; it cannot satisfy return or authorize another boarding proposal. The retained failed speech reproduced four-exchange exhaustion in the old browser player. The repaired actual shared player then completed constructed A/B missions, including inspection-based return recovery (2/2 focused browser cases); policy/preflight/acceptance checks passed 41 cases. These are offline constructed results, not Live passes. Logs: `.validation/goal-005-return-player-before.log`, `goal-005-return-player-after.log`, and `goal-005-return-recovery-after.log`.

Small prompt/tool-description changes favor completing useful read-only checks, using returned operation labels in speech, preserving evidenced causal relationships, and distinguishing readiness from completion. Focused config/voice tests passed 54 cases. New ordinary/recovery speech was synthesized locally before the next freeze. No real connection was open during these repairs.

Inspection of the real failed-run screenshot also found a fixed 10-minute label despite the correctly enforced approved 900-second cap. The display now follows the token-selected limit (15 minutes for the approved path, 10 for the public/default path) and resets on a new connection. Enforcement and allowance checks are unchanged; an injected browser case covers the display across 900, 600 and absent cap responses.

### Second Goal 005 Voice attempt — failed return, improved location reports

The next ordinary Voice sample used clean frozen commit `8351617b1202d78c3f173cca4835d22ccf148f27`, after typecheck, 420 unit tests, production build, all 138 compiled-browser tests, whitespace checks and the fresh-context production Practice check passed. Its runtime SHA-256 is `bb4e5178f7025236e1ec6027168a2c7f675ab2c8c37b57af91b3257abe23acc8`; its harness SHA-256 is `99b0a13bd0e469d54b7fc83c40bc5fe1959caac8adb34bbe96fb4eb5da6c90c8`. The exact session configuration was sent once and matched the frozen hash. Full identity and validation links are retained in the [attempt 7 accounting receipt](../artifacts/goal-005/live/attempt-07-accounting.json).

Arrival location names were now Ring, Fork, Sail and Return Dock. This improved location naming does not establish every spoken gate fact: the Fork arrival named a southeast gate, and the first northeast inspection response repeated that mismatch. A purposeful clarification recovered a clear northeast passage report. At Sail, the first southeast inspection was reported unreachable, and a second exchange recovered its clear passage report. Both recoveries used real communicated replies, without a hidden-state shortcut. The information-only canary again passed with no physical change. Eight exact UI confirmations matched eight physical commits in both directions, including capsule boarding.

The final return still failed after four exchanges. Initial capsule inspection failed; the clarification recovered an actual inspection and a spoken report of the local confirm-return operation. The subsequent proposal requests failed, leaving the previous committed boarding receipt visible and no new matching return proposal. No server-confirmed home occurred. The final failure remained `QA action recovery exhausted after 4 exchanges for Confirm the authorized return`; the behavior report remained `review_required`. The cause of the remaining proposal failure is under investigation; this report does not claim a completed repair. [Actual conversation](../artifacts/goal-005/live/2026-09-29T09-28-09-963Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T09-28-09-963Z-voice-mission-metrics.json).

| Observed measure | Second sample result |
| --- | --- |
| Token requests / provider sockets / synthetic turns | 1 / 1 / 25 |
| Local socket-open to remote ACK | 509.6798 seconds |
| Provider-reported session duration | 509.541203 seconds |
| Ending and cleanup | Explicit end and remote ACK; clean socket close; zero audio resources and supervisor survivors; browser/server closure observed |
| Goal 005 consumed after this result | 2 slots, 1,940 reserved seconds, USD 2.425 estimated |
| Same-batch capacity remaining | 6 slots, 5,820 reserved seconds, USD 7.275 estimated |

Aggregate linked accounting is now seven attempts and seven production admissions, 5,290 reserved seconds and USD 6.6125 estimated. Both failed Goal 005 reservations remain consumed. No account-refusal stop was recorded; the six remaining slots still require a repaired, clean, validated frozen candidate and supervised admission. The 15 historical accounting/cleanup journals remain unchanged. Export verification preserved all 42 checked raw/accounting files and the three first-attempt compact evidence files. New audio observations again establish synthetic input, real ASR and nonzero digital playback, without extending the physical-device or human-play claims.

The second raw run remains local at `.validation/goal-004c-live/2026-09-29T09-28-09-963Z-voice-mission/`. Its immutable manifest is `.validation/goal-004c-live/goal-005-attempt-7-8351617b1202d78c3f173cca4835d22ccf148f27.json`; its clean validation receipt is `.validation/goal-005-offline/8351617b1202d78c3f173cca4835d22ccf148f27-2026-09-29T09-24-18-069Z.json`. Original ledgers, browser media and audio remain local and preserved.

After the second sample, Goal 005 had two failed real Voice attempts and zero of the two required final-candidate passes. `RELEASE_NOT_LIVE_VERIFIED` remained the release status.

### Split-speech recovery repair after attempt 7

The final failed calls used the correct `inspect_object` / `propose_interaction` classes. Each failed result followed `reply.done` by less than 1 ms; additional speech segments had started while its original reply was open. This is consistent with the client's interrupted-request guard, not proof of the omitted error body. The unchanged compiled server separately accepted the exact aboard-capsule inspection, return proposal and one confirmed return in an isolated offline fixture; no server guard defect was reproduced.

A constructed replay of the observed event order verifies that a late request from an interrupted reply never executes, while a fresh request can create the intended proposal. The product now displays a recoverable cancellation explanation, keeps the microphone/controls/Pause available, and clears that notice after a fresh successful check. Cancellation, proposal matching and current return authorization remain unchanged. The four final-return utterances are now single ordinary sentences of 9–10 words. Existing longer utterances and their actual ASR remain preserved in the failed attempt. The evaluator recognizes the new explicit Return proposal synonym without changing safety thresholds. Future sanitized evidence retains only an allowlisted local outcome code, so cancellation and precondition failures can be distinguished without exposing arguments or private tool payloads.

Focused policy/protocol tests passed 53 cases, focused voice/evidence tests passed 84 cases (overlapping suites, not additive), and the actual compiled cancellation-notice browser test passed at both viewports. `.validation/goal-005-return-split-before.log` preserves the old multi-sentence fixture failure and a corrected test expectation about clearing the warning; `goal-005-return-split-after.log` preserves the repaired checks. Product-browser evidence is `.validation/goal-005/attempt-8-recovery-notice-browser.log`. The relevant [official interruption documentation](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions) was rechecked; no provider event, interrupt setting, or paid service was added.

### Third Goal 005 Voice attempt — empty completed reply in Gallery

Aggregate attempt 8 used clean frozen commit `61fdcbb5fda115ce63835d13762a5fd7592c64b0`, after typecheck, 422 unit tests, production build, all 140 compiled-browser tests, whitespace checks and the fresh-context production Practice check passed. Its runtime SHA-256 is `172f9a5da49507899fe4146af8646bcc948e803c4639510ea1e3ceb2b32fa8ee`; its harness SHA-256 is `77153bc118a133c5096a67037e728819b86fc7aefe57358192745c4d314df31c`. [Frozen identity, accounting and preservation receipt](../artifacts/goal-005/live/attempt-08-accounting.json).

This ordinary sample committed three exactly confirmed actions: engage the Latch, cross Cargo and pass through the east Gallery gate. The player then asked to inspect the northeast gate. Real ASR finalized that tenth input correctly. A matching `reply.started` and `reply.done` with status `completed` followed, with no recorded tool, audio or transcript events between them and no new visible Pip answer. The turn waiter continued to treat the final response as pending until its bounded wait failed with `QA turn stalled: final_response_pending`. The behavior report was `blocked` for this unresolved turn. The provider's empty content has no established cause; it must not be relabelled as a successful inspection. [Actual conversation](../artifacts/goal-005/live/2026-09-29T09-46-23-539Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T09-46-23-539Z-voice-mission-metrics.json).

| Observed measure | Third sample result |
| --- | --- |
| Token requests / provider sockets / synthetic turns | 1 / 1 / 10 |
| Exact UI confirmations / physical commits | 3 / 3; matching receipts in both directions |
| Local socket-open to remote ACK | 205.4826 seconds |
| Provider-reported session duration | 205.216512 seconds |
| Ending and cleanup | Explicit end and remote ACK; clean socket close; zero audio resources and supervisor survivors; browser/server closure observed |
| Goal 005 consumed after this result | 3 slots, 2,910 reserved seconds, USD 3.6375 estimated |
| Same-batch capacity remaining | 5 slots, 4,850 reserved seconds, USD 6.0625 estimated |

Aggregate linked accounting is now eight attempts and eight production admissions, 6,260 reserved seconds and USD 7.825 estimated. No account-refusal stop was recorded. The failed attempt remains consumed; a future offline pacing repair cannot resume or refund it. All 15 historical accounting/cleanup journals, 53 checked raw/accounting files and six prior-attempt compact evidence files were preserved. Nonzero digital audio was observed earlier in the session; that does not imply audio existed for the empty tenth reply.

Raw evidence remains local at `.validation/goal-004c-live/2026-09-29T09-46-23-539Z-voice-mission/`. The immutable manifest is `.validation/goal-004c-live/goal-005-attempt-8-61fdcbb5fda115ce63835d13762a5fd7592c64b0.json`; the clean validation receipt is `.validation/goal-005-offline/61fdcbb5fda115ce63835d13762a5fd7592c64b0-2026-09-29T09-42-31-355Z.json`.

After the third sample, Goal 005 had three failed real Voice attempts and zero of the two required final-candidate passes, with five slots remaining. `RELEASE_NOT_LIVE_VERIFIED` remained the release status. Return Dock was not reached in that sample, so it did not verify the return repair by Live.

### Empty-response recovery after attempt 8

The retained tenth-turn event sequence reproduced `final_response_pending` offline. Scheduling now explicitly recognizes a matching, completed reply with no transcript, tool activity or audio as `empty_completed_response` with `usefulReply: false`. It passes an empty answer into the existing four-exchange/120-second acquisition policy, which must obtain new communicated information before progressing. It does not borrow the previous caption or manufacture an inspection. Open input, unmatched or interrupted replies, pending tool continuations, provider errors and undrained playback remain blocking; the existing 450 ms late-event observation window is unchanged. A prior decision acknowledgement cannot trap a subsequent empty user response or count as its answer. The shipped UI was already listening with controls and Pause available in the actual failed-run screenshot; no additional runtime timer or automatic action was introduced.

Focused pacing/preflight/recovery checks passed 28 cases. A compiled-production browser case exercises actual empty wire events, the real shared player and its next purposeful survey, while checking visible controls and preservation of the old committed strip as history. The browser test also exposed two shared-player gaps: its diagnostic reply reused the last old caption, and an empty proposal exchange stopped immediately. The repaired player selects only newly finalized eligible reports; an explicitly empty exchange with no new Pip report may use the existing bounded proposal recovery. Partial, wrong-chapter and unsafe responses do not gain that exception. The failing-first logs and screenshot/context remain in `.validation/goal-005-empty-reply-*` and `.validation/goal-005-empty-action-before.log`; initial fixture failures concerned locator/mode assumptions and are retained separately. These constructed results do not establish that a subsequent real provider answer will be useful. The short final-return utterances and all game/runtime authority remain unchanged from attempt 8.

### Fourth Goal 005 Voice attempt — functional home, post-home harness failure

Aggregate attempt 9 used clean frozen commit `dd916335b0314dbbca1de22a391a560101f678c5`, after typecheck, 426 unit tests, production build, all 142 compiled-browser tests, whitespace checks and the fresh-context production Practice check passed. The compiled application runtime remained `172f9a5da49507899fe4146af8646bcc948e803c4639510ea1e3ceb2b32fa8ee`; the repaired harness SHA-256 was `f5a6b8a66fc7bdec1701532844962d5e0a53ab3d416a3b31b71638bd5d785494`. [Attempt 9 identity, accounting and preservation receipt](../artifacts/goal-005/live/attempt-09-accounting.json).

This ordinary sample achieved **verified functional home**. Its communicated route was Ring → Fork → Sail → Fork → Leaf → Return Dock, including backtracking. Turn 10 again received an empty completed reply; turn 11 used the existing purposeful passage clarification and obtained a new clear-passage report. The final capsule inspection and return proposal succeeded, and the exact owner-confirmation action committed the authorized return. All 11 UI confirmations matched 11 unique physical commits in both directions. The visible `You brought Pip home.` checkpoint was observed at browser time 638,040.5 ms. The original `failure.png` also visibly shows the confirmed-home debrief; its [byte-identical labelled export](../artifacts/goal-005/live/attempt-09-observed-home.png) was inspected.

The automated run nevertheless remained failed. After home, the harness entered a next-input wait as the session ended and reported `QA pre-submit stopped: session_ended`. Raw `report.json` retains `completion: false`, that exact failure, and the original `review_required` behavior result. The durable reservation result also remains failed. The observed home is separate evidence of functional completion; it does **not** convert this run into an automated acceptance pass or a pass on the final repaired harness. The final visible home utterance was marked interrupted/incomplete and is retained with that provenance. [Actual conversation](../artifacts/goal-005/live/2026-09-29T10-04-30-971Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T10-04-30-971Z-voice-mission-metrics.json).

| Observed measure | Fourth sample result |
| --- | --- |
| Token requests / provider sockets / synthetic turns | 1 / 1 / 28 |
| Exact UI confirmations / physical commits | 11 / 11; final authorized return committed |
| Functional home / automated acceptance | Verified / failed after home |
| Local socket-open to remote ACK | 645.8466 seconds |
| Provider-reported session duration | 645.664858 seconds |
| Ending and cleanup | Explicit end and remote ACK; clean socket close; zero audio resources and supervisor survivors; browser/server closure observed |
| Goal 005 consumed after this result | 4 slots, 3,880 reserved seconds, USD 4.85 estimated |
| Same-batch capacity remaining | 4 slots, 3,880 reserved seconds, USD 4.85 estimated |

Aggregate linked accounting is now nine attempts and nine production admissions, 7,230 reserved seconds and USD 9.0375 estimated. No account-refusal stop was recorded. The failed automated result consumes its slot without refund. All 15 historical accounting/cleanup journals, 65 checked raw/accounting files and nine prior-attempt compact evidence files were preserved. Synthetic microphone input, real ASR and nonzero digital playback were observed; physical-device and human-play claims remain unchanged.

The raw run remains local at `.validation/goal-004c-live/2026-09-29T10-04-30-971Z-voice-mission/`. Its immutable manifest is `.validation/goal-004c-live/goal-005-attempt-9-dd916335b0314dbbca1de22a391a560101f678c5.json`; its clean validation receipt is `.validation/goal-005-offline/dd916335b0314dbbca1de22a391a560101f678c5-2026-09-29T10-00-02-711Z.json`. The empty-response recovery and authorized return now have functional Live evidence. The post-home harness failure motivated the following offline repair.

The existing compiled-browser case was extended to reproduce the actual shared player's post-home `session_ended` failure. The repaired player skips the next-input wait only when the expected terminal Return action is committed and home is visible. The unchanged waiter still rejects an ended session in other cases; application runtime and driver ACK/cleanup checks are unchanged. The focused browser case passed in 33.3 seconds, with typecheck and whitespace checks also passing. Failing-first and repaired logs remain at `.validation/goal-005-terminal-wait-before.log` and `.validation/goal-005-terminal-wait-after.log`. This offline repair does not rewrite attempt 9 or establish a fresh final-harness Live pass.

After the fourth sample, Goal 005 had one verified functional home, four recorded failed automated runs and zero of the two required final-harness acceptance passes, with four slots remaining.

### Fifth Goal 005 Voice attempt — fresh Ring reports missed by the player

Aggregate attempt 10 used clean frozen commit `78fa583af5a4c17c7eda53ae07873deacaf46836`, after typecheck, 426 unit tests, production build, all 142 compiled-browser tests, whitespace checks and the fresh-context production Practice check passed. The application runtime remained `172f9a5da49507899fe4146af8646bcc948e803c4639510ea1e3ceb2b32fa8ee`; the harness SHA-256 was `44162d461b65b96f1fc652dc8331c1ca9b38f5bb2ee800fdf4251f84409b5185`. [Attempt 10 identity, accounting and preservation receipt](../artifacts/goal-005/live/attempt-10-accounting.json).

This ordinary sample crossed Cargo after two exact confirmations, then failed Gallery location acquisition. The visible, finalized seventh-turn reply said “I am in the Ring room.” The eighth said “The emblem beside me is the Ring.” Both were fresh current-location statements, but the shared player still recorded `needs_fresh_report`. The ninth exchange produced no new visible Pip reply; the tenth reported a sensor error. After four purposeful exchanges, the player stopped with `QA current Gallery location remained unknown after 4 purposeful exchanges.` This failure includes a player recognition defect; it is not evidence that Pip never supplied the location. The coarse behavior evaluator reported `pass`, which does not establish a mission or acceptance pass. A narrow parser repair is pending; no completed fix is claimed here. [Actual conversation](../artifacts/goal-005/live/2026-09-29T10-24-48-370Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T10-24-48-370Z-voice-mission-metrics.json).

| Observed measure | Fifth sample result |
| --- | --- |
| Token requests / provider sockets / synthetic turns | 1 / 1 / 10 |
| Exact UI confirmations / physical commits | 2 / 2; matching receipts in both directions |
| Local socket-open to remote ACK | 183.3817 seconds |
| Provider-reported session duration | 183.183735 seconds |
| Ending and cleanup | Explicit end and remote ACK; clean socket close; zero audio resources and supervisor survivors; browser/server closure observed |
| Goal 005 consumed after this result | 5 slots, 4,850 reserved seconds, USD 6.0625 estimated |
| Same-batch capacity remaining | 3 slots, 2,910 reserved seconds, USD 3.6375 estimated |

Aggregate linked accounting is now ten attempts and ten production admissions, 8,200 reserved seconds and USD 10.25 estimated. **The approved USD 10 ceiling applies to the additional Goal 005 batch**, whose consumed reservation estimate is USD 6.0625; the aggregate also includes USD 4.1875 of historical reservations. These are reservation estimates, not invoices or a refreshed account balance. No permanent account-refusal stop was recorded. No slot was refunded. All 15 historical accounting/cleanup journals, 76 checked raw/accounting files and 13 prior compact evidence files were preserved.

Raw evidence remains local at `.validation/goal-004c-live/2026-09-29T10-24-48-370Z-voice-mission/`. The immutable manifest is `.validation/goal-004c-live/goal-005-attempt-10-78fa583af5a4c17c7eda53ae07873deacaf46836.json`; the clean validation receipt is `.validation/goal-005-offline/78fa583af5a4c17c7eda53ae07873deacaf46836-2026-09-29T10-20-34-926Z.json`.

After the fifth sample, Goal 005 had one verified functional home from attempt 9, five recorded failed automated runs and zero of the two required final-harness acceptance passes, with three slots remaining. That sample did not reach Return Dock or home.

### Current-room language and initial arrival repair

The two retained Ring replies failed before the repair in direct policy and scoped-memory tests. Location interpretation now supports present self-location in a named room/chamber and an emblem, symbol or mark qualified as local to the speaker. It still rejects historical destinations, next-room statements, other speakers, alternatives, uncertainty and negation; unrelated gate uncertainty does not erase a clear location. Focused checks passed 48 cases, including stale/partial/interrupted/history and wrong-scope exclusions. Local logs are `.validation/goal-005-location-grammar-before.log` and `goal-005-location-grammar-after.log`.

The initial arrival was also processed before the player had read the visible atlas labels. The player now reads those rendered human labels before first consuming Gallery reports. It does not clear history eligibility, reprocess stale reports or obtain a location from the map. A failing-first compiled-browser probe checks that the already communicated Ring arrival leads directly to a gate inspection rather than an unnecessary location survey. Existing A/B full-player cases exercise the new natural wording and continued recovery. The first updated browser run retained fixture failures: an obsolete wording assertion and a redundant click on an already selected Relay. No runtime, tool protocol, speech fixture or paid service changes are part of this repair.

The corrected compiled arrival and A/B shared-player cases passed 3/3 in 25.2 seconds; typecheck and whitespace checks passed. Final focused logs are `.validation/goal-005-location-browser-final.log` and `goal-005-location-grammar-final.log`. No real attempt was open during these changes.

### Sixth Goal 005 Voice attempt — home reached, remote ending unconfirmed

Aggregate attempt 11 used clean frozen commit `cc3537bf9c3a49381986e79e5bfc4205ac1ec3e8`, after typecheck, 428 unit tests, production build, all 142 compiled-browser tests, whitespace checks and the fresh-context production Practice check passed. The application runtime remained `172f9a5da49507899fe4146af8646bcc948e803c4639510ea1e3ceb2b32fa8ee`; the harness SHA-256 was `aa4606c1242bca540284c4b9f1d9db33a44a1188a6579127b53522fa81d643fd`. [Attempt 11 identity, accounting, preservation and lease audit](../artifacts/goal-005/live/attempt-11-accounting.json).

This ordinary sample reached functional home after 34 synthetic turns and 11 exactly confirmed, unique physical commits. The final authorized return committed, and the `You brought Pip home.` checkpoint appeared at browser time 872,670.4 ms. The [byte-identical home screenshot](../artifacts/goal-005/live/attempt-11-observed-home.png) was inspected. Raw `completion: true` is preserved.

The automated run still failed with `page.waitForFunction: Timeout 12000ms exceeded.` Explicit `session.end` was observed, but **no `session.ended` ACK or provider duration was received**. The browser later reported a clean socket close with code 1005 during local fallback closure. The 883.0585 seconds recorded in this case measure local socket-open to close; they are neither acknowledged remote duration nor confirmed billing duration. The last observed peer event was 879.6824 seconds after opening. Browser/server closure, zero audio resources and zero supervisor survivors establish local cleanup only. They do not establish remote termination or indefinite continued billing. The raw missing-ACK result and `review_required` behavior report remain unchanged. [Actual conversation](../artifacts/goal-005/live/2026-09-29T10-39-24-021Z-voice-mission-conversation.md) and [compact metrics](../artifacts/goal-005/live/2026-09-29T10-39-24-021Z-voice-mission-metrics.json).

| Observed measure | Sixth sample result |
| --- | --- |
| Token requests / provider sockets / synthetic turns | 1 / 1 / 34 |
| Exact UI confirmations / physical commits | 11 / 11; final authorized return committed |
| Functional home / automated acceptance | Verified / failed |
| Local socket-open to close | 883.0585 seconds; remote/billing duration unconfirmed |
| Explicit end / remote ACK | Sent / **not observed** |
| Local cleanup | Zero audio resources and supervisor survivors; browser/server closure observed |
| Goal 005 consumed after this result | 6 slots, 5,820 reserved seconds, USD 7.275 estimated |
| Same-batch capacity remaining | 2 slots, 1,940 reserved seconds, USD 2.425 estimated |

Missing ACK retained the full conservative leases despite local cleanup. The supervisor lease ended at **2026-09-29 10:55:36.475 UTC**; the production admission lease ended 19 ms later at **10:55:36.494 UTC**. Independent read-only checks confirmed that the pure sequence guard rejects immediately before its expiry, and production admission remains busy immediately before its later expiry. The ACK-based early-release exemption remains false. Both time boundaries had elapsed when the audit finished; expiration removes only that waiting restriction, without confirming remote end, refunding capacity or replacing clean frozen-candidate and supervisor checks.

Aggregate linked accounting is now eleven attempts and eleven production admissions, 9,170 reserved seconds and USD 11.4625 estimated, including the USD 4.1875 historical reservations. The additional Goal 005 batch remains at USD 7.275 of its USD 10 ceiling. No permanent account-refusal stop was recorded. All 15 historical accounting/cleanup journals, 89 checked raw/accounting files and 16 prior compact evidence files were preserved.

Raw evidence remains local at `.validation/goal-004c-live/2026-09-29T10-39-24-021Z-voice-mission/`. The immutable manifest is `.validation/goal-004c-live/goal-005-attempt-11-cc3537bf9c3a49381986e79e5bfc4205ac1ec3e8.json`; the clean validation receipt is `.validation/goal-005-offline/cc3537bf9c3a49381986e79e5bfc4205ac1ec3e8-2026-09-29T10-34-55-314Z.json`.

After the sixth sample, Goal 005 had two verified functional homes (attempts 9 and 11), six recorded failed automated runs and zero of the two required final-harness acceptance passes, with two slots remaining. Attempt 11 has no `REMOTE_END_CONFIRMED` result.

### Current-handle grounding and bounded ending hardening

Attempt 11 correctly consumed all Gallery arrivals without extra location surveys. Five first gate inspections nevertheless returned `precondition_failed`; each was followed by a fresh survey with another permission question and then a successful inspection. Those five rejected-inspection/survey pairs occupied 199.3652 seconds. There was one ASR final per input, no split-input cancellation pattern, and all 32 calls received results. The omitted tool arguments prevent identifying the exact invalid identifier; the data does not prove a provider or transport cause.

The system decision context already carried eligible local handles, but the one-shot arrival instruction said to use its facts while omitting those handles. Both documented paths now retain the same dispatch-validated current gate handles, marked for tool arguments only and never spoken. Stale observations and their handles remain omitted. This is a consistency/grounding hypothesis, not proof of provider ingestion or persistence beyond a one-shot reply. The failing-first acknowledgement check and 20 passing repaired checks are retained in `.validation/goal-005-arrival-handles-{before,after}.log`.

The official [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration) and [message sequence](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/message-sequence) describe an ending ACK before normal socket closure, without a numeric ACK deadline. Attempt 11's handler had no reproduced ACK-processing defect: it continued receiving farewell events, then its five-second local fallback closed the connection. The driver's twelve-second observation could not recover an ACK after that listener/socket was gone. The bounded ending-policy hardening below was verified offline before the final pair; it cannot establish that the missing historical ACK existed.

The client now observes ending for up to ten seconds, clamped to the original monotonic socket-created 600/900-second deadline. Microphone, playback and tools still stop immediately, and only one End is sent. Constructed tests cover a six-second ACK, no ACK with hung cancellation, repeated End, oversized injected grace, and manual/automatic ending at both caps. The focused lifecycle/voice suite passed 87 checks after the failing baseline. This is a local bounded policy, not a provider latency guarantee.

The driver observes at most twenty seconds after home (the existing eight-second closing phase plus ten-second End window and processing margin), or twelve seconds after explicit Pause. Either ACK or socket closure finishes observation; closure without ACK remains a failed independent final audit. Fourteen focused lifecycle/pacing checks passed, including a fourteen-second home-to-ACK sequence, prompt unacknowledged closure, and finite absence of both events. The original 900-second supervisor and 970-second accounting reservation are unchanged. The combined arrival browser checks passed 2/2 and their rendered screenshot was inspected; no spoken identifiers or human projection leak appeared in the constructed peer. The 87-case and 14-case focused results were captured in tool output only; no separate saved log path is claimed for them.

### Final frozen validation and the seventh/eighth Goal 005 samples

Clean commit `2edf7914a008143843923b04a9bf3a1fe41f1f68` then passed the full offline release: 437 unit tests, 142 compiled-browser cases, typecheck, production build, whitespace and fresh-context production Practice. The exact [copied receipt](../artifacts/goal-005/live/final-offline-validation.json) matches `.validation/goal-005-offline/2edf7914a008143843923b04a9bf3a1fe41f1f68-2026-09-29T11-06-05-085Z.json`. Both final attempts used runtime `bf8fe9ef044561064164cf537380559d1a5e92d06f290399d20c472cae6fa401`, harness `d29a380dc055da2a2bcd6012d652f154a6133b3c3a6dea307f32fcfd6e9bd486`, speech fixtures `d144ff1bc96bf34f0721d93ce6e93e3cf24c5290a019fec1cf68642461744bf7` and exact `session.update` hash `f24d678be5f5fb0b2b96649e5be160cafbf1bc9a8031544f9df45d01782e8f24`.

| Measure | Attempt 12: ordinary | Attempt 13: deliberate recovery |
| --- | --- | --- |
| Automated outcome | **Passed** | **Failed** |
| Functional home | Yes | No; stopped in Relay Gallery |
| Synthetic turns | 28 | 23 |
| Exact confirmations / unique physical commits | 11 / 11 | 5 / 5 |
| Local observed duration | 577.2133 seconds to ending ACK | 567.4462 seconds to local socket close |
| Provider-reported duration | 576.923132 seconds | Unknown; no ACK |
| Explicit End / remote ACK | Sent / observed | Sent / not observed |
| Audio resources / supervisor survivors after cleanup | 0 / 0 | 0 / 0 |
| Browser and server closure | Observed | Observed |

Attempt 12 crossed Cargo, navigated Gallery with recovery and backtracking, completed Dock, and committed the final authorized return. Its home checkpoint appeared at browser time 574,384.8 ms; [the actual home screenshot](../artifacts/goal-005/live/attempt-12-observed-home.png) was inspected. The final return needed a capsule-inspection clarification and a rephrased proposal request, then completed through the exact UI confirmation. Real ASR and nonzero synthetic input, provider, rendered and post-volume digital audio were observed. The behavior audit passed, the remote ending ACK was received, and the durable supervisor result is `passed`. This is one synthetic Voice Rescue pass, not a human-play or statistical-reliability claim. [Conversation](../artifacts/goal-005/live/2026-09-29T11-10-24-116Z-voice-mission-conversation.md), [metrics](../artifacts/goal-005/live/2026-09-29T11-10-24-116Z-voice-mission-metrics.json), [accounting](../artifacts/goal-005/live/attempt-12-accounting.json).

Attempt 13 deliberately declined the first exact Latch proposal using **Not yet**. That proposal produced no physical commit. A fresh spoken request produced a different matching proposal, which was confirmed and committed. This local recovery exercise succeeded, but the mission later stopped after returning to Fork. The first southeast-passage request failed inspection; the second described an open gate without confirming a clear passage. The third inspection produced a successful tool result, but its normal spoken answer had not arrived when the 120-second subgoal expired. A clear-passage answer arrived only after explicit End and was not consumed for navigation or retroactively counted as recovery. The final failure remains `QA fork southeast passage recovery exceeded 120 seconds.` [The actual failure screenshot](../artifacts/goal-005/live/attempt-13-observed-failure.png), [conversation](../artifacts/goal-005/live/2026-09-29T11-21-06-378Z-voice-mission-conversation.md), [metrics](../artifacts/goal-005/live/2026-09-29T11-21-06-378Z-voice-mission-metrics.json), [accounting](../artifacts/goal-005/live/attempt-13-accounting.json) and [independent review](../artifacts/goal-005/live/attempt-13-independent-review.json) preserve the result.

The independent review found four first-inspection failures across four Gallery arrivals. Growing ASR-final and tool-continuation delays were also observed, without evidence sufficient to assign a browser, network, model or provider cause. Asking for opaque gate labels and asking permission for already-requested read-only checks remain conversational shortcomings. All five committed actions had exact confirmations; no unsupported execution or unconfirmed physical mutation was observed. Those safety results do not establish mission completion.

Attempt 13 sent one explicit End, then closed locally with code 1005 after the bounded fallback. No `session.ended` ACK arrived and provider duration remains null. Local cleanup is confirmed; remote termination and billing duration are not. Its supervisor lease expired at **2026-09-29 11:37:18.900 UTC** and the production lease at **11:37:18.921 UTC**. The [final audit](../artifacts/goal-005/live/final-accounting.json), performed at **11:42:34.087 UTC**, confirmed both expiries and read-only production admission rejection for exhaustion. Expiry cannot produce an ACK or restore capacity: **all eight Goal 005 slots are consumed, so every further attempt is blocked regardless of lease time**. No real call, funding initialization or retry follows this failed final sample.

The original directories are `.validation/goal-004c-live/2026-09-29T11-10-24-116Z-voice-mission/` and `.validation/goal-004c-live/2026-09-29T11-21-06-378Z-voice-mission/`. Their immutable manifests are `goal-005-attempt-12-2edf7914a008143843923b04a9bf3a1fe41f1f68.json` and `goal-005-attempt-13-2edf7914a008143843923b04a9bf3a1fe41f1f68.json` in the original campaign directory. Original reports, captions, browser recordings, audio and ledgers are retained unchanged. The final preservation receipt lists authorized rebuilt `dist/` differences separately from unchanged historical evidence, without silently excluding baseline paths.

## Delivery checklist

- The next [CI run 36564347209](https://github.com/catlover-bot/talk-me-home/actions/runs/36564347209) exposed a nondeterministic unit fixture: the hidden-configuration projection comparison called two surveys across a one-millisecond clock boundary. All fields matched except `observedAt`; 436 unit cases passed and this one failed in that job. The existing `robotView` timestamp parameter now gives both compared surveys the same explicit observation time. Full projection equality remains, with an additional timestamp assertion. All 21 focused Rescue state tests and typecheck passed. Logs remain in `.validation/goal-005/final-ci-second-unit-failure.log` and `ci-clock-fixture-final.log`. No runtime, shared-player or speech-fixture bytes changed.
- The first pushed delivery head `b24ece7d7a5fd1859835abc701cb728d971bd550` ran [CI 36563597245](https://github.com/catlover-bot/talk-me-home/actions/runs/36563597245). The 1280px job passed; the 1440px browser job reached 62 passed cases, then the suite's 210-second global deadline stopped nine unrun cases. No individual failed assertion was reported. The log remains in `.validation/goal-005/final-ci-first-failure.log`. CI now splits each existing viewport into two shards while retaining every test, individual deadlines, the 210-second suite cap and four-minute step cap. Runtime, shared player and speech fixtures are unchanged. This execution-capacity repair is separate from the failed real Voice recovery.
- Full offline validation and all eight authorized Goal 005 attempts are complete; the two-pass Live acceptance target was not met. No additional provider use is authorized by the exhausted batch.
- Current local media, provenance, public availability and remaining owner-only decisions are listed in the [submission checklist](../submission/release-checklist.md) and [OWNER_ACTIONS](../OWNER_ACTIONS.md). Older Goal 001–004 reports and media remain historical records.
- The frozen execution identity above is separate from the final documentation/media delivery commit. Consult the final handoff and local `.validation/goal-005/final-ci.json` for that exact delivery SHA and CI result; [feature-branch workflow runs](https://github.com/catlover-bot/talk-me-home/actions?query=branch%3Awork%2Fgoal-005-gallery-live-completion) provide the remote record. No final CI pass is inferred from local validation.
