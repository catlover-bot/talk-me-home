# Release and submission checklist

Prepared September 24, 2026. This checklist describes the release candidate and remaining owner actions; it is not a submitted entry.

Current Goal 004D branch: `work/goal-004d-runtime-intent-fix`. See [release status](../docs/goal-004d-release-status.md) and [runtime validation](../docs/goal-004d-runtime-intent-fix.md) for the final repaired candidate and exact checks. Live remains **LIVE_PENDING_AUTHORIZATION / RELEASE_NOT_LIVE_VERIFIED**; this runtime repair is offline only without a separate spending grant.

Historical September 27 Goal 004C acceptance: the frozen candidate `6f1ee799a14dc24686459f40ab0cbf7238e2df92` failed its real Text retest in Cargo Bay on an instruction/action-control mismatch. Ending ACK and cleanup succeeded; Voice was not run. See `docs/goal-004c-live-recovery.md` for the delivered history. The September 24 preparation rows below are historical package status, not claims that later Live testing was absent or passed. Deployment/access, real demo URL, video, finished deck and submission remain incomplete.

| Item | Honest status and next action |
| --- | --- |
| Finished game source | Release branch: `work/goal-004-release-candidate` in `catlover-bot/talk-me-home`, based on feature commit `a212857e00c8ad75a3b630af2b8e0435c48ad899`. Use the final pushed head and exact CI result recorded in `docs/goal-004-validation.md`. |
| Repository access | **OWNER CHECK REQUIRED.** Visibility has not been changed. Confirm judges can access the finished feature branch; starter-only `main` is not this submission. Do not publish private source or add a license without a deliberate owner decision. |
| Production build | **PREPARED AND LOCALLY RUN.** `npm run build:game` and `npm run start:game`; one Node service serves the game and API. `npm start` and the original `render.yaml` remain the upstream starter. |
| Public demo URL | **NOT PROVIDED — NOT DEPLOYED.** Follow `OWNER_ACTIONS.md` and `render.game.yaml`, select the exact release commit, and verify the actual HTTPS URL. Hosting/storage approval remains with the owner. |
| Judge Live access | **NOT ENABLED PUBLICLY.** Configure the server-side code, provider key, explicit Live enable, and durable finite allowance. Provide the real URL and code through the appropriate private access field. Practice stays available without a provider connection. |
| Descriptions | **PREPARED.** `project-description.md`: title 12 characters, short description 155 characters, long description 219 words. Recheck after any edits. |
| Cover and app icon | **GAME ART PREPARED.** Use the final exports and provenance labels in `assets/`. Confirm the cover is 16:9 and identified as illustration. |
| Gameplay screenshots | **PREPARED — PRACTICE.** Cargo, Gallery, Dock, history/pause, and confirmed ending captures are included in `assets/`. They are deterministic gameplay evidence, not Live captures. |
| Credits and source identity | **OWNER FINAL CHECK.** Preserve upstream notices and review the packaged art provenance. No new upstream license grant or external asset purchase is implied. |
| Demo video | **NOT PROVIDED.** Record the real human/Pip interaction using `demo-script.md`; identify edits and any simulated footage. Export within five minutes and under 300 MB, subject to the actual event form. |
| Presentation | **OUTLINE PREPARED; DECK/LINK NOT PROVIDED.** Build the six-slide presentation from `pitch-outline.md`. An outline is not a finished deck. |
| Local and CI evidence | See `docs/goal-004-validation.md` for the final tested/pushed head, exact checks, image provenance, sizes, and limitations. Historical Goal 001–003 results remain historical. |
| Real Live verification | **OWNER CHECK REQUIRED FOR CHANGED RELEASE FLOW.** Confirm microphone capture, audible playback, and immediate End on the actual browser/device after enabling access. No new automated real-provider run was performed. |
| Human play and enjoyment | The owner's earlier basic verification is accepted. No new natural Live clear, human enjoyment study, or measured audience outcome is claimed by this package. |
| Event form and deadline | **OWNER CHECK REQUIRED.** Verify the logged-in form, precise cutoff, mandatory fields, uploads, and repository/demo access. |
| Submission completion | **NOT SUBMITTED.** A saved draft is not final submission. The owner must complete submission and retain its confirmation. |

The [official live listing](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/live), checked September 24, lists September 1–30, 2026 and “Live · Submissions open.” The exact cutoff time remains unverified. A JavaScript countdown displaying zeros does not establish that submission is closed. **September 29 is our internal owner-submission target**, leaving a buffer; it is not an organizer deadline.

The [general submission guide](https://lablab.ai/ai-articles/hackathon-guidelines) lists the project title, descriptions, recommended 16:9 cover, video, repository, and deployed demo URL. It does not replace validation in the logged-in event form.

Finish in two owner work sessions:

1. Approve the hosting/storage choice, deploy the final release commit using `OWNER_ACTIONS.md`, deliberately enable a finite Live allowance, and verify judge access.
2. Record the real demo, finish the presentation, fill the actual links/access fields, check the event cutoff, and complete submission by the internal September 29 target where possible.
