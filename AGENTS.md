# Talk Me Home game rules

On September 26, 2026 JST the owner explicitly approved Goal 004C Part B after delivered head `35ced22e0fbba070f2533bb4e3eaeca30ea3723c`. This supersedes Part A's zero-new-use rule only for the single `.validation/goal-004c-live/` campaign: at most two token attempts, one active connection, 600 connected seconds per attempt, 670 reserved seconds each, 1,340 seconds total, and at most USD 1.68 estimated using verified official pricing. Existing balance only; no purchase, billing change or public deployment. Inspect/reuse existing accounting and never replenish it. Text must pass and terminate with ACK before Voice on the same frozen candidate; failure, unconfirmed termination or a candidate change stops the remaining attempt. Commit the activated harness before execution. Defaults and CI stay offline. Record the approval and actual Part B outcomes in the current Goal 004C evidence; retain Part A and Goal 004B history.

Goal 004C Part A runs on `work/goal-004c-live-recovery`, based on `00d10e1c21fa8de40a4c9bf5e49dce5126c2b04c`. New real-provider authorization is zero. Goal 004B's three attempts remain exhausted; preserve every ledger and historical uncertainty. The proposed two-attempt Goal 004C retest requires separate subsequent owner approval; no environment variable, local file, or command-line flag constitutes approval. Do not create a funded allowance during Part A. Keep defaults and CI offline. Current evidence belongs in `docs/goal-004c-live-recovery.md` and `artifacts/goal-004c/`. Commit/push only this feature branch and inspect its exact final CI head. Preserve gameplay, authority, information separation, and artwork. Distinguish `OFFLINE_REPAIR_PASS`, real Text/Voice rescue passes, and `REMOTE_END_CONFIRMED`; retain `RELEASE_NOT_LIVE_VERIFIED` until the relevant real tests are authorized and pass.

Goal 004B autonomous QA runs on `work/goal-004b-autonomous-qa`, based on the Goal 004 release candidate. Its explicit owner authorization permits one separately named campaign of at most three token attempts, each durably reserving 670 seconds, under `.validation/goal-004b-live/`. Use the independent supervisor and existing production admission together. Never reset/replenish either ledger. Default QA and CI remain offline; real calls require the explicit `qa:live -- --live --scenario ...` path. Synthetic speech is not human speech or physical speaker evidence. New evidence belongs in `docs/goal-004b-autonomous-qa.md`; preserve earlier reports as history. No public deployment, PR, main merge, visibility, or billing change is authorized.

## Goal 004 release candidate

- Current work belongs on `work/goal-004-release-candidate`, derived from Goal 003 feature head `a212857e00c8ad75a3b630af2b8e0435c48ad899`; do not use starter-only `main` as the game base. Preserve later owner edits.
- Current validation belongs in `docs/goal-004-validation.md`. Goal 001–003 validation files are historical evidence.
- Automatic real-provider use remains zero. Local readiness, injected providers, and Practice must never silently contact AssemblyAI. Do not run `test:live` or republish agents.
- `build:game` and `start:game` build/serve the production game. Original `start` and `render.yaml` remain starter entry points; the game deployment file is `render.game.yaml`.
- Public Live requires explicit enablement, browser ownership, demo access, and a durable conservative admission allowance. Never initialize, reset, refund, or replace an owner allowance automatically. Never load owner `.env` in the release server.
- Art remains a static reference or neutral communications portrait. Homecoming art mounts only after confirmed completion. Private annotations, hidden obstructions, and future clues never drive art or sound.
- Feature-branch commits/push and CI verification are authorized for this goal. Public deployment, repository visibility changes, billing, submission, video uploads, PRs, and main merges remain owner actions.

The following Goal 003 rules continue to apply except for the current branch and validation document above.

The Rescue Mission and Training game extend the upstream starter without replacing its deployments. The game-specific rules below take precedence for `game/`, `tests/`, and `scripts/`; the original starter conventions remain below.

- Use Node.js 24, React, Vite, and TypeScript for the game. Root game commands are `dev`, `typecheck`, `test`, `test:e2e`, and `build`. Preserve `start`, `publish`, `import`, and `phone` as starter commands.
- `game/server/` owns per-session authoritative state, role-specific HTTP routes, action validation, temporary-token issuance, and lifecycle. No database. Restarting this process loses missions.
- `game/shared/` contains safe contracts only. Hidden state and the puzzle solution do not belong in browser-shared data.
- `game/client/` owns mission control, static map/wiring documents, deterministic Mock, subtitles, and Live transport. Keep raw player transcripts faithful.
- `game/agent/` owns a compact English runtime prompt and documented inline function-tool configuration. Do not send developer documents, test fixtures, hidden state, wiring notes, or answer keys to the robot. Do not expose undiscovered object names in tool schema enums.
- Only the human controls Power, Relay, and the remote charge controller. Only robot tools inspect, interact, and move locally. Training ends at its validated crossing; Rescue ends only at a validated return home. Validate current state at commit; reject stale round/chapter actions, forged arguments, and conflicting retries. Deliver a committed chapter-transition result once before rejecting incompatible queued work.
- Human projections must not stream local observations. Strip human projections from tool results before forwarding them to AssemblyAI. This is solo gameplay separation, not protection against browser developer tools.
- All new application-authored UI, errors, prompts, comments, tests, and documents are English. Use canonical Power, Door, Conveyor, and Latch. No localization framework for this goal.
- Fetch the current AssemblyAI documentation index and relevant official pages before changing integration code. Inline configuration and browser function tools are authorized for this game. Do not combine `agent_id` with inline configuration.
- Preserve `.env` and ignored credentials. Never print keys, tokens, resume tokens, or authorization headers. No secrets in `VITE_` variables, logs, screenshots, fixtures, or bundles.
- Default to Rescue Mission with Practice (deterministic Mock). CI needs no provider secrets and must never run Live. Goal 003 authorizes zero automatic real-provider seconds: do not run `test:live` or contact the provider for screenshots. Goal 001's 111.0 seconds and ignored cumulative budget ledger are historical evidence, not a fresh allowance. Preserve the ledger unchanged.
- Run typecheck, unit tests, Mock browser tests, build, and `git diff --check`. Inspect actual browser screenshots. Report text/tool, microphone, audible playback, and human play tests separately.
- Work on `work/goal-003-rescue-mission`, based on Goal 002 commit `40583a9f3aad714fe1941591f74eb99c9867ba68`. Preserve unrelated edits and upstream history. Explicitly target `-R catlover-bot/talk-me-home` in GitHub CLI operations. Do not commit to or merge main, force-push, open a PR, change visibility, publish publicly, or change billing settings.
- Preserve Classic and Maintenance as Training. Rescue is one round through Cargo Bay, Relay Gallery, and Return Dock. The Gallery has two fixed authored obstruction configurations, selected server-side. Human map annotations are private inferences. Public chapter beacons and the narrowly defined Return Dock energy/readiness instrument are the only added instrumentation; no live map marker or full room state.
- The installed Maintenance plate and selector are server-only; both manual rows belong to the human. Never pass the mapping, full Gallery graph, hidden obstruction, or solution into Pip's prompt or automatic recap. Return authorization is scoped and revocable; pause/interruption revokes it while preserving committed physical progress.
- `game/server/records.ts` owns bounded audience-scoped records. Exact pinned reports retain round, message, source, and time; private notes never enter robot context. Reconnection recap contains historical robot observations/actions and untrusted communicated player quotes only.
- `game/client/useMission.ts` owns mission/connection lifecycle and round guards. Presentation lives in `components/`; source history must never be relabelled when the next connection mode changes. Speaking follows actual local PCM playback, not a transcript or received audio event.
- Preserve the observed delayed tool/reply correlation regressions. CI's Live-disable flag must not suppress explicitly injected fake transports and leave an unresolved test gate. Use finite waits and cleanup, never forced process exits to hide open handles.
- Preserve Goal 001 and Goal 002 validation documents as history. New results belong in `docs/goal-003-validation.md`; check actual CI for the final pushed head. Keep private notes/annotations out of chapter-aware recap. Report Practice, fake-provider, human speech, audible playback, full natural clear, and enjoyment separately.

# Working on the upstream starter

A dependency-free Node starter for the AssemblyAI Voice Agent API. There is a [Python version](https://github.com/AssemblyAI/voice-agent-starter-python) that mirrors it, and `deployment/browser/app.js` there is copied from the client in this repo, so audio and transcript fixes land here first. An agent is one file in `agents/`; `publish.mjs` pushes it to the account; the two front doors in `deployment/` decide where it answers.

```
agents/<name>.jsonc        the agent, as the body of POST /v1/agents
lib.mjs                    env loading, JSONC parsing, AssemblyAI + Twilio calls
publish.mjs                npm run publish
import.mjs                 npm run import <agent-id>, playground agent into a file
deployment/browser/        npm start, serves a page and mints session tokens
deployment/telephony/      npm run phone, Twilio SIP trunk and number binding
```

## Run

```sh
cp .env.example .env    # ASSEMBLYAI_API_KEY
npm run publish         # AGENT=<name> to pick one
npm start
```

Node 18+, no installs. Agents: `minimal`, `keyterms`, `turn-taking`, `byo-llm`, `http-tools`, `exa-search`, `airtable-crm`, `cal-booking`, `dtmf` (keypad entry for PCI compliance).

## How it fits together

Agent files are API request bodies. If a field isn't in the [create-agent reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/create-agent), it doesn't belong in the file. They use `.jsonc` so each field can carry a comment and a doc link. `parseJsonc` in `lib.mjs` strips comments and trailing commas before the file is sent.

`${VAR}` in an agent file is substituted from the environment, the root `.env`, or `agents/<name>.env`, in that order of precedence. Secrets never live in the JSON, and an unresolved variable stops the publish with a message naming it.

Each agent file owns an id, stored as `AGENT_ID_<NAME>`: `agents/http-tools.jsonc` uses `AGENT_ID_HTTP_TOOLS`. Unset, `publishAgent` sends `POST /v1/agents` and writes the returned id under that key. Set, it sends `PUT /v1/agents/{id}`, falling back to a create if that returns 404. A bare `AGENT_ID` overrides every per-file key and is never written to.

Both deployments resolve an id the same way, through `storedAgentId(name)`. The browser session sends only `{ agent_id }` and the phone number is bound to the same id, which is why behaviour changes belong in the agent file rather than in a deployment.

## Rules

- Behaviour goes in `agents/*.jsonc`. Runtime changes go in the deployment that owns them. Anything shared goes in `lib.mjs`, the only file both deployments import.
- Keep each deployment a single self-contained file plus its README.
- Prefer `http` tools. Client-executed tools can't be answered on a phone call, and `publish.mjs` warns about them.
- Voices: only IDs from the documented catalog at https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices. Never invent one.
- Never move the API key into client code, commit it, or log it. `.env` and `agents/*.env` are gitignored; keep them that way.
- Only use documented endpoints, and keep the doc links in the agent files accurate, since they are how anyone reading the repo finds the reference.
- Voice-first prompt style: short spoken sentences, no visual formatting, no exclamation marks.
- New agent file: name it after the parameter or integration it demonstrates, not the persona. Comment every non-obvious field with a link to the page that defines it, and add a row to `README.md` and `agents/README.md`.

## Reference

- [Create an agent](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/create-agent) · [Manage agents](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/manage-agents)
- [Tools overview](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/overview) · [HTTP tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/http-tools)
- [Turn detection and interruptions](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions)
- [Connect your own LLM](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm)
- [Connect to Twilio](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-to-twilio) · [Use your own number](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/twilio-own-number)

## Deploying

`render.yaml` runs the browser deployment; Render sets `PORT` and prompts for `ASSEMBLYAI_API_KEY`. Set `AGENT_ID` there so the deploy connects to a published agent instead of creating its own. Anyone with the deployed URL, or the phone number, runs sessions billed to that key.
