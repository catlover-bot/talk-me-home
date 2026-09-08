# Goal 003 — the rescue desk

The Rescue Mission turns the existing first Door into the beginning of one journey. The player keeps the same partner, conversation, notes, and connection as the documents and remote controls change from Cargo Bay to Relay Gallery to Return Dock. Training remains available for the shorter Classic and Maintenance exercises. Connection choices remain separate: Practice is a deterministic simulation; Live Voice and Live Text use AssemblyAI.

## Briefing and orientation

The briefing recommends Rescue Mission and shows its three public chapter names. Training reveals a separate exercise selector. Neither choice starts a provider connection. The existing line “You have the map. Pip has eyes and hands” remains the central explanation, with remote controls broadened beyond Cargo Power.

An optional Quick guide sits after the Start button, so it never gates a mission. Its four short explanations cover the static map, human remote controls, talking with Pip, and Pause. It introduces the damaged remote sensors as the reason Mission Control depends on Pip's local checks. The native disclosure supports keyboard opening and closing, with no onboarding modal or automatic provider connection.

The compact chapter header gives the current place, one objective, and three public checkpoints. A checkpoint is marked only when the server projection includes it in `chaptersCleared`. It is not a location tracker. The header does not announce a finale at Cargo or Gallery. The active connection and its provenance remain visible in the application header and Pip's console.

## Three documents, three kinds of cooperation

| Chapter | Human document | Human control | Information kept local to Pip |
| --- | --- | --- | --- |
| Cargo Bay | Existing rectilinear route drawing and shared-Power wiring | Desired Power ON or OFF | Current equipment conditions and Latch observations |
| Relay Gallery | An atlas with five room emblems, compass, and both labelled circuit branches | Desired Relay Off, Beacon, or Harbor | Current room, observed gate conditions, and obstruction |
| Return Dock | An energy procedure sheet with temporary energy, storage, and authorization schematic | Charge, Store, Authorize return, Revoke | Local contact and capsule details; checks and physical actions |

Cargo keeps the established paper and linework. Gallery uses a green survey sheet, circular emblem stations, and solid/dashed circuit tracks. Its topology is fixed documentation, independent of the hidden obstruction configuration. Return Dock uses a warmer service sheet, numbered procedure notes, and an energy diagram rather than another room map.

Gallery draws Ring–Fork through Beacon; Fork–Sail through Harbor; Sail–Dock through Beacon; Fork–Leaf through Beacon; and Leaf–Dock through Harbor. Every gate is bidirectional. Diagram geometry and the server's local compass labels agree. Circuit names accompany line styles so the map never requires color alone. At narrow widths, B/H identifiers match the visible Beacon/Harbor legend and a complete text gate reference is also shown.

The Gallery annotation drawer lets the player mark an inferred room and suspected obstructed paths. Its source label is **Private inference**. A dashed ring means “your mark,” never “Pip is here.” Marks use their own server record API and do not alter the game, disclose the true obstruction, or enter the robot recap. They are useful only as a record of the player's reasoning.

Return Dock deliberately exposes a narrow working instrument panel: acknowledged energy, return interlock readiness, and authorization. These are permitted console readings. They are visually and semantically separate from the static procedure. The panel has no contact-state display, robot coordinates, or local-action buttons. An authorization acknowledgement is permission for Pip to confirm departure; it is not success.

## Pip and the communication surface

Pip remains the original UNIT 04 drawing. Refinements add stitched repair detail, small shell wear, a clearer antenna response, and a distinct checking symbol and head pose. The illustration communicates the existing activity state rather than drawing hidden room conditions. A checking icon means a real pending local tool operation, not proof that a check succeeded. The portrait does not obtain access to the map or player annotations.

Speaking animation continues to depend on the audio adapter reporting actual audible playback with a nonzero volume. A typed response, queued audio, or provider event is insufficient. Ready, listening, considering, checking, interrupted, paused, error, and success remain separately named states. The success state is mounted for authoritative terminal completion, not a narrated promise.

History is now an ordinary in-panel section, not a centered modal. While open, it occupies the large portrait's space and retains a compact drawing of Pip's head and the UNIT 04 identity. It leaves the map, current caption, message input, and Pause/Interrupt controls outside the history region. Its own transcript list scrolls. Opening it does not trap focus or make the rest of the mission inert. Close or Escape returns focus to the trigger without an automatic page jump; Escape defers to an open restart dialog. At narrow widths it flows with the console rather than covering equipment controls.

Quotes and pinned reports retain transport origin and chapter labels. Previous calls remain labelled. A saved report is a quote from a particular point in the journey, not a current sensor reading. Private notebook entries remain separate from reported observations.

## Presentation and responsive behavior

Presentation layout is an explicit, reversible display choice. It enlarges the active caption and speaker while balancing the map and Pip console at 1280×720. Optional notes and settings remain available below the primary task area. It does not start a recording or suppress the Practice label, provider usage notice, errors, pending commands, or stop controls.

The layout retains the system UI and local Georgia display stack, with no remote fonts. Desktop uses a document desk and dark communication console. Short desktop viewports reduce decorative space and portrait height before reducing interaction areas. Wide desktop layouts give the documents and portrait more room. Narrow widths and reduced effective container width reflow to a single column. Inputs and action buttons retain a 44-pixel minimum target. Long captions and history have explicit scrolling affordances.

All new animation is short SVG/CSS motion. Reduced-motion preferences disable it, including the homecoming capsule movement. No full-screen flash, timer challenge, external raster artwork, shader, or 3D dependency is introduced.

Required visual review covers 1280×720, 1440×900, 1920×1080, a 390-pixel-wide layout, and 200% enlargement. The measured browser outcomes and any remaining limitations belong in `docs/goal-003-validation.md`; design intent here is not a claim that those checks passed. CSS enlargement is not an independently verified Windows browser/OS zoom test.

### Implementation review observations

The UI agent inspected actual local browser captures from the intermediate Goal 003 runs: Gallery, Return Dock, history, Presentation, and homecoming at 1280×720 and 1440×900; Gallery at 1920×1080; and the 390-pixel and 200% enlargement layouts. The three document styles are visibly distinct. The updated Gallery labels remain legible at desktop size. The narrow and enlarged captures reflow to one column, and narrow Gallery adds the textual gate reference. In the revised 1280-pixel history capture, the map, current caption, input, and Pause remain available without a modal overlay. The revised finale shows the real caption and all three recorded chapter excerpts near Pip's return illustration.

These observations prompted concrete corrections: redundant chapter labels were removed from the single-room Training timeline after its last row clipped; Gallery gate text and label boxes were enlarged; history moved into the portrait area; and the real closing caption moved inside the debrief. Long captions and scrollable history received visible cues that depend on measured overflow and reserve no additional panel height. An early Practice homecoming capture caught the capsule's brief fade; final evidence should disable screenshot animations or use reduced motion for a stable illustration.

Static color calculations give 8.44:1 for Gallery gate text, 4.74:1 for its secondary labels, 3.49:1 for circuit tracks against the sheet, 5.39:1 for Dock procedure text, 4.60:1 for schematic labels, and 6.38:1 for the authorization button. Small checkpoint status text was darkened from 4.49:1 to 4.562:1. These selected-pair checks are not a complete accessibility certification. The final screenshot and browser rerun after the last cue changes remains the responsibility of the consolidated validation report; this section makes no final-green claim.

`node --import tsx --test tests/contrast.test.ts` subsequently passed all 5 test groups, including 4 new Rescue groups. The tests read colors from the actual stylesheet, verify that their component/SVG classes are still present, and check same-selector color variants rather than keeping independent hex fixtures. The new pair diagnostics are:

| Declared color pair | Ratio | Required minimum |
| --- | ---: | ---: |
| Gallery gate text / label backing | 8.445:1 | 4.5:1 |
| Gallery secondary text / sheet | 4.740:1 | 4.5:1 |
| Dock procedure text / sheet | 5.390:1 | 4.5:1 |
| Dock schematic text / sheet | 4.602:1 | 4.5:1 |
| Dock acknowledged values / instrument panel | 7.421:1 | 4.5:1 |
| Enabled authorization text / button | 6.381:1 | 4.5:1 |
| Checkpoint status / page | 4.562:1 | 4.5:1 |
| Gallery circuit track / sheet | 3.491:1 | 3:1 |
| Private location outline / sheet | 5.249:1 | 3:1 |

These checks cover selected opaque declared colors. They do not model the decorative grid's compositing, antialiasing, all CSS cascade interactions, every interactive state, or overall accessibility. Browser inspection remains necessary.

## A confirmed homecoming

The rescue debrief uses an original SVG of a small capsule leaving the station for a home beacon. It is explicitly an illustration of the server-confirmed rescue, not a camera or recording. Its chapter checklist reads the public `chaptersCleared` values. Each chapter has a short, labelled excerpt from its last recorded local action, so the visible recap covers the whole journey. The full recorded timeline remains expandable. The excerpts and contribution counts come from actual events; absent records show a loading or missing-record state instead of invented achievements. The real final caption appears inside the debrief paper. Training retains its directly visible single-room timeline. Replaying returns to briefing and does not start Live automatically.

The intended first conversation within about 30 seconds and 6–8-minute rescue remain design hypotheses. Automated Practice traversal and visual inspection cannot establish first-time human pacing, audible playback, or natural conversational cooperation.
