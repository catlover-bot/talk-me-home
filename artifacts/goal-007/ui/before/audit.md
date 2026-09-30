# Goal 007: observed Goal 006 interface before changes

Captured 2026-09-30 from the existing compiled Goal 006 production game, with `GAME_DISABLE_LIVE=1` and `GAME_PUBLIC_LIVE_ENABLED=0`. The capture used isolated port 5487 and only visible Practice controls. No provider or token request occurred. The owned browser and production process exited normally. Source and dimensions are recorded in `manifest.json`.

## Observations that motivate the increment

- The entrance already has a rescue premise, original station art, a question example and an optional guide. It does not need a replacement art concept. However, Practice is selected while **Play with voice** is the visually primary action; the selected mode and primary action disagree. The mission/connection setup reads as two numbered configuration stages.
- The first Cargo screen shows Pip's greeting, but its useful question example is now gone. The player can type, yet the screen does not help them connect the first report to the shared-supply drawing. A small dismissible first-question hint can bridge this without revealing the solution.
- At 1280x720 the pending exact confirmation is visible, while the text input sits partly below the fold. At 1440x900 the Gallery's earlier Cargo proposal still has a separate cream receipt panel. Its historical result is useful but competes with the current report.
- Read-only recovery requests exist beneath the Gallery atlas, not in the shared radio. Cargo and Dock do not offer the same clearly labelled selected-input recovery affordance.
- Narrow and 200% zoom layouts have no page-level horizontal overflow. The atlas intentionally has a horizontal viewport. However, documents, annotations and disclosures precede the radio by roughly 1,600 pixels at narrow width. Reaching Pause or a pending action while studying the atlas needs excessive scrolling.
- The paper documents, charcoal radio, emblem shapes, original Pip portrait and room-specific accents already form a coherent visual language. Refinement should preserve them, emphasize the radio's hierarchy and give tactile feedback to deliberate controls; a new neon visual system would lose useful continuity.
- The existing recorder is a selected archive clue at Leaf, inspected locally and collected only after exact confirmation. The ending shelf is rendered only when the recorder was recovered, leaving no visible empty/occupied comparison. A permanent empty shelf and a clearly authored story caption can make both legitimate endings legible.
- Local effects are opt-in and already suppress competing speech. They are currently only generic finite tones; there is no independent low radio ambience or confirmed chapter cue. Any ambience must remain optional, gesture-unlocked, suppressed during microphone/speech, and closed with the connection.

## Proposed bounded changes

One consistent selected-mode launch; a compact roles/confirmation introduction; a first Cargo question with explicit selected-input provenance; shared radio recovery and truthful connection phases; compact past-action receipts; mobile Radio/Documents navigation; restrained paper/radio material refinements; richer existing recorder clue and contrasting home shelf; optional local ambience and confirmed chapter cue. Existing gameplay, transcripts, private notes, exact proposal confirmation and server authority remain the basis of the increment.

These observations are interface and automated interaction evidence, not a claim about human comprehension or enjoyment.