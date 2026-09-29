# Owner deployment and submission decisions

**NOT DEPLOYED. RELEASE_NOT_LIVE_VERIFIED.** Public URL and judge access are not provided. Goal 005 produced one complete final-candidate synthetic Voice Rescue with ending ACK; its two-pass target was not met. The fixed eight-attempt additional batch is exhausted. No further provider use is authorized. No hosting, billing settings, visibility or upload was changed.

**Goal 006 local delivery:** `work/goal-006-gameplay-and-submission` in `/home/mhirotaka/workspace/talk-me-home-goal-006` adds tested cooperation improvements and the explicitly selected optional recorder. Its new footage is Practice; the historical real Voice story remains the unchanged Goal 005 attempt 12. The [local package](submission/goal-006/README.md) includes an actual MP4, editable six-slide PPTX/native PDF, cover, current screenshots, subtitles and submission copy. No ordinary media editing or browser execution is left to the owner. A future public release must explicitly choose between this offline-tested gameplay candidate and the demonstrated historical candidate below, provide hosting/access and any finite Live funding, then perform authenticated uploads/submission. The existing deployment manifest is not silently redirected to the new unverified runtime.

Use `catlover-bot/talk-me-home`, branch **`work/goal-005-gallery-live-completion`**. Final runtime/player candidate `2edf7914a008143843923b04a9bf3a1fe41f1f68` passed 437 unit tests, 142 browser cases, typecheck, build and production Practice. Both last real attempts used that identical frozen candidate. See the [actual result, remaining defects and final CI](docs/goal-005-gallery-live-completion.md). Later delivery commits contain evidence, documentation, media and CI sharding; use the exact final feature head identified there for any separately approved deployment. Starter `main`, `npm start`, and `render.yaml` do not run this game.

**Separate stabilization candidate:** `work/goal-005b-targeted-stabilization` contains targeted direction-inspection and diagnostic changes with offline validation only. [Goal 005B report](docs/goal-005b-targeted-stabilization.md) separates its identity from the successful Goal 005 recording. Existing video/deck/provenance still describe the demonstrated Goal 005 build. No new Live slot is funded. The unchanged public 600-second cap leaves only 22.7867 seconds beyond that successful sample; the report proposes a finite manual checkpoint/resume review plan for a later explicit approval, without activating it.

## 1. Decide whether to publish the prepared service

Approve or decline the existing **Render Node service plus 1 GB disk** described by [render.game.yaml](render.game.yaml), initially with Live disabled. This is the one hosting decision; no service or paid disk has been created. An approved existing Render service can use these same settings. The prepared references are Render's [Node web-service instructions](https://render.com/docs/web-services) and [persistent disk instructions](https://render.com/docs/disks).

| Setting | Prepared value |
| --- | --- |
| Branch | `work/goal-005-gallery-live-completion`, exact approved final head |
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

Public Live is a **separate future spending and acceptance decision**. Historical C/D/E QA remains exhausted at 5 attempts / 3,350 reserved seconds / USD 4.1875 planning estimate. The one Goal 005 extension consumed all 8 additional attempts / 7,760 seconds / USD 9.70 estimated reservation cost. Combined history is 13 attempts / 11,110 seconds / USD 13.8875 estimated, with zero remaining capacity. These are conservative reservations, not an invoice, refreshed balance or public-player allowance. There are no refunds, replacement slots or automatic replenishment. A future grant must specify finite capacity; the existing owner-only creation command refuses to replace a ledger. Each ordinary public token attempt conservatively consumes 600 seconds, with a 670-second concurrency reservation. The approved private QA used its separate 900/970-second limits. These local limits are not an AssemblyAI account billing cap. Missing or exhausted storage fails closed.

Any later enabled demo needs its actual HTTPS URL and private judge access instructions. Give judges feature-branch source access deliberately; visibility remains unchanged. The final ordinary synthetic Voice run completed Cargo, Gallery backtracking, Dock and home with 11 exact confirmed commits; the provider reported 576.923132 seconds and acknowledged End. The second run recovered from a deliberately declined Latch proposal, but stopped in Gallery at the 120-second passage-recovery bound. It did not reach Dock/home and received no ending ACK; 567.4462 seconds is local socket duration only, with provider duration unknown. Local audio/browser/server cleanup completed. The report preserves the outstanding first-inspection failures and delayed responses. Human microphone/speaker quality, natural play and enjoyment remain unverified.

## 2. Review the produced files and complete external submission

Current Goal 005 files are the editable [PPTX](submission/Talk_Me_Home_Goal005_Pitch.pptx), native-rendered [PDF](submission/Talk_Me_Home_Goal005_Pitch.pdf), and **local `submission/Talk_Me_Home_Goal005_Demo.mp4`**. The demo separates silent Practice UI operations from excerpts of one successful synthetic-microphone real Voice mission, discloses cuts, preserves original dialogue/audio, and states the unmet two-pass target. The successful uncut run and every failed original remain local. See [media paths, provenance and inspection](submission/goal-005-deliverables/README.md) and the [checklist](submission/release-checklist.md). Earlier Goal 004E PPTX/PDF/video files remain preserved as historical deliverables.

Review these local files, decide the public hosting/access scope, and check the logged-in event form's current cutoff and requirements before uploads and final submission. The local draft is not a claim of event compliance. Uploads, public links and final submission remain owner actions; no ordinary implementation or browser work is delegated back to the owner.
