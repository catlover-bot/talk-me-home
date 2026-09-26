# Before: discarded Cargo report

Base: `b5ff2f0e0ad956ab3c90a49244afc44a8739ce94`. The player modules were unchanged when this regression ran. Command: `node --test --test-reporter=tap .validation/before-cargo-player.test.mjs`. Result: **0 passed, 1 failed**, no provider or token requests. See [before-cargo.tap](before-cargo.tap).

The smallest relevant driver is `scripts/qa-live-browser.mjs:253-254`: it awaits the wiring turn without retaining its return value, then calls `confirmedAction`. In `scripts/qa-player-policy.mjs:65`, that helper sends `request` before considering any previously communicated report.

The test returned the exact historical wiring response from `live/2026-09-25T17-58-10-565Z-text-mission-metrics.json`:

> I have engaged the latch and the door is now being held open. I can see the conveyor is still running. Should I try moving to the far side platform?

The metrics retain this visible-history entry's `speaker: Pip`, `sourceLabel: Live Text`, `chapterLabel: Cargo Bay`, `final: true`, and `interrupted: false`. They do not retain its source message ID or round ID. The separate provider transcript has reference `16`, time `47578.4 ms`, and `interrupted: false`; that numeric alias is not invented as the visible entry's message ID. Tool payloads and exact tool/reply associations are absent.

After this response, the regression expected only the original wiring submission. Actual submissions were the wiring statement followed by `Please engage the Latch.`. This reproduces lost player evidence independently of the classifier's whole-reply uncertainty bug.

The continuation answering the duplicate with `The latch is engaged.` is **synthetic**, only to let the bounded helper terminate. This is not an exact historical protocol replay, an authoritative physical-state assertion, or a new real-provider result. Original failed-run files and all campaign accounting were hashed without modification in `.validation/goal-004c-player-repair-baseline.json` (72 files).
