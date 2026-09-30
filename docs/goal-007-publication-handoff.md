# Goal 007 current publication handoff

## Current decision

The owner reports manually deploying existing Render service `talk-me-home` (`srv-dauc8fek1f9s73b93pc0`) through the dashboard on the **Free plan, without a persistent disk**, with successful deployment from `caa896d`. The owner supplied [https://talk-me-home.onrender.com](https://talk-me-home.onrender.com) as the application URL. Public `/api/version` independently reports application commit `caa896d3a90dd4e8cb26499dba586b646bb7030a`, version `0.7.0`. This newer decision supersedes the earlier paid-service/disk proposal for current work. The existing application is the inspection target; no new deployment is required just to verify it. The dashboard's reported “Live/Deployed” state describes the deployment, not provider Live availability.

Do not create another service, upgrade the plan, attach a paid disk, enable Live, initialize a funded allowance, change credentials, or submit the LABLAB form. Public HTTP/browser checks do not require Render CLI authentication. No existing grant is reset or replaced.

## Evidence axes

| Axis | Current evidence |
| --- | --- |
| Dashboard deployment | Successful deployment from `caa896d`, reported by the owner; not independently inspected |
| Actual public HTTPS URL | [talk-me-home.onrender.com](https://talk-me-home.onrender.com), supplied by the owner and responding over HTTPS |
| Public HTTP, assets, health and identity | PASS: health, page, safe version, hashed JavaScript/CSS MIME/cache and SPA reload; application `caa896d3a90dd4e8cb26499dba586b646bb7030a` / `0.7.0` |
| Hosted Practice | PASS: fresh-browser recorder-collected and selected-skipped rescues reached server-confirmed home through all three chapters; separate from local checks and real Voice |
| Live availability | Read-only `/api/access` returned `liveEnabled=false`, `available=false`, `authorized=false`, `maxSessionSeconds=600`; both Live Text and Live Voice UI showed unavailability and disabled Connect |
| Current real Voice | Not verified; intentionally outside this continuation's scope |
| New provider requests, token issuance and funding | None performed by this continuation |
| Source publication | [catlover-bot/talk-me-home](https://github.com/catlover-bot/talk-me-home): GitHub API currently reports Public; unauthenticated repository HTTPS returned 200; this continuation did not change visibility |
| Event submission | Not performed |

The URL comes from the owner's supplied service details. No Render credentials were used for the public HTTP checks. GitHub reports Public, and a separate unauthenticated HTTP request to the repository returned 200. This observes an external visibility change; it does not claim that this session changed visibility or resolved the earlier historical-data disclosure decision.

## Bounded public verification

The first `/api/health` request returned 200 with `{ "ok": true }` in 22.261 seconds, within the single 120-second cold-start allowance. There was one request and no additional cold-start wait. The following homepage, version and access requests also returned 200. Private HTTP evidence is preserved in `.validation/goal-007/hosted-free-20260930T083358Z/cold-start.json` and `http.json`. No scheduled keep-alive traffic is used.

Verification covered `/api/health`, safe `/api/version` identity, the page, required assets and SPA reload, followed by fresh-browser Practice rescues. Provider/token requests and WebSockets were guarded and counted; no issuance probe or access code was used.

The hosted browser inspection passed on September 30, 2026, from 08:35:23.884 to 08:36:22.851 UTC. The recorder-collected rescue committed 12 exact confirmations and declined one proposal before a fresh proposal; the selected-skipped rescue committed 11 exact confirmations. Both reached Cargo Bay, Relay Gallery, Return Dock and confirmed home, including Gallery backtracking. Power, Relay and Dock controls, route annotation/Undo/erase/undo-erase, retained Gallery progress and private route mark across Pause/resume, and two distinct replay rounds starting in Cargo Bay passed. The receipt records zero errors and completed browser cleanup.

Provider HTTP requests, browser token requests, WebSocket attempts and negative token probes were each zero. The test used normal Practice UI and deterministic simulation; it supplies no human speech, audible provider playback, real Voice or provider ending-ACK evidence. The private receipt and screenshots are preserved under `.validation/goal-007/hosted-free-20260930T083358Z/practice/`, including `receipt.json`, `collected-route-controls.png`, `selected-skipped-replay.png` and `selected-skipped-home.png`. Those three screenshots were visually inspected, alongside the entrance, collected ending and unavailable Text screenshots inspected separately.

A narrow fresh-browser Voice readiness check passed from 08:37:44.876 to 08:37:47.793 UTC in the same authorized verification session. It displayed “Live is unavailable for this demo. Practice is available without a connection.” and disabled Connect Live Voice. The explicit Choose Practice alternative reached Cargo Bay and could be paused. There were zero forbidden requests, WebSocket attempts, failed HTTP requests or HTTP errors, and the browser closed. The private receipt is `.validation/goal-007/hosted-free-20260930T083358Z/voice-unavailable.json`; its screenshot was visually inspected. No provider connection was attempted.

The [safe hosted verification receipt](../artifacts/goal-007/free-hosted-verification.json) accompanies reviewable screenshots of the [entrance](../artifacts/goal-007/hosted-free/entrance-1280.png), [recorder-collected ending](../artifacts/goal-007/hosted-free/collected-home.png), [selected-skipped ending](../artifacts/goal-007/hosted-free/selected-skipped-home.png) and [unavailable Voice UI](../artifacts/goal-007/hosted-free/voice-unavailable.png).

Render documents that Free web services can sleep after inactivity and lose local filesystem changes on restart/redeploy/spin-down. The game's missions are also in-memory. Do not describe this deployment as always-on or durably saved. These constraints are documented at [Render's Free service reference](https://render.com/docs/free); do not install a wakeup job to avoid them.

Keep the observed deployed application commit separate from any later documentation or inspection-script commit. A documentation update does not require a deployment just to inspect this owner-published revision.

## Inspection harness readiness (local only)

The `--disabled-live-only` inspection mode passed one local compiled-production smoke against the unchanged `caa896d` application. It completed recorder-collected and selected-skipped rescues, exact confirmations, route marks/Undo/erase/undo-erase, retained route marks across Pause/resume, and two actual new replay rounds. Read-only access status and visible UI confirmed Live unavailable. Provider HTTP, browser token endpoints, negative token probes and WebSocket counts were all zero; owned browser/server cleanup completed. This verifies the inspection procedure, not the public service. [Safe local receipt](../artifacts/goal-007/free-inspection-harness-offline.json). All 15 existing component-manifest files remain unchanged.

The single hosted browser inspection uses the supplied origin after the successful bounded HTTP check:

```sh
node scripts/qa-hosted-practice.mjs --run --disabled-live-only \
  --origin https://talk-me-home.onrender.com \
  --expected-commit caa896d3a90dd4e8cb26499dba586b646bb7030a \
  --output .validation/goal-007/hosted-free-practice-UNIQUE
```

Do not run the historical paid harness or the default token-denial probes for this inspection. The script and documentation are local inspection changes; application/runtime source is unchanged. Do not push these changes in a way that triggers an unneeded Render deployment while the service's automatic-deploy setting is unknown.

## Current local publication media

The [Free Practice media edition](../submission/goal-007/free-publication/README.md) updates the previously pending-publication narration and slides using the saved hosted receipt. It includes a 209.733-second 1920x1080 MP4, 50-cue SRT, six editable slides, native PDF and an explicit allowlist ZIP. The movie preserves 170.9 seconds of normal-speed local Practice from `d22d39a`; the hosted `caa896d` evidence is separate and labelled. Local presentation narration is never represented as Pip/provider audio. Deck screenshots retain their individual `66f1bd2` or `caa896d` origins.

Full video decode, stream/duration checks, exact subtitle text/hash checks, sampled audio checks and actual representative/transition-frame inspection passed. Deck pages were rendered and visually inspected. All 15 original component-manifest entries and the prior preview MP4/SRT/ZIP retain their hashes. New MP4/ZIP remain local; no media upload, final submission, extra public-app request or provider call was made for this update. Feature-branch documentation/media commits do not change the deployed `caa896d` application.
