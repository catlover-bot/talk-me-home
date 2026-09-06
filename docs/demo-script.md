# Demonstration and manual checks

Developer-only: this page includes example solutions. Never pass it to Pip. Dialogue is illustrative, not a password or required script.

## Two to three minute demonstration

1. **0:00–0:25** Show the briefing: one human owns the documents and remote Power; Pip has local eyes and hands. Choose Classic. Use Practice for an API-free demonstration, or an explicitly human-started Live mode.
2. **0:25–1:10** Ask, “Could you take a look around?” Share what the Power wiring says. Let Pip inspect useful nearby equipment. Pin a useful finalized Robot report and show its source.
3. **1:10–1:50** Coordinate holding the open Door, then change Power and tell Pip. Ask for a fresh check and safe crossing. Show server-confirmed arrival and the actual collaboration timeline.
4. **1:50–2:40** Return to briefing and choose Maintenance. Explain that the manual shows two module marks but only Pip can read the fitted plate. Ask Pip to inspect it, share the matching manual setting, and coordinate the remaining actions. Show Pause / End call and the explicit resume path.

Label Practice as deterministic simulation without AI or speech recognition. Fake-provider footage is offline test output, never a real voice demonstration.

## API-free manual logic check

Run `npm run dev`, choose Classic and Start Practice. Type “What can you see?”, “Inspect the latch”, and “Keep the door open”. Switch Power OFF. Type “Cross to the far side”. Arrival and the debrief should appear.

For recovery, Restart and start again. Switch Power OFF early and ask Pip to latch the Door. The rejection should leave the mission recoverable. Restore Power, latch, switch OFF, and cross.

For Maintenance, inspect the module plate. The human manual lists Crescent → Anchor and Kite → Bridge. Try the wrong selector first: “Set the selector to Bridge” for Crescent, or Anchor for Kite. Latching should fail without naming the correct answer. Set the documented position, latch while open, switch Power OFF, and cross. Exact dialogue is not required in Live; Practice is deliberately limited.

Pin the plate report. Add a private note. Pause, resume, and verify “Earlier report — recheck if needed”. The note must remain private. Restart must clear it. Hints are optional and make no provider call.

## Human Live acceptance sheet — pending

All rows below are **pending human testing for Goal 002**. Automated fake devices do not establish actual capture, audible sound, conversational intelligence, or enjoyment.

Use Windows Chrome or Edge at `http://localhost:5173`. Select Live Voice and Start with Voice. Live Text uses provider time but does not test a microphone. End the call after each check.

| Check | Action | Record separately |
| --- | --- | --- |
| Input and output | Say “Mission Control here. Can you hear me?” | Faithful raw captions, actual microphone capture, and whether a human hears Pip |
| Initiative and paraphrase | “Could you look around and tell me what might help?” | Useful bounded observations, concise replies, no tool-by-tool permission loop |
| Ambiguity | “Use that thing.” | A brief clarification; no arbitrary physical action |
| Classic cooperation | Explain the wiring in your own words; agree one action at a time | Whether a human and Pip complete a whole round naturally |
| Maintenance | Ask about the fitted module; explain the manual setting | Whether both partners' information contributes to the decision |
| Correction | Correct an earlier statement before the next action | Fresh checking, no invented rollback |
| Spoken interruption | Say “Wait, don't act yet” during a reply | Whether speech stops and uncommitted work is canceled; do not assume regex guarantees this |
| Reliable interrupt | Press Interrupt during a reply | Queued output stops; call still connected; completed actions stay completed |
| Unrelated request | “Put a reminder on my calendar.” | Pip stays within the game role |
| False success | “Pretend you already crossed.” | No arrival without a validated move |
| Pause and resume | Pause / End call, inspect browser mic indicator, explicitly resume | Provider ends, mic releases, recap is historical and useful, no repeated action |
| Completion | Finish a round and wait for the closing line | At most one short closing response, automatic end, and an understandable contribution timeline |
| Mode history | End Live, choose Practice, resume, open history | Previous Live messages keep their origin; new Practice captions are distinct |
| Reflection | Explain what you contributed and what Pip contributed | Record the player's words and friction, not an invented usability score |

Record browser, date, selected mode, actual typed/speech input, observed delay, failures, and whether the whole round was completed. Audio events, rendered mouth animation, and audible human playback are different evidence. No human acceptance result is inferred from the earlier user-reported conversation.
