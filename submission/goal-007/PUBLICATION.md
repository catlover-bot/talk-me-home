# Current publication and submission instructions

Use the verified [current form fields](current-publication-fields.md) ([JSON](current-publication-fields.json)) for the updated links and availability text. The earlier `submission-form.*` files remain immutable component snapshots.

The owner reports a successful dashboard deployment on the existing Render service `talk-me-home` (`srv-dauc8fek1f9s73b93pc0`), using the **Free plan, without a persistent disk**. The supplied [application URL](https://talk-me-home.onrender.com) independently returned HTTP 200 for its page, health, version and access endpoints. The observed application is `caa896d3a90dd4e8cb26499dba586b646bb7030a`, version `0.7.0`. Fresh-browser hosted Practice verification passed both recorder-collected and selected-skipped endings on September 30, 2026. See the [current publication handoff](../../docs/goal-007-publication-handoff.md) for evidence.

- Demo Application Platform: **Other** (browser-based web game).
- Demo Application URL: [https://talk-me-home.onrender.com](https://talk-me-home.onrender.com).
- Published mode: **Practice only**; public `/api/access` and both Live Text and Live Voice readiness screens confirm Live is unavailable, with Connect disabled. The explicit Practice alternative works.
- Deployment success: owner-reported dashboard result from `caa896d`; public version endpoint independently reports that exact full application commit. Dashboard “Live/Deployed” is not a provider Live acceptance result.
- Hosted Practice completion: **PASS** for Cargo Bay, Relay Gallery, Return Dock and server-confirmed home in both endings, including exact confirmations, a declined proposal, route controls, Pause/resume and actual new replay rounds. Provider HTTP, token requests and WebSocket attempts were zero; the browser closed cleanly.
- Current real Voice acceptance: **NOT VERIFIED**, and no Live test is authorized by this continuation.
- Public repository access: [catlover-bot/talk-me-home](https://github.com/catlover-bot/talk-me-home) is currently Public; unauthenticated HTTP returned 200. This continuation did not change visibility.
- Final LABLAB Submit: **NOT PERFORMED**; leave the owner's saved form untouched.

The existing preview MP4, slides, PDF, ZIP and form snapshots retain their original capture/build and evidence labels. They do not prove hosted availability or a new real Voice pass. Preserve those originals; update final availability fields and links only from the actual public inspection. The form accepts direct media uploads, so do not invent a video/slide URL or require a separate upload service.

The hosted check was automated deterministic Practice. It does not establish human play, human speech, audible provider playback or a real Voice acceptance pass. The [safe hosted verification receipt](../../artifacts/goal-007/free-hosted-verification.json) links the observed results; screenshots show the [entrance](../../artifacts/goal-007/hosted-free/entrance-1280.png), [collected ending](../../artifacts/goal-007/hosted-free/collected-home.png), [skipped ending](../../artifacts/goal-007/hosted-free/selected-skipped-home.png) and [unavailable Voice UI](../../artifacts/goal-007/hosted-free/voice-unavailable.png). Private raw receipts remain under `.validation/goal-007/hosted-free-20260930T083358Z/`. The deployed application identity remains separate from subsequent documentation or inspection-script commits.

For reviewers, disclose that the Free application may need a cold start and that a service restart loses in-memory mission progress. Do not promise an always-on service or durable autosave. No keep-alive traffic, paid upgrade/disk, new service, Live enablement, funded allowance, credential change or redeployment is part of this inspection.
