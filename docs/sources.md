# Sources and attribution

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
