# Talk Me Home

**You have the map. Pip has eyes and hands. Neither can get home alone.**

A browser-based cooperative rescue for one human and an AI partner. Read the station plans, ask Pip what it can see, and choose a way home through Cargo Bay, Relay Gallery and Return Dock. An optional flight recorder gives you a reason to take a detour; coming straight home is also a complete rescue.

![Original Talk Me Home cover illustration, not gameplay](submission/goal-006/cover-1920x1080.png)

## Play

**Public game URL: publication in progress; not yet deployed.** Goal 007 is integrating the game into main and publishing one controlled Render service. [Current release evidence](docs/goal-007-release-and-immersion.md) records the actual state.

- **Practice** is deterministic and offline. Start here to learn the shared controls without a provider connection.
- **Live Voice** uses AssemblyAI speech recognition, dialogue and digital playback. It requires explicit connection and protected access. Live Text also uses a real provider.
- You operate Power, Relay and the Dock controller. Pip inspects local equipment and proposes actions. Read each specific proposal, then choose **Confirm this action** or **Not yet**. Saying “yes” does not commit an action.
- Use the map, quoted reports and reversible private route marks. Pip does not receive your private notes or the full map.
- **Pause** preserves the running server session. **End** stops the connection. A server restart loses mission progress; there is no durable autosave.

Classic and Maintenance remain available as Training. The optional recorder starts off; a shelf item appears only after an actual pickup and server-confirmed home.

## Run locally

Node **24** is required.

```sh
npm ci --include=dev
npm run build:game
GAME_DISABLE_LIVE=1 npm start
```

Open `http://127.0.0.1:3001`. `npm start` and `npm run start:game` serve the compiled game and API from one origin. The production server reads its hosting environment only and never loads an owner `.env`. Practice requires no API key.

For development: `npm run dev`. Verification: `npm run typecheck`, `npm test`, and `npm run test:e2e`. Default QA and CI stay offline; synthetic devices are not human microphone or physical speaker evidence.

## Controlled release

The canonical [render.yaml](render.yaml) selects **main**, one Node instance and one 1 GB disk, with automatic deployment and Live disabled initially. Hosting is an explicitly authorized recurring service; the Goal 007 agreement caps its combined base rate at USD 8/month, with taxes and usage-based overage separate. Only the tested main commit is deployed. `/api/version` exposes the build commit and application version.

The new release grant has separately capped QA and reviewer purposes. Reviewer access stays disabled until its hosted acceptance pair passes. Historical grants remain exhausted and are never replenished. Provider credentials, access codes, funded ledgers and raw recordings are never public assets.

Current Goal 007 gameplay has offline evidence: a shorter radio briefing, a persistent first-question suggestion, clear conversation phases and confirmation receipts, optional quiet radio ambience, and distinct recorder/direct-return homecomings. The existing media's real Voice success is a historical Goal 005 run with a synthetic microphone; another run on that same build failed in Gallery without an ending ACK. Goal 007's current hosted Voice results will be recorded separately. No human enjoyment or statistical reliability claim is made.

## Source, media and attribution

[Goal 007 editable deck and current screenshots](submission/goal-007/README.md) · [Goal 006 preserved local package](submission/goal-006/README.md) · [Goal 007 release record](docs/goal-007-release-and-immersion.md) · [Historical README](README_GOAL006_HISTORY.md)

This project extends [AssemblyAI's voice-agent-starter-js](https://github.com/AssemblyAI/voice-agent-starter-js). Original files and notices remain. No license grant for upstream work is invented; review the included provenance before reuse.

The original browser starter remains available as `npm run start:starter`. `publish`, `import` and `phone` are separate starter utilities, not game deployment commands. Its original manifest is preserved under [deployment/starter/](deployment/starter/README.md). Historical Goal 005/006 manifests remain references; do not apply them as additional services. npm package publication remains disabled with `private: true`.
