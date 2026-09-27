# Goal 004D release status

Current branch: `work/goal-004d-runtime-intent-fix`, continued from delivered Goal 004C head `6521bc0a761e35c36d5deb56538eb77f1f8ebae7`. The shipped runtime-policy repair is frozen at **`5014a6452468897e7d30e08d95bbb6f9a36a8047`**, with changed prompt/config bytes and successful full offline verification. See the [004D validation report](goal-004d-runtime-intent-fix.md) and [candidate manifest](../artifacts/goal-004d/candidate.json). The final delivery message and private `.validation/goal-004d-final-ci.json` identify the final pushed evidence commit and exact-head CI result.

Runtime status: **RUNTIME_POLICY_CHANGED / LIVE_PENDING_AUTHORIZATION**. Release verdict: **RELEASE_NOT_LIVE_VERIFIED**. No separate Goal 004D spending grant accompanied this task. Offline configuration and conversation tests cannot prove real-model compliance. The two Goal 004C Text attempts remain consumed and failed; the unused Voice slot remains blocked by its failed-Text sequencing condition. It cannot fund a 004D retry, and no replacement allowance is authorized.

| Release item | Current evidence and remaining boundary |
| --- | --- |
| Production service | Deployment code is prepared: `build:game` builds the client/server and `start:game` serves one origin. The changed 004D candidate passed typecheck, production build, 308 unit tests, 94 compiled-production browser cases and compiled Practice through confirmed home; [receipt](../artifacts/goal-004d/release-validation.json). This does not establish a hosted service. |
| Public HTTPS and demo URL | **NOT DEPLOYED; URL NOT PROVIDED.** [Deployment instructions](../OWNER_ACTIONS.md) and [the deployment manifest](../render.game.yaml) are preparation only. The manifest selects the 004D feature branch with automatic deploy disabled; any future deployment still requires the exact approved commit and hosting/access permission. |
| Repository and judge access | **NOT ENABLED OR CHANGED BY THIS TASK.** Public visibility, hosting access, a demo access code and a separate finite public Live allowance remain owner decisions. |
| Screenshots and artwork | Existing [submission assets](../submission/assets/README.md) are preserved. Successful Practice captures demonstrate deterministic gameplay; illustrations and Practice are not real Live evidence. |
| Test footage and submission video | Private Goal 004C failed-Text footage includes a derived 47.11-second MP4 with actual captured Pip audio; see its [media receipt](../artifacts/goal-004c/final-acceptance/media.json). It is local test footage, not a successful playthrough or submission video. **SUBMISSION VIDEO/LINK NOT PROVIDED.** |
| Presentation | [Six-slide outline](../submission/pitch-outline.md) exists. **FINISHED DECK/LINK NOT PROVIDED.** |
| Event submission | [Descriptions and checklist](../submission/release-checklist.md) are prepared. **NOT SUBMITTED.** Actual links, access, current form requirements and a submission confirmation remain outstanding. |

The [Goal 004C report](goal-004c-live-recovery.md) and its failed verdicts remain historical evidence. Ending ACKs confirm protocol termination, not successful gameplay or correct interpretation of permission. Real microphone/speaker checks, a human playtest and enjoyment are separate from digital QA.

The remaining external release work is deployment/access, a real HTTPS demo URL, an honestly labelled video and finished deck, then event submission. Goal 004D authorizes none of those external actions.
