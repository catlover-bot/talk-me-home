# Sources and attribution

Goal 004 checked the official [AssemblyAI index](https://www.assemblyai.com/docs/llms.txt), [browser integration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), and [inline session configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration) on **2026-09-24**, before changing local readiness and production token admission. Existing protocol/voice/tool configuration remains; the changes add local checks and application access limits. Documentation retrieval consumed no provider session time.

The one prepared deployment path follows Render's current [Node web services](https://render.com/docs/web-services), [persistent disks](https://render.com/docs/disks), and [Blueprint specification](https://render.com/docs/blueprint-spec), checked on **2026-09-24**. No service or paid disk was created. A persistent disk requires an owner-approved paid service; only one instance is supported by this in-memory game/admission design.

The [general LABLAB submission guide](https://lablab.ai/ai-articles/hackathon-guidelines), refreshed **2026-09-24**, informed `submission/`: title/summary limits, a 16:9 cover recommendation, video under 300 MB and within five minutes, repository and deployed demo links. The current [event live listing](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/live) displays September 1–30, 2026 and open submissions. Its zero-valued JavaScript countdown is not evidence of closure. An exact cutoff was not independently verified; the owner must check the logged-in form. September 29 is the internal submission target, not an organizer rule.

[Vite preview options](https://vite.dev/config/preview-options.html), accessed 2026-09-08, were checked for the loopback preview host, strict port, and API proxy used to test the frozen production browser build. Preview is a local test server, not a public production deployment.

[Playwright route cleanup](https://playwright.dev/docs/api/class-page#page-unroute-all), accessed 2026-09-08, documents waiting for in-flight route handlers before disposing the offline fixture context. [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), accessed the same day, informs the selected 3:1 diagram/control checks alongside normal text checks; these measurements are not certification.

Goal 003 fetched the official [documentation index](https://www.assemblyai.com/docs/llms.txt) again on **2026-09-08**, before provider-facing edits. The current [events reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference), [client-side tools](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools), [inline configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration), [turn detection and interruptions](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions), [prompting guide](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/prompting-guide), and [voice catalog](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices) were consulted. These are documentation requests, not provider sessions; automatic provider usage for Goal 003 is zero seconds.

The chosen configuration remains inline `session.update` with generic function tools and English `anna`. Documented `conversation.message` supports `user` and `system`; the application uses `user` for bounded, explicitly historical recap and never invents an assistant role. Chapter context capture, sequential local work, cancellation reasons, return grants, and the 540/600-second client warning/watchdog are application rules, not new AssemblyAI fields or event types. Normal chapter transitions preserve the connection and its valid committed tool result. The latest documented turn-transition gate and existing ordinary-reply/delayed-call regressions remain in place. Explicit `session.end` and acknowledgement cleanup remain unchanged. The pending owner-run evaluation is in [Goal 003 Live acceptance](goal-003-live-acceptance.md).

The [browser integration reference](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration), also checked on 2026-09-08, distinguishes single-use token redemption expiry from the connected-session maximum and documents server-side token issuance. The existing server sets both separately; the campaign does not raise the 600-second connection cap or mint tokens on chapter changes. Browser test peers and audio devices are locally simulated, not provider or hardware evidence.

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
