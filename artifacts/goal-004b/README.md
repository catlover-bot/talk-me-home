# Goal 004B evidence

This directory contains compact sanitized autonomous-QA summaries. Full synthetic speech, digital Pip output, screenshots, and browser videos stay local and ignored under `.validation/`.

- [offline-summary.json](offline-summary.json): final passing offline checks, with original checkout/dirty metadata retained.
- [final-runtime.json](final-runtime.json): final application source commit and compiled-file hashes; no real-provider coverage is claimed for this final runtime.
- [live/campaign-summary.json](live/campaign-summary.json): three consumed attempts and their actual incomplete outcomes, with per-attempt conversations and metrics alongside it.
- [redaction-check.json](redaction-check.json): credential-value scan of compact exports and browser assets.
- [ci-environment-failure.json](ci-environment-failure.json): the earlier sandbox launch failure and the targeted CI repair.

Full local evidence:

- `.validation/goal-004b-offline.json`: the latest completed offline production regression run.
- `.validation/goal-004b-offline/screenshots/`: actual compiled-production Practice captures.
- `.validation/goal-004b-media/`: generic offline Windows System.Speech fixtures, text, PCM format, durations, and hashes.
- `.validation/goal-004b-live/`: the one persistent campaign ledger and separate three-attempt production allowance, plus per-attempt evidence. Never delete or reset these accounting files to obtain more attempts.

Real evidence is labelled **AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI**. Offline evidence is labelled separately. The player is a bounded scripted expert policy reading human-visible documents, finalized visible Pip reports, public checkpoints, and human controls. It is not a human usability or enjoyment test.

Digital evidence distinguishes provider PCM received, actual shipped playback-worklet output, and an isolated post-volume capture. No physical microphone, room acoustics, speaker routing, or subjective listening result is claimed. Video is inspected for an audio track; any later audio mux is identified as a digital reconstruction with approximate alignment, not a native browser recording of physical sound.

The evidence allowlist excludes socket URLs, session/resume identifiers, token values, configuration, headers, cookies, tool arguments, and hidden tool-result payloads. Private full test transcripts are permitted for this campaign. Compact committed conversations must retain actual ASR errors and distinguish provider text from text delivered visibly by the app.

See [the validation report](../../docs/goal-004b-autonomous-qa.md) for the completed scope, defects, accounting, and exact runtime identity.
