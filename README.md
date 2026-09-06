# Talk Me Home

You have the map. Your partner has eyes and hands. Neither can escape alone.

A browser game for one human at Mission Control and Pip, a stranded maintenance robot. Read your map and manual, operate remote Power, and talk Pip through one Door. Pip has local eyes and hands; only the server can confirm arrival. Choose **Classic** or the optional **Maintenance** remix, which adds one equipment clue to exchange in the same room. There are no accounts, database, or public deployment.

## Run the game

Use Node.js 24 (tested with 24.20.0 and npm 11.19.0). On Windows, open an Ubuntu WSL terminal:

```sh
cd ~/workspace/talk-me-home
node --version
npm ci
npm run dev
```

Open **http://localhost:5173** in Windows Chrome or Edge. The game server listens on loopback port 3001; Vite forwards `/api` requests. Ctrl+C stops both processes. Nothing starts a paid voice session on page load.

Keep the existing working Node.js 24 installation. `.nvmrc` records the tested version for environments that use nvm; a version manager is not required.

1. Leave **Practice** selected and choose **Start Practice** for an API-free game. Pip's deterministic simulation accepts simple inspection and action requests. It does not test AI reasoning or speech recognition.
2. For real conversation, select **Live Voice** and choose **Start with Voice**. Allow microphone access. **Live Text / Start with Text** uses the same real provider without microphone capture; it still uses provider time. No republishing is needed.
3. Read the route map and equipment manual, exchange observations, and use **Power ON** or **Power OFF**. Pin useful finalized captions as **Robot reports**, or add private **My notes**. Reports retain their original source and are not live telemetry.
4. **Interrupt** stops playback and uncommitted actions while leaving a Live call connected. **Pause / End call** ends the provider connection and keeps the mission checkpoint. After ending, choose the next mode under **Connection & sound**, then explicitly resume. History retains Practice, Live Voice, or Live Text provenance, including typed input in a voice call.
5. **Restart** confirms loss of the current round and returns to briefing. Arrival opens a factual debrief; any final Live reply has an eight-second shutdown limit. Replay never opens another Live call automatically.

Live mode reads `ASSEMBLYAI_API_KEY` from your existing root `.env`. If you do not have that file, copy `.env.example` once and add your key. Do not overwrite an existing `.env`. No key is needed for Mock, builds, or automated tests. The key stays on the server; the browser receives a temporary token. The game uses inline configuration and does not require publishing the Minimal agent. Missing credentials produce an explicit Live error; the app never silently switches to simulation.

End the call before walking away. Each Live connection is capped at ten minutes. Ending explicitly requests provider termination; a broken network can prevent acknowledgement. Resume opens a fresh connection with a bounded historical recap of earlier observations, completed actions, and communicated player information. Private notes and unread documents are excluded. Server restarts lose missions, notes, and transcripts. The app records no raw microphone audio and stores no transcripts, keys, tokens, or puzzle state in browser storage. AssemblyAI receives Live audio/text for its service.

Effects are original local tones, muted by default; voice and effects volume are under **Connection & sound**. Muting output does not end a provider call. The interface supports keyboard operation, captions, reduced motion, and narrow-screen reflow; Windows Chrome/Edge microphone and audible playback acceptance remains a separate human check.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Game UI and local game server |
| `npm run typecheck` | TypeScript checks |
| `npm test` | API-free logic, HTTP, and voice-adapter tests |
| `npm run test:e2e` | Practice and local fake-provider browser tests; first run `npx playwright install chromium` |
| `npm run build` | Typecheck and bundle the browser game into `dist/client` |
| `npm run test:live` | Existing opt-in provider probe; consumes time and is **not authorized automatically for Goal 002** |
| `npm start` | Original starter diagnostics at port 3000 |
| `npm run publish` | Original stored-agent publishing workflow |

See [architecture](docs/architecture.md), [design](docs/goal-002-design.md), the [demo and pending human Live checks](docs/demo-script.md), [Goal 002 validation](docs/goal-002-validation.md), [historical Goal 001 validation](docs/validation.md), [sources](docs/sources.md), [assets](docs/assets.md), and [next steps](docs/roadmap.md). Developer documents and tests contain puzzle details and must never be supplied to the robot as context. Goal 002 automated validation uses zero real-provider seconds; the earlier budget ledger is preserved.

## Upstream starter

The original starter and its history are preserved below. Its dependency-free description and telephone examples refer to the original diagnostic commands, not the React game. No telephone functionality was added to Talk Me Home.

<img src="assemblyai.png" width="500"/>

---

[![Voice Agent API](https://img.shields.io/badge/docs-Voice%20Agent%20API-2545E6)](https://www.assemblyai.com/docs/voice-agents/voice-agent-api)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](package.json)
[![AssemblyAI Twitter](https://img.shields.io/twitter/follow/AssemblyAI?label=%40AssemblyAI&style=social)](https://twitter.com/AssemblyAI)
[![AssemblyAI YouTube](https://img.shields.io/youtube/channel/subscribers/UCtatfZMf-8EkIwASXM4ts0A)](https://www.youtube.com/@AssemblyAI)

# AssemblyAI Voice Agent Starter for JS

Voice agents defined as JSON files. Publish one to your AssemblyAI account, then talk to it in a browser tab or by calling a phone number.

Each file in [agents/](agents/) is the request body for `POST /v1/agents`. The starter sends it unchanged, saves the agent ID it gets back to `.env`, and both deployments connect using that ID. An agent you already have goes the other way, `npm run import <agent-id>` turns it into one of these files. Built on the [AssemblyAI Voice Agent API](https://www.assemblyai.com/products/voice-agent-api). Node 18 or later, no dependencies.

There is a [Python version of this repo](https://github.com/AssemblyAI/voice-agent-starter-python) with the same agents and the same steps.

## Quickstart

### 1. Clone

```sh
git clone https://github.com/AssemblyAI/voice-agent-starter-js
cd voice-agent-starter-js
cp .env.example .env
```

### 2. Add your key

From [assemblyai.com/dashboard/api-keys](https://www.assemblyai.com/dashboard/api-keys):

```sh
# .env
ASSEMBLYAI_API_KEY=your_key_here
```

### 3. Get an agent

Publish one of the examples:

```sh
npm run publish                       # agents/minimal.jsonc
# AGENT=http-tools npm run publish    # or any other file in agents/
```

Or import one you already have, shaped in the playground or the dashboard:

```sh
npm run import <agent-id>          # writes agents/<its-name>.jsonc
```

Either way you end up with the same pair: a file in `agents/` and its id in `.env` as `AGENT_ID_<NAME>`. Publishing again updates that agent rather than creating another, and each file keeps its own, so switching with `AGENT=` never overwrites the last one.

### 4. Talk to it

```sh
npm start
```

Open http://localhost:3000 and start the call.

### 5. Put it on a phone number

```sh
# .env
TWILIO_ACCOUNT_SID=AC...                          # console.twilio.com, top of the page
TWILIO_AUTH_TOKEN=your_token_here                 # same place, hidden until you click it
TWILIO_PHONE_NUMBER=+15551234567                  # a number already in your account, E.164
TWILIO_TRUNK_DOMAIN=acme-agent.pstn.twilio.com    # a name you invent, must end .pstn.twilio.com
```

The trunk domain does not exist yet. You are naming the SIP trunk that gets created for you, and the name has to be unique across all of Twilio, so put something specific to you in front of `.pstn.twilio.com`. The phone number does have to exist already: buy one under Phone Numbers in the Twilio console first.

```sh
npm run phone
```

This creates the trunk, routes it to AssemblyAI, attaches your number to it, and binds the agent. Then call the number. Details in [deployment/telephony](deployment/telephony/).

---

## Core examples

Nine agent files. Four demonstrate a parameter, five demonstrate an integration.

| `AGENT=` | Demonstrates | Requires |
| --- | --- | --- |
| [`minimal`](agents/minimal.jsonc) | the three required fields, and the defaults applied to the rest | |
| [`keyterms`](agents/keyterms.jsonc) | biasing transcription toward names and jargon | |
| [`turn-taking`](agents/turn-taking.jsonc) | silence thresholds and interruption handling | |
| [`byo-llm`](agents/byo-llm.jsonc) | Claude through the AssemblyAI gateway, or your own endpoint | |
| [`http-tools`](agents/http-tools.jsonc) | tools that AssemblyAI calls on the agent's behalf | |
| [`exa-search`](agents/exa-search.jsonc) | web search during a call | `EXA_API_KEY` |
| [`airtable-crm`](agents/airtable-crm.jsonc) | reading a caller record and writing one back | `AIRTABLE_*` |
| [`cal-booking`](agents/cal-booking.jsonc) | checking availability, then booking a slot | `CAL_*` |
| [`dtmf`](agents/dtmf.jsonc) | PCI compliance: card entry on the keypad, never in the transcript, the logs or the model | `DTMF_WEBHOOK_URL` |

```sh
AGENT=exa-search npm run publish
npm start
```

To write your own, copy the closest file: `cp agents/http-tools.jsonc agents/my-agent.jsonc`. Every field is commented, with a link to the documentation page that defines it.

## Importing an agent

The playground is the quickest way to shape an agent. This is how it moves into code without being rebuilt by hand:

```sh
npm run import 8f3c1e2a-...
```

It writes `agents/<name>.jsonc`, the live agent as a file, headed with the id it came from. It records `AGENT_ID_<NAME>` in `.env`, so `npm run publish` sends a `PUT` to that same agent instead of creating a second one. It drops `id`, `created_at` and `updated_at`, which are not part of a create request. And it refuses to overwrite an existing file unless you pass `AGENT=<other-name>` or `OVERWRITE=1`.

Credentials are the one thing it cannot recover. Tool header values and `llm[].api_key` are write-only on the API, so they come back blank. The import names the ones to restore, and they belong in `.env`, referenced from the file as `${VARS}`:

```
Header values are write-only and did not come back for: lookup.
Put them in .env and reference them as ${VARS}.
```

From there it behaves like any other file in `agents/`: edit it, publish, call.

## Where it answers

| | | |
| --- | --- | --- |
| [Browser](deployment/browser/) | `npm start` | Serves a page with a call button and mints session tokens. The API key stays on the server. |
| [Phone](deployment/telephony/) | `npm run phone` | Configures a Twilio SIP trunk and attaches the agent to your number. |

Twilio passes the call to AssemblyAI over SIP, so nothing in this repo sits in the audio path.

## Hosting the browser app

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AssemblyAI/voice-agent-starter-js)

Render reads [render.yaml](render.yaml) and prompts for exactly one value, `ASSEMBLYAI_API_KEY`, because that is the only variable marked `sync: false`. It sets `PORT` itself. The other two arrive with defaults you can change under Environment on the service:

| Variable | Default | What it does |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | prompted | Stays on the server. Never sent to the page. |
| `AGENT` | `minimal` | Which `agents/<name>.jsonc` the service publishes when it boots. |
| `AGENT_ID` | empty | Paste an id from your `.env` to serve that exact agent, whichever file it came from. |

Leaving `AGENT_ID` empty is fine. The service publishes `AGENT` on boot, and on later restarts it updates the agent of that name rather than creating another one. Setting it is still better, since the deployment then uses the same agent you tested locally and your phone number answers with.

Anyone with the URL can start sessions billed to that key.

## How it works

```
  copy an example                     npm run import <id>
  or write your own                   an agent you already have
           │                                   │
           ▼                                   ▼
agents/exa-search.jsonc     body of POST /v1/agents
        + .env              the ${VARS} it references
           │
           ▼  npm run publish
      AGENT_ID_EXA_SEARCH
           ├──  npm start        browser tab
           └──  npm run phone    phone number
```

The first publish sends `POST /v1/agents` and stores the returned ID in `.env` under a key of its own, `AGENT_ID_EXA_SEARCH` for that file. Later publishes send `PUT /v1/agents/{id}`, so the browser tab and the phone number both pick up the change on the next call, and publishing a different file leaves this one alone. A bare `AGENT_ID` overrides every per-file key.

Values written as `${VAR}` anywhere in an agent file are substituted at publish time from `.env`, or from `agents/<name>.env` for credentials only one agent uses. Both files are gitignored, so the JSON can be committed.

## Build with AI coding agents

This repo includes [AGENTS.md](AGENTS.md), which Claude Code, Cursor and Copilot read for its conventions. The Voice Agent API changes, so point coding tools at the current documentation rather than letting them work from memory:

> Always fetch https://assemblyai.com/docs/llms.txt before writing AssemblyAI code. The API has changed, do not rely on memorized parameter names.

```sh
claude mcp add --transport http --scope user assemblyai-docs https://mcp.assemblyai.com/docs
npx skills add AssemblyAI/assemblyai-skill --global
```

See [Build with AI tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/build-with-ai-tools) and [Coding agent prompts](https://www.assemblyai.com/docs/coding-agent-prompts).

## Voice Agent API

Product: [Voice Agent API](https://www.assemblyai.com/products/voice-agent-api) · [Pricing](https://www.assemblyai.com/pricing) · [Dashboard](https://www.assemblyai.com/dashboard)

Start here: [Documentation](https://www.assemblyai.com/docs/voice-agents/voice-agent-api) · [Create an agent](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/create-agent) · [Manage agents](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/manage-agents) · [Prompting guide](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/prompting-guide) · [Best practices](https://www.assemblyai.com/docs/voice-agents/best-practices)

Configuration: [Voices](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices) · [Greeting](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/greeting) · [Turn detection](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions) · [Keyterms](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/transcription-prompt) · [Languages](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/supported-languages) · [Noise suppression](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/noise-suppression) · [Custom LLM](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm)

Tools: [Overview](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/overview) · [HTTP tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/http-tools) · [Client-side tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools)

Deployment: [Deploy](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/deploy) · [Browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration) · [Connect to Twilio](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-to-twilio) · [Use your own number](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/twilio-own-number) · [Webhooks](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/webhooks)

Reference: [Session configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration) · [Events](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference) · [Message sequence](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/message-sequence) · [Session history](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-history) · [Troubleshooting](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/troubleshooting)

## Cost

Sessions are billed to the API key that published the agent. Anyone with the deployed URL or the phone number can start a session on that key.
