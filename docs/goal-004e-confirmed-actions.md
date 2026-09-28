# Goal 004E — confirmed actions

Work branch: `work/goal-004e-confirmed-actions`, based on delivered Goal 004D head `52d8c6d4cc68d136890ffa4dfb39c4060602ffb0`. The server boundary, UI and offline release verification are delivered. The one authorized real synthetic Voice + UI attempt stopped in Cargo before a crossing proposal. **OFFLINE_REPAIR_PASS / LIVE_VOICE_CONFIRMATION_RESCUE_FAIL / REMOTE_END_CONFIRMED / RELEASE_NOT_LIVE_VERIFIED**. All four linked C/D/E attempts are consumed; no retry remains authorized.

## Deliberate product contract

Previously, model-selected mutation tools executed directly while the runtime prompt tried to infer conversational permission. The [September 28 failed real Text attempt](../artifacts/goal-004d/retest/live/text-mission-conversation.md) shows that the revised configuration did not reliably prevent an unsolicited mutation. Its failed verdict, successful ending ACK and accounting remain unchanged.

The changed product is **voice-led cooperation with explicit on-screen action confirmation**. Pip may observe and inspect immediately, then propose one exact interaction or movement. A proposal has not executed. Only a separate owner-bound Confirm button decision can cause the server to recheck the current conditions and commit that immutable action once. Free-form spoken assent is conversation, not the confirmation channel. Practice and Training use this same boundary.

An unsolicited nonexecuting proposal is permitted under this chosen contract. An unconfirmed physical commit, false claim of execution, proposal spam, contradictory action, inability to complete, or failure to stop is still a defect. Historical ungated attempts remain FAIL; new offline results will not be presented as evidence that those old runs passed. A communicated proposal is not a live equipment reading, and confirmation does not grant access to private maps, notes or hidden state.

## Protocol sources reviewed before integration changes

Reviewed September 28, 2026: the [official documentation index](https://www.assemblyai.com/docs/llms.txt), [client-side tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools), [events reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference), and [inline configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration).

Relevant fields are `tool.call` (`call_id`, `name`, `arguments`), one `tool.result` (`call_id`, JSON-string `result`) at the existing valid `reply.done` boundary, and the inline `session.update.session` configuration without `agent_id`. Proposal creation returns promptly; it never holds the tool request open for a human decision or sends a second result for that completed call.

For verified decision context, the documented `conversation.message` supports `role: system` and `content`; it adds context without itself requesting speech. The separately documented `reply.create.instructions` requests a response. Any such game event must retain its provenance in UI/history and must not be represented as human speech. A read-only proposal-status tool is a recovery path, not an autonomous polling loop. Existing `session.end` and received `session.ended` establish the scoped ending evidence.

## Authorized final-slot boundary

The owner explicitly approved one final synthetic-input Live Voice attempt after complete offline UI regression. It reassigns the existing unused conditional slot without adding capacity or requiring another real Text attempt. Linked C/D/E remains capped at four token attempts, 2,680 reserved seconds and USD 3.35 conservative planning. Actual accounting must be inspected; a used or uncertain request cannot be retried. Each attempted token reserves 670 seconds; the one connection is capped at 600 seconds. Price must be rechecked before spending, with existing balance only.

The same connection must begin with the three historical regression inputs as synthetic microphone speech, with no UI confirmation during that phase. Evaluator-only truth verifies no physical commit without steering the player. The player then requests and deliberately confirms matching actions through Cargo Bay, both applicable Gallery routing rules, and Return Dock to validated home. The route is one naturally selected Gallery variant; both variants require offline coverage. No human text may substitute for speech. Evidence must say **SYNTHETIC VOICE + UI CONFIRMATION**, not hands-free gameplay.

Physical microphone/speaker quality, human listening, human play and enjoyment remain separate and unverified. No public HTTPS service, deployment, billing change, PR, main merge, visibility change or event submission is authorized.

## Implemented boundary and affected paths

`game/server/proposals.ts` owns validated action descriptions and proposal scope. `SessionStore` routes `propose_interaction` / `propose_move` and the legacy `interact_object` / `move_to` names through the same proposal boundary, before the existing physical transition. The owner-only `/proposal-decision` route accepts round/request/proposal identities and a confirm/decline decision; extra operation arguments are rejected. Opaque proposals expire after 90 seconds, with one outstanding action and retained immutable receipts. The server rechecks current physical conditions, ownership, round, chapter, location and lifecycle inside its serialized commit path.

Interrupt, Pause, End, reset and return-grant revocation invalidate pending work. Ordinary speech supersession preserves a pending decision. Revoking and regranting the Dock authorization cannot revive an old proposal. A separate monotonic `proposalRevision` prevents delayed equal-physical-revision snapshots from restoring declined or replaced actions. Confirmation events report only the validated action and outcome: Gallery surveys remain robot-only and do not leak into the human caption or proposal result.

`useMission`, the API client and `ActionProposalStrip` implement native Confirm / Not yet controls without auto-focus or a global key binding. The adapter sends verified decisions as labelled system game context, never as human speech or a second result for the old call. It does not request unsolicited speech with `reply.create`; the existing final-response timeout still closes a confirmed home session if Pip provides no closing reply. `get_action_status` can retrieve the original private robot outcome once if needed. Practice and Training share the production decision endpoint.

The shared QA player matches one exact visible proposal label to its current explicit intent. During the first three information-only turns it never confirms. Physical digests and commit receipts come through evaluator-only parent IPC around the actual compiled production entry point; no oracle state reaches the player, browser projection or provider. The offline observer check verified unchanged physical state before confirmation and one matching commit afterward.

## Current evidence

- [Constructed before replay](../artifacts/goal-004e/before-boundary.json): the delivered Goal 004D server committed an unsolicited Latch mutation with zero confirmations.
- [Constructed after replay](../artifacts/goal-004e/after-boundary.json): no unconfirmed physical change; one exact decision, retries and double-clicks produced one commit. These are deliberately constructed offline calls, not raw real-trace replays.
- [Compiled production observer check](../artifacts/goal-004e/production-observer-check.json): offline IPC evidence remains outside the human projection.
- [Current pricing check](../artifacts/goal-004e/pricing-check.json): the official [pricing page](https://www.assemblyai.com/pricing) still lists USD 4.50/hour. The remaining 670-second reservation plans USD 0.8375 within the unchanged USD 3.35 linked ceiling; no balance or invoice claim is made.

Targeted boundary, ownership, idempotency, ordering, private-survey, client, evidence and financial tests passed during implementation. The final clean execution candidate passed the complete existing release suite: **342 unit tests, 100 browser cases**, typecheck, production build, whitespace and fresh-browser production smoke. It used Node 24.20.0 and sandboxed Linux Chromium 153.0.8010.12; this is not a Windows physical-device measurement. The [offline receipt](../artifacts/goal-004e/offline-validation.json) records the exact candidate, checks and sizes. Final pushed-head CI is checked separately and linked in the delivery report.

### Pre-token preparation failure

The first clean candidate `fae42ae9d9a12e29a3fe9895d1e8f28a09063d0f` passed the full existing release suite: 341 unit tests and 98 browser cases. Its supervised launcher then stopped during local audio-instrumentation setup because that helper did not allow the new explicit evidence label. This was a harness defect before any token request, WebSocket or reservation. The original report, silent local browser video and frozen manifest are preserved; the aggregate ledger still contains exactly three consumed attempts / 2,010 seconds, and the production allowance still contains the same three reservations. No failed request was refunded or removed.

The narrow correction permits the exact synthetic-voice-plus-confirmation label and tests installation offline. The shipped runtime is unchanged. The corrected clean source must pass the full suite again before its execution manifest is frozen at `confirmed-actions-execution-candidate.json`; the earlier `confirmed-actions-candidate.json` remains unchanged as preparation evidence. This changes no slot, accounting limit or retry permission. [Preparation failure receipt](../artifacts/goal-004e/preparation-failure.json).

## Final frozen execution and observed result

Implementation commits are `73250f5` (server/client boundary), `fae42ae` (QA, contract and final-slot guards), and `bb6dfd2` (pre-token evidence-label correction). The actual execution candidate is **`bb6dfd2181503415a14c440c52dd762db88f5e3c`**. Its [manifest](../artifacts/goal-004e/candidate.json) pins all 22 compiled files, 15 harness files, 150 fixture files and the browser binary. Later delivery changes contain evidence and documentation only.

| Identity | SHA-256 |
| --- | --- |
| Shipped runtime | `cacfeef453ca4ad49e6aa3317fd61a77b3a55f4cbfdb8c2eeae95e2ae96ccbce` |
| Executed harness | `1b2b5bee2572c890e9e2ebf30c268a5bd992914fed6f62603e5430efb1347d16` |
| Actual single serialized `session.update` | `7504148459f16110e193f54db94007f82d83d53b9bdb80f5f14829f924104dfc` |

At September 28 10:24 UTC, the sole real E token request reserved the final 670 seconds before issuance. The first three exact historical inputs were delivered as offline-synthesized microphone speech. Real ASR retained their meaning. The initial and third-input physical digests were identical, with zero commits and zero UI confirmations. No false completion claim was detected in those turns.

The explicit fourth input, “Please engage the Latch,” produced one `propose_interaction` result marked `awaiting_confirmation`. The player matched the visible **Engage the Latch** descriptor and confirmed its exact ID. The independent final oracle contains one robot commit, matching that one UI receipt in both directions. The Game event was visibly labelled as application output. All three observed tool calls received one correlated result each; no tool request waited for a human or received a second result.

Continuation then failed. After “Power is now off,” Pip said it should check the proposal status. After “Please cross to the far side,” it asked permission to check that status, but issued neither `get_action_status` nor a movement proposal. The shared player's action-request path expected a pending crossing strip, encountered the old committed Latch strip and stopped before its Cargo clarification path could run. This is a real observed continuation gap and a strict QA-player assumption. It does **not** prove that a human could not recover through further conversation, an ASR defect, an unauthorized mutation, or a pending-tool transport deadlock.

Instrumentation recorded a sent non-user `conversation.message` at 62,205.7 ms, consistent with the pinned adapter's verified-decision notification. The payload and provider ingestion acknowledgement were not retained; the evidence does not establish that the provider consumed or ignored that context. The original narration, including the spoken internal action name `latch_open`, remains unedited in the [conversation](../artifacts/goal-004e/live/2026-09-28T10-24-13-651Z-voice-mission-conversation.md). The narrow behavioral evaluator passed its no-unauthorized-action checks; **the Rescue attempt still failed** and never reached Gallery, Dock or home.

The final reply completed and digital playback drained before the stop. Explicit `session.end` and real `session.ended` were observed exactly once; local open-to-ACK duration was **89.6163 seconds**, provider-reported duration **89.469441 seconds**, with about 293.8 ms end-ACK delay. The socket closed cleanly with code 1000. Application tracks, sources and audio contexts were zero; browser/server closure was observed, and the independent supervisor recorded zero survivors. Acknowledged remote ending is separate from the failed gameplay result.

Linked C/D/E is now **4/4 attempts, 2,680/2,680 reserved seconds, USD 3.35 conservative planning, zero remaining slots**. No seconds were refunded, no ledger reset or replenishment occurred, and the preceding three failed results remain unchanged. The pre-token preparation failure consumed no request or reservation. [Final accounting](../artifacts/goal-004e/live/campaign-summary.json).

## Visual evidence, interaction cost and remaining scope

The actual production Practice [pending](../artifacts/goal-004e/screenshots/action-pending.png), [declined](../artifacts/goal-004e/screenshots/action-declined.png), [committed](../artifacts/goal-004e/screenshots/action-confirmed.png) and [home](../artifacts/goal-004e/screenshots/home.png) screenshots show the delivered controls and ending. [1280 Presentation](../artifacts/goal-004e/screenshots/pending-presentation-1280.png) and [1440 Presentation](../artifacts/goal-004e/screenshots/pending-presentation-1440.png) are clearly labelled constructed offline peers. The [real Voice stop](../artifacts/goal-004e/screenshots/live-voice-cargo-stop.png) is a failed Cargo capture, never a completed Rescue image. These renders were visually inspected.

The shared player used **9 confirmations** on the ordinary route and **11** with Gallery backtracking. The final production Practice smoke used 9, plus one deliberate decline. Both Gallery variants, backtracking, Classic and Maintenance Training, changed preconditions, grant revoke/regrant, cancellation races, keyboard activation and final-home-only completion passed offline. These counts disclose interaction cost, not human enjoyment or ordinary completion time.

Final compressed assets are 98,243 bytes for the main JS, 16,664 bytes for CSS and 3,617 bytes for the lazy debrief JS. Existing art is unchanged. The [preservation audit](../artifacts/goal-004e/preservation-audit.json) verifies all 418 previous evidence, accounting, fixture, artwork and credential files byte-for-byte.

Actual synthetic input, ASR, provider audio and shipped rendered/post-volume digital audio were nonzero. Original WAVs, silent browser video and a locally derived same-session MP4 remain under the ignored `.validation/goal-004c-live/2026-09-28T10-24-13-651Z-voice-mission/`; [hashes and media properties](../artifacts/goal-004e/live-media.json) are committed. No response was replaced or synthesized after the run; video alignment is approximate. No physical microphone, physical speaker, human listening, human natural clear or enjoyment was established. New real Text was deliberately not required or run under the E amendment. Public HTTPS remains untested because nothing was deployed.

Use `npm run build:game` and `npm run start:game` on this feature branch. Practice is offline; future public Live requires a separate deliberate owner allowance and deployment. The exhausted QA allowance is not a judges' demo allowance. [Owner steps](../OWNER_ACTIONS.md) and [submission status](../submission/release-checklist.md) retain the undeployed URL, unprovided owner video/presentation and unfinished submission honestly.
