# Goal 007 protected release admission

The owner's Goal 007 approval permits one new allocation, distinct from every exhausted historical campaign. Implementing this mechanism does not initialize it. All charged Goal 007 QA and reviewer requests use the one hosted authoritative file, `/var/data/talk-me-home-goal-007-release.jsonl`. Do not run the historical `qa:live` paid path or create a matching local allowance.

The fixed grant has eight QA attempts and eight separately reserved reviewer attempts. Each attempt reserves 970 seconds before the provider request and caps the resulting session at 900 seconds. At the rechecked inclusive Voice Agent rate of USD 4.50/hour, the whole grant reserves USD 19.40, within the USD 20 approval. Failed token requests and reconnects consume attempts. No command resets, refunds, replenishes, or transfers capacity. Old 600-second defaults and historical v1 ledgers remain unchanged.

Pricing was read from the official [pricing page](https://www.assemblyai.com/pricing) and [Voice Agent API page](https://www.assemblyai.com/products/voice-agent-api): the rendered pages state per-second connected-session billing and inclusive ASR, model, and voice. Recheck before actual allocation/spending. This does not establish an account balance or Auto-pay state.

## Hosted configuration

| Variable | Value or purpose |
|---|---|
| `GAME_RELEASE_PROFILE` | `goal-007`; explicitly selects this protected 900-second configuration |
| `GAME_RELEASE_ALLOCATION_FILE` | `/var/data/talk-me-home-goal-007-release.jsonl` exactly |
| `GAME_LIVE_CONCURRENT_LIMIT` | `1` |
| `GAME_ORIGIN` | Actual exact HTTPS origin |
| `RENDER_SERVICE_ID` | Actual Render-provided service identity; ledger binding must match |
| `GAME_DISABLE_LIVE` | `1` for provider-disabled deployment; `0` only for approved QA/review |
| `GAME_HOSTED_QA_ENABLED` | `1` only while approved QA is open; `0` afterwards |
| `GAME_PUBLIC_LIVE_ENABLED` | `0` until the current hosted acceptance pair is recorded; `1` only for protected review |
| `GAME_QA_ACCESS_CODE` | Private, random QA Voice code, at least 32 characters |
| `GAME_QA_TEXT_ACCESS_CODE` | Optional distinct private Text diagnostic code; at most two QA reservations |
| `GAME_DEMO_ACCESS_CODE` | Separate private reviewer code, at least 32 characters |
| `ASSEMBLYAI_API_KEY` | Existing provider credential, hosting secret only |

Do not set `GAME_LIVE_ALLOWANCE_FILE` alongside the protected profile. The profile must not be used on a local origin. Startup never initializes a grant. A missing, malformed, exhausted, or halted grant denies Live while Practice still starts. One service process and instance remain required. Browser authorizations expire on a server restart; their consumed reservations do not.

All purposes use the ordinary `/api/access` code UI. The submitted secret code determines purpose and diagnostic mode; extra request fields cannot choose another pool. Signed, owner-bound cookies cannot be transplanted or edited. Reviewer capacity also requires an acceptance record for the actual runtime. Re-exchanging a code does not reset the durable limit of two reviewer launches for that browser owner. A new cookie can start another visit but cannot evade the global eight reviewer attempts. Access exchange is rate-limited before issuance.

## Operator commands

Use the authenticated shell of the one intended hosted service, after inspecting its disk and any existing grant. These commands expose no administrative HTTP route. They are never build, startup, or pre-deploy hooks. Existing payment/provider approval is not inferred from a file or environment flag.

```sh
node scripts/manage-release-allocation.mjs inspect
node scripts/manage-release-allocation.mjs initialize <actual-current-pricing-review-ISO-timestamp>
node scripts/manage-release-allocation.mjs inspect
```

Initialization uses exclusive creation and is idempotent only for the same valid service-bound grant. Existing reservations and a permanent halt remain intact. Malformed or mismatched data and a writer lock fail closed. An interrupted writer lock needs diagnosis; do not delete it or edit the ledger automatically. The API durably halts the entire grant upon actual insufficient credit, credential refusal, or explicit account/workspace mismatch. A non-account provider failure still consumes the attempt but permits later authorized QA after its lease expires.

For browser-direct WebSocket errors, the shipped client reports only an explicit credit refusal or account/workspace mismatch to its owned session's `live-refusal` route. A server-issued, still-reserved connection is required; the request can only stop the allocation, never grant, inspect, refund or extend it. Repeated reports are idempotent. The ledger labels this `client_report`, distinct from a server-observed `token_response` or an `operator` stop. An expired temporary token alone is not classified as an account mismatch. The same browser visit refuses further Live starts, including after reload, using a nonsecret session-storage stop flag; Practice remains available. This flag is not a second grant or accounting ledger. If the stop cannot reach the server, the UI says not to reconnect and to contact the owner; the operator must inspect and record the stop before more use. Raw provider messages are never sent in the report.

Each `/voice-token` response includes a safe `allocation` receipt with grant ID, purpose, mode, global/pool attempt ordinal, reserved seconds, lease expiry and runtime fingerprint. The `x-tmh-allocation-attempt` header also identifies a reservation when the provider request fails. No secret or browser hash is returned. Read-only `/api/access` checks consume no token or reservation.

Concurrency uses the full conservative 970-second lease. End, a browser statement, mission completion, or local cleanup cannot release it early. Lease expiry permits a later connection under the provider cap; it never counts as a remote ending ACK. Root QA must separately preserve the actual End/ACK and cleanup evidence.

## Recording the acceptance pair

After reviewing two preserved hosted Voice reports on the same behavior, the operator supplies a private JSON file with `ordinary` and `recorderRecovery` objects. Each object contains: `attempt`, `runtimeSha256`, `reportSha256`, `mode: "voice"`, `completion: true`, `chapters: ["cargo", "gallery", "dock", "home"]`, `endingAck: true`, `cleanup: true`, `nonzeroPlayback: true`, `exactConfirmations: true`, and `accessCodeRoute: true`. The ordinary object has `recorderCollected: false` and `recoveryExercised: false`; the second has both `true`. Hash the preserved original reports. Do not substitute inferred success or a synthetic fixture.

```sh
node scripts/manage-release-allocation.mjs accept-pair <protected-reviewed-pair-json-file>
node scripts/manage-release-allocation.mjs inspect
```

This command validates two distinct consumed QA Voice reservations and the current compiled runtime, after both leases expire. It records the operator's evidence attestation; it does not independently prove speech or remote ACK from a boolean. The root release audit must inspect the underlying actual reports and media. After acceptance, further QA requests for that runtime are denied. Reviewer requests additionally need their separate code and actual Live environment enablement. Turning on one flag alone cannot bypass this gate.

The runtime fingerprint includes every compiled client/server file, shipped asset, and the protected duration/budget profile. It excludes `dist/release.json`, source commit labels, documentation and submission media. Documentation-only deploys can retain acceptance when compiled bytes match. Any changed runtime requires a new qualifying pair within remaining QA capacity; it does not create more capacity.

Render supplies its service identity and deployed commit through documented [default environment variables](https://render.com/docs/environment-variables). The canonical root manifest selects this protected profile from its first deployment, while all Live/QA flags remain off. It creates no allocation. Do not carry the historical legacy allowance variable into that service. After explicit operator initialization, restart/redeploy the same service before opening QA if a previous missing-file status was cached as unavailable; this does not initialize or reset capacity.
