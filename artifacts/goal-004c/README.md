# Goal 004C trace and regression index

This is **offline repair evidence**, not a new real-provider campaign. Goal 004B's release FAIL, exhausted accounting, missing end acknowledgements, and unverified final prompt remain historical facts.

Part A result: **OFFLINE_REPAIR_PASS / LIVE_RETEST_BLOCKED**, with **RELEASE_NOT_LIVE_VERIFIED** retained at that delivery. [offline-summary.json](offline-summary.json) records 239 passing unit tests, 84 passing compiled-production browser cases and fresh Practice home. [final-runtime.json](final-runtime.json) identifies the Part A application/harness source and build. These historical files remain unchanged.

The owner subsequently approved one bounded Part B campaign on September 26 JST. [part-b-authorization.json](part-b-authorization.json) records the scope and verified USD 4.50/hour price; [part-b-activation.json](part-b-activation.json) records 27 passing focused tests and actual offline/default gate checks before spending.

**Part B stopped after Text failure in Cargo Bay.** [part-b-outcome.json](part-b-outcome.json) records one used attempt, 670 reserved seconds, observed End/ACK and complete local cleanup. Voice was not run; the failed-Text sequencing gate preserves the remaining slot. [part-b-runtime.json](part-b-runtime.json) is the frozen real candidate. [Live metrics/conversation](live/campaign-summary.json) and [actual failure screenshot](live/text-cargo-failure.png) preserve the unsuccessful run. The release remains **RELEASE_NOT_LIVE_VERIFIED**. Large original media stays local and ignored.

## Observed sources

- [historical-evidence-audit.json](historical-evidence-audit.json) verifies preserved local artifact existence, original fixture SHA-256 values, and unchanged accounting. No credentials were read.
- [attempt-1-observed-metadata.json](attempt-1-observed-metadata.json) retains the observation/wait segmentation and unacknowledged ending.
- [attempt-2-observed-metadata.json](attempt-2-observed-metadata.json) retains the split wiring/action input, completed replies, tool call without a returned result, and confirmed ending.
- [attempt-3-observed-metadata.json](attempt-3-observed-metadata.json) retains cancellation results, fresh successful calls, split crossing speech, and missing remote-ending metadata.
- [observed-split-turn.json](observed-split-turn.json) narrows attempt 2 to 40,801–51,000 ms and retains its two exact ASR-final texts for an observed-order replay. Tool arguments and the initial ready adapter are explicitly synthetic test substitutions.
- Original [Goal 004B conversations/metrics](../goal-004b/live/campaign-summary.json) and [final runtime manifest](../goal-004b/final-runtime.json) remain unchanged. Final 004B application source `b0849b7` was not covered by its real attempts.

The extracts are produced by `node scripts/qa-recovery-evidence.mjs`. They retain observed order and relative timestamps and replace correlation numbers with stable per-kind aliases. The three general extracts exclude transcripts; the narrow split-turn replay includes only its two recorded ASR-final texts. All extracts exclude tool arguments/results, configurations, URLs, session/resume identifiers, headers, cookies, and credentials. The original sanitizer omitted tool-call-to-reply association; this index does not invent it. Tests supplying absent arguments, commit truth, chapter state, or alternate orders must be labelled reconstructed or synthetic adversarial. The narrow replay contains `reply.done` with `completed`; it does not invent a provider `interrupted` event.

## Regression mapping

| Failure shape / invariant | Provenance | Existing or new coverage |
| --- | --- | --- |
| A waveform creates two ASR turns; later user start interrupts earlier output | Observed in all three attempts; original WAVs retained | Existing `observed split spoken wait` test in `tests/voice.test.ts`; new waveform-drain/player pacing tests retain the multi-clause stress input |
| Completed call reply uses an interrupted ID; safe result permits fresh continuation | Observed shape, correlation reconstructed where old sanitizer omitted it | Existing `observed split speech tool: reject the interrupted request once, then validate a fresh continuation`; already fixed before Goal 004C |
| `tool.call` after correlated `reply.done`; duplicate/different ID variants | Previously observed API variants plus synthetic adversarial ordering | Existing `correlated reply.done before tool.call still executes exactly once` and ordinary-reply-ID tests; must remain passing |
| Physical commit before interruption/result delivery | Synthetic adversarial test; commit payload absent from recorded metadata | `tests/voice-recovery.test.ts` and `tests/voice-authority.test.ts`: one authoritative commit, one safe result, cause-accurate success/uncertainty |
| Late old interrupted completion or caption after a newer response/chapter | Synthetic adversarial test | Existing chapter-aware/stale-caption tests plus new correlation regression; no invented real chapter transition |
| Ordinary next-turn speech versus actual Interrupt/Pause grant revocation | Synthetic adversarial authoritative-state tests | Existing quiet-next-turn preservation and explicit revoke cases, extended to active response bookkeeping |
| End during pending tools; delayed ACK and missing ACK | Observed ACK/no-ACK outcomes plus synthetic adversarial delayed cleanup | `tests/voice-lifecycle.test.ts`: shared five-second bound on adapter waiting for cleanup/handshake, not all application requests; `tests/qa-lifecycle.test.ts`: incremental milestone persistence |
| Canonical completion before tool call; speech-stop and cancellation-barrier ordering | Synthetic adversarial ordering, not invented observed fields | `tests/voice-recovery-review.test.ts`: seven transition/correlation cases |
| Cancellation response reveals committed final home without closing model reply | Synthetic authoritative browser fixture | `tests/e2e/voice-completion.spec.ts`: both viewports, once-only completion and `session.end` sent at eight seconds; fake immediate ACK |
| One waveform drains across multiple ASR turns; Text uses normal UI without microphone | Offline local WAV and injected provider only | `tests/qa-turn-pacing.test.ts`, `tests/qa-audio.test.ts`, and `tests/e2e/qa-player.spec.ts`: no next-fixture overlap, late calls, PCM drainage, UI Text, lifecycle sink |
| Negation, intentions, canceled observations, and public checkpoint recovery | Pure visible-speech policy fixtures | `tests/qa-player-policy.test.ts`: bounded clarification/retry, no hidden-state oracle |
| Future financial proposal stays unapproved; old campaign stays exhausted | Offline negative tests only | `tests/qa-live-authorization.test.ts`: no flag/file approval, 2×670 restart/corruption/locking, old-profile preservation |
| Sanitized exports do not invent missing fields | Pure offline export tests | `tests/qa-evidence.test.ts` and `tests/qa-recovery-evidence.test.ts` |

Exact final test counts and source/build/CI identity belong in [the Goal 004C report](../../docs/goal-004c-live-recovery.md). The table does not claim that a newly added test failed on the base when its repair already existed.

The initial six reconstructed adversarial schedules in `tests/voice-recovery.test.ts` were run against the unchanged Goal 004B protocol and all failed before the Goal 004C repair; the local before-output remains `.validation/goal-004c-recovery-before.txt`. The file now contains additional cases. That before-result applies to those initial six schedules, not the prior `9a0d901` split-call regression.

The prior `observed split speech tool: reject the interrupted request once, then validate a fresh continuation` regression was separately run against an isolated temporary checkout of `00d10e1`: **1 passed**, zero skipped or failed. Its local output is `.validation/goal-004c-existing-base-regression.txt`.

At Part A delivery no funded Goal 004C allowance existed and Part B remained `BLOCKED_AWAITING_BUDGET_APPROVAL`. The subsequent owner approval and actual Part B result are recorded above. Large/private WAVs and videos remain ignored locally. This index does not certify physical sound, a human playtest, enjoyment, public HTTPS, or a completed real Rescue.
