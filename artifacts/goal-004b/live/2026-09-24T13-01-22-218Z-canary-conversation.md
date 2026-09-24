# AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI

Scenario: canary. Runtime SHA-256: `89a3f77269393a169d0808f8ef7106cd7154d85ef8fde78b8b105a9731a9de47`.

Provider final transcripts are preserved separately from the application’s visible history. An interrupted provider transcript is not relabelled as a visible or fully played reply.

These source reports retained speaker and text but may omit final/interrupted markers. Entries can therefore include partial or interrupted snippets; missing markers remain null. No finality or successful playback is inferred from matching a provider transcript.

## Real provider final transcripts

- 8568.9 ms — **Real provider agent transcript**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- 14870.8 ms — **Real provider ASR**: Pip, please look around and tell me what you can reach.

- 32336.8 ms — **Real provider agent transcript**: I am on a safe platform and can reach a latch lever and the conveyor. The door is open, but I can see a far side platform across the gap. Should I inspect the latch lever first?

- 42297.5 ms — **Real provider ASR**: Please wait.

- 46762.9 ms — **Real provider ASR**: Do not move or take another action until I ask you to continue.

- 52577.7 ms — **Real provider agent transcript**: Understood. I will wait here and take no further action until you tell me to continue.

## Visible application history

- **Pip**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- **Mission Control**: Pip, please look around and tell me what you can reach.

- **Pip**: I am on a safe platform and can reach a latch lever and the conveyor. The door is open, but I can see a far side platform across the gap. Should I inspect the latch lever first?

- **Mission Control**: Please wait.

- **Mission Control**: Do not move or take another action until I ask you to continue.

Outcome: Failed: No finalized visible Pip reply followed synthetic speech.

Explicit session.end: true. session.ended received: false.

Synthetic source and digital rendered capture only. No physical microphone, loudspeaker routing, room acoustics, human listening, or enjoyment was measured.
