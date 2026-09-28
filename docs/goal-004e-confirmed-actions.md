# Goal 004E — confirmed actions

Work branch: `work/goal-004e-confirmed-actions`, based on delivered Goal 004D head `52d8c6d4cc68d136890ffa4dfb39c4060602ffb0`. Implementation and verification are in progress. **RELEASE_NOT_LIVE_VERIFIED** remains current until the scoped final result is recorded.

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

Targeted boundary, ownership, idempotency, ordering, private-survey, client, evidence and financial tests have passed during implementation. Complete frozen-source release results, screenshots, confirmation count and exact final-head CI will be recorded below after they run. No Goal 004E real-provider connection has run at this point.
