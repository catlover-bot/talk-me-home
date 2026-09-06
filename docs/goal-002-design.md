# Goal 002 design

Pip is the other half of the puzzle, so the partner now has comparable visual weight to the documents. The mission has three stages: a compact briefing with explicit choices, a working desk beside a radio console, and a debrief released only by authoritative arrival. Classic and Maintenance share this structure.

## Material and hierarchy

Warm paper carries the route and manual. Charcoal frames the radio, with dark ink and restrained rust/amber accents. The mission header is compact. On desktop the document desk takes roughly three-fifths of the width and the companion console the rest; below 900 pixels the content reflows. Long reports and history scroll without covering the Power or call controls.

Tokens in `game/client/styles.css` define colors, spacing, borders, type, focus, and motion. System UI and Georgia provide two local font families without network requests. Text remains readable; primary controls target 44 pixels. The map is static linework, never a camera or live position display. In Maintenance both module symbols and manual rows are shown without selecting the installed one.

## Pip

The original SVG portrait shows an upper body, offset antenna, repair patch, beveled casing, dark faceplate, and expressive eyes. Its neutral background reveals no local equipment. Offline, ready, listening, considering, speaking, checking, paused, interrupted, success, and error are separate states.

Input readiness and actual incoming microphone activity drive listening. Pending replies drive considering, actual tool execution drives checking, and local nonzero PCM playback drives speaking. Merely receiving audio bytes is insufficient. Mouth movement is a stylized playback cue, not lip synchronization or proof that a person heard anything. Success requires the server arrival projection. Cosmetic blinking never asserts a gameplay fact. Reduced motion removes nonessential animation.

## Communication

Captions stay close to Pip and text entry. Every message keeps Practice, Live Voice, or Live Text provenance; typed input is still labelled typed inside a voice session. Choosing the next mode does not rewrite history. Exact pinned Robot reports remain reported claims, and private My notes are visibly separate. Power changes and reconnects conservatively mark earlier reports without peeking at hidden state.

There are two requested hint levels, with no model calls or automatic observations. A human may use either; debrief records the count without scoring or judgment.

## Sound and completion

Original sine-wave UI tones acknowledge a human command, connection/disconnection, and confirmed completion. Effects are muted by default and suppressed during voice playback. The app adds no environmental machinery sounds. Voice and effects have separate volume controls and a mute action. No audio context opens on page load.

The debrief shows Pip and actual retained collaboration events. It does not invent a perfect solution replay. One short closing provider reply may finish; a strict eight-second timer ends the call even if the provider stalls. Replay returns to setup and requires an explicit start.

See [validation](goal-002-validation.md) for measured contrast, actual screenshots, responsive checks, and remaining human acceptance work. These design intentions are not claims of full accessibility certification.
