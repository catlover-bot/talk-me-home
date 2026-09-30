# Goal 007 hosted QA harness

This is an offline-validated driver for one explicitly selected hosted attempt. It does not establish a Goal 007 real Voice pass, create a grant, enable reviewers, deploy, or spend when invoked without `--live`. Historical grants and the old local Live browser driver remain unchanged.

## Execution inputs

Use Node 24 on the Linux/WSL runner with installed Playwright Chromium. The ordinary command is an offline dry run:

```sh
node scripts/qa-hosted-live.mjs
```

Prepare the finite synthetic speech catalog separately, before freezing. `--reuse-fixtures` copies existing files without overwriting them; its source remains read-only. Missing files are synthesized with the installed local Windows English SAPI voice, without a provider. The current catalog contains 352 possible utterances, including every exact action-label recovery pair and recorder discovery requests.

```sh
node scripts/qa-hosted-live.mjs --prepare-speech \
  --fixture-dir .validation/goal-007/speech \
  --reuse-fixtures /absolute/path/to/existing/speech-cache
```

The resulting `manifest-<sha256>.json` identifies the fixture directory and hashes every WAV and metadata file. Actual execution never generates or repairs speech. Preserve the manifest and source files together.

Supply a protected regular local JSON file owned by the runner, with mode `0600`. It contains `origin`, `qaVoiceAccessCode`, and optionally a separate `qaTextAccessCode`. Each code must have 32–256 characters. `origin` is the exact real HTTPS origin, with no path, query, credentials, or trailing slash. Never put code values in command arguments, URLs, reports, Git, or chat. Malformed credential JSON produces a generic error without its input. The driver checks that the normal access field is a password field before filling it, and masks it in still screenshots.

After rechecking the official configured price, prepare a private pricing receipt with `checkedAt` (ISO timestamp), `source` exactly `https://www.assemblyai.com/pricing/`, and `usdPerHour`. Evidence must be no older than 24 hours. The driver rejects a rate above the frozen grant's USD 4.50/hour, even if it would remain below the owner's USD 20 ceiling. This is price evidence, not an automated balance or Auto-pay check.

One invocation requests at most one token and constructs at most one provider socket:

```sh
node scripts/qa-hosted-live.mjs --live \
  --origin "$TMH_HOSTED_ORIGIN" \
  --credential-file .validation/goal-007/hosted-credentials.json \
  --expected-commit "$TMH_EXPECTED_MAIN_COMMIT" \
  --expected-runtime-sha256 "$TMH_EXPECTED_RUNTIME_SHA256" \
  --expected-config-sha256 "$TMH_EXPECTED_SESSION_UPDATE_SHA256" \
  --speech-manifest "$TMH_FROZEN_SPEECH_MANIFEST" \
  --pricing-file .validation/goal-007/verified-pricing.json \
  --scenario ordinary --run-id goal007-ordinary-unique
```

Use `--scenario recorder-recovery` for the second required scenario. A diagnostic Text attempt additionally requires `--mode text --diagnostic-reason <reason>` and the separate QA Text code. No Text prerequisite or automatic sequence is built into this driver. `CI` or `GAME_DISABLE_LIVE=1` refuses explicit Live execution before credentials or network access. Never remove an exhausted-grant restriction merely to make this command run.

The expected source is the tested main commit. The runtime hash is the protected server's compiled runtime/release-profile fingerprint. The configuration hash is SHA-256 of the exact serialized `session.update` envelope, including its session configuration; it is checked against what the browser actually sends. The report separately freezes shared player/instrumentation bytes, speech files, Node version, browser version and browser executable hash. A later final deployment must provide matching identities; this branch's offline result is not a hosted release receipt.

## Authority and bounded execution

The driver uses the normal mode selection, access-code UI, local microphone/test-tone readiness and Connect control. It validates the authenticated `/api/access` QA capability and server fingerprint before Connect. The shipped UI supplies the selected transport mode to `/voice-token`; the driver does not rewrite that payload or choose the pool. The successful response must contain the fixed Goal 007 QA allocation receipt, a 970-second reservation, a 900-second session cap and the expected runtime hash. A reserved token failure retains the server's attempt header. Missing reservation evidence stays unknown, never zero or refunded.

All charged accounting belongs to the hosted service. There is no local quota, allowance, reservation initializer, grant reset or import from the Goal 005 supervisor. Run directories are created exclusively under `.validation/goal-007/hosted/<run-id>`; an existing directory causes refusal, never replacement.

The independent parent verifies the spawned browser PID and Linux process start time, acknowledges ownership, and acknowledges an armed watchdog before the token route continues. It requests End at 890 seconds after the token request, forcibly closes the owned browser at 900 seconds, and bounds worker cleanup at 945 seconds. An overall preflight/run bound also applies. A lost supervisor triggers local End and emergency cleanup. Only owned processes/descendants with matching start identities are eligible for termination. A worker PASS becomes FAIL if its exit or independently observed local cleanup fails. Local cleanup does not establish remote termination.

Both players use rendered documents and eligible spoken reports. The optional objective selects its archive destination from the visible authored clue and atlas, navigates using reported local obstructions, discovers the recorder through spoken local observation, and clicks the exact `Secure the flight recorder` proposal. It also deliberately declines the Latch once with `Not yet`, then requires a fresh exact proposal. The initial request plus three purposeful recoveries and 120-second acquisition bound remain unchanged. Voice never types a player message, switches to Practice, receives hidden navigation, or calls robot tools directly.

The independent evaluator passively observes ordinary owner session, decision and mission-record HTTP responses. It retains safe human projections, not robot-local tool-result payloads. Every committed proposal must match one exact UI receipt; declined proposals must remain uncommitted; all three chapters and authoritative home must be present. Recorder recovery requires the server home consequence. The separate coarse behavior evaluator checks captions and sanitized tool metadata; material defects stop execution. Neither evaluator supplies navigation decisions.

## Evidence and limits

Each private run directory retains the actual conversation, intended synthetic inputs, WAV captures for input/rendered/post-volume audio, the original silent browser video, screenshots, ordinary HTTP evidence, synchronized lifecycle journals, allocation receipt, report, and supervisor outcome. Video and audio retain their original clocks for later alignment. `public-summary.json` is a separate allowlisted projection; raw dialogue, codes, token/config payloads, refusal prose and diagnostics do not enter it. Publication is a separate decision.

The report distinguishes reserved estimate, observed connected time, provider duration, explicit `session.end`, observed `session.ended`, and local cleanup. Both Voice and Text require nonzero digital provider/playback evidence. Voice additionally requires actual final ASR, nonzero microphone-path input, and no typed user input. Explicit credit/account refusal categories survive in the synced lifecycle journal. A normal acknowledged `/live-refusal` response records a durable client-report halt, not independent proof about the provider account. An authenticated summary may separately report a halted grant. Generic expired-token errors do not become account-mismatch claims.

Observed measurements include ASR-final delay, call-to-result and result-to-continuation intervals, first useful caption, failed first inspection, permission questions, recovery exchanges, time to home and End-to-ACK. The semantic counts are explicitly bounded caption/acquisition heuristics requiring transcript review. Timing does not identify network/model/provider causality. Synthetic audio and digital playback do not establish human speech, physical speaker output, enjoyment or a population success rate.

## Offline validation

The isolated harness branch passed 92 targeted unit/policy/audio/lifecycle/preflight tests, TypeScript checking, production build and `git diff --check`. Eighteen browser scenarios passed, covering existing shared-player regressions and two new constructed Voice peer runs. A final rerun of the new ordinary and recorder-recovery scenarios also passed with visible offline evidence labels.

Both new scenarios reached Cargo, Gallery, Dock and confirmed home, matched ordinary HTTP decision receipts, sent one fake token/socket, used nonzero microphone-path and digital playback samples, and sent no typed Voice fallback. The recovery scenario used Gallery layout B, visited the document's archive, backtracked after a communicated obstruction, declined and recovered an exact proposal, and brought the recorder home. The final home screenshots were inspected.

The offline peer emits constructed ASR text for a local tone fixture and drives the normal provider tool protocol from its own local observations. This validates the player, audio path and confirmation audit; it does not test real recognition or AssemblyAI behavior. Earlier offline fixture failures exposed an overly literal mock parser and incorrect fake audio event; those test fixtures were corrected without increasing the 90-second scenario limit. No real token, reservation, provider ending ACK, or hosted attempt was created by this implementation work. Root integration must still run the final combined release suite and establish hosted acceptance under the authoritative grant.

## CI scheduling repair after the first main run

The main run `36655568130` on `076079742ff4728dbbf3d78fe1847a4a3259e024` reached the unchanged 210-second global deadline in Chromium 1280 shard 1 after 46 passes, leaving two cases unrun. The other three jobs passed. Feature run `36655568115` also exhausted that lane and separately failed the sound test's exact count of two ending messages. These failures remain preserved; the earlier local suite pass did not establish adequate runner scheduling margin.

The recorded first-shard work was concentrated: main Chromium 1280 reported 399 seconds of individual case work across two workers, including 66- and 78-second hosted Voice cases beside 33- to 36-second shared-player cases. The other 1280 shard reported 207 seconds. Minute-formatted case times are rounded, and sums are workload evidence rather than wall-clock predictions. CI now places the two hosted Voice cases in a dedicated two-worker lane for each viewport. The ordinary suite retains two shards per viewport. Exact Playwright listing comparison proves six disjoint lanes of 47, 47 and 2 cases per viewport, covering all 192 cases once. No test was removed or skipped; retries remain zero, the hosted cases remain bounded at 90 seconds, and each lane retains the 210-second global limit and four-minute CI step limit.

The sound test had a connection-readiness gap: its local microphone check and zero ambience were already true before the Voice connection completed, and its readiness helper returned immediately after clicking Connect. Clicking End at that point can legitimately cancel startup; zero remaining sockets alone does not establish two connected calls or two ending acknowledgements. The test now awaits the normal enabled message input after both Connect actions, requires the first exact end before resuming, confirms two created connections, and awaits exactly two ending messages before checking closed sockets. This closes the test's observable precondition gap without changing runtime stopping behavior; the archived CI log does not by itself identify the exact event ordering of that failure.

Both sound cases passed in both viewports (4/4) with two workers and Live disabled. Typechecking and the production build passed. The compiled runtime fingerprint remained `9e99902afe98cef18e2e75ee3b55504dcda2e3642848f9da1be03ca36c689e36`; application, player and harness source bytes match runtime source `19d4036`. The safe receipt is [`ci-scheduling-repair.json`](../artifacts/goal-007/ci-scheduling-repair.json). A final pushed-head CI result remains to be collected after integration; this focused offline repair does not claim a new CI pass or real provider use.
