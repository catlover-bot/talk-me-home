# Release and submission checklist

Goal 005 local delivery, September 29, 2026. Branch: **`work/goal-005-gallery-live-completion`**. **OFFLINE_REPAIR_PASS / ONE FINAL-CANDIDATE VOICE RESCUE PASS / TWO-PASS TARGET NOT MET / RELEASE_NOT_LIVE_VERIFIED**.

| Item | Actual status |
| --- | --- |
| Source and CI | Runtime/player frozen at `2edf7914a008143843923b04a9bf3a1fe41f1f68` for both last calls. Later delivery commits add evidence, documents and media. Exact final-head CI is recorded in the owner handoff and [Goal 005 report](../docs/goal-005-gallery-live-completion.md). |
| Offline coverage | **PASSED:** typecheck, 437 unit tests, build, 142 browser cases, whitespace and fresh production Practice. Both Gallery variants, backtracking, cancellation, Training, Dock/home, narrow layout and zoom covered. |
| Ordinary real Voice | **PASSED ONCE:** global attempt 12 / new attempt 7. Cargo, Gallery backtracking, Dock and home; 11 exact confirmed commits. Synthetic microphone, real ASR/model/tools and shipped digital playback. End ACK and cleanup verified. 576.923132 provider seconds. |
| Deliberate-recovery real Voice | **FAILED:** global attempt 13 / new attempt 8, same candidate. Declined Latch caused no commit; a fresh proposal recovered. Five exact commits; Cargo and Gallery reached. Fork passage recovery exceeded 120 seconds; no Dock/home. End sent, ACK absent, provider duration unknown. 567.4462 local socket seconds; local cleanup verified. |
| Earlier home observations | Attempts 9 and 11 reached functional home but failed full acceptance because of a terminal harness error and missing ACK respectively. These are historical outcomes, not final-candidate passes. |
| Remaining defects | Intermittent first-inspection failures, unnecessary permission questions and delayed responses remain. The required two-pass target was not met. |
| QA allowance | **EXHAUSTED:** 8/8 new attempts, 7,760 reserved seconds / USD 9.70 additional estimate. Historical five attempts remain untouched. Combined 13 attempts / 11,110 seconds / USD 13.8875 estimate. Zero remaining; no refund or replenishment. Reservations are not invoices or refreshed balance evidence. |
| Evidence | [Accounting and conversations](../artifacts/goal-005/live/campaign-summary.json); raw audio/video stay under local `.validation/goal-004c-live/`. Missing ACKs in 11 and 13 remain unknown remote ending. |
| UI images | Actual [Gallery captures](../artifacts/goal-005/ui/gallery-validation.json), final Practice media, and real home/failure screenshots retain their mode labels. |
| Descriptions | Title 12 characters; short description 172 characters; long description 242 words. |
| Artwork | Original cover/icon and license/source provenance preserved. Cover is illustration. |
| Presentation | [Goal 005 editable PPTX](Talk_Me_Home_Goal005_Pitch.pptx) and [native-rendered PDF](Talk_Me_Home_Goal005_Pitch.pdf). All six slides reviewed; [media receipt](goal-005-deliverables/README.md). |
| Video | Local `submission/Talk_Me_Home_Goal005_Demo.mp4`: labelled Practice UI and disclosed excerpts from one successful synthetic real Voice run. Original speech retained; successful uncut run retained locally. [Exact edit and inspection](goal-005-deliverables/README.md). MP4 is ignored and not uploaded. |
| Historical deliverables | Goal 004E PPTX/PDF/video and previous evidence remain unchanged. [Fifth-attempt history](../docs/goal-004e-confirmed-actions.md#approved-fifth-attempt-result). |
| Physical audio / human play | **UNVERIFIED:** no physical microphone/speaker acceptance, human listening review, natural human clear or enjoyment study. Digital evidence is separate. |
| Public HTTPS / judge access | **NOT DEPLOYED / NOT ENABLED.** [Prepared hosting settings](../OWNER_ACTIONS.md) keep Live disabled. Private QA is not a public allowance. |
| Repository | Feature-branch push authorized; visibility unchanged. No PR or main merge. |
| Event form / cutoff | Actual logged-in requirements and exact cutoff remain owner checks; historical dates are not a refreshed deadline. |
| Uploads / submission | **NOT UPLOADED / NOT SUBMITTED.** No public video, presentation or demo URL is invented. |

The report and media retain the successful sample and failed acceptance target together. Local implementation, browser testing and media production are handled here; future spending, deployment and external submission remain separate owner decisions.
