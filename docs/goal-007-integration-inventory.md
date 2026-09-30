# Goal 007 integration inventory

The selected delivered source is `5982fb69711f765aaeff33959773b022fce50c27`. Git ancestry and three-dot diffs were inspected for every existing local and origin `work/goal-*` head, against the independently fetched GitHub branch listing. All twelve remote branches and their local counterparts are already ancestors of this selected head. No branch has unique commits or a nonempty divergent diff requiring another merge or cherry-pick.

| Existing branch | Head | Treatment |
| --- | --- | --- |
| `main` | `11b4c9508bef682785e8bdf23d5170b30aafb7a6` | Upstream starter history retained |
| `work/goal-001-first-door` | `b1be76ef0e2b28a52b3d59fe6a824af96bdfbe26` | Already included |
| `work/goal-002-companion-polish` | `40583a9f3aad714fe1941591f74eb99c9867ba68` | Already included |
| `work/goal-003-rescue-mission` | `a212857e00c8ad75a3b630af2b8e0435c48ad899` | Already included |
| `work/goal-004-release-candidate` | `99bec1634eb3a1e49a2707a6c72f5b775785d12e` | Already included |
| `work/goal-004b-autonomous-qa` | `00d10e1c21fa8de40a4c9bf5e49dce5126c2b04c` | Already included |
| `work/goal-004c-live-recovery` | `6521bc0a761e35c36d5deb56538eb77f1f8ebae7` | Already included |
| `work/goal-004d-runtime-intent-fix` | `52d8c6d4cc68d136890ffa4dfb39c4060602ffb0` | Already included |
| `work/goal-004e-confirmed-actions` | `d87a898bdc7fa1e6dcb6bbf1debe4be1e9930291` | Already included |
| `work/goal-005-gallery-live-completion` | `1949b921fc744dc28d0889ca8d30c9d7d8102bd6` | Already included |
| `work/goal-005b-targeted-stabilization` | `ec9766dae2ff1eafb0d6559d637a1517a878e08a` | Already included |
| `work/goal-006-gameplay-and-submission` | `5982fb69711f765aaeff33959773b022fce50c27` | Selected base |

There were no tags at this initial inventory. Private ignored data is outside integration scope. The inventory does not authorize copying credentials, ledgers, caches or raw recordings into Git.

Goal 007 baseline `c691019` adds the product entry point, archived starter manifest, canonical production manifest and safe build identity. Its new admission and immersion branches are intended increments based on this baseline, not divergent historic work. Their final exact heads and integration reachability must be appended after implementation. Final remote main and CI evidence belong in the Goal 007 release report; this initial inventory alone is not proof of main integration.

The detailed read-only inventory is retained locally in `.validation/goal-007/security/branch-inventory.json`. All historical branches and evidence remain intact.

## Integrated main snapshot: September 30, 2026, 01:34 UTC

Fresh remote ref advertisement, local refs, ancestry and three-dot diffs were checked against `076079742ff4728dbbf3d78fe1847a4a3259e024`. Remote `main`, remote `work/goal-007-release-and-immersion`, their origin-tracking refs, local `main` and the release worktree all resolve to that commit. The release publication used a normal fast-forward; the previous published baseline is an ancestor. The formerly stale, unused local `main` was then advanced by a non-forced fetch, whose reflog explicitly records the fast-forward. The local and remote backup tag `archive/pre-goal-007-main-20260930` still points to `11b4c9508bef682785e8bdf23d5170b30aafb7a6`.

The audit covers 44 local/remote ref observations: 16 local branch heads, 13 origin-tracking heads, 13 freshly advertised remote branch heads, and the local/remote backup tag. All objects were available; every audited commit is an ancestor of the target, with zero unique commits beyond it and empty divergent diffs. The eleven historical Goal 001–006 branch heads listed above remain unchanged and included. There are now twelve published `work/goal-*` branches, counting the Goal 007 release branch. The three isolated Goal 007 implementation branches are local; their committed heads are also included.

| Intended Goal 007 increment | Included source commit(s) | Integration evidence |
| --- | --- | --- |
| Product entry points, deployment baseline, source inventory and exact runtime notices | `c691019`, `e37f8f7` | Direct ancestors |
| Immersion, selected-input disclosure, sound, recorder detail and inspected UI evidence | `d9ee08b` | Normal merge `1a9675a` |
| Editable submission components with pending-release labels | `f9f4b32` | Normal merge `fd8640f` |
| Protected hosted allocation and signed transport-mode enforcement | `ed2a410`, `5ced8ba` | Normal merges `671ed71`, `e273b50` |
| Bounded hosted QA, optional recorder player and offline regressions | `fa9e30e` | Normal merge `d22d39a` |
| Validated offline speech preparation receipt | `8645cd7` | Normal merge `5e5cef0` |
| Startup refusal-warning preservation | `4c2937d` | Normal merge `19d4036` |
| Incremental source/media/Actions exposure review | `0a3ecf1` | Normal merge `1c57312` |
| Main publication, controlled release profile, Practice smoke, preservation and integrated validation reports | `88a0249`, `9936675`, `86b2c35`, `2a88dc1`, `0760797` | Direct release-branch ancestors |

The safe machine-readable receipt is [integration-main-0760797.json](../artifacts/goal-007/integration-main-0760797.json). It records full source and merge identities and hashes both private inventory snapshots. The original detailed inventory and the later read-only snapshots remain private and unchanged.

At this snapshot, `work/goal-007-immersion` has committed head `d22d39a`, which is already included, plus uncommitted Practice-preview work under `submission/goal-007/preview/`, its preview SRT and a draft preview report. That in-progress media work is **not integrated** by this receipt. Its eventual committed source, assets and provenance require a later merge and verification. This inventory records source reachability; it does not claim current hosted Voice acceptance, successful deployment, public-source approval, final-head CI or inclusion of ignored credentials, ledgers, fixtures and raw recordings.
