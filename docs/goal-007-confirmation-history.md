# Goal 007 confirmation and history refresh

An offline browser reproduction on `fb2fda4d2e48eab35878c65df3d71a1446921a56` showed an independent UI defect: a successful owner decision could remain visibly **confirming** while the subsequent conversation-history read was pending. This can produce the same five-second terminal-status timeout reported by the shared QA player. It does **not** establish the cause of the historical CI failure; that run has logs but no trace artifacts.

The reproduction used the compiled production app in Practice on an owned loopback server with Live disabled. It submitted the normal Latch proposal and exact confirmation through the visible UI. The real `/proposal-decision` response returned `ok: true` and matching committed proposal/view at 1,017 ms. Only the following authentic HTTP 200 `/record` response was withheld. At 5,879 ms the existing player had reported its unchanged 5,000 ms poll timeout, while the action strip still said “Checking your decision with the game server…” and the caption said “Engage the Latch: completed after your confirmation.” Releasing history changed the strip to committed in 6 ms. No server decision, robot state, or response body was fabricated. Provider requests were zero and the browser and owned server closed cleanly.

`useMission.decideProposal` now finishes decision input and clears its busy indicator after processing the authoritative response. The auxiliary history read follows that finalization. Its failure can report a history error, but cannot mark the committed proposal uncertain or cause a decision-recovery GET. Existing exact proposal/result handling, acknowledgement delivery, stale generation/round guards and record ordering remain in place. The change adds no retry or provider-protocol behavior.

Focused compiled browser coverage checks:

- The unchanged shared confirmation helper returns committed while history is held; there is one matching physical commit and one decision request.
- A rejected history read retains the exact committed result and caption, with no recovery GET or repeated action.
- A delayed rejection after Restart cannot enter the new mission as an old error.
- With the browser clock paused, injected Text input waits behind the decision response, then follows the exact verified receipt while history remains held. This verifies explicit decision-input release without relying on its timeout.

The four cases pass at 1280 × 720 and 1440 × 900. The existing confirmation-continuity, QA-player and stale-record suites are included in the focused run. Typecheck, production build and `git diff --check` pass. The initial new-test run revealed two fixture-readiness omissions: it now waits for the injected connection and for the proposal transcript's own persistence read before imposing the decision-history fault. No timeout was enlarged.

The safe receipt is [`confirmation-history-offline.json`](../artifacts/goal-007/confirmation-history-offline.json). Original diagnostic script, raw receipt, two visually reviewed screenshots and focused logs remain private under `.validation/goal-007-confirmation-diagnosis/`. Previous media and accounting remain unchanged. This is offline evidence and does not establish current hosted or Live acceptance.
