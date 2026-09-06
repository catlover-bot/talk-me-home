# Sources and attribution

Goal 002 re-fetched the documentation index on 2026-09-07 before integration edits. The current events, client-side tools, browser integration, inline configuration, and prompting references below were checked for fresh-connection context, playback, tool ordering, and explicit termination. The existing documented English voice `anna` remains. There is no documented client `reply.cancel`; the UI interrupts local playback and server actions, then sends the player's wait intent through the documented user conversation role. Goal 001's observed delayed reply/tool regression remains covered.

[WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), accessed 2026-09-07, informed the 4.5:1 normal-text target. Goal 002 character and sound attribution is recorded in [assets](assets.md). New offline evidence is in [Goal 002 validation](goal-002-validation.md); historical provider evidence remains in the original validation document.

Official documentation consulted on 2026-09-07. The index was fetched before integration changes; settings were checked for inline session configuration rather than assumed from stored-agent examples.

| Reference | Use |
| --- | --- |
| [AssemblyAI documentation index](https://www.assemblyai.com/docs/llms.txt) | Current reference discovery |
| [Inline session configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration) | Inline config without `agent_id` |
| [Client-side tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools) | Function schemas, call correlation, result ordering |
| [Events reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference) | Transcript, audio, conversation message, reply, and termination events |
| [Message sequence](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/message-sequence) | Readiness and reply/tool lifecycle |
| [WebSocket API schema](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/api-spec/voice-agent-websocket) | Event schema cross-check |
| [Audio format](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/audio-format) | PCM encoding and sample-rate requirements |
| [Browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration) | Temporary tokens, PCM audio, browser permissions, clean ending |
| [Prompting guide](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/prompting-guide) | Compact cooperative robot behavior |
| [Transcription context](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/transcription-prompt) | Recognition context separate from dialogue instructions |
| [Language preferences](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/language-selection) | English recognition preference |
| [Supported languages](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/supported-languages) | Input/output support distinction |
| [Voice catalog](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices) | Existing documented English voice `anna` |
| [Vite guide](https://vite.dev/guide/) | Browser build/dev server |
| [Node.js releases](https://nodejs.org/en/about/previous-releases) | Node.js 24 runtime choice |

Upstream: [AssemblyAI/voice-agent-starter-js](https://github.com/AssemblyAI/voice-agent-starter-js), base commit `11b4c9508bef682785e8bdf23d5170b30aafb7a6`. Git history, original starter files, README instructions, and attribution were preserved. The game audio capture/resampling, playback ring buffer, and transcript joining logic derive from `deployment/browser/server.mjs`. No license file was present in the inspected upstream checkout; no new license grant is inferred or added.

React, Vite, TypeScript, tsx, and Playwright are installed from npm with versions recorded in `package-lock.json`; their distributions retain their own licenses. The map and wiring diagram are original application SVG/CSS, not a generated screenshot. The upstream `assemblyai.png` remains in the starter README and is not game art. No external fonts, music, cover art, or stock assets are required.
