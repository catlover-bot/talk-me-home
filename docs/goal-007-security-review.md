# Goal 007 whole-exposure review

Review date: 2026-09-30. **Public-source gate: blocked by historical private account data pending the owner's specific disclosure decision.** The repository remains eligible for private-source application deployment; this review does not block authorized main integration or HTTPS Practice publication.

## Scope actually inspected

- Every initial GitHub branch: twelve remote branches, with all corresponding local/origin refs compared by ancestry and divergent diff. There were no tags, pull requests or divergent historic fixes at the initial snapshot. See [integration inventory](goal-007-integration-inventory.md).
- All reachable tracked Git history and commit metadata: the expanded credential scan covered 1,346 unique blobs at the Goal 007 baseline, including superseded file versions. No tracked `.env`, private `.validation` directory, raw media file, or durable allowance/ledger JSONL was found.
- All 29 existing Actions runs: each run's complete log archive was downloaded privately and scanned. All were available. The current workflow and its historical blobs were reviewed; CI disables Live, uses no provider credentials, and does not upload recordings. Later Goal 007 run deltas require review before a visibility change.
- GitHub's paginated inventories returned zero Actions artifacts, issues, issue comments, commit comments, pull requests and releases/attachments. Wiki and Discussions were disabled. These observations are time-specific inventories, not assumptions based on an empty landing page.
- All 169 historical PNG blobs were visually reviewed on contact sheets. All four PDF versions were text-extracted and their 24 pages rendered and inspected. All four PPTX versions had their XML and relationships scanned. These are game screens, original project art, project pitch material and the upstream logo; no personal photo, billing screenshot, raw audio or raw video is tracked.

Private scan inputs, complete logs, object/ref lists, findings with context, and visual sheets are retained under ignored `.validation/goal-007/security/`. They must not be committed or attached to a public release. The original evidence, branches and ledgers were not rewritten, removed or revoked.

## Findings and disposition

| Finding | Disposition |
| --- | --- |
| Historical owner-specific AssemblyAI plan and displayed credit figures | **Private disclosure decision required.** Present in current files and immutable history listed below. No figures are reproduced in this report. |
| Credential-pattern matches in source/tests | Reviewed as explicit synthetic test fixtures, environment placeholders, a deliberately malformed example URL, or commit hashes. No real provider/API/access credential was identified in the inspected history. |
| Credential-pattern matches in Actions logs | Reviewed as npm cache keys containing lockfile hashes. No actual credential, signed raw-download URL or token was identified. |
| Author/co-author email metadata | Preserved project authorship: GitHub no-reply identifiers and upstream corporate author/co-author addresses. These are not newly disclosed private contact records. |
| Historical conversations and diagnostic summaries | Synthetic/typed game QA dialogue and bounded project evidence, with retained provenance and failure labels. No personal conversation or physical human recording was identified. These remain historical evidence, not current-release acceptance. |
| Absolute local source paths in provenance | Existing project-workspace references; no file content or private download authorization is exposed by those paths. Do not add new private account or credential details. |

The private account information occurs in these five paths and their historical versions:

- `AGENTS.md`
- `docs/goal-004e-confirmed-actions.md`
- `docs/goal-005-gallery-live-completion.md`
- `artifacts/goal-004e/recheck-live/authorization.json`
- `artifacts/goal-005/activation-review.json`

Generic service pricing, the owner's expressly authorized task budgets, and conservative usage estimates are distinct from those account-specific balance facts. Removing a current line would leave historic copies exposed. The authorized response is to keep the repository private and request one explicit disclosure/remediation decision; do not rewrite history, revoke credentials, delete records or create a replacement repository automatically.

## Attribution and license review

The upstream source and current [AssemblyAI starter repository](https://github.com/AssemblyAI/voice-agent-starter-js) contain no LICENSE file. Preserve its authorship/history and the existing [source attribution](sources.md). This review does not invent a blanket license, label the upstream code MIT, or represent public visibility as a license grant.

React 19.2.8, react-dom 19.2.8 and scheduler 0.27.0 include MIT notices in their installed distributions. Their exact full notice texts are now copied into [`game/client/public/third-party-notices.txt`](../game/client/public/third-party-notices.txt), with package/version attribution and a separate accurate upstream note. A byte/content comparison against all three installed LICENSE files passed. The shipped app should expose `/third-party-notices.txt` and link it from its About/Credits disclosure. Other build/runtime dependencies retain their own notices in installed distributions; versions are pinned by the lockfile.

Project artwork and procedural sounds are locally authored, as recorded in [assets and attribution](assets.md). System font choices do not redistribute font files. Inspected pitch packages contain no embedded third-party font files or external licensed media requiring an invented attribution.

## Visibility gate remains open

GitHub documents that making a repository public exposes its [code, history and Actions logs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility). The owner approved that general consequence, subject to a clean private-data review. The account-data finding above has not been silently waived.

Before Public: resolve that finding explicitly, inspect new Goal 007 branches/commits/workflows/logs/artifacts and final curated release files, re-fetch remote refs, and record the exact audited main SHA. A regex result or this baseline report is not a permanent security guarantee. Final public access must then be verified in a logged-out context; no visibility change or public-access verification has been performed by this audit.
