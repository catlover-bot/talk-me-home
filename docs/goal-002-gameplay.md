# Goal 002 gameplay specification

Developer-only: this page contains puzzle solutions and the complete Maintenance answer table. Never send it, its fixtures, or the hidden server state to Pip.

Talk Me Home remains one human and one robot in one room. Classic is immediately available. Maintenance is an optional rule set, available in setup and as a replay. There is no timer-based physical failure, required phrase, required mistake, or additional room.

## Classic

Power starts ON, the Latch starts disengaged, and Pip starts on the near-side safe platform. The Conveyor runs exactly when Power is ON. The Door is open exactly when Power is ON or the Latch is engaged. Door and Conveyor state are derived rather than separately mutable.

Only Mission Control can issue an explicit desired Power state. Pip can observe local equipment, inspect one reachable object, perform one local interaction, or attempt a move. The Latch is reachable from the starting safe platform. Engaging it requires an open Door. Crossing requires an open Door, a stopped Conveyor, and Pip on the near side. The server alone confirms arrival after a valid crossing.

The shortest solution is to have Pip latch the open Door, switch Power OFF at Mission Control, and have Pip cross. Switching OFF too early closes the Door but is recoverable: restore Power and try again. Failed actions leave physical state unchanged. The player does not have to experience a failure first.

## Maintenance

Maintenance preserves the same room, Power rules, Latch reachability, and crossing condition. A local three-position selector starts Neutral. It can be moved only while the Latch is disengaged and reachable. Moving it never engages the Latch by itself. Once the Latch engages, the selector is locked for the remainder of the round.

There are exactly two authored server profiles:

| Local plate found by inspection | Holding selector setting |
| --- | --- |
| Crescent, with a crescent-shaped mark | Anchor |
| Kite, with a kite-shaped mark | Bridge |

The human manual shows both rows and both shapes. It never identifies the currently installed plate. Pip learns the installed plate and selector labels by inspecting the reachable Latch. Its inspection result contains no plate-to-setting mapping. Pip must receive that relationship through conversation or discover a valid setting through experimentation. No exact sentence is required.

The existing `interact_object` category accepts these local actions on `latch`: `select_neutral`, `select_anchor`, `select_bridge`, and `latch_open`. The generic runtime tool schema contains no undiscovered object names or answer-table enum. Inspection supplies the local action syntax.

With Neutral or the wrong setting, a latch attempt reports that the catch did not seat. The selector stays where it was set and the Door is not mechanically held. The failure result does not name the correct alternative. The robot can select another setting and try again. If Power was switched OFF, restoring it opens the Door for another attempt. The sequence does not depend on a failure, an inspection checkpoint, or a dialogue password.

For example, a Crescent round can be completed by inspecting the local module, sharing Crescent with Mission Control, selecting Anchor as explained by the human, engaging the open Door's Latch, switching Power OFF, and crossing. A new Maintenance round chooses one of the two authored profiles on the server. Pause and reconnect preserve that choice. Only an explicit new round resets the mechanism and may choose a different profile. Ordinary setup APIs accept only the scenario, never the hidden profile. Pure state tests can supply a profile directly to `initialState` for reproducibility.

## Information and permission partitions

The ordinary human projection contains session and round identifiers, revision, cancellation epoch, selected scenario, acknowledged Power state, lifecycle status, and validated completion. It never contains the active plate, selector position, Latch engagement, Door state, Conveyor motion, or Pip's unreported local observations. The static map and manual are human documents, not live telemetry.

Pip receives a premise-only initial prompt, genuine conversation, local tool results, and an optional bounded same-round historical recap. It cannot call a Power tool. Model arguments cannot choose an actor or another session. Unknown fields, targets, and actions are rejected. Human controls do not invoke robot actions. Browser developer tools can inspect these transports; this is a solo game's information boundary, not account authentication or a complete anti-cheat system.

Reports pinned in the notebook quote finalized robot messages exactly and retain their message ID, round, segment, origin, original timestamp, and interruption marker. They remain reported claims even if they assert success. Private notes never enter Pip's recap. A Power change or resume marks earlier reports conservatively without reading hidden current equipment state.

Two explicit optional hint levels direct attention to the wiring documents and reachable equipment; the second is more specific about coordination and, in Maintenance, comparing a reported mark with the manual. Hints do not inspect the room or identify the active profile. Their use appears neutrally in the debrief.

## Finite-state validation and recovery

Tests enumerate physical states using only scenario, installed profile, Power, Latch, selector, and robot location as the search key. They exclude revisions, random IDs, transcripts, and log history, so repeated observations cannot make the search infinite.

| Scenario | Reachable physical states | Why |
| --- | --- | --- |
| Classic | 5 | Two unlatched near-side Power states, two latched near-side Power states, and one arrived state. |
| Maintenance, Crescent | 9 | Six disengaged near-side states from two Power states and three selector positions, two engaged near-side Power states with Anchor, and one arrived state. |
| Maintenance, Kite | 9 | The same structure, with Bridge required for engaged states. |

For each profile, every reachable nonterminal physical state has a path to arrival using cooperative actors. A disengaged state can restore Power, choose the holding setting in Maintenance, engage, switch OFF, and cross. An engaged near-side state can switch OFF and cross. Ended-session lifecycle states are excluded deliberately because a user ending a mission is not a physical puzzle dead end.

Neither human-only nor robot-only actions reach completion from a fresh round. Every arrived state has a stopped Conveyor and open, latched Door. Tests additionally verify invalid-state preservation, duplicate IDs, conflicting retries, delayed selector changes immediately before commit, old-round callbacks, and scenario stability across stop/resume. This proves the implemented small state space and recovery properties; it does not establish enjoyment or natural-language play quality.

## Earned completion

Completion comes from a successful server move, never a subtitle or portrait animation. The debrief unlocks a factual timeline of this round's validated robot transitions, acknowledged human Power commands, requested hints, and arrival. Duplicate calls do not create duplicate physical actions. A recovery round shows its actual OFF/ON changes. The timeline does not pretend a canned ideal solution was the player's route. If bounded history discarded older events, the debrief is explicitly marked incomplete.

The browser permits a brief final response and then explicitly closes a Live call, with an eight-second fallback. Replay and scenario changes return to briefing and require an explicit new connection. Human Live acceptance remains a separate manual check; deterministic Practice and exhaustive state tests do not prove that Pip can negotiate the puzzle through natural conversation.
