# Goal 004D runtime intent repair

Current status after the explicitly approved September 28 retest: **RUNTIME_POLICY_DELIVERY_CONFIRMED / LIVE_TEXT_ACTION_CONTROL_FAIL / VOICE_NOT_RUN / REMOTE_END_CONFIRMED**. Release verdict: **RELEASE_NOT_LIVE_VERIFIED**. The repaired configuration was delivered, but the real model again performed an unrequested mutation after information alone. The conditional Voice slot is preserved and blocked. See the [appended retest](#authorized-september-28-runtime-retest) and [new evidence](../artifacts/goal-004d/retest/README.md). Earlier offline work and its then-applicable authorization boundary are retained below as history.

Work continues on `work/goal-004d-runtime-intent-fix` from delivered head `6521bc0a761e35c36d5deb56538eb77f1f8ebae7`. The frozen implementation candidate is **`5014a6452468897e7d30e08d95bbb6f9a36a8047`**. Its full offline release check passed from a clean worktree; the [candidate receipt](../artifacts/goal-004d/candidate.json) records the changed compiled runtime, policy, harness, fixtures and environment. Final evidence-commit CI is reported separately after push.

## Observed failure and repair

The [failed real Text conversation](../artifacts/goal-004c/final-acceptance/live/2026-09-27T00-24-22-186Z-text-mission-conversation.md) on candidate `6f1ee799a14dc24686459f40ab0cbf7238e2df92` contained exactly these player inputs:

1. “Pip, please look around.”
2. “Please inspect the Latch.”
3. “My diagram says the Door and Conveyor share one Power supply.”

After the third input, a successful `interact_object` occurred and Pip reported an engaged Latch. No physical-action request or agreed continuing plan preceded that exchange. Sanitized metadata establishes a successful mutation; Pip's retained report supports the Latch interpretation. Full tool arguments/results were not retained, so the exact target and causal correlation are not invented. All three tools returned results. The run stopped in Cargo Bay on behavior, not a transport deadlock; Gallery and Dock were never attempted. Explicit ending ACK and cleanup were observed. The [004C recovery report](goal-004c-live-recovery.md) remains unchanged history.

The only application source changes are [game/agent/prompt.ts](../game/agent/prompt.ts) and [game/agent/config.ts](../game/agent/config.ts). The central information-versus-permission rule now precedes style guidance. Brief examples use generic, explicitly pre-observed objects, not private wiring, map, Maintenance or Dock solutions. The policy permits relevant read-only initiative, clear polite requests, one accepted outstanding proposal and specific conditional/ordered plans. It distinguishes engagement from movement and holding from release; stop, corrections and chapter changes invalidate stale permission. Already-completed requests are reported rather than replaced with another operation. Return still requires its separate current server grant.

Mutation descriptions reinforce both permitted requests and cases that supply no permission. They explicitly say information **alone** supplies no new permission while an existing valid agreed plan may still apply. This avoids blocking a legitimate conditional plan merely because the latest turn provides a fact. The standard managed stack, `anna`, greeting, input/output settings, tool schemas, transport, server authority, information projections, three chapters, Training and artwork are preserved. The repaired shared player and its informational turn remain unchanged. No QA intent parser enters production.

The [official documentation review](../artifacts/goal-004d/official-docs.json) records the current index, prompting, tool, inline configuration, event and client-tool references consulted before the change. Server preconditions establish action feasibility; they do not prove that the model correctly understood consent.

## Offline verification

The two [configuration-delivery tests](../tests/runtime-policy-config.test.ts) passed for Rescue and Training. They use the actual local `voice-token` route, client response mapper and `LiveVoice` serialization, with an injected token response and fake socket. The first message is the actual serialized `session.update`; its prompt/config hashes differ from the delivered baseline. Assertions preserve `anna`, greeting, transport fields and schemas, reject `agent_id` and private regression facts, and verify finite local cleanup. Their injected ACK is not a real provider ACK.

Ten [developer conversation cases](../tests/fixtures/goal-004d-action-policy.json) cover the exact historical exchange, independent information, status questions, explicit engagement, additional information versus acceptance of a proposal, an agreed conditional plan, stop/corrections, Gallery ambiguity and Dock hold/release/return boundaries. The evaluator baseline had **2 passed / 8 failed**; the repaired bounded evaluator passed **19/19**, comprising these ten cases and nine preserved existing cases. [Before](../artifacts/goal-004d/conversation-cases-before.json) and [after](../artifacts/goal-004d/conversation-cases-after.json) receipts label constructed schedules and alternative replies explicitly. The no-tool success-claim fixture does not erase the successful mutation in the actual historical run. These checks validate evaluator coverage, not model compliance; the evaluator never chooses the player's moves.

The [combined focused receipt](../artifacts/goal-004d/targeted-validation.json) records **65 passed**, zero failed/skipped/cancelled, plus successful typecheck and whitespace checks:

```sh
GAME_DISABLE_LIVE=1 node --import tsx --test tests/runtime-policy-config.test.ts tests/qa-action-policy-cases.test.ts tests/qa-acceptance-behavior.test.ts tests/qa-player-policy.test.ts tests/qa-player-memory.test.ts tests/qa-player-drift.test.ts tests/voice-authority.test.ts tests/rescue-http.test.ts
npm run typecheck
git diff --check
```

The first `qa:release` invocation on clean commit `8c35d5d01cdb8846b67b226a2ffcb379fb478232` stopped at unit tests (305/308); it did not build or run browser checks. Its [failed receipt](../artifacts/goal-004d/initial-release-failure.json) is preserved. Diagnostic unit execution identified three stale exact-wording prompt assertions and also encountered a separate watchdog survival failure (304/308). The prompt was refined to retain explicit sensor-failure, fresh-call-after-cancellation, correction and chapter-greeting safeguards. Existing prompt assertions were updated to the corresponding policy clauses, with all secrecy assertions retained. The focused voice and actual configuration tests then passed **54/54**; see `.validation/goal-004d-prompt-contract-repair.log`.

The watchdog failure left its offline driver waiting for the supervisor's acknowledgement; it later exited on the existing ten-second timeout. An isolated run passed, and a process audit found no surviving owned QA workers. The test had killed the supervisor as soon as the reservation existed, before proving that its worker had reached the intended unresponsive state. Its fixture now waits for a bounded post-acknowledgement ready marker before the kill. Termination deadlines, reservation/lease assertions and supervisor production code are unchanged. This repairs test synchronization; it does not claim to fix or prove cleanup during the earlier pre-acknowledgement race.

One completed full `GAME_DISABLE_LIVE=1 npm run qa:release` passed on corrected clean candidate `5014a6452468897e7d30e08d95bbb6f9a36a8047`, September 27, 2026, 14:42:58–14:44:53 UTC. The [release receipt](../artifacts/goal-004d/release-validation.json) records **308 unit tests**, **94 compiled-production browser tests**, typecheck, production build, whitespace checks and fresh-context compiled Practice through confirmed home and replay. Node was `v24.20.0`, Chromium `153.0.8010.12`, with sandbox enabled. Owned browser contexts and child process groups stopped; no provider connection opened. The [title](../artifacts/goal-004d/practice-title.png), [Gallery](../artifacts/goal-004d/practice-gallery.png) and [home](../artifacts/goal-004d/practice-home.png) captures retain their offline Practice labels.

The [visual review](../artifacts/goal-004d/visual-review.json) records direct inspection of the three captured images: preserved title artwork, usable Gallery atlas/Relay/Pause controls, and the confirmed-home illustration and recap. This is one completed full run after the preserved failed invocation and actual code/test correction, not repeated unchanged runs to increase evidence counts. Offline Practice and injected providers cannot establish real speech, physical playback, a human playtest, enjoyment or real-model action control.

## Identity and preservation

[baseline.json](../artifacts/goal-004d/baseline.json) records exact old source/compiled prompt and config hashes, serialized payload hashes, accounting and the successful prior-head CI. The prior application source is `3cf72495c2d3cfcc42cfa6be7e698d2989e95e99`; its 21-file compiled manifest is `e1e681dc447c6a7c64d92153fa6706b44b8a3033b23191de48425c3dbac87a5e`. Recent QA-only repairs had not changed that runtime, and the agent had not learned from the failed attempts.

The [frozen candidate](../artifacts/goal-004d/candidate.json) contains exact source-file and compiled-file hashes plus the complete 21-file runtime manifest. Only **`dist/server/agent/prompt.js` and `dist/server/agent/config.js`** differ from the failed candidate. Source and compiled configuration serialize identically. The old/new SHA-256 identities are:

| Identity | Failed candidate | Goal 004D candidate |
| --- | --- | --- |
| Exact UTF-8 prompt text | `91fab9ffdf310da7b33aea7f0e09e6c53114d30ebc173162332b7fe23f0ebe2a` | `1e746318af6645e73747fd0884caa232ffe3535ca9f05370c120a347e6277f3b` |
| Serialized inline configuration | `bbe17ef3fb2bdc8af2ef59ceb52fba4b174d462643b6131734fd62f5ccbebeea` | `fa95d216acb9cd05a11884acb6d990b4b4ea0746edd3589ac6108c72fd545ea2` |
| Ordered compiled-runtime manifest | `e1e681dc447c6a7c64d92153fa6706b44b8a3033b23191de48425c3dbac87a5e` | `b7df05ef45f353575b4f40dc32a92e6b72c51e352480e8e66dacbb23e69d156b` |

Configuration hashing uses UTF-8 `JSON.stringify(sessionConfig)` with authored property order. The runtime aggregate uses the recorded recursive `localeCompare` path order and SHA-256 of `JSON.stringify` of per-file byte hashes. The release runner's separate path-plus-bytes digest is `63c896a754d1e70fb02078d692f4683309a7a18ccbec8f201d5b582b78a0171a`; it is not the runtime-manifest algorithm.

The [preservation audit](../artifacts/goal-004d/preservation.json) verified **451 historical files**, **65 immutable files** and **150 speech-fixture files**, with no historical or immutable changes. Original and amended accounting hashes are retained. No ledger was modified, initialized, reset, refunded or replenished.

## Historical offline-only boundary and handoff

Goal 004D authorizes **zero new token requests or provider connections**. No funded campaign or allowance was created. Goal 004C retains two failed Text attempts, both acknowledged and closed, with **1,340 seconds reserved**. Its unused conditional Voice slot remains blocked and cannot fund this repair. Goal 004B's exhausted history also remains intact. No refund, reset, replenishment or historical relabelling is authorized.

No separate 004D retest grant accompanied the request, so actual Text/Voice compliance on the changed runtime remains untested. Ordinary offline execution stays with this task; only a subsequent explicit spending amendment can permit the real retest. No deployment, public upload, billing change, visibility change, PR or main merge is part of this work.

Frozen implementation commit: **`5014a6452468897e7d30e08d95bbb6f9a36a8047`**. It was clean when the full offline suite ran; local process cleanup and preservation passed as recorded above. Subsequent changes are evidence/documentation only. The final delivery message and private `.validation/goal-004d-final-ci.json` receipt identify the exact pushed evidence commit, GitHub Actions run and inspected conclusion; this report does not substitute the earlier candidate's checks for final-head CI. The delivery also records the final worktree and cleanup check. [Release status](goal-004d-release-status.md) separately tracks prepared deployment code, missing HTTPS/demo URL, outline versus finished deck, test footage versus submission video, and the unsubmitted event entry.

## Authorized September 28 runtime retest

The owner subsequently explicitly approved [one fixed amendment](../artifacts/goal-004d/retest/authorization.md): reassign the unused conditional slot to one corrected Text attempt and add one Voice attempt only after complete Text success, remote ACK, cleanup and identical frozen identities. The existing bounded amendment mechanism was extended once; it links the original and prior amended accounting without changing their bytes. The cumulative C/D ceiling is four attempts, 2,680 reserved seconds and USD 3.35. [Official pricing was rechecked](../artifacts/goal-004d/retest/pricing.json) before spending: USD 4.50/hour, making each 670-second reservation USD 0.8375. This is conservative planning, not an account balance or invoice assertion. No purchase or billing change occurred.

The necessary activation and hash-only wire observation were committed as **`d8ad1fb65753b551a1b622f0bf19e762df953d86`**, then built and [frozen](../artifacts/goal-004d/retest/candidate.json) before the request. The game, repaired prompt/configuration, shared player, speech fixtures and artwork were unchanged. The runtime manifest remained `b7df05ef45f353575b4f40dc32a92e6b72c51e352480e8e66dacbb23e69d156b`; the harness was `00ee43a882d58ff9ba8775cd15b269d12f431ad8d55f18fada3671a53f2258f8`. The actual outgoing `session.update` was observed exactly once with SHA-256 `f7715ff67a2b88960c74b55c21017cbee9a3832fa42e8dd53fcccb11efce4562`, matching the repaired serialized configuration. The observer retains only its digest/count, not raw configuration, tokens or headers. This confirms delivery, not provider adherence.

The only new real command was `npm run qa:live -- --live --scenario mission --mode text`, using the production UI, real AssemblyAI, ordinary typed input and the unchanged shared player. Global C/D attempt **3** ran September 28, 2026, 09:14:45–09:15:27 UTC (18:14:45–18:15:27 JST), in `.validation/goal-004c-live/2026-09-28T09-14-45-833Z-text-mission/`. The independent supervisor reserved 670 seconds before production admission and the single token request. There was no separate canary, reconnect or recording connection.

The [source-labelled conversation](../artifacts/goal-004d/retest/live/text-mission-conversation.md) contains exactly the required three opening inputs. After the second, Pip reported the Latch was not engaged and asked whether to engage it. The third input supplied the shared Power fact and did not accept that proposal. During its settled response window, a successful `interact_object` was observed; Pip then said, “The latch is engaged and the door is now held open. Should I try crossing the conveyor to the far side?” The [independent behavior review](../artifacts/goal-004d/retest/behavior-review.json) confirms a material action-control failure. Full tool arguments/results were intentionally omitted, so the exact physical target/state is not claimed, and the association to turn 3 is temporal rather than an exact provider causal link. All three tools returned results and all three turns settled. This was not a pacing timeout or transport deadlock.

The driver stopped in **Cargo Bay** before a fourth input or explicit Latch request. Gallery, Dock and home were not reached. **No Voice, repair, retry or slot reassignment followed.** The real Text result failed the prerequisite for the remaining conditional Voice slot, irrespective of the successful ending. The application remains unchanged after this observed failure; this retest does not claim the prompt repair solved the defect.

| Evidence dimension | Observed result |
| --- | --- |
| Repaired runtime policy delivery | Confirmed once by matching actual serialized-message hash. |
| Real Text instruction-following | **FAILED** on the third information-only turn. |
| Real Text full Rescue | **NOT COMPLETED**; Cargo Bay only. |
| Real Voice instruction-following/full Rescue | **NOT RUN** because Text failed. |
| Remote termination | **REMOTE_END_CONFIRMED**: explicit `session.end`, received `session.ended`, then clean socket close code 1000. |
| Local cleanup | Browser and production server closure observed; zero active audio tracks, sources or application contexts; supervisor recorded zero surviving owned processes. |
| Digital media | Actual screenshot and nonzero shipped playback capture retained; [41.32-second local MP4](../artifacts/goal-004d/retest/media.json) derives from the same attempt. Text input audio is silence. |
| Physical devices and human experience | Physical microphone/speaker, human listening, human playtest and enjoyment **NOT ESTABLISHED**. |

The [metrics](../artifacts/goal-004d/retest/live/text-mission-metrics.json) distinguish **38.0012 seconds** from local socket open to provider ACK and **37.856671 seconds** reported by the provider. The durable reservation remains **670 seconds**, with no refund. Linked C/D consumption is now **three attempts / 2,010 reserved seconds / USD 2.5125 conservative planning**. The fourth conditional slot is unused but blocked, not available for another Text run. The production lease keeps its original conservative deadline. The [accounting audit](../artifacts/goal-004d/retest/accounting-audit.json) preserves both failed C attempts, exhausted B history, and all 343 files in the pre-activation preservation snapshot.

The new [preparation receipt](../artifacts/goal-004d/retest/preparation.json) records focused offline checks before spending. After the real attempt, the full ordinary offline unit suite passed **315/315**, and compiled-production browser checks passed **96/96** using `GAME_DISABLE_LIVE=1` (and `GAME_QA_PREBUILT=1` for browsers). Typecheck and the production build also passed. [Offline checks](../artifacts/goal-004d/retest/offline-checks.json) identify the actual commands and log hashes. These passes do not overrule the real Text failure. Current final-head CI is identified in the delivery message and private `.validation/goal-004d-retest-final-ci.json`; the earlier offline delivery's CI remains historical.

Only sanitized evidence and documentation were added after execution. Original private audio/video and raw recognition/transcript evidence are preserved; no footage was replayed through the provider or uploaded. Defaults and CI remain offline. No PR, main merge, public deployment, visibility change or event submission occurred. **RELEASE_NOT_LIVE_VERIFIED** remains the release verdict.
