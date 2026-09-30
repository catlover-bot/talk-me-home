# Goal 009: The first Switchyard play

## Scope

This increment starts from fetched remote main `4f1b8af8e85b1a42fbcdf6020ca6cbc8f0eb515b`, source version 0.8.1, using `work/goal-009-first-play-experience` in the preceding worktree. It reuses the existing puzzle and 008B presentation; no new mission, reward, economy or progression system is added. Normal tested remote-main delivery is required with `[skip render]`, ordinary CI, and an exact integrated production smoke. No provider use, funding, deployment, hosting change, submission edit or external media upload is authorized.

The previously observed public submission identity `caa896d` / 0.7.0 is historical. This task does not access or change that service or claim its current identity.

## Actual production baseline

A fresh local production build on 4f1b8af was inspected at 1280 x 720 and 1440 x 900, with nine native scenes per viewport. The [baseline receipt](../artifacts/goal-009/before-review.json) distinguishes actual observations from interpretation. Requests used visible player controls and public documents, with external/token/WebSocket guards; all guard counts were zero.

The objective, both route tradeoffs, private-plan label, initial Look around invitation and its button were already visible. One Look returned a useful reported location, an inspectable item and the information split. Draft/Applied labels, quoted plates beside all manual rows, exact decisions and Pause already worked. A declined move stayed unexecuted; a replacement needed a fresh exact proposal. An overcapacity draft blocked Apply without a POST or applied change. The existing conversation-help disclosure preserved the report and made no request on opening. Scrolling is not classified as a defect.

The missing connection was a brief integrated opening that explains the existing interaction boundaries while the player tries them, with a way to skip or replay it. Whether this improves learning or enjoyment is a hypothesis. Source inspection also found that the old numbered Switchyard hints named an undiscovered directory and suggested a lift supply sequence. Those hints needed public-rule and investigation guidance without choosing an answer. The existing ending already started replay explicitly; naming the alternative is a small clarification, not a new replay system.

## Implemented choices

The optional opening lives beside the real document, radio, panel and pending proposal. Its short role statement tells the player to bring Pip home: Mission Control reads the documents and routes power; Pip inspects and handles local equipment. Existing Look around and inspection choices remain the request path. There is no modal tour, duplicate request menu, automatic command or equipment gate. Rescue remains the default mission selection.

The guide follows actual interactions: an attributable report advances the observation beat, an actual piece turn advances the draft beat, and a matching newer routing acknowledgement completes the Apply beat. The initial greeting, a click on Apply, a held response or a rejected layout cannot count as acknowledged routing. The player can operate controls out of order. Skip hides the cues; Replay starts the local learning sequence again and requires fresh interactions while preserving the draft, applied power, messages and exact pending decision. Neither control changes puzzle or authorization state.

A declined Switchyard Practice action now says "You chose Not yet; [exact action] was not executed" instead of exposing its opaque proposal ID in the authored narration. Only the exact current declined receipt prefix is paraphrased. Structured server receipts, original provider/player text, historical prefixes, mismatched IDs and other chapters are unchanged.

The existing **Need a nudge?** disclosure now offers **Nudge**, **Explain the rule** and **How to investigate**. Copy distinguishes reported information, predicted connectivity and acknowledged power; explains facing contacts and the two-load limit; and points back to ordinary observation and manual comparison. It does not name the fitted installation, unseen equipment, a solution orientation or a winning action. Context uses only displayed reports, Pause and the current proposal. It is labelled private mission guidance rather than a fabricated Pip report. Opening help makes no request. Explicit tier selection uses the existing human hint endpoint and record refresh, without sending a companion message or operating machinery. A delayed older hint response cannot replace a later selected tier.

The ending invitation names the approach actually confirmed by the server and suggests the other approach, treating both as complete rescues. **Try the other approach** returns to the briefing; a new mission still needs explicit **Start Practice**. It neither preselects the installation nor applies a circuit. Original report text, exact confirmations, manual rows, private-plan boundaries, audio controls and the two authored installations remain intact.

## Working-candidate verification

The compiled **0.9.0 working tree based on `4f1b8af`**, before a clean source commit, passed **52 of 52 focused browser cases** across 1280 x 720 and 1440 x 900. This includes **12 of 12 new first-play cases**: six scenarios at each size. These results are working-candidate evidence, not the later clean full-suite or main-delivery result.

The new cases exercise local-only reading/Skip/Replay/private planning; explicit hint reads without physical or funding effects; actual report and turn progression; held, rejected and acknowledged Apply; replay preserving existing work; declined and stale proposals requiring a fresh exact confirmation; out-of-order hint responses with the original report and manual quote retained; and keyboard focus, 390px reflow, 200 percent enlargement and reduced motion. External, token and WebSocket attempts were blocked and asserted absent. Existing route coverage also completed both approaches in both installations while varying guided, skipped, replayed and help-free starts, and checked the actual-approach replay invitation and explicit new start.

The focused suite did not increase deadlines, add retries or weaken authority checks. Its results do not measure microphone input, provider understanding, audible playback, human solving time or enjoyment.

The first clean implementation commit `ca18933166c70e61516d08943867246a9889ac13` passed typecheck, production build, **556/556 unit tests and 256/256 production browser cases** (128 per viewport). A subsequent read-only audit found the radio observation cue was nested inside the Practice-only request section. Its existing non-Practice copy is now also placed beside the normal Voice/Text message controls; a separate injected-Text regression protects that placement without real provider access. The final clean successor is validated separately below.

The successor `5c13b0d27c579c78504decb9825aa1ec86031326` again passed the build and 556 unit tests. Its browser run passed 128 cases and failed the new injected-copy case at an incorrect fixture wait for a startup `reply.create`; the runner correctly stopped before the second viewport. The transport actually starts with `session.update` and server readiness, requesting a reply only after explicit input. Correcting that fixture expectation passed the focused case at both sizes, without a production change, longer timeout or retry. The failed log and screenshot remain in `.validation/goal-009/full-final-browser/`.

## Observed presentation comparison

A separate fresh-browser check used the frozen compiled working snapshot on loopback with Live disabled. Eight native images cover initial entry, the first actual Look, help beside a pending decision, and the report/manual comparison at both desktop sizes. The images, geometry receipt and capture script are retained in ignored `.validation/goal-009/visual-initial/`; each image identifies the uncommitted working candidate. The guard receipt records no external, token or WebSocket attempts. The owned browser closed after capture; the shared development server was left to its owner.

| Situation | Baseline | Working candidate |
| --- | --- | --- |
| Understand the first role and request | Objective, route tradeoffs and Look around already available | Brief role statement plus a contextual selected-text cue; existing request remains usable |
| Learn draft versus applied | Existing labels, traces and acknowledgement receipt | Cues follow a real turn and acknowledgement without changing either state |
| Read help during a decision | Existing conversation recovery preserves the report | Public-rule guidance, exact pending proposal, Confirm/Not yet and Pause remain readable together |
| Compare the reported plate | Exact quote and both manual rows already available | Comparison remains readable beside the radio; help can stay open below it |
| Replay after home | Explicit return to briefing already available | Invitation names the confirmed approach and its alternative; new start remains explicit |

At 1440px, the initial Look around button is fully visible. At 1280px, its bottom measured `720.016px` in the labelled capture, which adds a **24px top spacer**. That capture edge must not be presented as a clipped application control. After the longer first report, the lower request row needs ordinary scrolling at 720px height. Help, the entire manual and every panel control are not all simultaneously visible in one short viewport; no such claim is made. Opening help leaves the quoted plate and manual intact, while the pending-decision scene shows the proposal and Pause together.

Four updated ending images were independently inspected: both installations and both approaches, split across the two desktop sizes. The invitations agree with the confirmed outcomes and keep the local/scripted and Voice-unverified labels. Their full-page test screenshots place a fixed evidence stamp across a caption or replay buttons; this is a capture-composition limitation, not an application overlay. Final native capture should avoid that overlap. No actionable product regression was found in this bounded review. Still-frame inspection is not a human playtest or continuous playback review.

The [optional first-play sheet](goal-009-playtest.md) asks what was unclear, which observation changed the plan, where players felt they were reasoning, and whether they would try the alternative. No participants, quotations, retention figures or enjoyment results are invented. The roughly three-minute first-useful-decision target remains a design intention.

## Preservation and remaining delivery evidence

This increment preserves the existing puzzle, both successful approaches, Rescue and Training, server authority, exact confirmation, raw transcripts, historical allowances and all submitted media. Practice remains explicitly deterministic selected-text interaction. No provider call, funding initialization, public-service access, deployment, hosting change, submission edit or media upload was performed for these implementation and local checks. The old public/submitted `caa896d` / 0.7.0 identity remains historical evidence.

- **Pending — clean full candidate:** record the clean source SHA, complete typecheck/unit/production-browser/build results and exact receipt after execution. The 52-case working-tree result above does not substitute for this gate.
- **Pending — final after evidence and local preview:** record clean-source native screenshots, the labelled local preview, hashes, actual edited sections/audio status and bounded review after capture. Preserve working-candidate and baseline evidence separately.
- **Pending — exact main delivery:** record fetched-main reconciliation, the normal integration commit with `[skip render]`, exact remote-main SHA, its real CI URL/result and Live-disabled integrated production smoke receipt. A source merge is not a deployment.
