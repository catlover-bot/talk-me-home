# Goal 003 gameplay specification

**Developer-only reference.** This document contains hidden configurations, complete topology, and test solutions. Never send it, its tables, or its fixtures to Pip as runtime context.

Rescue is one in-memory mission round with three authoritative chapters: Cargo Bay, Relay Gallery, and Return Dock. Training keeps Classic and Maintenance as independent first-door exercises. Connection choice (Practice, Live Voice, Live Text) does not select mechanics or reset progress. Restart creates a new round; restarting the server loses all sessions.

## State and completion

`missionKind` selects Training or Rescue; `scenario` selects Classic or Maintenance Training. Rescue uses Classic Cargo Bay. The production HTTP API rejects Rescue with Maintenance and rejects any supplied hidden configuration. Server randomness selects Gallery A or B once when a round starts. Pause, reconnect, hints, and wrong moves preserve that selection. Tests inject `new SessionStore({ galleryConfiguration: 'a' })` or `'b'` directly into their own ephemeral server; there is no production route or request header for it.

The server owns the mission's `roundId`, current `chapter`, `chapterEpoch`, action cancellation epoch, revision, lifecycle, and small chapter states. Chapters advance Cargo → Gallery → Return Dock. Each advance increments the chapter and action epochs. Public `chaptersCleared` contains only validated milestone beacons.

In Training, a valid Cargo crossing completes the exercise. In Rescue, Cargo and Gallery crossings establish checkpoints and continue the same round. Only a valid, authorized Return Dock confirmation moves Pip to `home` and sets `completed`. A transcript, hint, animation, human authorization alone, or intermediate crossing cannot complete Rescue.

## Cargo Bay

Power initially is ON, the Door is unlatched, and Pip is on the near-side safe platform. `conveyorRunning = powerOn`; `doorOpen = powerOn || doorLatched`. Only the human commands Power. Pip can inspect local equipment and engage the Latch while the Door is open, from the safe platform. Crossing requires an open Door and stopped Conveyor. Invalid actions leave the physical state unchanged.

Switching Power OFF too early closes the unlatched Door. Restoring Power permits recovery. Neither a prior failure nor a particular spoken phrase is required. Maintenance Training retains its two hidden local module marks: Crescent requires the Anchor setting; Kite requires Bridge. Neutral and the wrong setting cannot engage the Latch. These mappings appear in the human's Training document, never the runtime prompt or an automatic robot recap.

Developer solution: Pip engages the Latch, the human switches Power OFF, and Pip crosses. Cargo's existing `latch`, `door`, `conveyor`, and `far_side` target names remain compatible; chapter dispatch prevents their use in a later chapter.

## Relay Gallery

The human owns the complete static map below, including gate circuits. Pip sees only the current room emblem, a fixed north mark, and adjacent gate labels and visible open/closed conditions. Inspecting an adjacent gate reveals whether its opening is obstructed. Its generic identifier is usable for inspection and movement; it does not encode an unseen destination or circuit.

| Gate target | Rooms | Circuit | Direction from first room | Direction from second room |
| --- | --- | --- | --- | --- |
| `gallery.g1` | Ring ↔ Fork | Beacon | East | West |
| `gallery.g2` | Fork ↔ Sail | Harbor | Northeast | Southwest |
| `gallery.g3` | Sail ↔ Dock | Beacon | Southeast | Northwest |
| `gallery.g4` | Fork ↔ Leaf | Beacon | Southeast | Northwest |
| `gallery.g5` | Leaf ↔ Dock | Harbor | Northeast | Southwest |

Relay initially is Off. Exactly one desired selection is active: Off, Beacon, or Harbor. A gate opens when its circuit is selected. A physical obstruction can still prevent passage through an open gate. All rooms are safe with any selection; returning gates can always be reopened remotely. There is no reaction-time constraint.

Configuration A obstructs `gallery.g3`; B obstructs `gallery.g5`. Exactly one final branch is obstructed. A failed move does not relocate Pip. Obstruction results describe the reachable cargo and safe room, without identifying the other branch or installed configuration. Nonadjacent gates cannot be inspected or traversed. A successful internal move includes an observation of the newly reached room, which is now legitimate local knowledge. Reaching Dock advances to Return Dock; its new equipment must be observed separately.

Developer solutions:

- A: Beacon; Ring → Fork → Leaf; Harbor; Leaf → Dock.
- B: Beacon; Ring → Fork; Harbor; Fork → Sail; Beacon; Sail → Dock.
- Wrong-branch recovery: inspect the blocked opening, select the circuit for the return gate, return to Fork, and investigate the other service bay. Off never traps Pip permanently.

The human map has a manually placed room marker and suspected blocked-gate marks. These are private player inferences, including when incorrect. The server neither validates them against Pip's location nor automatically updates them. They never enter the robot recap. The normal human projection contains Relay's acknowledged selection and checkpoint progress, not Pip's room, observed gates, active obstruction, or configuration.

## Return Dock

The initial local state is platform, contact released, energy empty, no grant. Pip's local plaques describe the spring-loaded contact, local movement constraints, and available actions. The human procedure describes its Charge/Store controller. The human may read exactly the acknowledged energy state, readiness interlock, and authorization status: this is working Return Dock instrumentation, not a room camera.

| Actor and operation | Preconditions | Authoritative result |
| --- | --- | --- |
| Pip: `return.contact` / `hold_contact` | On platform | Contact remains held until released |
| Human: Charge | On platform with contact held | Empty → primed energy |
| Human: Store | Primed energy with contact held on platform | Primed → stored energy |
| Pip: `return.contact` / `release_contact` | On platform | Releases contact; primed energy becomes empty; stored energy persists |
| Pip: move to `return.aboard` | On platform, contact released, stored energy | Boards the capsule |
| Human: Authorize return | Aboard, contact released, stored energy | Creates a scoped return grant |
| Human: Revoke | Active Return Dock | Removes grant and cancels pending robot actions |
| Pip: `return.capsule` / `confirm_return` | Current readiness and valid grant | Consumes grant, moves home, completes Rescue |

Holding is a stable state, not a timed button press. Pip cannot board while holding. Early release after Charge loses only unstored energy; holding and charging again recovers. Stored energy and committed physical actions survive a pause or interruption. Repeated desired-state commands are harmless where the state already matches; invalid combinations return short English explanations without changing the world.

The grant binds the current round, chapter epoch, and readiness version. A physical readiness change removes it. Revoke, genuine interruption, Pause/End, Restart, or a chapter transition removes it. Pure inspection and faithful caption recording preserve it. Ordinary input supersession cancels uncommitted work without revoking an otherwise valid grant, so a typed request following human authorization remains usable. Revoke also advances the action epoch: an old pending confirmation cannot become valid again merely because the human reauthorizes before it arrives.

Developer solution: hold → Charge → Store → release → board → Authorize return → confirm. Authorize is not departure, and generic dialogue is not local confirmation. Committed confirmation is idempotent by call identifier; no second departure can occur.

## Generations, requests, and audiences

The HTTP route binds actor permissions outside model arguments. The four robot tools remain `observe_room`, `inspect_object`, `interact_object`, and `move_to`; Power, Relay, Charge, Store, and grants are human routes. Unknown fields, forged roles/session fields, ambiguous targets, array-valued actions, and cross-chapter objects are rejected.

Robot calls carry the round, chapter epoch, action epoch, and call identifier captured when the provider emits the call. State is rechecked immediately before commit. Each successful Gallery movement advances the action epoch, preventing another queued intent from the old room from accidentally backtracking through the same gate. A deliberately requested backtrack with current context remains valid. Human equipment commands carry the round, chapter epoch, revision, desired command, and request identifier. Conflicting reuse of identifiers rejects. A committed chapter-advancing call returns its original successful result on an exact retry, even after advancing; other queued old-chapter calls reject. The browser must deliver that committed tool result to its conversation exactly once.

Rescue requires chapter generations. Legacy Training requests may omit its unchanged Cargo generation. Same-round Stop, End, and cancellation accept an older already reached chapter because a crossing might commit before the safety request arrives; they never accept a future chapter. Other old-chapter mutations reject. Cancellation reasons are `interrupt`, `supersede`, and `stop`; the default is `interrupt`.

| HTTP operation below `/api/sessions/:id/` | Input beyond URL-bound session | Response |
| --- | --- | --- |
| `power` | round, chapter epoch, request ID, revision, boolean `powerOn` | Human view |
| `relay` | same generation/revision fields, `relay: off/beacon/harbor` | Human view |
| `dock-control` | same generation/revision fields, `action: charge/store/authorize_return/revoke_return` | Human view |
| `tools` | round, chapter/action epochs, call ID, name, object arguments | Validated local result plus separate human view |
| `annotations` | round, chapter epoch, request ID, `kind: location` with room/null, or `kind: blocked_gate` with `g1`–`g5` and boolean `marked` | Private human mission record |
| `messages` | Final text plus immutable ID, segment, role, origin, input method, original chapter/epoch, interrupted flag | Recorded communicated message |
| `notebook` | round, chapter epoch, request ID, exact report message ID or private note text | Notebook entry |
| `hint` | round, chapter epoch, request ID, level 1–3 | Human-only chapter hint |
| `record?roundId=…` | GET, current round only | Communicated messages, private notebook/annotations, requested hints; final debrief only after completion |
| `recap?roundId=…` | GET, current round only | Bounded historical robot knowledge and untrusted player quotes |

Local tool results must have their human view stripped before forwarding to the voice provider. Historical local events retain their original chapter/epoch. A delayed final caption may refer to an earlier chapter already reached in the same round, but cannot relabel an existing message or claim a future chapter. Previous-round captions reject. Later interruption can only amend a finalized message to `interrupted: true`, retaining exact text and provenance.

Recaps contain prior robot observations and completed local actions, plus actually recorded human conversation as untrusted quotes. They contain no private notes, map annotations, unused hints/manuals, human-only event stream, unobserved state, or full topology. The recap instruction says these are historical records and completed actions must not be replayed. Human Power/Relay commands are not silently relayed as robot knowledge. Live model compliance with these boundaries still requires the separately documented live acceptance checks.

Retention is bounded per round: 160 local events; the latest 120 messages plus at most 1,000 message receipts; 40 notebook entries; three hint levels per chapter; one room annotation and five gate marks. Message text is at most 2,000 characters; private notes at most 500. Recaps keep at most 16 whole entries, 6,000 text characters, and 11,000 serialized UTF-8 bytes, removing oldest whole entries when necessary. Debrief truncation is disclosed and only retained actual events are shown.

Ordinary requests retain at most 1,000 receipts without eviction, preventing replay of committed actions. Stop, End, cancellation, and Restart use a separate rolling cache of 32 safety receipts, so saturation cannot prevent stopping or restarting. Retrying an evicted safety request may stop/revoke again but cannot replay physical work. Session storage defaults to 100 sessions with two-hour idle expiry. This is a solo gameplay and model-context boundary, not authentication or protection against browser developer tools.

## Finite-state verification

`tests/state.test.ts` retains the Classic five-state and each Maintenance nine-state exploration. `tests/rescue-state.test.ts` explores the physical Rescue state graph with both actor sets and separately from each actor's allowlist. IDs, revisions, timestamps, historical records, and generation counters are deliberately excluded from the physical search key; validity of those fields is tested separately.

For **each** Gallery configuration, the composed mission has **24 reachable physical states**. The Gallery chapter alone has **13 states**, including its terminal chapter checkpoint; Return Dock has **8 states**, including authorized readiness and final home. From every reachable nonterminal physical state, an allowed cooperative path reaches the next checkpoint and final home. Neither actor alone can clear Gallery, complete Return Dock from its initial state, or complete the whole Rescue. Training's existing actor-dependence checks remain in place.

The proof covers active physical play. Separate lifecycle tests establish that pause blocks uncommitted work, resume retains committed progress/configuration, safety operations work at request saturation, and Restart resets records and rejects old rounds. Race tests delay commit, then change preconditions or revoke/reauthorize; stale requests cannot advance the world. HTTP tests cover both complete A/B paths, actor forgery, stale chapters, private annotations, historic captions, checkpoint-only progress, and duplicate final confirmation with an injected transport asserting **zero provider calls**.

Server-focused validation on 2026-09-08:

```sh
npm run typecheck
GAME_DISABLE_LIVE=1 ./node_modules/.bin/tsx --test tests/state.test.ts tests/http.test.ts tests/records.test.ts tests/rescue-state.test.ts tests/rescue-http.test.ts
```

Typecheck and `git diff --check` passed; **81/81 tests passed**, zero skipped. These tests establish state, HTTP, and record behavior. They are not microphone tests, audible playback checks, live model evaluations, or evidence of a natural human-and-Pip playthrough. Browser and final aggregate validation are recorded separately by Goal 003's validation report.
