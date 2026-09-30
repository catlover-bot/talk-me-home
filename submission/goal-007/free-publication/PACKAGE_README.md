# Free Practice publication media

Public demo: https://talk-me-home.onrender.com. Hosted Practice passed on September 30, 2026. Observed application: **0.7.0 / caa896d3a90dd4e8cb26499dba586b646bb7030a**.

Repository: https://github.com/catlover-bot/talk-me-home. Demo Application Platform: **Other**.

This version replaces outdated pending-publication presentation text while preserving every original media file and manifest. These are local deliverables; no upload or LABLAB submission was performed.

## Choose these files

- `Talk_Me_Home_Free_Practice_v1.mp4` and matching `.srt`: full normal-speed recorded Practice rescue, with separately labelled local presentation narration and updated availability cards.
- `Talk_Me_Home_Goal007_Free_Practice_v1.pptx` and `.pdf`: six editable slides and the native rendered PDF.
- `Talk_Me_Home_Free_Practice_Package_v2.zip`: explicit allowlist package with current form fields, cover, evidence, notices and receipts.
- [Current form fields](current-publication-fields.md) and [publication handoff](https://github.com/catlover-bot/talk-me-home/blob/work/goal-007-release-and-immersion/docs/goal-007-publication-handoff.md).

The MP4 and ZIP are local files excluded from Git. Slide/PDF sources and verification receipts are reviewable on the feature branch. No invented public video or slide URL is supplied.

## Evidence boundaries

The film's gameplay is the preserved local Practice recording from `d22d39a427a3250f184dd5b98cfbfb91fa78eba6`, not a recording of the hosted run. Its 170.9 seconds of gameplay retains the original normal-speed source intervals and exact confirmations. The new introduction, home narration and presentation cards describe current availability. Presentation narration uses local Windows System.Speech / Microsoft Zira Desktop; it is neither Pip nor provider audio. The faithful Practice captions remain visible within the recorded interface.

Older Cargo, Gallery and Dock stills retain their `66f1bd2` capture identity. The explicitly labelled hosted stills are from the separately verified `caa896d` service. The safe [hosted receipt](evidence/free-hosted-verification.json) records both recorder-collected and selected-skipped rescues through Cargo Bay, Relay Gallery, Return Dock and home, including exact confirmations, route controls, Pause/resume and replay.

The public service offers Practice; Live Voice and Live Text are unavailable. Training is exposed by the interface but was not separately exercised in the hosted inspection. No new provider request, token issuance, provider connection or funding was used to make these materials. No new public application request was needed: the media update reuses saved evidence.

A hosted Practice pass is not a real Voice pass, human speech, physical speaker playback or enjoyment evidence. Provider ending ACK is not applicable to Practice. Historical Live records remain unchanged. Free hosting may require a cold start; restarting the in-memory server loses mission progress. The owner selected Free with no persistent disk.

## Reproduction and review

`make_deck_v1.py` creates the new deck; render it with headless LibreOffice using a private temporary profile. `make-narration.ps1` synthesizes only the four updated presentation sections into a new ignored work directory and refuses to replace existing audio. `render_video.py --source-workspace PATH` reads the preserved private `goal-007-preview` raw source and narration plan; it never runs the game or contacts a provider. `prepare_sources.py --source-workspace PATH` verifies the raw recording hash and copies/verifies the eight unchanged narration WAV/word-event pairs against the original manifest. Outputs refuse replacement. `verify_video.py` checks full decode, stream formats, durations, audio samples, exact subtitle text and representative/transition frames. `package_release.py` creates and verifies one explicit allowlist ZIP without upload.

Do not run the historical preview generators to overwrite originals. Follow the new receipts for exact hashes, timing and visual-review observations. No main merge or redeployment is needed for this local media edition.

The pre-delivery package v1 is preserved locally. Package v2 includes normalized receipt line endings and the delivered generator guard hash; media bytes are unchanged.
