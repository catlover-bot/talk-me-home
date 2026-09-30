# Goal 010 finite generation and proof boundaries

R1 contains three panel structures, two operation dependency families, two equipment-location arrangements and four independent lift/service row combinations: 48 equipped profiles. There are 12 base panel/procedure/layout families used by novelty selection. All 48 remain distinct under the documented canonical comparison. Sixteen fixed safe starts per panel add orientation variety, not new structural families. Narrative nonce values, codes and side assignments are counted separately.

The developer-only commands are `npm run validate:remix` for a complete read-only proof and `npm run validate:remix -- --write` to write the certificate and compact receipt. The validator imports the real `applySwitchyardPanel` and `applySwitchyardTool` functions. It does not contact a provider, create a game server or operate a browser. Solution witnesses remain in ignored `.validation/goal-010/finite-*/witnesses.json`; they are absent from game projections and client imports.

## What differs

| Axis | Authored change | Changed decision |
| --- | --- | --- |
| Branch panel | Four junctions, two elbows; corner source | Original reciprocal circuit geometry; one safe output pair has only four target layouts. |
| Mesh panel | Five junctions, one elbow | An extra branch changes which routes can connect and the number/distance of valid targets. |
| Crown panel | Four junctions, two elbows; source moved to the middle edge, different attachment sites | Connecting the same named supplies requires a different physical routing plan even after global rotations/reflections are removed. |
| Detent-first | Deployment is a prerequisite for turntable alignment | Visit and prepare the service mechanism before aligning at Transfer Table. |
| Alignment-first | Alignment is a prerequisite for deployment | Obtain the alignment lock before deploying; an isolated brace can be seated before or after alignment. |
| Hub arrangement | Control Bay–Transfer Table; Transfer branches to Lift/Service | The alignment station is on the initial branch point. |
| Chain arrangement | Control Bay–Lift Station–Transfer Table–Service Gallery | Calibration is encountered first; the relevant preparation station changes the useful visit order. |
| Crescent / Kite lift row | Dedicated test Blue / White; running Amber+Blue / Amber+White, index one / two | Read the fitted plate, select its manual row, test on its isolated supply and then change to its running pair. |
| Rivet / Slot service row | Winch White / Blue; alignment Amber / White; crossing Amber+White / Blue+White | The locally fitted service plate determines three distinct power requirements independently of the lift row. |

The two uncolored full station graphs are isomorphic. Their functional equipment placement is not: calibration and alignment occupy different positions relative to the starting station. Canonicalization preserves these functional roles, while removing room names, drawing coordinates and raw IDs. This is the spatial decision being claimed; extra corridor length is not counted as novelty.

## Canonical comparison

`scripts/switchyard-canonical.ts` considers all eight global rotations/reflections, including quarter-turns that exchange the rectangular footprint. It normalizes translation, raw piece IDs, output display labels and each independently turnable piece's authored zero angle. The canonical panel retains source/output attachment sites, connector shape and capacity. The equipped signature jointly maps all lift/service supply relationships to the normalized terminal sites. Renaming outputs independently of those relationships would hide a real difference, so it is not permitted.

Equipped forms retain the real operation dependency edges and function-labelled station adjacency; they remove profile index, plate text, initial rotations, seed and presentation data. Tests transform every panel through all eight symmetries, reorder/rename objects, rotate local zero angles and jointly permute output names and machine supply relationships. These remain equal. The three panels, the two dependency graphs and the two functional arrangements remain different. This is a reproducible mechanical proxy, not proof that every run will feel novel.

## Complete finite checks

Each panel enumerates all 4,096 rotations. An independent reciprocal-contact circuit check agrees with the shipped preview. Every layout is submitted through the actual Apply boundary: all valid supplies commit, and every three-load overload leaves accepted state unchanged. All seven safe terminal subsets exist.

| Panel | Isolated | Amber | Blue | White | Amber+Blue | Amber+White | Blue+White | Rejected three-load layouts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Branch | 3304 | 520 | 66 | 92 | 66 | 40 | 4 | 4 |
| Mesh | 3002 | 394 | 298 | 66 | 250 | 30 | 30 | 26 |
| Crown | 2724 | 48 | 496 | 522 | 48 | 22 | 214 | 22 |

The physical quotient retains location, powered terminal set, index, passing test, monotonic survey/restoration facts, brace, bridge, alignment, last arrival approach and completion. Orientations in the same power class are equivalent for mechanical guards. All seven power classes have real representatives; panel edits have no consumable cost, and a valid layout can be applied from every active state. Revision/visit identities enforce freshness at the HTTP/tool boundary but are not puzzle resources. The search obtains fresh observation and inspection through the real read-only functions before each local action. Those recoverable knowledge states are therefore not separate physical vertices.

Every profile is explored completely, without truncation: detent-first has 1,316 reachable quotient states and 9,492 non-self successful edges; alignment-first has 1,582 states and 11,471 edges. Across 48 profiles, this is 69,552 states (66,024 active) and 503,112 edges. The validator attempts 687,960 transitions and replays every attempt under each of the two other assignment RunSpecs: 1,375,920 additional equivalence checks, including refusals. A refused operation may not change its physical key. The assignment copies produce the same transition result and physical state; actual completed projections must classify the assignment correctly.

For every profile, reverse searches start at each of six goal sets: lift/bypass home crossed with Rescue/Lift survey/Service restoration completion. Every reachable active state is in every required reverse closure. Both approaches therefore remain attainable with every offered assignment until final departure, including after wrong index settings or visiting the other return landing. All six witnesses are replayed with the corresponding real assignment. A state-limit failure throws and cannot produce a certificate. No candidate profiles were rejected in this accepted catalog; overload layouts are refused operations, not selectable starts.

All 16 pinned starts per panel are distinct nonzero rotation arrays with no outputs connected and no prepared machinery. Proof reuse is justified because each has the same initial physical key, all 4,096 Applies were checked, and every mechanical power guard reads only that powered set. These layouts are initial conditions, not solution witnesses.

## Cooperation and information ordering

The human-only Apply subgraph cannot move or prepare machinery. The robot-only tool subgraph, even with omniscient action selection and unlimited read-only inspection, cannot power either crossing from the isolated start. Neither reaches completed home. This establishes dependence on both actors' permitted actions; it does not claim that guessing, sharing information verbally or reading public source is impossible.

Using only ordinary corridor moves from the isolated initial state, the validator reaches and inspects Control Bay, Lift Station, Transfer Table and Service Gallery without any mechanical prerequisite. Actual reports disclose the fitted lift plate, service plate and procedure where appropriate; both full manual catalogs are available to the human. There is no prerequisite that hides its own indispensable clue. The report-fact vectors are authored prerequisites checked obtainable, not a formal epistemic lower bound or a human comprehension claim.

## Measured design proxies

Across six goals per profile, independent weighted minima are 2–4 meaningful Applies, 5–13 exact-confirmed physical actions and 2–7 traversals. One shortest-edge witness per goal has 0–3 repeated corridor edges and 3–5 distinct inspected locations. These witness counts are not additional proven minima. The optional cross-approach assignments strictly increase the required confirmed-action minimum: Service restoration before lift home and Lift survey before bypass home both change useful preparation.

The accepted-catalog guards require 2–8 meaningful Applies, 5–24 confirmed actions and 2–18 traversals. They are explicit engineering bounds for this catalog, not human difficulty bands. There is no marketed difficulty rating or adaptive response to performance. The compact receipt stores each goal's vector and each panel's full target-count and power-class rotation-distance matrix. Quarter-turn distance uses either direction; intermediate drafts can overload but are not applied. From the 16 starts, the largest distance to any individual safe target class is eight quarter-turns (Branch), four (Mesh) and six (Crown).

## Certificate and version boundary

`game/server/remix-certificate-data.ts` contains only source hashes, counts, ordered safe starts and identity pins, not paths to home. A complete proof binds shared contracts, Switchyard rules/catalog, selector, authoritative state, the canonicalizer, validator and certificate verifier. Source-mode availability checks those hashes once per process. The build helper cheaply checks them again after compilation and writes a server-only manifest binding the compiled rule bytes. Compiled runtime verifies that manifest once per process. Missing, stale or modified rules disable only Remix. Ordinary missions stay available.

R1 regeneration must preserve the ordered start arrays and the per-index resolved mechanical-definition digest. Unlike novelty signatures, code identity retains ordered pieces, zero-angle connectors, calibration indices and exact named supply relationships. Transition/routing, shared Remix schema, catalog construction and code-interpretation implementation hashes are also pinned conservatively: changing those source files requires explicit catalog-version review, even if the edit was nonsemantic. A future version must deliberately retain or reject earlier codes; it cannot silently recertify a different puzzle as R1. Presentation nonce changes do not alter these definitions.

The focused suite passed all 54 tests, including every profile, D4/renaming invariance, incomplete-search refusal, initial projection separation, and source/compiled-byte invalidation. Its measured local runtime was about 14 seconds. HTTP authority, 1,000-code sampling, ordinary UI traces, deployment and CI results are separate evidence owned by their respective tests and delivery report. Logical solvability and these proxies make no claim about human enjoyment, learning time, retention or real-model behavior.

## Per-profile signatures

Each row below refers to the concrete decision changes in the axis table above. Full SHA-256 signatures and all per-goal vectors are in `artifacts/goal-010/finite-coverage.json`; prefixes here are for comparison only.

| Profile | Panel / procedure / spatial order | Fitted lift / service row | Canonical prefix |
| ---: | --- | --- | --- |
| 0 | branch / deploy_then_align / hub | crescent / rivet | 757fa1053e413b67 |
| 1 | branch / deploy_then_align / hub | crescent / slot | 3de6ce3200c4387a |
| 2 | branch / deploy_then_align / hub | kite / rivet | d96facfe22e4b73c |
| 3 | branch / deploy_then_align / hub | kite / slot | 1aae915bd06dcf59 |
| 4 | branch / deploy_then_align / chain | crescent / rivet | 5e466451f15c6b8e |
| 5 | branch / deploy_then_align / chain | crescent / slot | fa9a9cac7ed29274 |
| 6 | branch / deploy_then_align / chain | kite / rivet | 318c3054429ead93 |
| 7 | branch / deploy_then_align / chain | kite / slot | cabf081baa583eab |
| 8 | branch / align_then_deploy / hub | crescent / rivet | aa97163836120fcd |
| 9 | branch / align_then_deploy / hub | crescent / slot | 2fb3831577298963 |
| 10 | branch / align_then_deploy / hub | kite / rivet | ddf927009f0fb3b3 |
| 11 | branch / align_then_deploy / hub | kite / slot | 884e84b8faa46ffe |
| 12 | branch / align_then_deploy / chain | crescent / rivet | 996016af89c997ff |
| 13 | branch / align_then_deploy / chain | crescent / slot | 2a77ac54a9938613 |
| 14 | branch / align_then_deploy / chain | kite / rivet | 949c601a1659c7c2 |
| 15 | branch / align_then_deploy / chain | kite / slot | c2d995027d1f3ad7 |
| 16 | mesh / deploy_then_align / hub | crescent / rivet | b88d8c3812084069 |
| 17 | mesh / deploy_then_align / hub | crescent / slot | e96a9c215f330c2b |
| 18 | mesh / deploy_then_align / hub | kite / rivet | d2a8331b8579756c |
| 19 | mesh / deploy_then_align / hub | kite / slot | 050f72261e09a28e |
| 20 | mesh / deploy_then_align / chain | crescent / rivet | e2b3dfa7285edc7f |
| 21 | mesh / deploy_then_align / chain | crescent / slot | 07ae005d4346d3ae |
| 22 | mesh / deploy_then_align / chain | kite / rivet | a7d558b6cb2a59bb |
| 23 | mesh / deploy_then_align / chain | kite / slot | ea207ae3260c0488 |
| 24 | mesh / align_then_deploy / hub | crescent / rivet | 0184572789a91ae6 |
| 25 | mesh / align_then_deploy / hub | crescent / slot | be1065e0f3e3a1a2 |
| 26 | mesh / align_then_deploy / hub | kite / rivet | 86dfb7bb29ae7de7 |
| 27 | mesh / align_then_deploy / hub | kite / slot | 2d84df6bd3088231 |
| 28 | mesh / align_then_deploy / chain | crescent / rivet | 59c9380e0f579e52 |
| 29 | mesh / align_then_deploy / chain | crescent / slot | 04d0ae77ee90d885 |
| 30 | mesh / align_then_deploy / chain | kite / rivet | 00653593dc552bb4 |
| 31 | mesh / align_then_deploy / chain | kite / slot | 5c21d4d26e3b7e32 |
| 32 | crown / deploy_then_align / hub | crescent / rivet | c3c657ce5cd04696 |
| 33 | crown / deploy_then_align / hub | crescent / slot | 761fa31482eca010 |
| 34 | crown / deploy_then_align / hub | kite / rivet | 02ab1bafe1ae0f85 |
| 35 | crown / deploy_then_align / hub | kite / slot | 4f09463667e75df8 |
| 36 | crown / deploy_then_align / chain | crescent / rivet | 5f92f7530ba32672 |
| 37 | crown / deploy_then_align / chain | crescent / slot | aa62aef37076f2d8 |
| 38 | crown / deploy_then_align / chain | kite / rivet | bb4c2002c9868dc3 |
| 39 | crown / deploy_then_align / chain | kite / slot | 993a9bf1b2ffc2f0 |
| 40 | crown / align_then_deploy / hub | crescent / rivet | 69461708c900c6fb |
| 41 | crown / align_then_deploy / hub | crescent / slot | 51ca0d4e5208236b |
| 42 | crown / align_then_deploy / hub | kite / rivet | 6b8c34fda4cede27 |
| 43 | crown / align_then_deploy / hub | kite / slot | 75fac562b2578ad5 |
| 44 | crown / align_then_deploy / chain | crescent / rivet | 0e98075616409fbe |
| 45 | crown / align_then_deploy / chain | crescent / slot | ebf3226d77c9ef72 |
| 46 | crown / align_then_deploy / chain | kite / rivet | 49af1ec98c219858 |
| 47 | crown / align_then_deploy / chain | kite / slot | 15cba037c2ecfe25 |
