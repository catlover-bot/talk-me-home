# Goal 007 current publication handoff

## Current decision

The owner reports manually deploying existing Render service `srv-dauc8fek1f9s73b93pc0` through the dashboard on the **Free plan, without a persistent disk**, with successful deployment from `caa896d`. The expected full application commit is `caa896d3a90dd4e8cb26499dba586b646bb7030a`. This newer decision supersedes the earlier paid-service/disk proposal for current work. The existing application is the inspection target; no new deployment is required just to verify it.

Do not create another service, upgrade the plan, attach a paid disk, enable Live, initialize a funded allowance, change credentials, or submit the LABLAB form. Public HTTP/browser checks do not require Render CLI authentication. No existing grant is reset or replaced.

## Evidence axes

| Axis | Current evidence |
| --- | --- |
| Dashboard deployment | Successful deployment from `caa896d`, reported by the owner; not independently inspected |
| Actual public HTTPS URL | NOT PROVIDED: the message contains a placeholder; requested once |
| Public HTTP, assets, health and identity | Not yet checked without the actual origin |
| Hosted Practice | Not yet checked; local Practice results remain separate |
| Live availability | Owner-selected disabled-Live setup; read-only public status/UI verification pending |
| Current real Voice | Not verified; intentionally outside this continuation's scope |
| New provider requests, token issuance and funding | None performed by this continuation |
| Source publication | GitHub API currently reports Public; unauthenticated repository HTTPS returned 200; this continuation did not change visibility |
| Event submission | Not performed |

The service ID does not establish its public hostname. GitHub's deployment list and commit statuses supplied no origin during this continuation. The missing public URL is the input required for these checks, not a request for Render credentials or another spending approval. The repository homepage is unset. GitHub now reports Public, and a separate unauthenticated HTTP request to the repository returned 200. This observes an external visibility change; it does not claim that this session changed visibility or resolved the earlier historical-data disclosure decision.

## Bounded public verification

Use the exact provided HTTPS origin and a new private evidence directory. Allow one initial cold-start window of at most 90 seconds, then run one continuous verification session. Stop and report a persistent HTTP/startup error; do not create scheduled keep-alive traffic or repeatedly wake the service.

Verify `/api/health`, the safe `/api/version` identity, the page, required assets and SPA reload. Use fresh browser contexts for deterministic Practice rescues through Cargo Bay, Relay Gallery, Return Dock and server-confirmed home. Check exact confirmations, a declined action followed by a fresh proposal, Power/Relay/Dock controls, route marks/Undo/clear, Pause/resume and an actual replay round. Require read-only access status and UI to report Live unavailable. Block and count attempted provider/token requests and WebSockets; do not probe issuance or use an access code. Retain actual screenshots and the result receipt, and close owned browser resources.

Render documents that Free web services can sleep after inactivity and lose local filesystem changes on restart/redeploy/spin-down. The game's missions are also in-memory. Do not describe this deployment as always-on or durably saved. These constraints are documented at [Render's Free service reference](https://render.com/docs/free); do not install a wakeup job to avoid them.

After the real URL arrives, replace pending rows only with observed results and link the evidence. Keep the deployed application commit separate from any later documentation or inspection-script commit. A documentation update does not require a deployment just to inspect this owner-published revision.

## Inspection harness readiness (local only)

The `--disabled-live-only` inspection mode passed one local compiled-production smoke against the unchanged `caa896d` application. It completed recorder-collected and selected-skipped rescues, exact confirmations, route marks/Undo/erase/undo-erase, retained route marks across Pause/resume, and two actual new replay rounds. Read-only access status and visible UI confirmed Live unavailable. Provider HTTP, browser token endpoints, negative token probes and WebSocket counts were all zero; owned browser/server cleanup completed. This verifies the inspection procedure, not the public service. [Safe local receipt](../artifacts/goal-007/free-inspection-harness-offline.json). All 15 existing component-manifest files remain unchanged.

After the actual origin is supplied and the single bounded cold-start check succeeds:

```sh
node scripts/qa-hosted-practice.mjs --run --disabled-live-only \
  --origin "$TMH_PUBLIC_ORIGIN" \
  --expected-commit caa896d3a90dd4e8cb26499dba586b646bb7030a \
  --output .validation/goal-007/hosted-free-practice-UNIQUE
```

Do not run the historical paid harness or the default token-denial probes for this inspection. The script and documentation are local inspection changes; application/runtime source is unchanged. Do not push these changes in a way that triggers an unneeded Render deployment while the service's automatic-deploy setting is unknown.
