# Retained attempt 13: timing audit

This is a read-only analysis of the actual failed sample on runtime/player `2edf7914a008143843923b04a9bf3a1fe41f1f68`. It is not a constructed reproduction or a new provider call. The [machine-readable timeline](timing-attempt-13.json) contains all 23 input turns, source hashes, correlations and unknown measurements. [Extraction source](extract-timing.mjs).

All numbers below are milliseconds on the **browser instrumentation clock**, unless labelled otherwise. The acquisition deadline uses a separate Node monotonic clock; its raw value must not be subtracted from these browser values.

| Stage | Turn 21: inspect southeast | Turn 22: ask whether passage is clear | Turn 23: inspect again |
| --- | ---: | ---: | ---: |
| Local source waveform ended | 446098.5 | 491315.1 | 536059.8 |
| Captured input drained | 446113.3 | 491320.9 | 536066.7 |
| Final ASR received | 459078.5 | 504109.5 | 549232.8 |
| Tool call received | 462030.7 | 505186.6 | 550198.1 |
| Tool | `inspect_object` | `observe_room` | `inspect_object` |
| Server validation / HTTP result received | Unknown | Unknown | Unknown |
| Tool-bearing reply completed | 462294.9 | 505315.1 | 550392.9 |
| Correlated tool result sent | 462457.8 | 505366.8 | 550400.4 |
| Recorded outcome | `precondition_failed` | Successful survey | Successful inspection |
| Next reply started | 475520.8 | 518272.6 | 563185.0, after End |
| Final robot transcript | 482330.7 | 525732.7 | 569067.0, after End |
| Reply completed | 482584.9 | 526050.4 | 569413.1, after End |
| Playback drained | 482721.3 | 526778.0 | Not played; End had stopped playback |
| Waveform end to final ASR | 12980.0 | 12794.4 | 13173.0 |
| Sent result to next reply | 13063.0 | 12905.8 | 12784.6 |

The final subgoal began at **443630.487752 ms**, had a deadline of **563630.487752 ms**, and stopped at **563631.833606 ms**, all on the **Node acquisition clock**: 120001.3459 ms elapsed. Its historical result remains failed. Browser `session.end` was sent at **560442.9 ms**; the late normal reply began 2742.1 ms later. Local socket closure occurred at **570697.0 ms**, code 1005, 10254.1 ms after End. No `session.ended` was received. No late answer was consumed for navigation.

The last three decoded fixtures lasted 4.8695, 4.6445 and 5.4695 seconds. Scheduled source-start to `onended` intervals were 4.8554, 4.6324 and 5.4573 seconds: differences of -14.1, -12.1 and -12.2 ms. The scheduled start is an estimate and the end is a main-thread callback; these differences do not measure network delay or event-loop lag. Fixture padding also separates source end from the last meaningful speech sample.

There were 21 recorded tool calls and 21 correlated sent results, with at most one unmatched tool call at a time. At End, the final inspection result had already been sent and its normal continuation was still outstanding. The final 202.3 ms call-to-result interval includes waiting for `reply.done`; it is **not a measured server round trip**. All three sent results followed the recorded reply-completion boundary. Pairing the continuation with the preceding result is temporal; no direct continuation identifier was supplied on the tool result.

Playback instrumentation admitted 19,882 chunks / 4,771,680 samples across the call. Those are cumulative admissions, not instantaneous queue depth. Captured input contained 13,356,288 samples (556.512 seconds at 24 kHz); the aligned output WAV spans the 570.7212-second instrumentation timeline with silence. These measures have different boundaries and cannot establish audio-clock drift. Browser/Node event-loop lag, outgoing WebSocket buffering, server HTTP timestamps and provider queue depth were not recorded. They remain unknown.

After End, a provider audio onset and the late ordinary reply were still observed, but there were zero new queued-playback events, rendered-audio onsets or tool calls. Input/playback shutdown and local cleanup did not manufacture a remote ACK. The 567.4462-second local socket duration remains distinct from an unknown provider duration.

The repeated first-inspection rejections and approximately 13-second late intervals are established observations. Rejected arguments were omitted; wrong-handle selection is a hypothesis. The record does not attribute delay to the browser, network, server, model or provider. The four initial inspection failures must not be rewritten as a specific historical target-resolution cause.
