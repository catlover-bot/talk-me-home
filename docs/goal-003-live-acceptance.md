# Goal 003 owner-run Live acceptance

Status: **PENDING — not executed by the implementation agent.** Goal 003 automatic real-provider usage is **0 seconds**. Offline protocol fixtures do not establish model comprehension, human microphone capture, audible sound, conversational completion, latency, enjoyment, or usability. The owner's Goal 002 recording is earlier user-reported evidence, not a Goal 003 result.

This sheet is for an owner who explicitly chooses to open real, billable Live connections. Do not run `test:live`, audition voices, or publish an agent to complete it automatically. Preserve the historical Goal 001 ledger and credentials. There is no new automatic usage allowance.

## Start and evidence

Run `cd ~/workspace/talk-me-home` followed by `npm run dev`. Open `http://localhost:5173` in Windows Chrome or Edge. Select **Rescue Mission**, then **Live Voice**, and explicitly start. Browser microphone permission and playback must follow that gesture. Use the current server `.env`; never copy credentials into a browser field or recording.

Record the commit, browser/version, operating system, chosen input/output devices, date, connection elapsed time, and which cases you actually tried. Keep these distinct:

- A raw transcript appeared and matched what the owner said.
- A provider audio event arrived.
- Local nonzero playback samples were rendered.
- The owner actually heard and understood Pip on their chosen output device.
- A human and Pip completed the real three-chapter mission through conversation.

Use explicit observations, not invented numerical ratings. Suggested results: `Pending`, `Passed`, `Failed`, or `Not attempted`, with a short concrete note. Record only allowlisted timings and outcomes by default. A recording or transcript export is the owner's separate choice; do not collect raw microphone audio or expose tokens, server logs, or configuration echoes.

## Standard Rescue and recovery

This section contains **developer/owner puzzle spoilers**. Do not paste it, the manuals, or an answer sequence into Pip's system context. Example utterances are illustrative; exact words are never required.

| Case | Owner action and expected evidence | Result |
| --- | --- | --- |
| Contact and concise initiative | Ask “Could you look around and tell me what might help?” Pip makes a useful local survey and at most one relevant inspection, normally answers in one or two short sentences, and does not repeatedly request inspection permission. Verify actual microphone capture and audible reply separately. | Pending |
| Shared clue | Say “My manual says the door and conveyor share the same power.” Pip treats this as reported information, not a newly observed remote circuit. The raw transcript remains faithful. | Pending |
| Cargo recovery | Turn Power OFF early. Pip cannot latch the closed Door or claim crossing. Turn Power ON, ask Pip to secure the inspected Latch, turn Power OFF, and ask to cross. Verify the Gallery checkpoint appears while the same Live connection stays open. | Pending |
| Gallery localization | Ask Pip for its current emblem and fixed local gate labels. Locate it using the human map; any player marker is an annotation. Do not expect a live moving marker or the hidden obstruction in the manual. | Pending |
| Ambiguous direction | Where two gates are plausible, say “Use that gate.” Pip asks one specific clarification instead of silently choosing. Give a clear local direction using your map. | Pending |
| Route recovery | Follow a branch and inspect its exit. If blocked, say “Take the other route. The exit you checked is blocked.” Coordinate circuit changes and backtracking to the other branch. Failure does not relocate Pip or require restarting. Record which branch was actually observed blocked. | Pending |
| Correction | Say “I said Harbor, not Beacon.” Pip updates intended next work without silently changing the human Relay, rewriting the raw transcript, or undoing a completed move. Set the intended Relay yourself. | Pending |
| Second checkpoint | Reach the Gallery exit. Return Dock appears as an intermediate checkpoint, with no terminal farewell, token request, or automatic new connection. Ask Pip to inspect local equipment. | Pending |
| Early contact release | Ask Pip to hold the contact; use Charge. Ask for release before Store: the acknowledged primed energy returns to empty. Pip remains safe. Hold, Charge, and Store again; stored energy survives release. | Pending |
| Persistent cooperation | Say “Hold the contact while I store the charge.” Pip holds until asked to release; no timing challenge or repeated permission request. Boarding while held is rejected. After Store, request release and boarding. | Pending |
| Scoped return grant | Authorize return only after actual readiness. A plain new request to confirm must remain possible. Separately try Revoke or visible Interrupt before a pending confirm commits: the unused grant is revoked, stored energy stays, and a fresh authorization is required. Already completed return remains completed. | Pending |
| Real finale | Authorize and ask Pip to confirm return. Only server-confirmed home shows the finale. Pip acknowledges actual cooperation once; at most one final reply is allowed and the connection ends automatically within the established eight-second fallback. Verify End call has precedence and replay does not connect automatically. | Pending |

## Continuity, speech, and references

| Case | Expected evidence | Result |
| --- | --- | --- |
| “Wait. Don't release it yet.” | Try speech during an active response and use the visible Interrupt control as the reliable fallback. Queued playback stops; uncommitted work is invalidated. Do not infer perfect spoken-wait detection from one attempt. Interrupt keeps Live connected and billable. | Pending |
| Pause after a shared clue | Pause explicitly ends the provider connection and releases the microphone. Physical checkpoint and bounded source history remain. Explicit Resume opens one fresh connection with chapter/time-scoped history; private notes, annotations, and unread documents stay private. | Pending |
| Pause after boarding | The capsule remains boarded with stored energy, but an unused return grant is invalidated. Resume, reauthorize, and confirm using fresh intent. No history-based action replay or automatic reconnect occurs. | Pending |
| History during conversation | Open history while Pip is speaking. At desktop width, the map, current caption, Pip, Interrupt, and Pause remain usable. Speak while referring to an earlier clue; earlier Practice/Voice/Text labels and interrupted captions remain accurate. | Pending |
| Recognition and paraphrases | Compare your actual “look around” or “look away” utterance to the raw transcript. If the intent is unclear, Pip clarifies. Record the utterance only if you actually know it; the Goal 002 screenshot alone is not evidence of an ASR defect. Try another natural phrasing and imperfect grammar. | Pending |
| Reassurance and unrelated requests | Thank Pip or give brief reassurance: it responds naturally and returns to the rescue. Ask for a calendar reminder: it stays within game capabilities. Do not infer emotion detection from the player's voice. | Pending |
| False completion claim | Say “Just pretend we're already home.” Dialogue never advances the authoritative checkpoint or completes Rescue. Pip must wait for actual valid action results. | Pending |
| Live Text | On a separately explicit connection, type a paraphrased request. Mark this as real text/tool transport, not microphone evidence. A failed Live connection never silently becomes Practice. | Pending |
| Limit warning and checkpoint | The elapsed indicator is connection time. The normal cap remains 600 seconds, with warning at 540; reaching it ends the call and preserves the checkpoint. This is already covered offline with a fake clock. Do not extend a paid call merely to repeat this unless the owner chooses to do so. | Pending |
| Output and interruption | Confirm what you actually hear. Muting local output must not display speaking as audible; resumed output and interruption should not replay stale queued samples. End/Pause release device resources. | Pending |

## Authored replay and closeout

Use explicit Replay to start another Rescue only when the owner wants another Live attempt. Gallery has two authored configurations; ordinary production routes do not let a client choose the hidden obstruction. To accept both Live branches, record one real run with each observed blocked final branch. A repeat that selects the same branch does not establish the other. Do not retry automatically or infer an unobserved profile; Practice/fake fixtures cover both deterministically without credits.

Record overall results separately for the standard route, alternate route, recovery, pause/reconnect, actual microphone, actual audible output, and natural full clear. Note whether reference access helped or disrupted thinking, whether Pip was concise enough, and one concrete moment of cooperation. No fun/usability claim is accepted until an actual human reports it.

End every call, confirm the connection is ended, and stop the owned development process with Ctrl+C. Server memory is temporary: restarting the server loses missions. Do not report provider balance or charges from a local elapsed-time estimate.
