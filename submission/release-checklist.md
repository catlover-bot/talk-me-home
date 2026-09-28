# Release and submission checklist

Updated for Goal 004E, September 28, 2026. This is local release preparation, not a submitted entry.

Current branch: **`work/goal-004e-confirmed-actions`**. The product now uses voice-led cooperation with explicit confirmation of each proposed local action. See the [E implementation and validation report](../docs/goal-004e-confirmed-actions.md). **OFFLINE_REPAIR_PASS**: 342 unit tests and 100 browser cases passed on clean candidate `bb6dfd2181503415a14c440c52dd762db88f5e3c`. The final synthetic Voice + UI confirmation attempt failed to complete Cargo; **RELEASE_NOT_LIVE_VERIFIED** remains. Historical C/D failed Text results and unused-slot restrictions remain recorded in their original reports; a new implementation does not turn those failures into passes.

| Item | Honest status and next action |
| --- | --- |
| Game source | Goal 004E feature branch in `catlover-bot/talk-me-home`, based on delivered D head `52d8c6d4cc68d136890ffa4dfb39c4060602ffb0`. Frozen execution candidate: `bb6dfd2181503415a14c440c52dd762db88f5e3c` ([manifest](../artifacts/goal-004e/candidate.json)). Exact final pushed-head CI is linked in the delivery report. Starter-only `main` is not the game. |
| Repository access | **OWNER CHECK REQUIRED.** Visibility has not changed. Confirm judges can access the selected feature branch; preserve upstream notices and art provenance. |
| Production build | One Node service serves the compiled game and API through `build:game` / `start:game`. The current E production build and 100 offline browser cases passed; see the [offline receipt](../artifacts/goal-004e/offline-validation.json). |
| Public demo URL | **NOT PROVIDED - NOT DEPLOYED.** `OWNER_ACTIONS.md` and `render.game.yaml` prepare the E branch with automatic deployment off. Verify an actual HTTPS URL after an owner-approved deployment. |
| Judge Live access | **NOT ENABLED PUBLICLY.** Hosting, secrets, explicit enablement, and a separate durable finite public allowance remain owner actions. The private QA amendment is not a judges' allowance. |
| Descriptions | **PREPARED.** `project-description.md`: title 12 characters, short description 172 characters, long description 236 words. Describes spoken coordination plus console confirmation, without a hands-free claim. |
| Cover and app icon | **GAME ART PREPARED.** Preserve exports and provenance in `assets/`; the cover is an illustration. |
| Gameplay screenshots | Existing `assets/` captures are **historical Practice**. E validation captures in `artifacts/goal-004e/screenshots/` show confirmation states and Practice home; offline captures cannot establish real conversation or physical audio. |
| Demo video | **NOT PROVIDED.** `demo-script.md` is an owner recording plan. Private automated test footage is not a finished submission video; synthetic input must be labelled. |
| Presentation | **OUTLINE PREPARED; DECK/LINK NOT PROVIDED.** `pitch-outline.md` is six-slide source copy, not a finished deck. |
| Local and CI evidence | Current E results belong in `docs/goal-004e-confirmed-actions.md`. The clean candidate and complete local results are recorded; exact final pushed-head CI is linked in the delivery report. Preserve historical Goal 001-004D evidence. |
| Real Live verification | **FAILED TO COMPLETE CARGO.** Three unconfirmed inputs caused no physical change, then one UI decision committed one action. Pip asked to check status instead of proposing the crossing; the strict player stopped before recovery. Ending ACK was received. [Actual conversation](../artifacts/goal-004e/live/2026-09-28T10-24-13-651Z-voice-mission-conversation.md). No full real rescue is claimed. Physical microphone capture and human-audible playback remain separate owner checks. |
| Remaining real allowance | **EXHAUSTED.** Linked C/D/E: 4/4 attempts, 2,680 reserved seconds, USD 3.35 estimated reservation cost. Zero remaining; no retry, replenishment, or further real call is authorized. |
| Human play and enjoyment | Earlier basic verification is historical. No new natural human Live clear, enjoyment study, or measured audience outcome is claimed. |
| Event form and deadline | **OWNER CHECK REQUIRED.** Verify the logged-in form, precise cutoff, mandatory fields, uploads, and access. |
| Submission completion | **NOT SUBMITTED.** The owner must complete submission and retain its confirmation. |

The [official live listing](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/live), checked September 24, lists September 1–30, 2026 and “Live · Submissions open.” The exact cutoff time remains unverified. A JavaScript countdown displaying zeros does not establish that submission is closed. **September 29 is our internal owner-submission target**, leaving a buffer; it is not an organizer deadline.

The [general submission guide](https://lablab.ai/ai-articles/hackathon-guidelines) lists the project title, descriptions, recommended 16:9 cover, video, repository, and deployed demo URL. It does not replace validation in the logged-in event form.

Current work stops at this documented result. Review the failed continuation and exact final CI when delivered. Public deployment, additional recording calls, finished deck/video, and submission remain incomplete and are not authorized by this exhausted QA campaign.
