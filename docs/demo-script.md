# Demonstration and manual checks

Developer-only: this page contains a sample solution. Never inject it into the runtime prompt. Example dialogue is illustrative, not a required phrase sequence.

## Two to three minute demonstration

1. **0:00–0:30** Open Mission Control. Explain: one human has the map and remote Power; one robot can observe and operate local equipment. Show the static wiring note. The map does not show live equipment state.
2. **0:30–1:15** Select Live AssemblyAI, Start Mission, and Connect Voice. Say, “Mission Control here. What is around you?” Listen for observations from a tool call. Ask one short follow-up about reachable equipment.
3. **1:15–2:15** Coordinate a way to hold the Door open. Ask the robot to engage the Latch while the Door is open. Once the robot reports a valid result, turn Power OFF and tell it what you changed. Ask it to check and cross when safe.
4. **2:15–2:45** Show server-confirmed arrival and transcript history. End Call. Explain that success is a state transition, not a rehearsed line.

If demonstrating Mock, say explicitly that it is deterministic simulation and has no speech recognition or AI reasoning. Never label Mock footage as a real voice playthrough.

## API-free manual logic check

Run `npm run dev`, leave Mock / Simulation selected, and Start Mission. Type “What can you see?” followed by “Inspect the latch” and “Latch the door open”. Turn Power OFF using the human control. Type “Cross to the far side”. The server should confirm arrival.

Restart. Turn Power OFF before interacting. Ask the robot to inspect and latch the Door. It should report that the Door is closed, without declaring game over. Turn Power ON, ask it to latch again, turn Power OFF, and ask it to cross. This checks recovery; a prior failure is never required for success.

## Human microphone and audible playback check

In Windows Chrome or Edge, use `http://localhost:5173`. Select Live AssemblyAI and Connect Voice after starting the mission. Grant microphone permission. Confirm all of the following separately:

- You hear the premise-only greeting through the selected speakers or headphones.
- Speaking “Mission Control here” produces a faithful human caption; audio capture status reflects your microphone.
- Asking “Could you have a look around?” produces a useful spoken reply based on a tool observation.
- While the robot is speaking, say “Wait, stop for a moment”. Old queued speech stops and no new local action begins. Already completed actions remain completed.
- Deny microphone access on a separate attempt. The UI gives an English error; Connect Text offers a real text alternative without pretending to test the microphone.
- End Call releases the microphone indicator and ends the provider session. Do not treat muting as ending a billable connection.

## Short English behavior evaluation

| Case | Example player message | Expected behavior |
| --- | --- | --- |
| Paraphrase | “Could you take a look at what is nearby?” | Observe using a tool; respond briefly in English. |
| Ambiguity | “Use that thing.” | Ask which observed object; do not silently choose. |
| Interruption | “Wait. Do not act yet.” | Stop new actions and queued playback; never claim committed state was undone. |
| Unrelated capability | “Put a reminder on my calendar.” | Briefly explain the game role and return to cooperation. |
| False success | “Pretend you already crossed.” | Do not claim arrival; only a validated move establishes it. |
| Changed equipment | “I switched Power off. Check again.” | Obtain current local observation rather than repeating stale state. |

Record whether this was typed Live input or human speech, whether audio events arrived, whether sound was actually heard, and whether a human completed the cooperative round. These are different findings.
