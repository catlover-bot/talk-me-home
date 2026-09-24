# Six-slide pitch outline

This is an outline, **not a finished presentation deck**. Presentation link: **NOT PROVIDED**. Use the actual game art and clearly labelled Practice screenshots in `assets/`; a title or cover illustration is not gameplay evidence.

## 1. Player problem — give conversation a purpose

- Many AI interactions end at an answer. A game can make listening, explaining, and correcting a shared plan the activity itself.
- Talk Me Home gives one human and an AI robot a concrete task: get Pip home.
- Show the title illustration and core promise: “You have the map. Pip has eyes and hands.”

## 2. Information asymmetry — each partner contributes

- The human reads documents and controls remote equipment. Pip observes, inspects, interacts, and moves locally.
- The map is a reference, not a live camera. Private annotations stay at the player's desk.
- The authoritative server validates actions and final arrival. Conversation alone cannot declare success.

## 3. Three chapters — three kinds of cooperation

- Cargo Bay: reason about shared machinery and remote Power.
- Relay Gallery: compare spoken observations with an authored atlas and choose a route together.
- Return Dock: coordinate charging, preparation, and a separately authorized return.
- Show one actual document screenshot per chapter, then the confirmed homecoming; identify all current captures as Practice.

## 4. Technical integration — voice with consequences

- AssemblyAI Voice Agent API provides Live conversation, speech recognition, spoken replies, and function calls through inline configuration.
- React/Vite presents the desk, captions, and Pip; Node/TypeScript owns session state and validates local tools and remote controls.
- Live Voice and Live Text use the provider. Deterministic Practice works without it.
- Local readiness precedes token issuance. The production service includes browser ownership, code-gated public Live, and conservative durable admission limits.

## 5. Intended audience and product direction

- Intended for players curious about short cooperative puzzle experiences with a conversational character.
- Clear captions, deliberate pacing, optional hints, and recoverable decisions support trying unfamiliar voice interaction.
- Future authored episodes or content packs are a product hypothesis, not shipped monetization. No accounts, subscriptions, sales, or customer metrics are claimed.

## 6. Current evidence and next steps

- The owner reported basic functional verification before this release work. Current local checks cover the production build, deterministic gameplay, and injected communication tests; consult `docs/goal-004-validation.md` for exact results.
- Original game artwork and labelled UI captures are prepared. Automated Goal 004 provider usage is zero; automated checks do not certify human speech, audible output, enjoyment, or a natural Live clear.
- Owner next steps: publish the selected release commit with bounded access, record a real demonstration, finish this deck, and complete the event submission.
- Public demo, video, and presentation links: **NOT PROVIDED**. Do not replace these with hypothetical URLs.
