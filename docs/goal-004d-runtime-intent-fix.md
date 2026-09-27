# Goal 004D runtime intent repair

Status: **RUNTIME_POLICY_CHANGED / LIVE_PENDING_AUTHORIZATION**. Release verdict: **RELEASE_NOT_LIVE_VERIFIED**. The shipped prompt and tool descriptions now distinguish information from permission. This is a behavioral intervention, not deterministic natural-language authorization or evidence that the real model follows the new policy.

Work continues on `work/goal-004d-runtime-intent-fix` from delivered head `6521bc0a761e35c36d5deb56538eb77f1f8ebae7`. Implementation candidate, final compiled identity, full offline release result and exact final pushed-head CI are **PENDING VERIFICATION** in this pre-freeze report; they must be filled from actual results before delivery.

## Observed failure and repair

The [failed real Text conversation](../artifacts/goal-004c/final-acceptance/live/2026-09-27T00-24-22-186Z-text-mission-conversation.md) on candidate `6f1ee799a14dc24686459f40ab0cbf7238e2df92` contained exactly these player inputs:

1. “Pip, please look around.”
2. “Please inspect the Latch.”
3. “My diagram says the Door and Conveyor share one Power supply.”

After the third input, a successful `interact_object` occurred and Pip reported an engaged Latch. No physical-action request or agreed continuing plan preceded that exchange. Sanitized metadata establishes a successful mutation; Pip's retained report supports the Latch interpretation. Full tool arguments/results were not retained, so the exact target and causal correlation are not invented. All three tools returned results. The run stopped in Cargo Bay on behavior, not a transport deadlock; Gallery and Dock were never attempted. Explicit ending ACK and cleanup were observed. The [004C recovery report](goal-004c-live-recovery.md) remains unchanged history.

The only application source changes are [game/agent/prompt.ts](../game/agent/prompt.ts) and [game/agent/config.ts](../game/agent/config.ts). The central information-versus-permission rule now precedes style guidance. Brief examples use generic, explicitly pre-observed objects, not private wiring, map, Maintenance or Dock solutions. The policy permits relevant read-only initiative, clear polite requests, one accepted outstanding proposal and specific conditional/ordered plans. It distinguishes engagement from movement and holding from release; stop, corrections and chapter changes invalidate stale permission. Already-completed requests are reported rather than replaced with another operation. Return still requires its separate current server grant.

Mutation descriptions reinforce both permitted requests and cases that supply no permission. They explicitly say information **alone** supplies no new permission while an existing valid agreed plan may still apply. This avoids blocking a legitimate conditional plan merely because the latest turn provides a fact. The standard managed stack, `anna`, greeting, input/output settings, tool schemas, transport, server authority, information projections, three chapters, Training and artwork are preserved. The repaired shared player and its informational turn remain unchanged. No QA intent parser enters production.

The [official documentation review](../artifacts/goal-004d/official-docs.json) records the current index, prompting, tool, inline configuration, event and client-tool references consulted before the change. Server preconditions establish action feasibility; they do not prove that the model correctly understood consent.

## Offline verification before freezing

The two [configuration-delivery tests](../tests/runtime-policy-config.test.ts) passed for Rescue and Training. They use the actual local `voice-token` route, client response mapper and `LiveVoice` serialization, with an injected token response and fake socket. The first message is the actual serialized `session.update`; its prompt/config hashes differ from the delivered baseline. Assertions preserve `anna`, greeting, transport fields and schemas, reject `agent_id` and private regression facts, and verify finite local cleanup. Their injected ACK is not a real provider ACK.

Ten [developer conversation cases](../tests/fixtures/goal-004d-action-policy.json) cover the exact historical exchange, independent information, status questions, explicit engagement, additional information versus acceptance of a proposal, an agreed conditional plan, stop/corrections, Gallery ambiguity and Dock hold/release/return boundaries. The evaluator baseline had **2 passed / 8 failed**; the repaired bounded evaluator passed **19/19**, comprising these ten cases and nine preserved existing cases. [Before](../artifacts/goal-004d/conversation-cases-before.json) and [after](../artifacts/goal-004d/conversation-cases-after.json) receipts label constructed schedules and alternative replies explicitly. The no-tool success-claim fixture does not erase the successful mutation in the actual historical run. These checks validate evaluator coverage, not model compliance; the evaluator never chooses the player's moves.

The [combined focused receipt](../artifacts/goal-004d/targeted-validation.json) records **65 passed**, zero failed/skipped/cancelled, plus successful typecheck and whitespace checks:

```sh
GAME_DISABLE_LIVE=1 node --import tsx --test tests/runtime-policy-config.test.ts tests/qa-action-policy-cases.test.ts tests/qa-acceptance-behavior.test.ts tests/qa-player-policy.test.ts tests/qa-player-memory.test.ts tests/qa-player-drift.test.ts tests/voice-authority.test.ts tests/rescue-http.test.ts
npm run typecheck
git diff --check
```

The single full `GAME_DISABLE_LIVE=1 npm run qa:release` on the clean committed implementation is **PENDING**. Its production build, unit/browser counts, Practice screenshots, cleanup and final identity will be recorded in `artifacts/goal-004d/release-validation.json` after execution. Offline Practice and injected providers cannot establish real speech, physical playback, a human playtest, enjoyment or real-model action control.

## Identity and preservation

[baseline.json](../artifacts/goal-004d/baseline.json) records exact old source/compiled prompt and config hashes, serialized payload hashes, accounting and the successful prior-head CI. The prior application source is `3cf72495c2d3cfcc42cfa6be7e698d2989e95e99`; its 21-file compiled manifest is `e1e681dc447c6a7c64d92153fa6706b44b8a3033b23191de48425c3dbac87a5e`. Recent QA-only repairs had not changed that runtime, and the agent had not learned from the failed attempts.

Pending frozen receipts: `artifacts/goal-004d/candidate.json` will contain the exact implementation commit, old/new policy identities, ordered runtime manifest, harness/fixture manifests and environment. `artifacts/goal-004d/preservation.json` will record historical and immutable-byte checks. The runtime aggregate uses the recorded recursive `localeCompare` path order and SHA-256 of `JSON.stringify` of per-file byte hashes; the release runner's separate digest must remain distinctly labelled. The relevant compiled application bytes must change from the failed candidate before this repair is delivered.

## Live boundary and final handoff

Goal 004D authorizes **zero new token requests or provider connections**. No funded campaign or allowance was created. Goal 004C retains two failed Text attempts, both acknowledged and closed, with **1,340 seconds reserved**. Its unused conditional Voice slot remains blocked and cannot fund this repair. Goal 004B's exhausted history also remains intact. No refund, reset, replenishment or historical relabelling is authorized.

No separate 004D retest grant accompanied the request, so actual Text/Voice compliance on the changed runtime remains untested. Ordinary offline execution stays with this task; only a subsequent explicit spending amendment can permit the real retest. No deployment, public upload, billing change, visibility change, PR or main merge is part of this work.

Final implementation commit: **PENDING**. Final pushed evidence/documentation commit and exact-head CI: **PENDING**. Worktree, owned-process cleanup and preservation audit: **PENDING FINAL CHECK**. [Release status](goal-004d-release-status.md) separately tracks prepared deployment code, missing HTTPS/demo URL, outline versus finished deck, test footage versus submission video, and the unsubmitted event entry.
