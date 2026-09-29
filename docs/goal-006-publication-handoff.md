# Goal 006 publication handoff

**Accepted candidate, features and media frozen. NOT DEPLOYED. RELEASE_NOT_LIVE_VERIFIED.** No public URLs or judge access have been created.

## Source and service

Repository: `catlover-bot/talk-me-home`. Branch: **`work/goal-006-gameplay-and-submission`**. Pinned deployment source: **[`e3db028c5e9f42376d2c08f400b5aecc1083bc14`](https://github.com/catlover-bot/talk-me-home/tree/e3db028c5e9f42376d2c08f400b5aecc1083bc14)**, which adds only the Goal 006 manifest to accepted delivery `5cbca538c80748c6944a43b9d886e9e74c50ce36`. Game/test source remains unchanged from `2a08aefe835a45ca815c281753784b3f8b4e6487`. The final handoff commit adds documentation and local verification evidence on top; its exact-head CI covers the same frozen application and manifest.

Select **[render.goal-006.yaml](../render.goal-006.yaml)** as the custom Blueprint Path. The preserved `render.game.yaml` is Goal 005; starter `render.yaml` and `npm start` do not serve this game. Current Render [Blueprint settings](https://render.com/docs/blueprint-spec) and [custom path instructions](https://render.com/docs/infrastructure-as-code) were checked on September 30, 2026 JST.

| Setting | Prepared value |
| --- | --- |
| Service | `talk-me-home-goal-006`, Node 24.20.0, one instance |
| Compute / disk | `0.5c-512mb`, 1 GB at `/var/data`; paid resources, not created |
| Automatic deployment | Off; also set Blueprint Auto Sync to No after owner-approved creation |
| Build | `npm ci --include=dev && npm run build:game` |
| Start | `npm run start:game` |
| Bind / port | `GAME_BIND_ADDRESS=0.0.0.0`; hosting-provided `PORT` |
| Health | `/api/health` |
| Origin | `GAME_ORIGIN`: actual HTTPS service origin, no path or trailing slash; never `*` |
| Live | `GAME_PUBLIC_LIVE_ENABLED=0`, `GAME_DISABLE_LIVE=1` |
| Dormant admission safeguards | Concurrency 2; `/var/data/talk-me-home-live-allowance.jsonl`; no allowance is created |

The owner supplies the actual origin during authorized setup. Initial Practice needs no API key, demo access code or allowance. Production reads hosting variables, never the owner's `.env`. Sessions live in one process and are lost on restart; the disk does not save missions. Render's [port/proxy rules](https://render.com/docs/web-services#port-binding) and [disk boundaries](https://render.com/docs/disks) inform these settings. Use [Deploy a specific commit](https://render.com/docs/deploys#manual-deploys) for the pinned source on an approved service; the Blueprint branch remains Goal 006.

Future Live is a separate decision: explicit enablement, private `ASSEMBLYAI_API_KEY` and `GAME_DEMO_ACCESS_CODE`, finite durable owner allowance, and relevant acceptance. Preserve all exhausted historical ledgers. Do not initialize or replenish funding in build/start hooks. No new Live check is required for this completed local preparation.

## Submission fields

All files below are under [`submission/goal-006/`](../submission/goal-006/README.md); the delivered package is unchanged.

| Field | File or eventual link |
| --- | --- |
| Title / summary | `submission-form.md`: Title (12 characters), Summary (159 characters) |
| Long description / technologies | The corresponding sections of `submission-form.md` (description: 248 words) |
| Cover | `cover-1920x1080.png` |
| Demo video | `Talk_Me_Home_Submission.mp4`, 209.5 seconds, 1080p; upload URL **NOT PROVIDED** |
| Subtitles | `video-subtitles.srt`; also selectable inside the MP4 |
| Presentation | `Talk_Me_Home_Pitch.pdf`; editable six-slide source `Talk_Me_Home_Pitch.pptx`; hosted link **NOT PROVIDED** |
| Screenshots | `screenshots/practice-{cargo,gallery,dock,home}.png`, labelled Practice |
| Repository | [Goal 006 branch](https://github.com/catlover-bot/talk-me-home/tree/work/goal-006-gameplay-and-submission); reviewer access **NOT CONFIRMED**, visibility unchanged |
| Working demo | Actual approved HTTPS deployment URL: **NOT PROVIDED**; initially Practice with Live unavailable |
| Supporting download, if accepted by the form | `Talk_Me_Home_Submission_Package.zip`, 17 deliverables; MP4/ZIP remain local and Git-ignored |
| Provenance / limitations | `media-manifest.json`, `practice-source.json`, `screenshots/mode-build-manifest.json`, `README.md` |

The video preserves a historical Goal 005 real AssemblyAI success on `2edf7914a008143843923b04a9bf3a1fe41f1f68`: synthetic microphone, deliberate confirmations, all three chapters and confirmed home, provider ending ACK. Another run on that same candidate failed in Gallery without an ending ACK. Goal 006's new gameplay is separately labelled offline Practice; its 470 unit and 160 browser passes establish offline behavior, **not a new Live completion or human playtest**. Keep these distinctions in the submitted description and media.

## Remaining owner decisions

1. Authorize the prepared Render service/cost and publication, or identify an already approved service to receive these settings; provide its actual origin and permitted repository/reviewer access. Goal 006 is already selected, so no candidate decision remains.
2. Authorize authenticated video/deck upload (or direct form attachments), verify the logged-in event's current fields and cutoff, and submit. Record actual links and the final submission confirmation. Do not treat the local package or a saved draft as a submitted entry.

The media requires no regeneration. Human enjoyment, physical audio and repeat-run Live reliability remain evidence limitations, not newly invented submission fields.

## Preparation verification

[Local verification](../artifacts/goal-006/publication-prep/local-verification-final.json) passed all 11 checks: parsed the actual manifest, built and started the production game, ran three existing production tests, and checked assets, health, origin restrictions, browser ownership and disabled-Live rejection. The local run used loopback bind/origin and an absent temporary allowance path, with no inherited credentials. Cleanup was graceful and the port closed. No provider call, token or allowance was created. The unchanged game/tests/harness/package configuration was checked against the accepted delivery. Render schema/account acceptance and hosted HTTPS were not tested; local build used installed dependencies, while CI performs `npm ci`.

[Preservation verification](../artifacts/goal-006/publication-prep/media-preservation.json) confirms all 17 ZIP members, MP4/PPTX/PDF/ZIP hashes, 19 tracked submission files, Goal 005 manifest and archived owner handoff are unchanged. The initial verifier-only npm configuration error and its successful recheck are retained beside the final receipt; no application repair was required. Exact final pushed-head CI and commit are reported in the delivery message, with the fetched receipt at `.validation/goal-006-publication-prep/final-ci.json`. No service, upload, visibility change or submission was performed.
