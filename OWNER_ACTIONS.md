# Owner deployment and submission decisions

**NOT DEPLOYED. RELEASE_NOT_LIVE_VERIFIED.** Public URL and judge access are not provided. No hosting, billing, visibility, provider allowance or upload was changed.

Use `catlover-bot/talk-me-home`, branch **`work/goal-004e-confirmed-actions`**. The delivered candidate is `d094ba654895a300d97b5741262ce90353a80ef6`; its [exact-head CI passed](https://github.com/catlover-bot/talk-me-home/actions/runs/36435823074). Frozen application source `fcbd513effb17d8c90e612c28aa92ed76c070b7e` passed 358 unit tests, 124 browser cases and the complete local production check. The subsequent recheck changes only QA preflight and handoff evidence; application, prompt, configuration and shared player remain unchanged. Use the final feature head identified in the delivery report for any later approved deployment. Starter `main`, `npm start`, and `render.yaml` do not run this game.

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

Public Live is a **separate future spending and acceptance decision**. Linked C/D/E QA is exhausted at 4 attempts / 2,680 reserved seconds / USD 3.35 planning estimate and is not a public-player allowance. No new calls or allowance changes are authorized. A future grant must specify finite capacity; the existing owner-only creation command refuses to replace a ledger. Each public token attempt conservatively consumes 600 seconds, with a 670-second concurrency reservation. End does not refund it. These limits are not an AssemblyAI account billing cap. Missing or exhausted storage fails closed.

Any later enabled demo needs its actual HTTPS URL and private judge access instructions. Give judges the feature-branch source access deliberately; do not change visibility implicitly. The historical synthetic Voice run confirmed one Latch action and then failed Cargo. Offline repairs do not establish a full Live clear, human microphone/speaker quality, natural play or enjoyment.

## 2. Review the produced files and complete external submission

The editable [PPTX](submission/Talk_Me_Home_Pitch.pptx), native-rendered [PDF](submission/Talk_Me_Home_Pitch.pdf), and **local `submission/Talk_Me_Home_Demo_Draft.mp4`** are finished. The 166.79-second, 1280×720, 4,526,386-byte H.264/AAC draft explicitly separates retained failed synthetic Voice from new completed Practice; it is not an owner human-play recording or full Live evidence. Recorded gameplay audio appears only within the historical excerpt at 29.0–73.6 seconds, including pauses. Titles, Practice and ending are silent; the file is not narrated throughout. The outputs and historical originals were rechecked without regeneration. See [provenance](submission/local-deliverables/provenance.json), [recheck readiness](artifacts/goal-004e/recheck-preflight/readiness.json) and [checklist](submission/release-checklist.md).

Review these local files, decide the public hosting/access scope, and check the logged-in event form's current cutoff and requirements before uploads and final submission. The local draft is not a claim of event compliance. Uploads, public links and final submission remain owner actions; no ordinary implementation or browser work is delegated back to the owner.
