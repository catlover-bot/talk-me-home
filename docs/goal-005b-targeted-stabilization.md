# Goal 005B — Targeted stabilization

**Offline stabilization in progress; zero new Live authorization.** The demonstrated Goal 005 build remains preserved. Its successful ordinary Voice sample and failed recovery sample are separate evidence fields, and `RELEASE_NOT_LIVE_VERIFIED` remains the unmet acceptance flag.

| Evidence field | Preserved fact / current status |
| --- | --- |
| Delivered Goal 005 source | `1949b921fc744dc28d0889ca8d30c9d7d8102bd6` on `work/goal-005-gallery-live-completion` |
| Demonstrated runtime/player | `2edf7914a008143843923b04a9bf3a1fe41f1f68`; runtime `bf8fe9ef044561064164cf537380559d1a5e92d06f290399d20c472cae6fa401` |
| Successful Live sample | Attempt 12: complete Rescue, backtracking, 11 exact commits, home, 576.923132 provider seconds, End ACK and local cleanup |
| Failed final recovery sample | Attempt 13: deliberate decline recovered with a fresh proposal; later Fork southeast-passage deadline failed, no home, no End ACK |
| Missing remote-ending evidence | Attempts 11 and 13 retain null provider duration and unconfirmed remote termination |
| Repeated-run acceptance | One of two required final-candidate passes; no population success-rate inference |
| Goal 005B branch | `work/goal-005b-targeted-stabilization`, based on delivered `1949b921fc744dc28d0889ca8d30c9d7d8102bd6` |
| Goal 005B validation | Focused reproductions, complete offline release and final feature-head CI pending |
| Goal 005B Live evidence | None; no token/provider call or funded allowance is authorized |
| Existing accounting | Goal 005 exhausted: 8/8 new attempts, 7,760 reserved seconds / USD 9.70 conservative estimate, zero remaining; linked history 13 attempts / 11,110 seconds / USD 13.8875 |
| Public access and submission | Hosting, public allowance, upload, visibility change, PR/main merge and event submission remain unapproved |

The full [Goal 005 report](goal-005-gallery-live-completion.md), original attempt [12 conversation](../artifacts/goal-005/live/2026-09-29T11-10-24-116Z-voice-mission-conversation.md) / [metrics](../artifacts/goal-005/live/2026-09-29T11-10-24-116Z-voice-mission-metrics.json), attempt [13 conversation](../artifacts/goal-005/live/2026-09-29T11-21-06-378Z-voice-mission-conversation.md) / [metrics](../artifacts/goal-005/live/2026-09-29T11-21-06-378Z-voice-mission-metrics.json), and [independent failed-sample review](../artifacts/goal-005/live/attempt-13-independent-review.json) remain unchanged. This report records the stabilization work separately.

## Confirmed observations and limits

Four initial inspections after four Gallery arrivals failed in attempt 13. The retained wire record identifies `inspect_object` and `precondition_failed`, but omits rejected arguments, validation stage and independent server-response timestamps. It cannot establish whether a handle was unknown, nonlocal, malformed or stale. Wrong-handle selection remains a hypothesis. Asking the human for opaque internal identifiers and repeatedly asking permission for already-requested inspections are observed conversational failures.

The third inspection in the final subgoal succeeded, but its normal answer arrived after the strict 120-second acquisition deadline and after End. That answer was not used for navigation and does not retroactively pass the historical sample. [Stage timeline](../artifacts/goal-005b/timing-attempt-13.md) and [all-turn timing JSON](../artifacts/goal-005b/timing-attempt-13.json).

| Final acquisition exchange | Source end to final ASR | Sent result to next reply | Call to sent result |
| --- | ---: | ---: | ---: |
| First inspection | 12.9800 s | 13.0630 s | 427.1 ms |
| Clarifying survey | 12.7944 s | 12.9058 s | 180.2 ms |
| Repeated inspection | 13.1730 s | 12.7846 s | 202.3 ms |

The call-to-result interval includes the valid `reply.done` delivery boundary; it is not server latency. Browser event timestamps and Node subgoal timestamps have different origins. Sample counters, scheduled waveform duration and callback elapsed time are recorded separately. Instantaneous audio/network queue depth, event-loop delay, provider processing and independent server timing were not measured. No causal attribution follows from the approximately 13-second intervals.

## Required narrow changes and offline verification

| Dimension | Required behavior | Verification record |
| --- | --- | --- |
| Rejected-read diagnosis | Opt-in local allowlist at the validation boundary; bounded target/direction, safe correlation and scope outcomes; no secrets or unrestricted payloads | Implemented; constructed baseline lacked classified codes, [server receipt](../artifacts/goal-005b/server-validation.json) |
| Direction-targeted inspection | Authoritative current observed room only; exact unique direction; reject unavailable, ambiguous, unseen or stale requests | Implemented; 48 direction/layout/Relay combinations plus rejected and delayed-scope cases in focused server checks |
| Read-only semantics | Preserve open/powered versus clear/blocked/unchecked; no physical authority, remote topology or human navigation leak | Protocol, Practice and confirmation-isolation checks pass; no movement-tool redesign |
| Slow-response UI | Accurate communication stage; Pause/End reachable; no duplicate results, automatic reconnect, repeated status polling or unrequested action | Reproduced incorrect listening status after result delivery, then passed explicit waiting-stage and delayed/empty/duplicate/interrupted compiled-peer cases |
| Recovery bounds | Preserve the existing 120-second/four-exchange baseline; late-after-End answers stay unusable | No enlarged deadline or completion grace has been adopted by this evidence audit |
| Ending | One End, bounded cleanup, absolute cap, stopped input/playback/tools, receive ACK if it arrives | Existing 9/9 and expanded 11/11 offline lifecycle checks passed; no production ending defect reproduced |

The constructed client baseline failed all four new direction/error-projection cases; the separately recorded status regression reproduced `listening` while awaiting a normal tool continuation. The repaired focused client/config/Practice suite passed 76 cases. Its first integration run passed 73/76: one old Practice expectation still required an opaque ID, and two schema tests banned every enum. Those fixtures now require the direction argument and exactly the eight universal compass values; undiscovered object/action/route enums remain prohibited. Original logs remain under `.validation/goal-005b/inspection-client-before.log`, `inspection-stage-before.log`, `client-focused.log` and `client-focused-after.log`. These are constructed reproductions, not a claim to know the historical rejected arguments.

Production paths are `game/server/gallery.ts` (observed local direction resolution), `state.ts` / `sessions.ts` (request scope and classified validation), `errors.ts` / `http.ts` (HTTP error projection), and `tool-diagnostics.ts` with explicit local startup wiring in `index.ts` / `production.ts`. The browser captures the robot-only visit at tool receipt in `useMission.ts`, sends it outside model arguments in `api.ts`, and retains the safe code/recovery projection through `voice-protocol.ts`. `config.ts`, the affected prompt paragraph and `mock.ts` use the same read-only direction interface. Shared safe contracts and existing QA allowlists recognize it. `CommunicationDock.tsx` distinguishes a sent check awaiting reply from actual response/playback. The human map still learns from communicated reports, and physical movement/interaction still requires the exact owner-bound proposal decision.

To collect private validation diagnostics during a separately chosen **offline local** run, build and start with `GAME_DISABLE_LIVE=1 GAME_BIND_ADDRESS=127.0.0.1 GAME_LOCAL_TOOL_DIAGNOSTICS=.validation/goal-005b/new-inspection.jsonl npm run start:game`. Use a new file each time. The production entry does not load `.env`; this diagnostic flag creates no provider authorization. Public binds/origins, paths outside `.validation`, symlinks and existing output files are rejected. The sink retains at most 2,000 allowlisted records with monotonic start/end/elapsed time, validation stage, result code, scope comparisons and hashed correlation identities. Only fixed admitted targets/directions remain plain text; unexpected strings are hashed. Arguments, credentials, cookies, configuration, transcripts, remote topology and private player notes are excluded. No HTTP endpoint serves this file.

The first clean implementation `7473ea791745be20a44997789a76602ac7767bb1` passed typecheck, all 455 unit tests and production build. Its combined browser invocation passed 145/146 cases before the existing 210-second global suite limit left the final case unrun; no individual assertion failed. The failed release receipt is preserved at `.validation/goal-005-offline/7473ea791745be20a44997789a76602ac7767bb1-2026-09-29T13-37-25-706Z.json`. The existing release runner now uses the same two viewports × two shards already used by CI, and records each result before adding the complete-suite summary. No cases, per-case limits, suite limits or cleanup bounds are removed or enlarged. This is test execution organization, not a Live recovery-policy change.

## Independent ending audit

The [ending audit](../artifacts/goal-005b/ending-audit.json) found no reproduced production-handler defect. `session.ended` is handled before the ended-state suppression of ordinary replies, transcripts, audio and tools, so an ACK remains receivable during the existing bounded closing window. The production ending code was byte-identical to the delivered baseline at audit time; no deadline enlargement or extra ending request was introduced.

| Retained attempt | End to ACK | End to observed local close | Remote duration |
| --- | ---: | ---: | --- |
| 11, historical five-second grace | Not received | 5.7250 s | Unknown |
| 12, ten-second grace | 0.7169 s | 1.5618 s | 576.923132 s |
| 13, ten-second grace | Not received | 10.2541 s | Unknown |

The code-1005 local closes in attempts 11 and 13 do not prove remote termination. Attempt 13's late ordinary reply, transcript and completion arrived 2.7421, 8.6241 and 8.9702 seconds after End; none is an ending ACK. The browser `end.requested` marker is a send interceptor immediately before `session.end`, not a measurement of the earliest UI click. Close-event delivery can follow the local close invocation; the retained data does not timestamp that invocation separately.

The existing lifecycle suite passed 9/9. Two additional constructed schedules replay late ordinary events and verify a missing ACK remains unknown while a constructed 9.2-second ACK remains receivable; the expanded suite passed 11/11. Delayed/missing ACK, repeated End, hung cancellation and both 600/900-second absolute caps remain covered. This is a passing-baseline audit with added adverse schedules, not a red-to-green production repair. Typecheck and whitespace checks passed. Exact log paths and hashes are in the audit receipt; no real provider call filled the historical gaps.

Independent review caught a test-only coverage gap: the first added late-audio fixture used `audio` instead of the documented `data` field. The original passing logs are retained with that limitation. The corrected schedule first proves the same valid PCM event starts playback before End, then confirms it cannot add playback after End. Both corrected schedules and the other ending cases pass 11/11; `.validation/goal-005b/ending-audio-correction.log` and the appended audit receipt identify the actual corrected source. Production ending code is unchanged.

## Demonstrated media and accounting preservation

The current [178.021354-second Goal 005 demo, editable PPTX, native PDF and provenance](../submission/goal-005-deliverables/README.md) remain the demonstrated-build package, together with the local uncut successful recording at `.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4`. The [package receipt](../artifacts/goal-005b/demonstrated-package.json) verifies all four media files against their delivered provenance, both final raw reports against their recorded hashes, and all 18 campaign journals against final accounting. They are not screenshots or recordings of Goal 005B. Original failed recordings and raw reports remain intact.

The new [preservation baseline](../artifacts/goal-005b/preservation-baseline.json) hashes 495 historical files totaling 1,211,858,558 bytes without copying them. It covers delivered reports/artifacts, media recipes/provenance, all B/C campaign records, successful/failing raw records, current and earlier submission media, and the successful uncut. A [separate anchor](../artifacts/goal-005b/historical-budget-anchor.json) preserves the original Goal 001 cumulative budget outside those campaign directories. The private full hash manifest is `.validation/goal-005b/preservation-baseline.json`; a final comparison will check every one of these 496 paths. Current rebuildable `dist/` outputs are outside the immutable-file set; their old frozen manifests and original execution identities remain preserved.

The [read-only audit helper](../artifacts/goal-005b/check-preservation.mjs) writes only a new receipt and refuses to replace its baseline or an existing output:

```sh
node artifacts/goal-005b/check-preservation.mjs --check artifacts/goal-005b/preservation-final.json
```

The [initial preservation comparison](../artifacts/goal-005b/preservation-initial-check.json) passed all 496 paths with no exclusions or differences. No historical accounting, grant, reservation or media was edited. Final preservation and zero-use verification remain pending the completed offline work.

## Public reviewer duration proposal — not activated

The ordinary public/default session cap remains **600 seconds**. The successful sample used **577.2133 locally observed socket seconds**, leaving only **22.7867 seconds**, about 3.8% of that cap. It actually ran under the separately approved private 900-second QA configuration. One automated successful sample does not show that a human reviewer can reliably finish within 600 seconds; startup and ending observation also need margin.

A finite future reviewer plan could retain the existing 600-second cap and schedule a manual Pause at the Gallery-to-Dock checkpoint, then one explicit Resume for Dock. Limit the visit to at most two token attempts, one active connection, at most 1,200 connected seconds and the existing 1,340 seconds of conservative concurrency reservations; require the first connection's ending ACK before Resume, and stop if it is absent. This is a proposed separate owner-approved access/spending plan, not an enabled allowance or a promised duration. Resume depends on the same in-memory server session; a restart loses the mission. No automatic reconnect or cap change is introduced.

## Final delivery fields

- New stabilization source/runtime identity and exact production paths: pending.
- Focused before/after regressions, complete offline release and actual browser inspection: pending.
- Final preservation/unchanged exhausted accounting and new provider/token attempts: pending final audit; authorized new use is zero.
- Final pushed feature head and exact-head CI: pending.
- Demonstrated Live result remains one full pass with the repeated-run target unmet. Any future same-candidate ordinary/recovery retest requires separate explicit funding authorization; Goal 005B creates none.
