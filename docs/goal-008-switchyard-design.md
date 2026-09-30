# Goal 008 Switchyard mechanic and finite-state design

Developer-only design and evaluator reference. Do not add this document, the state search, or a solution board to the companion/model context. The original Rescue and Training remain independent. Goal 008 starts from source `06dd6b7ec97ddb4157c581f2ad82089df20159a1`; the submitted public application remains `caa896d3a90dd4e8cb26499dba586b646bb7030a`. Event submission is owner-reported. This implementation uses no provider, hosting or accounting action.

## Equipment and information

The five locations are Control Bay, Transfer Table, Lift Station, Service Gallery and Return Platform. Home is the completed outcome rather than another puzzle location. Ordinary corridors connect Control Bay–Transfer Table, Transfer Table–Lift Station and Transfer Table–Service Gallery. The direct lift and maintenance bridge separately connect their approach stations to Return Platform. A marked unpowered return walkway leads back to the arrival-side station until final departure.

The human sees a static installation schematic, both lift/service manual rows, and a two-row, three-column routing board. The server alone selects the fitted installation once. Pip learns its actual plate names, physical preparation and local routes by observation/inspection. HumanView contains only the applied rotations, public panel revision and topology-calculated output terminals. It does not contain the installed plate, current location, readiness, route selection or hidden configuration. Only confirmed home may reveal the final approach through the root ending projection.

The six fixed pieces are row-major `p1`–`p6`. The base ports on p1/p2/p3/p5 are north/east/west junctions, p4 is a north/east elbow, and p6 is a north/west elbow. Rotations are clockwise quarter-turns. Supply enters p1 west; Amber is p3 north, Blue p6 east, White p4 south. Contacts conduct only when both neighboring ports meet. Unused sockets are insulated, not implicit shorts. Every output consumes one load; capacity is two. Three connected outputs reject the whole Apply operation without changing the accepted board. Disconnected power and invalid experiments consume nothing.

Draft rotations and Undo are client-local. Apply sends the entire six-piece layout through the owning human route. Root authority checks owner, round, mission/chapter and expected revision before the module validates all rotations and the load rule. A changed applied board increments revision and invalidates pending physical proposals even if its powered output set happens to remain the same.

## Two authored installations

These relationships are visible as all manual rows to the human; the actual selected row is discovered only by local inspection. No solution rotations are shipped.

| Server configuration | Local lift plate | Isolated index | Test supply, alone | Lift running pair | Local service plate | Winch supply, alone | Turntable alignment supply, alone | Service crossing pair |
|---|---|---|---|---|---|---|---|---|
| A | Crescent | One | Blue | Amber + Blue | Rivet | White | Amber | Amber + White |
| B | Kite | Two | White | Amber + White | Slot | Blue | White | Blue + White |

The configurations change the equipment/circuit relationship, not its color or prose alone. Each supports both approaches. Direct travel requires interpreting an index and performing a separate test before its running pair; it uses three outbound traversals. The bypass avoids index calibration and its test, but requires service-side preparation, a return to the central table for a different operation, and a second service visit: five outbound traversals. Neither route receives a score, penalty or better ending.

## Authoritative transition table

Every movement and interaction below passes through the existing exact-proposal/owner-confirmation framework. Read-only observation/inspection needs no confirmation. Proposal descriptions validate an exact reachable target and current-visit discovery without mutation; machinery prerequisites are checked on the authoritative state only when the owner confirms. A confirmed proposal can therefore fail safely if its physical prerequisites are absent.

| Local action | Prerequisites checked at commit | Consequence | Failed experiment or recovery |
|---|---|---|---|
| Observe surroundings | Exact empty arguments | Admit only the current visit's local device and exits | Always available while active; no remote map or installed plate is revealed |
| Inspect a device | Exact observed local handle and current visit scope | Communicate local plate/conditions and admit that device's action labels for this visit | A wrong or stale target fails; no substitute target is chosen |
| Set lift index one/two | Lift Station; Lift console inspected this visit; no powered outputs | Set index; changing it clears its previous test | Wrong selection is reversible after isolation; no damage or lockout |
| Test the lift | Lift console inspected; correct dedicated test supply alone; correct installed index | Persist passing calibration | Wrong supply/index fails without damage; isolate, inspect/manual-compare and revise |
| Ride the direct lift | Observed local route; console inspected; passing test; exact installed running pair | Arrive Return Platform with approach `lift` | Unsafe state keeps Pip on the safe landing; all prior progress retained |
| Seat bridge brace | Service Gallery; Bridge winch inspected; no powered outputs | Persist seated brace | Power on rejects seating; isolate without losing progress |
| Deploy bridge | Winch inspected; brace seated; exact winch supply alone | Persist bridge in a mechanical detent | No hold/drain/latch timing; power changes cannot retract it |
| Align turntable | Transfer Table; turntable inspected; bridge deployed; exact distinct alignment supply alone | Persist mechanical alignment lock | No deployed bridge or wrong supply rejects; return and revise |
| Cross maintenance bridge | Observed local route; winch inspected this visit; bridge deployed; turntable aligned; exact crossing pair | Arrive Return Platform with approach `bypass` | Keep Pip on safe service platform; return corridor remains available |
| Ordinary corridor / marked return walkway | Exact currently observed local route | New visit ID; clear device inspection admission; report confirmed arrival | Works with any accepted routing, including no power |
| Depart for home | Return Platform; Departure console inspected this visit | Complete with the approach of the actual latest arrival | Before confirmation, backtrack and change plans; after completion, further physical actions reject |

Device handles are `switchyard.directory`, `.turntable`, `.lift`, `.winch` and `.return`, each available only at its location. Action names and labels are admitted by inspection. The proposal descriptor returns a label only for an observed local movement or inspected local device/action, without changing state. The ToolResult local observation carries visit ID and state revision; core integration stamps the global game revision after applying a mutation. Communicated report text includes every structured target/action label so the local companion does not unlock silent structured knowledge.

## Finite validation and limits

`tests/switchyard-state.test.ts` enumerates every one of 4^6 = 4,096 orientations. Counts are: no outputs 3,304; Amber 520; Blue 66; White 92; Amber+Blue 66; Amber+White 40; Blue+White 4; overloaded all-three 4. All 4,092 safe boards apply; each overloaded board leaves authoritative state unchanged. Malformed, sparse, extra-property and substituted-piece layouts reject.

Physical reachability is exhaustively explored per configuration using seven routing equivalence classes. This reduction is valid because every mechanical guard reads only the powered-terminal set; orientation still matters for Apply validation and proposal invalidation and is separately covered by full enumeration. Revisions, visit IDs and current inspection admission are not finite resources: a fresh observation/inspection is always available, so the search normalizes those read-only recovery steps. The state key includes location, current power class, index/test, brace/deployment/alignment, latest arrival approach and completion.

The complete search reaches **1,008 states and 8,297 admitted transitions in each configuration**, without hitting its 50,000-state safety bound. Reverse reachability from each ending proves that every active physical state retains a path to **both** approaches before departure. Focused checks also exercise wrong-index recovery, changing plans after direct arrival and power-off retreat, repeated departure rejection, current-visit/inspection scope, wrong targets, exact arguments, and human-view separation. All ten focused state tests passed locally.

This is a proof about the authored physical-state quotient, not a proof of every HTTP lifecycle, UI interaction, arbitrary conversation or real model response. Core owner/revision/proposal tests and ordinary browser routes validate those additional boundaries. No real Voice, human first-play duration, speaker listening quality or enjoyment is measured here.

## Session and HTTP authority verification

`tests/switchyard-authority.test.ts` adds eleven focused session/HTTP checks: exact owner decisions; decline and concurrent/idempotent retries; stale panel/round/chapter revisions; malformed and overloaded layouts; current-visit discovery; paused and completed rejection; stale queued inspection; a confirmation racing panel Apply; reset isolation; robot recap/private-note separation; and approach disclosure only after confirmed home. Changed piece geometry invalidates a proposal even when the connected outputs stay the same. The HTTP test rejects configuration selection and checks that no provider request occurs.

Two integration regressions were reproduced before repair (nine of eleven new tests passed): the evaluator digest initially omitted Switchyard physical fields, and ordinary speech supersession incorrectly invalidated the exact pending proposal. The digest now covers routing and mechanical progress while excluding read-only discovery. Supersession advances the queued-work generation and preserves only a still-valid pending exact proposal; safety cancellation, Pause, changed routing and expiration retain their invalidation behavior. The proposal dispatcher does not pre-execute machinery to decide whether an action may be proposed.

The focused run passed all 43 tests across Switchyard state/authority, existing proposals, sessions and HTTP. TypeScript checking and whitespace checking also passed. These are local offline tests, not hosted or real-provider acceptance; the integrated browser evidence is recorded separately.

Final integration review also added the already-recorded human routing Apply events to the completed mission timeline. A completed-round assertion verifies their human provenance and continued exclusion from the robot recap. Repeating an unchanged, already-tested lift index reports its retained passing test rather than falsely asking for another required test. The final targeted run including all existing records tests passed 58/58, followed by TypeScript and whitespace checks.
