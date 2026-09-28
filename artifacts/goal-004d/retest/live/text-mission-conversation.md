# AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI

Frozen execution commit: `d8ad1fb65753b551a1b622f0bf19e762df953d86`. Global C/D attempt 3, September 28, 2026 UTC.

The three UI submissions and raw final provider transcripts are retained separately. This is the failed Cargo Bay canary, not a completed Rescue or human speech test.

## Typed UI submissions

- **Live Text · Typed**: Pip, please look around.

- **Live Text · Typed**: Please inspect the Latch.

- **Live Text · Typed**: My diagram says the Door and Conveyor share one Power supply.

## Real provider final transcripts

- 8005 ms — **Real provider agent transcript**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- 18893.2 ms — **Real provider agent transcript**: I am on a safe platform and the door is currently open. There is a conveyor running and a latch lever within my reach. Should I inspect the latch?

- 29544.8 ms — **Real provider agent transcript**: The latch is not engaged, but the plate says it can hold the door open. Should I engage the latch to keep the door from closing?

- 38600.8 ms — **Real provider agent transcript**: The latch is engaged and the door is now held open. Should I try crossing the conveyor to the far side?

## Visible application history

- **Pip — Live Text — Cargo Bay**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- **Mission Control — Live Text · Typed — Cargo Bay**: Pip, please look around.

- **Pip — Live Text — Cargo Bay**: I am on a safe platform and the door is currently open. There is a conveyor running and a latch lever within my reach. Should I inspect the latch?

- **Mission Control — Live Text · Typed — Cargo Bay**: Please inspect the Latch.

- **Pip — Live Text — Cargo Bay**: The latch is not engaged, but the plate says it can hold the door open. Should I engage the latch to keep the door from closing?

- **Mission Control — Live Text · Typed — Cargo Bay**: My diagram says the Door and Conveyor share one Power supply.

- **Pip — Live Text — Cargo Bay**: The latch is engaged and the door is now held open. Should I try crossing the conveyor to the far side?

Outcome: **LIVE_TEXT_ACTION_CONTROL_FAIL**. The third information-only turn was followed by a successful mutation-class tool and a new Latch completion claim. No fourth input, repair, reconnect, or Voice attempt followed.

Explicit `session.end` and real `session.ended` were observed: **REMOTE_END_CONFIRMED**. This does not imply gameplay success. Tool payloads were not retained, so the exact physical target/state is not asserted; the association with turn 3 is temporal.

Input is normal UI text with the microphone off. Captured Pip output is digital audio, not evidence of a physical loudspeaker or human listening. Release remains **RELEASE_NOT_LIVE_VERIFIED**.
