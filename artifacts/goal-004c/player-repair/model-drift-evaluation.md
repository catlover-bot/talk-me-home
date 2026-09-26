# Model request/action evaluation

Command: `GAME_DISABLE_LIVE=1 node --import tsx --test --test-reporter=tap tests/qa-player-drift.test.ts`. Result: **5 passed**, zero failures/skips/cancellations. [TAP result](model-drift-evaluation.tap).

`scripts/qa-player-drift.mjs` is a bounded Cargo evaluator, not a player input or a model fix. It does not run tools, contact a provider, inspect game state, or steer the autonomous player. It accepts explicit diagnostic observations and treats missing target payloads as missing. Its cases cover independent request phrasing, relevant negative/uncertain status answers, target-known inspection, and refusal to count a question, promise, human quotation, or unrelated Conveyor report as an answer.

The historical tests read the unchanged compact Part B metrics. The following are **temporal observation windows**, from the prior submitted turn's recorded completion to the current turn's recorded completion. They do not reconstruct exact provider call/turn associations omitted by the export.

| UI submission | Observations in the retained window | Evaluator concern |
| --- | --- | --- |
| `My diagram says the Door and Conveyor share one Power supply.` | One `interact_object`, successful result, and the Latch-engaged report | An informational statement is not automatically a mutation or movement request. The reported initiative is not proof of compliant instruction following. |
| `Please engage the Latch.` | One `move_to`, error result, and Pip's report that it tried moving across the running Conveyor | Movement follows an engage request in the observed sequence. The failed tool result does not establish physical crossing. |
| `Is the Latch engaged now?` | One `observe_room`, successful result, and a position/Conveyor response without Latch status | No relevant status answer or target-known Latch inspection is retained in this window. A bare tool name cannot prove the inspected target. |

All five historical tool entries contain result times; four are marked successful and one unsuccessful. Real end ACK is retained. The input was Text, with no ASR utterances. These findings do not rename the failure as a transport stall or ASR problem.

For the exact Latch-success quote, the compact visible history retains final `true`, interrupted `false`, source `Live Text`, and chapter `Cargo Bay`, but no round or message ID. The provider transcript separately retains numeric reference `16`, time `47578.4 ms`, and interrupted `false`; the compact item has no explicit final flag. No flags, payloads, source IDs, associations, or authoritative physical outcomes are invented.

The player evidence/classification repair cannot prove that the real model will follow later requests, choose appropriate tools, answer status questions, or complete Rescue. Those live questions remain unverified. This evaluator passes when it correctly preserves the observed concerns; it does not mark them fixed.
