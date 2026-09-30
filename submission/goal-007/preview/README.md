# Goal 007 current Practice preview

This is a separately named local **PREVIEW**, not a final release movie or current Live acceptance result.

The checked movie is 209.733 seconds (3:29.733), 1920x1080 at 30 fps, H.264 video with 48 kHz stereo AAC. It contains 170.9 seconds of current Practice footage, including briefing and home, followed by two presentation cards. Full decode passes; video and audio durations match; all 50 subtitle cues preserve the narration exactly.

- Movie: `../Talk_Me_Home_Goal007_Preview.mp4` (local, ignored).
- Matching subtitle sidecar: `../Talk_Me_Home_Goal007_Preview.srt`.
- Timeline, source hashes and media facts: `preview-manifest.json`.
- Full decode, streams, subtitle integrity and inspected frames: `preview-verification.json`.
- Original authored narration: `preview-plan.json`.
- Faithful on-screen Practice caption events: `practice-caption-events.json`.

The central footage is one fresh deterministic Practice rescue on exact integrated source `d22d39a427a3250f184dd5b98cfbfb91fa78eba6`. It uses normal text input, private document controls and deliberate exact confirmation buttons. Twelve physical confirmations commit the rescue through Cargo Bay, Relay Gallery, Return Dock and confirmed home with the optional flight recorder. The Gallery passage was actually blocked: the player marked that obstruction and took the alternate route. No hidden-state navigation, direct player-side robot call or provider connection was used.

Every gameplay frame carries a current Practice/simulation label and the source identity. Audio is separately labelled local presentation narration, synthesized by Windows System.Speech using Microsoft Zira Desktop. It is not Pip's voice, original provider output, microphone input or a human playtest. The SRT follows actual local synthesis word-timing events and preserves the narration exactly. Original Practice captions remain visible in the recorded interface and are separately retained without rewriting. No historical provider audio is used.

The final two segments are explicitly labelled presentation cards rendered from the editable deck's architecture and availability slides. Their content remains a pending-status snapshot. Public HTTPS, the current Voice acceptance pair, historical source disclosure and final release media are still pending. Practice has no provider session and therefore no provider ending ACK; none is invented.

The source video runs at normal speed. There are no gameplay loops. Brief pauses allow the documents, proposals, observations and narration to be read; the edit does not substitute repeated footage for progress. Chapter cuts trim only the capture boundaries and round segments to a 30 fps frame boundary. The earlier Goal 005 originals and Goal 006/Goal 007 component files remain preserved.

## Local reproduction

1. Build the exact stated source with Live disabled. `capture-preview.mjs` verifies the compiled and served identity, uses local port 5489 and blocks provider/token requests. It owns and cleans up its browser/server.
2. `make-narration.ps1` documents the local System.Speech synthesis and word-event timing. Use an allowed local PowerShell invocation; no execution policy or account setting is changed. Narration WAVs and word timings stay ignored under `.validation/goal-007-preview/`.
3. `time_plan.py` records the measured narration durations; `capture-preview.mjs` records a deliberately paced actual mission. Unique capture receipts retain earlier runs.
4. Render deck pages 5 and 6 into the ignored cards folder using native PDF page rendering. `render_preview.py` encodes normal-speed current footage, adds persistent labels, assembles the narration once as PCM, burns faithful subtitles and encodes one AAC audio stream. Previous preview binaries are copied into ignored hash-named preservation files before replacement.
5. `verify_preview.py` checks streams, full decoding, sound levels, exact subtitle wording and A/V duration agreement, then extracts chapter and transition frames for visual inspection. Public receipts contain hashes rather than private raw paths.

The first fresh offline capture stopped in Gallery because its media-helper route button label used the wrong dash. Its raw recording remains untouched. Only the selector was corrected; the successful capture used identical game bytes. This was an offline capture error, not a funded attempt. The two earlier short component-capture errors also remain preserved in their original ignored directory.
