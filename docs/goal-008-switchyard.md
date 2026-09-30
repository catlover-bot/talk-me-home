# Goal 008: The Switchyard

## Playable decision

Mission Control edits a six-piece, 2 x 3 routing panel while Pip inspects local equipment. Restore the direct lift through plate identification, isolated calibration, a dedicated test supply and a paired running supply; or take the maintenance bypass through a seated brace, winch deployment, backtracking to a separate turntable alignment and a paired crossing supply. These are different causal operations, with three versus five outbound traversals. Neither earns a better score or ending.

Two fixed authored installations change the fitted equipment and required circuit relationships. The human manual lists all rows; Pip's local inspection identifies the installed one. The panel preview shows only connectivity calculable from the visible schematic. It cannot reveal Pip's position, installed configuration, machine readiness or a preferred path.

## Launch

Use Node 24 in this repository:

```sh
npm ci --include=dev
npm run build:game
GAME_DISABLE_LIVE=1 npm run start:game
```

Open http://127.0.0.1:3001 and choose **The Switchyard -> Practice -> Start Practice**. Rescue remains the default. Classic and Maintenance remain separate Training selections.

Select **Look around**, then an inspection from Pip's communicated report. Compare the fitted plate with **Lift plates** or **Service modules**. Turn the six pieces with pointer/Enter or Left/Right, inspect draft terminal connectivity, then **Apply routing**. The acknowledged layout and terminal power remain separate from the editable draft. Undo/Reset affect only the draft. Pip's physical actions still need **Confirm this action** for the exact current proposal; **Not yet** leaves them unexecuted.

## Boundaries and recovery

The deterministic companion offers requests only for labels actually included in current communicated local reports. Those selections use normal player messages and the existing robot-tool/proposal routes, never direct physical commits. Discussion and compact authored reactions are labelled local/scripted. Raw real-provider speech is not rewritten or fabricated. No runtime player policy imports the hidden installation, manual mappings or solver.

The server validates owner, round, chapter, global revision, panel revision, all six rotations and the two-load limit. Applied routing changes invalidate pending physical proposals. Mechanical progress is retained through power changes, ordinary backtracking and Pause; Pause cancels pending work. The installation is chosen once per round and retained through resume. New rounds may choose the other authored installation. Final home requires its own owner-confirmed departure from Return Platform. The ending names only the approach actually completed.

No timer, energy drain, score penalty, punishment for hints or unavoidable physical trap is added. The intended 8-12 minute first human play is a design target, not a measured result or acceptance deadline.

## Finite validation

The board was validated before its full UI was built: every 4^6 = 4,096 orientation was enumerated, with 4,092 accepted layouts and four harmless overload rejections. Every one of the seven allowed terminal subsets is reachable.

Each authored installation's physical-state quotient contains 1,008 reachable states and 8,297 admitted transitions. Reverse reachability finds a path from every active state to either approach's ending before departure. The quotient combines layouts with the same terminal power, and normalizes freely repeatable observations/inspections and unbounded identifier/revision values. It does not prove arbitrary HTTP, browser or real-model behavior. See [developer-only transition and coverage details](goal-008-switchyard-design.md).

The implementation passed the local authority, browser and regression checks below. Final capture and remote-main delivery receipts are recorded separately after those actions. Human fun, first-play duration, microphone/speaker quality and real Voice remain unmeasured; the optional [playtest sheet](goal-008-playtest.md) does not invent results.

## Starting point and preservation

This standalone post-submission increment starts from fetched remote main `06dd6b7ec97ddb4157c581f2ad82089df20159a1` on `work/goal-008-switchyard` in a separate worktree. The owner reports submitting the event entry; no authenticated submission check was performed. The previously observed hosted judging build is `caa896d3a90dd4e8cb26499dba586b646bb7030a`, version 0.7.0, at https://talk-me-home.onrender.com. Main and deployed identities are distinct. This task does not wake or change that service, old worktrees, submitted media or historical accounting.

The owner's latest amendment authorizes normal integration into remote main after validation, preserving concurrent changes and repository protections. The final integration and any subsequent main repair commits use **[skip render]**, while GitHub Actions continue normally. No provider/token request, allowance initialization, purchase, hosting/configuration change, deployment, media upload or submission edit is authorized.

The existing baseline was captured once from compiled source `06dd6b7` at 1280 x 720 and 1440 x 900. Screenshots and identity/hash manifest are in `artifacts/goal-008/before/`; all are labelled local deterministic Practice. Capture rejected external/provider/token/WebSocket requests and observed zero attempts. Its browser and local server were closed.

Render documents `[skip render]` as its per-commit auto-deploy skip phrase: [Deploying on Render](https://render.com/docs/deploys#skipping-an-auto-deploy). This integration uses that supported marker without changing service settings or suppressing GitHub Actions. It does not claim a fresh authenticated Render deployment inspection.

## Browser runner isolation repair

The initial combined browser process completed 210 tests and failed ten late second-viewport starts because the shared production server had reached its existing 100-session capacity. The preserved failure screens explicitly show that limit. No game rule, production capacity or assertion was relaxed. `npm run test:e2e` now runs each configured viewport in a separate Playwright invocation with a fresh production server; explicit CI `--project` and shard arguments keep their original single invocation. Raw failed-run evidence remains under `.validation/goal-008/combined-suite-failure/` with the original `e2e-full.log`.

## Observed local verification

- Typecheck and compiled production build: passed, source version 0.8.0.
- Full unit suite: **546 passed**, including finite mechanics, exact proposal authority, hidden-information boundaries and existing Rescue/Training/lifecycle behavior.
- Complete production browser suite: **110/110 at 1280 x 720 and 110/110 at 1440 x 900**, each with a fresh server. This includes all existing Rescue/Training and injected-provider regression cases, plus 16 Switchyard cases.
- Switchyard browser coverage: both approaches in both configurations, normal visible intent requests and exact confirmations, deliberate decline and plan revision, Pause/resume retaining deployed bridge work, confirmed departure/home, replay, keyboard turns/Undo, malformed/overloaded/rejected routing, pending proposal invalidation, draft retention after a changed acknowledgement, 390px reflow and 200 percent zoom.
- Authority tests separately cover wrong/nonlocal targets, owner and round rejection, stale revisions and visits, conflicting and duplicate confirmations, queued commit races, reset, and hidden configuration rejection. The stale-ack UI case is an explicitly injected response test; it is not represented as a natural server event.
- Injected provider integration: the real client protocol and API/server dispatcher accept the new observed-visit flow without network calls; provider-authored transcripts remain raw, and outgoing results omit human panel/private scope data. This is simulated-provider preparedness, not real Voice evidence.
- `git diff --check`: passed. The browser runner's default two-invocation path was also exercised directly on one panel case per viewport.

Safe test receipts belong in `artifacts/goal-008/`; full logs, failed-run evidence, raw traces and video remain in ignored `.validation/goal-008/`. No real provider request, token issuance, provider allowance initialization or deployment occurred.

## Choices and remaining playtest questions

Observed prepolish ordinary-UI traces used 14 selected requests, seven proposals, six confirmations/commits, one deliberately declined proposal and two routing applies for a lift run. The bypass trace used 26 selected requests, 12 proposals, 11 confirmations/commits, one deliberate decline, three routing applies and one deliberate Pause/resume, including investigation of the lift followed by a plan change. These counts matched both configurations at both viewports. They include the named recovery exercises, not a minimum action count.

The traces contained no typed requests, duplicate call/decision identifiers, HTTP errors or unintended failed operations. Expected repeat requests were a fresh look after routing/resume, a replacement proposal after the deliberate decline, and inspection after returning to a device. Exact confirmation occurred once per committed physical action; no extra read-only permission question was required. [Trace count receipt](../artifacts/goal-008/prepolish-trace-counts.json) defines the counting boundary and source identity.

The player can choose less travel with index/test deduction, or more travel with mechanically retained bridge progress and no lift calibration. Whether that tradeoff feels balanced or enjoyable is **not measured**. Repeated fresh looks after panel changes, manual scrolling on short screens and confirmation frequency are concrete first-play questions. Automated timings do not measure human reading, deduction, provider latency or fun. The authored dialogue is compact but intentionally finite; arbitrary natural-language understanding remains outside local Practice.

The first frozen source `386b6a1` also passed all 16 Switchyard UI cases. Its stills remain in `.validation/goal-008/ui-386b6a1-screens/`. A presentation-script initializer failed before browser/network use and was repaired. The multi-viewport runner now keeps separate output directories so the second invocation does not clear the first recording; the first preliminary capture retained all screenshots but only the second viewport raw trace. Final captures use the repaired tooling, with the gameplay unchanged.

## Final UI capture

The final screenshot/trace run passed **16/16** on clean source `f01a2f4653da1ac1c2ec099385c28729b7688149`, version 0.8.0, with separate preserved output directories for both viewports. It records all four ordinary-UI route/configuration combinations; the game source is unchanged by subsequent capture-helper readiness repairs. Curated actual stills are [the panel](../artifacts/goal-008/ui/after/panel-a-lift-chromium-1440.png), [a plan change](../artifacts/goal-008/ui/after/plan-change-b-chromium-1440.png), [pending departure](../artifacts/goal-008/ui/after/departure-b-bypass-chromium-1440.png), [lift home](../artifacts/goal-008/ui/after/home-a-lift-chromium-1440.png), [bypass home](../artifacts/goal-008/ui/after/home-b-bypass-chromium-1440.png) and [200 percent zoom](../artifacts/goal-008/ui/after/zoom-panel-chromium-1440.png). [Capture receipt](../artifacts/goal-008/ui/final-capture.json) preserves hashes for all 40 stills and the raw trace/video location. The earlier source-labelled baseline remains unchanged.
