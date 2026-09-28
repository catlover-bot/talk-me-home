# Six-slide pitch outline

This is an outline, **not a finished presentation deck**. Presentation link: **NOT PROVIDED**. Use the actual game art and clearly labelled Practice screenshots in `assets/`; a title or cover illustration is not gameplay evidence.

## 1. Player problem — give conversation a purpose

- Many AI interactions end at an answer. A game can make listening, explaining, and correcting a shared plan the activity itself.
- Talk Me Home gives one human and an AI robot a concrete task: get Pip home.
- Show the title illustration and core promise: “You have the map. Pip has eyes and hands.”

## 2. Information asymmetry — each partner contributes

- The human reads documents and controls remote equipment. Pip observes and inspects freely, then proposes one exact local interaction or movement. The human confirms it on the console.
- The map is a reference, not a live camera. Private annotations stay at the player's desk.
- The server checks the confirmed action and final arrival. A proposal is an intention; a separate Game event reports its verified decision. Spoken "yes" cannot commit an action.

## 3. Three chapters — three kinds of cooperation

- Cargo Bay: reason about shared machinery and remote Power.
- Relay Gallery: compare spoken observations with an authored atlas and choose a route together.
- Return Dock: coordinate charging, preparation, and a separately authorized return.
- Show one actual document screenshot per chapter, then the confirmed homecoming; identify all current captures as Practice.

## 4. Technical integration — voice with consequences

- AssemblyAI Voice Agent API provides Live conversation, speech recognition, spoken replies, and function calls through inline configuration.
- React/Vite presents the desk, captions, and Pip; Node/TypeScript owns session state and validates local tools and remote controls.
- Live Voice and Live Text use the provider. Deterministic Practice works without it; all three use the same explicit action-confirmation boundary.
- Local readiness precedes token issuance. The production service includes browser ownership, code-gated public Live, and conservative durable admission limits.

## 5. Intended audience and product direction

- Intended for players curious about short cooperative puzzle experiences with a conversational character.
- Clear captions, deliberate confirmation, optional hints, and recoverable decisions support trying unfamiliar voice interaction. This is voice-led cooperation with visible controls.
- Future authored episodes or content packs are a product hypothesis, not shipped monetization. No accounts, subscriptions, sales, or customer metrics are claimed.

## 6. Current evidence and next steps

- Goal 004E passed 342 unit tests and 100 browser cases on clean candidate `bb6dfd2181503415a14c440c52dd762db88f5e3c`; see `docs/goal-004e-confirmed-actions.md`. Exact final pushed-head CI is linked in the delivery report. Historical C/D failed Text results remain failures. **RELEASE_NOT_LIVE_VERIFIED** remains.
- The final synthetic Voice + UI confirmation attempt did not complete Cargo. The first three unconfirmed inputs caused no physical change, and one confirmed Latch proposal committed once. Pip then asked to check status instead of proposing the crossing; the strict QA player stopped without trying a human recovery. Ending ACK was received.
- Original artwork and historical Practice captures are prepared. Synthetic voice tests, injected-provider tests, human speech, physical audio, natural play, and enjoyment are distinct evidence categories.
- Linked C/D/E allowance is exhausted: 4/4 attempts, 2,680 reserved seconds, USD 3.35 estimated reservation cost, zero remaining. No retry or additional real call is authorized. Public deployment, finished deck/video, and submission remain incomplete.
- Public demo, video, and presentation links: **NOT PROVIDED**. Do not replace these with hypothetical URLs.
