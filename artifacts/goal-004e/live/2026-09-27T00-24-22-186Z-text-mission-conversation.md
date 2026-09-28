# AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI

Scenario: mission. Runtime SHA-256: `e1e681dc447c6a7c64d92153fa6706b44b8a3033b23191de48425c3dbac87a5e`.

Provider final transcripts are preserved separately from typed UI submissions and the application’s visible history. An interrupted provider transcript is not relabelled as a visible or fully played reply.

These source reports retained speaker and text but may omit final/interrupted markers. Entries can therefore include partial or interrupted snippets; missing markers remain null. No finality or successful playback is inferred from matching a provider transcript.

## Typed UI turns

- **QA player UI submission record; not ASR or proof of provider delivery**: Pip, please look around.

- **QA player UI submission record; not ASR or proof of provider delivery**: Please inspect the Latch.

- **QA player UI submission record; not ASR or proof of provider delivery**: My diagram says the Door and Conveyor share one Power supply.

## Real provider final transcripts

- 8090.1 ms — **Real provider agent transcript**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- 20121.5 ms — **Real provider agent transcript**: I am on a safe platform near an open door and a running conveyor. There is a latch lever here that seems connected to the door. Should I inspect the latch?

- 32084.2 ms — **Real provider agent transcript**: The latch is currently disengaged and it is meant to hold the door open. I can use the lever to engage it. Do you want me to pull it?

- 44893 ms — **Real provider agent transcript**: The latch is now engaged and the door is held open. I can see the conveyor and the far side platform across the gap. Should I try to cross to the far side?

## Visible application history

- **Pip**: Mission Control, this is Pip. Can you hear me? I need your help getting out.

- **Mission Control**: Pip, please look around.

- **Pip**: I am on a safe platform near an open door and a running conveyor. There is a latch lever here that seems connected to the door. Should I inspect the latch?

- **Mission Control**: Please inspect the Latch.

- **Pip**: The latch is currently disengaged and it is meant to hold the door open. I can use the lever to engage it. Do you want me to pull it?

- **Mission Control**: My diagram says the Door and Conveyor share one Power supply.

- **Pip**: The latch is now engaged and the door is held open. I can see the conveyor and the far side platform across the gap. Should I try to cross to the far side?

Outcome: Failed: Material instruction/action-control mismatch; the attempt stopped without a repair or retry.

Explicit session.end: true. session.ended received: true.

Player text was submitted through the normal UI; provider replies and digital output are separate evidence. No ASR, physical microphone, loudspeaker routing, human listening, or enjoyment pass is inferred from Text.
