# Release and submission checklist

Updated after the approved Goal 004E candidate recheck, September 29, 2026. Branch: **`work/goal-004e-confirmed-actions`**. **OFFLINE_REPAIR_PASS / REAL_VOICE_RESCUE_FAILED / REMOTE_END_CONFIRMED / RELEASE_NOT_LIVE_VERIFIED**. This is local delivery, not a submitted entry.

| Item | Actual status |
| --- | --- |
| Source and CI | Frozen application source `fcbd513effb17d8c90e612c28aa92ed76c070b7e`; approved preparation `c38a10c` minimally activated and executed as `0d21f7cd30cbb4d4b59a9710a53228cd7bad8b4d`. Application/prompt/shared player unchanged. Final feature-head CI is linked in the delivery report. Starter `main` is not the game. |
| Production and offline coverage | **PASSED**: 358 unit tests, 124 browser cases, typecheck, build, whitespace and fresh production Practice. Both Gallery variants, Dock/home and Training covered. [Receipt](../artifacts/goal-004e/follow-up/offline-validation.json). |
| Public HTTPS | **NOT PROVIDED / NOT DEPLOYED.** One prepared Render Node service + disk decision in [OWNER_ACTIONS](../OWNER_ACTIONS.md); initial Live disabled. |
| Judge Live access | **NOT ENABLED.** Needs separate hosting/access/spending authorization and a finite durable public allowance. Exhausted private QA is not that allowance. |
| Repository access | **OWNER DECISION PENDING.** Feature-branch access must be deliberate; visibility unchanged. |
| Descriptions | **PRODUCED.** Title 12 characters, short description 172 characters, long description 242 words. |
| Cover/icon | **PRODUCED.** Existing original art and source/license provenance preserved in `assets/`. Cover is illustration, not gameplay. |
| Current UI images | **CAPTURED / INSPECTED.** New Practice images in `local-deliverables/screenshots/`; constructed-provider confirmation/history/home images in `../artifacts/goal-004e/follow-up/screenshots/`. Modes are labelled. |
| Presentation | **PRODUCED LOCALLY.** [Editable six-slide PPTX](Talk_Me_Home_Pitch.pptx) and [native-rendered PDF](Talk_Me_Home_Pitch.pdf); every slide inspected. Public link **NOT PROVIDED**. |
| Video | **PRODUCED LOCALLY / RECHECKED.** `submission/Talk_Me_Home_Demo_Draft.mp4`, 166.79s, 1280×720, 4,526,386 bytes, H.264/AAC. Retained failed synthetic Voice and completed Practice are explicitly separated. Audio occurs only within the historical 29.0–73.6s excerpt, with pauses; remaining sections are silent. Not narrated throughout. Local ignored file; upload/link **NOT PROVIDED**. |
| Media provenance | [Exact paths/sizes/hashes and rendering checks](local-deliverables/provenance.json), [edit timeline](local-deliverables/edit-timeline.json), small editable sources retained. Historical originals unchanged. |
| Historical Voice result | **FAILED IN CARGO** on September 28; original transcript/media and accounting retained. [Original conversation](../artifacts/goal-004e/live/2026-09-28T10-24-13-651Z-voice-mission-conversation.md). |
| Approved candidate Voice recheck | **EXECUTED ONCE / RESCUE FAILED.** Cargo crossed; one Gallery gate move completed; no Dock/home. Three exact first-response proposals confirmed and committed. Final emblem clarification produced no observation and hit the unchanged player bound. [Actual conversation](../artifacts/goal-004e/recheck-live/2026-09-29T03-22-38-226Z-voice-mission-conversation.md), [analysis](../artifacts/goal-004e/recheck-live/outcome-analysis.json). No repair/retry. |
| Recheck usage and ending | **ONE TOKEN / ONE CONNECTION.** 163.9664 local seconds, 163.862032 provider-reported seconds; explicit End ACK after 266 ms and clean closure. 670 seconds / USD 0.8375 conservatively reserved, below USD 0.84. No invoice or refreshed balance claimed. [Accounting](../artifacts/goal-004e/recheck-live/final-accounting.json). |
| Recheck media | **PRESERVED SEPARATELY.** New real synthetic-microphone ASR/replies, digital input/output audio and browser video remain in the local ignored run directory. The older PPTX/PDF/draft video were not replaced after failure. [Review](../artifacts/goal-004e/recheck-live/media-review.json). |
| QA allowance | **EXHAUSTED:** 5/5 attempts, 3,350 seconds reserved, USD 4.1875 planning estimate, zero remaining. Historical records unchanged. No reset/refund/replenishment. |
| Physical audio / human play | **UNVERIFIED.** No new physical microphone/speaker result, natural human clear or enjoyment claim. |
| Event form / cutoff | **OWNER CHECK PENDING.** Verify current logged-in requirements and precise cutoff; previous listing dates are historical, not a refreshed deadline. |
| Uploads / final submission | **NOT UPLOADED / NOT SUBMITTED.** Local draft is not event compliance or submission confirmation. |

The [general submission guide](https://lablab.ai/ai-articles/hackathon-guidelines) was referenced in prior preparation; the actual logged-in event form remains authoritative for this entry. No public link is invented. Review the completed local artifacts and decide hosting/access/upload scope; no further ordinary implementation/browser work is pending for the owner.
