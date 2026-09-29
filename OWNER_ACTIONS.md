# Owner deployment and submission decisions

**NOT DEPLOYED. RELEASE_NOT_LIVE_VERIFIED.** Public URL and judge access are not provided. The explicitly approved fifth private QA attempt is consumed; no further provider use is authorized. No hosting, billing settings, visibility or upload was changed.

Use `catlover-bot/talk-me-home`, branch **`work/goal-004e-confirmed-actions`**. Prepared commit `c38a10c1567e55d93eb00e07136646258a37d5f0` was minimally activated and frozen as execution head `0d21f7cd30cbb4d4b59a9710a53228cd7bad8b4d`. Application source remains `fcbd513effb17d8c90e612c28aa92ed76c070b7e`, whose historical complete local suite passed 358 unit tests and 124 browser cases. Activation passed 89 focused checks and typecheck. Application, prompt, configuration, shared player and acceptance criteria were unchanged for the real recheck. See the [actual result and evidence](docs/goal-004e-confirmed-actions.md#approved-fifth-attempt-result). Use the final feature head and exact-head CI identified in the delivery report for any later approved deployment. Starter `main`, `npm start`, and `render.yaml` do not run this game.

## 1. Decide whether to publish the prepared service

Approve or decline the existing **Render Node service plus 1 GB disk** described by [render.game.yaml](render.game.yaml), initially with Live disabled. This is the one hosting decision; no service or paid disk has been created. An approved existing Render service can use these same settings. The prepared references are Render's [Node web-service instructions](https://render.com/docs/web-services) and [persistent disk instructions](https://render.com/docs/disks).

| Setting | Prepared value |
| --- | --- |
| Branch | `work/goal-004e-confirmed-actions`, exact approved final head |
| Runtime | Node 24.20.0, one instance, automatic deploy off |
| Build | `npm ci --include=dev && npm run build:game` |
| Start | `npm run start:game` |
| Bind / port | `GAME_BIND_ADDRESS=0.0.0.0`; hosting-provided `PORT` |
| Origin | `GAME_ORIGIN` set to the actual HTTPS service origin, no trailing slash |
| Health | `/api/health` |
| Persistent disk | 1 GB at `/var/data` |
| Initial Live setting | `GAME_PUBLIC_LIVE_ENABLED=0` |
| Future Live secrets | `ASSEMBLYAI_API_KEY`, `GAME_DEMO_ACCESS_CODE` (at least 16 characters), supplied privately |
| Future Live limits | `GAME_LIVE_CONCURRENT_LIMIT=2`; `GAME_LIVE_ALLOWANCE_FILE=/var/data/talk-me-home-live-allowance.jsonl` |

Practice runs without a provider key or allowance; leave future Live secrets and the allowance file unconfigured for the initial Live-disabled deployment. For a local production check: `npm run build:game`, then `GAME_DISABLE_LIVE=1 npm run start:game`, and open `http://127.0.0.1:3001`. The release server does not load `.env`. Use one origin and one process; sessions are in memory, and a server restart loses mission progress. Pause can preserve an existing session; durable autosave is not advertised. The [current Render port instructions](https://render.com/docs/web-services#port-binding) and [disk persistence boundaries](https://render.com/docs/disks) were rechecked on September 28, 2026; a disk preserves the allowance file, not in-memory missions.

Public Live is a **separate future spending and acceptance decision**. Linked C/D/E QA is exhausted at 5 attempts / 3,350 reserved seconds / USD 4.1875 planning estimate and is not a public-player allowance. The fifth grant consumed one 670-second / USD 0.8375 reservation; there is no retry or refund. No new calls or allowance changes are authorized. A future grant must specify finite capacity; the existing owner-only creation command refuses to replace a ledger. Each public token attempt conservatively consumes 600 seconds, with a 670-second concurrency reservation. End does not refund it. These limits are not an AssemblyAI account billing cap. Missing or exhausted storage fails closed.

Any later enabled demo needs its actual HTTPS URL and private judge access instructions. Give judges the feature-branch source access deliberately; do not change visibility implicitly. The September 29 real synthetic Voice recheck crossed Cargo and completed one Gallery gate move, then stopped because Pip supplied no current emblem after the permitted clarification. Three confirmed actions committed, but Dock and home were not reached. The real provider reported 163.862032 seconds; ending ACK arrived 266 ms after explicit End, followed by verified cleanup. This is a failed Rescue, with no human microphone/speaker quality, natural play or enjoyment claim.

## 2. Review the produced files and complete external submission

The editable [PPTX](submission/Talk_Me_Home_Pitch.pptx), native-rendered [PDF](submission/Talk_Me_Home_Pitch.pdf), and **local `submission/Talk_Me_Home_Demo_Draft.mp4`** are finished and retained unchanged after the failed recheck. The 166.79-second, 1280×720, 4,526,386-byte H.264/AAC draft explicitly separates the September 28 failed synthetic Voice excerpt from completed Practice; it is not an owner human-play recording or full Live evidence. Recorded gameplay audio appears only within the historical excerpt at 29.0–73.6 seconds, including pauses. Titles, Practice and ending are silent; the file is not narrated throughout. The new failed recording is preserved separately in `.validation/goal-004c-live/2026-09-29T03-22-38-226Z-voice-mission/`. See [provenance](submission/local-deliverables/provenance.json), [new media review](artifacts/goal-004e/recheck-live/media-review.json) and [checklist](submission/release-checklist.md).

Review these local files, decide the public hosting/access scope, and check the logged-in event form's current cutoff and requirements before uploads and final submission. The local draft is not a claim of event compliance. Uploads, public links and final submission remain owner actions; no ordinary implementation or browser work is delegated back to the owner.
