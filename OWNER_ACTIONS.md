# Publish the Rescue release candidate

Deployment status: **NOT DEPLOYED**. Demo URL: **NOT PROVIDED**. Hosting, billing, repository visibility, and provider settings have not been changed.

Use `catlover-bot/talk-me-home`, branch `work/goal-004-release-candidate`, based on feature commit `a212857e00c8ad75a3b630af2b8e0435c48ad899`. The release commit is the final pushed head of this branch, recorded in `docs/goal-004-validation.md`; select that exact commit when deploying. The starter-only `main`, `npm start`, and original `render.yaml` do **not** serve this game. Original starter commands and notices remain intact.

## 1. Build and publish one Node service

Local production check, without loading `.env` or enabling Live:

```sh
npm ci
npm run build:game
GAME_DISABLE_LIVE=1 npm run start:game
```

Open `http://127.0.0.1:3001`. This runs compiled Node server code and the built React game from one origin. `PORT` overrides 3001; `GAME_BIND_ADDRESS` defaults to loopback. `GAME_ORIGIN` defaults to the matching loopback origin. Use the exact chosen hostname; `localhost` and `127.0.0.1` are different origins.

For the existing Render deployment path, use the prepared **`render.game.yaml`**, or apply its settings to an already approved service. Creating a paid service or disk needs your decision; nothing has been purchased. Render's current [web-service instructions](https://render.com/docs/web-services) require binding to `0.0.0.0` and using `PORT`. Its [persistent-disk instructions](https://render.com/docs/disks) require a paid service, preserve only the mount path, and limit the disk to one instance. Use one service/process; no replicas or process cluster.

| Setting | Value |
| --- | --- |
| Runtime | Node 24 (`NODE_VERSION=24.20.0`) |
| Branch | `work/goal-004-release-candidate`, exact final pushed commit |
| Build | `npm ci --include=dev && npm run build:game` |
| Start | `npm run start:game` |
| Bind | `GAME_BIND_ADDRESS=0.0.0.0`; Render provides `PORT` |
| Origin | `GAME_ORIGIN=https://YOUR-ACTUAL-SERVICE.onrender.com`, no trailing slash |
| Health | `/api/health` |
| Instances | 1; automatic deploy disabled |
| Disk | 1 GB persistent disk mounted at `/var/data` |
| Live | `GAME_PUBLIC_LIVE_ENABLED=0` initially |
| Concurrency | `GAME_LIVE_CONCURRENT_LIMIT=2` (allowed range 1–4) |
| Allowance | `GAME_LIVE_ALLOWANCE_FILE=/var/data/talk-me-home-live-allowance.jsonl` |
| Secrets | `ASSEMBLYAI_API_KEY`; `GAME_DEMO_ACCESS_CODE` (random, at least 16 characters) |

Keep the repository private unless you deliberately choose otherwise. Give Render access through your existing authorized GitHub connection. Confirm the actual service URL, set that exact `GAME_ORIGIN`, then deploy the selected commit. Do not use wildcard origins. HTTPS terminates at Render's proxy; browser API calls stay on the same origin. Practice works without a provider key or Live allowance.

## 2. Deliberately enable a finite Live demo

After approving the hosting/storage choice, open the running service's Render Shell. The disk is unavailable during build. Choose a total number of permitted token attempts; the example below permits **12 attempts, each reserving 600 seconds (7,200 seconds total)**:

```sh
npm run game:allowance -- 12
```

This explicitly creates a new durable allowance file and refuses to replace an existing file. It never runs automatically. Set the two secrets privately, then set `GAME_PUBLIC_LIVE_ENABLED=1` and restart. If `GAME_DISABLE_LIVE=1` is present from testing, remove it deliberately before owner Live use. Do not print or put either secret in a URL, browser build variable, screenshot, or submission document.

Every issued/attempted token consumes one full 600-second reservation before the provider request, including failures or uncertain outcomes. A concurrent slot remains reserved for 670 seconds, allowing the 10-second request timeout, 60-second redemption window, and maximum session duration. Client End/Pause/disconnect never refunds this allowance. The browser still explicitly ends provider connections, and reconnection requires another deliberate action and reservation. A missing, damaged, exhausted, or unwritable file prevents further admission. Restart preserves consumed reservations; sessions and access grants in process memory are lost. Do not delete, replace, roll back, or restore an older allowance to recover unused credits: that would erase the conservative accounting. A new allowance is a separate deliberate owner spending decision.

These are application admission limits, **not a verified AssemblyAI account billing cap**. Other applications using the same key remain outside this allowance. The durable file stores reservation times only; it contains no transcripts or credentials. Browser ownership covers all session routes through HttpOnly cookies. The access grant expires after 30 minutes; browser ownership expires after two hours. This is a small demo access gate, not an account system or complete anti-cheat protection.

Give judges the actual HTTPS URL and access code in the submission's appropriate private access field. Suggested instruction: “Choose Play with voice, check your microphone locally, and enter the supplied demo access code. Live Text also uses the provider. If Live is busy, wait a few minutes or choose the clearly labelled offline Practice mode.” Verify one owner Live connection after enabling it; automated work spent zero provider seconds. Check microphone capture, audible output, and immediate End on your actual browser/device.

## Memory and submission

Pause/resume preserves progress while the service session exists. Refresh recovery is not advertised; page refresh, browser-cookie expiry, or server restart can require a new mission. There is no durable mission autosave. The service admission ledger is the only persistent runtime record. The release server does not expose source files, `.env`, solution documents, or the ledger.

Finish the owner-recorded demo video, presentation, actual URL/access fields, and repository access in `submission/release-checklist.md`. Check the logged-in event form's current cutoff and requirements, and complete final submission. Unknown public links remain **NOT PROVIDED** until you supply them.
