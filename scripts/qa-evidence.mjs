// Local, read-only campaign inspection plus explicit compact evidence exports. No provider access.
import { readFile, readdir, mkdir, writeFile, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectCampaign } from './qa-budget.mjs'

const LABEL = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI'
const round = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : null
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const exists = path => access(path).then(() => true, () => false)
const iso = value => Number.isSafeInteger(value) ? new Date(value).toISOString() : null
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const text = value => {
  if (typeof value !== 'string') return null
  if (/\b(?:Bearer\s+\S+|ASSEMBLYAI_API_KEY|GAME_DEMO_ACCESS_CODE|(?:token|resume_token|authorization|cookie)\s*[:=]\s*\S+)/i.test(value)) throw new Error('Credential-like text was excluded from the compact export; inspect the local source privately.')
  return value.replace(/(?:https?|wss?):\/\/\S+/g, '[URL omitted]').slice(0, 12_000)
}

export function summarizeAttempt(report, evidence) {
  if (report.label !== LABEL || evidence.label !== LABEL || !Array.isArray(evidence.events)) throw new Error('Only explicitly labelled real-provider synthetic QA evidence is accepted.')
  const events = evidence.events
  const endSent = events.find(event => event.type === 'session.end')
  const ended = events.find(event => event.type === 'session.ended')
  const socketOpen = events.find(event => event.type === 'socket.open')
  const socketClose = events.find(event => event.type === 'socket.close')
  const finalTranscripts = events.filter(event => ['transcript.user', 'transcript.agent'].includes(event.type) && event.final === true).map(event => ({ atMs: round(event.atMs), source: event.type === 'transcript.user' ? 'Real provider ASR' : 'Real provider agent transcript', text: text(event.text), reference: Number.isSafeInteger(event.reference) ? event.reference : null }))
  const utterances = events.filter(event => event.type === 'synthetic.speech.queued').map((queued, index, all) => {
    const start = events.find(event => event.type === 'synthetic.speech.started' && event.id === queued.id && event.atMs >= queued.atMs)
    const end = events.find(event => event.type === 'synthetic.speech.ended' && event.id === queued.id && event.atMs >= queued.atMs)
    const next = all[index + 1]?.atMs ?? Infinity
    const finals = events.filter(event => event.type === 'transcript.user' && event.final === true && event.atMs >= queued.atMs && event.atMs < next)
    const firstProvider = end && events.find(event => event.type === 'audio.provider.onset' && event.atMs >= end.atMs && event.atMs < next)
    const firstRendered = end && events.find(event => event.type === 'audio.rendered.onset' && event.atMs >= end.atMs && event.atMs < next)
    return {
      fixture: text(queued.id), syntheticText: text(queued.text), startedAtMs: round(start?.atMs), endedAtMs: round(end?.atMs), durationSeconds: round(queued.durationSeconds),
      asrFinals: finals.map(event => ({ text: text(event.text), atMs: round(event.atMs), waveformEndToAsrFinalMs: end ? round(event.atMs - end.atMs) : null })),
      waveformEndToFirstSubsequentProviderOnsetMs: firstProvider ? round(firstProvider.atMs - end.atMs) : null,
      waveformEndToFirstSubsequentRenderedChunkReceiptMs: firstRendered ? round(firstRendered.atMs - end.atMs) : null,
      firstSubsequentRenderedChunkStartAtMs: round(firstRendered?.audioAtMs),
    }
  })
  const tools = events.filter(event => event.type === 'tool.call').map(call => {
    const result = events.find(event => event.type === 'tool.result' && event.callRef === call.callRef && event.atMs >= call.atMs)
    return { name: ['observe_room', 'inspect_object', 'interact_object', 'move_to'].includes(call.name) ? call.name : 'other', callAtMs: round(call.atMs), resultAtMs: round(result?.atMs), callToResultMs: result ? round(result.atMs - call.atMs) : null, succeeded: result ? result.isError === false : null }
  })
  const audio = Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(kind => {
    const counter = evidence.counters?.[kind] ?? {}
    return [kind, { chunks: count(counter.chunks), samples: count(counter.samples), nonzeroSamples: count(counter.nonzeroSamples), energy: round(counter.energy), lastNonzeroMarkerAtMs: round(counter.lastNonzeroMs) }]
  }))
  const visible = (report.visibleHistory ?? []).map(item => ({ source: 'Visible application history', speaker: item.speaker === 'Pip' ? 'Pip' : 'Mission Control', text: text(item.text) }))
  return {
    label: LABEL, scenario: text(report.scenario), commit: /^[0-9a-f]{40}$/.test(report.identity?.commit) ? report.identity.commit : null,
    runtimeSha256: /^[0-9a-f]{64}$/.test(report.identity?.runtimeSha256) ? report.identity.runtimeSha256 : null,
    inputMode: text(report.inputMode), completion: report.completion === true, route: (report.route ?? []).map(text), failure: text(report.failure), tokenRequests: count(report.tokenRequests),
    ending: { explicitEndSent: Boolean(endSent), endAcknowledged: Boolean(ended), endSentAtMs: round(endSent?.atMs), endAcknowledgedAtMs: round(ended?.atMs), endAcknowledgementDelayMs: ended && endSent ? round(ended.atMs - endSent.atMs) : null, socketCloseCode: socketClose?.code ?? null, socketCloseWasClean: socketClose?.clean ?? null, localConnectedSeconds: socketOpen && (ended || socketClose) ? round(((ended ?? socketClose).atMs - socketOpen.atMs) / 1000) : null, providerSessionSeconds: Number.isFinite(report.providerDurationSeconds) ? report.providerDurationSeconds : null },
    audio, utterances, tools, finalTranscripts, visibleHistory: visible,
    cleanup: { activeTracks: count(report.cleanup?.activeTracks), activeSources: count(report.cleanup?.activeSources), openApplicationContexts: count(report.cleanup?.openApplicationContexts) },
    timingNotes: [
      'Measurements describe this small synthetic sample, not a production SLA or human latency study.',
      'Waveform end includes fixture padding; ASR may finalize before that end or split one fixture into several turns. Negative delays are retained.',
      'Provider onset means the first recorded nonzero-audio onset after a quiet gap. It is not necessarily the first reply.audio frame.',
      'Rendered onset receipt is the main-thread receipt of a nonzero playback chunk. Chunk start is approximate to the 100 ms observer chunk; it is not the exact first nonzero sample.',
      'Tool call-to-result includes waiting for reply.done before returning the result. It is not a pure server HTTP round-trip measurement.',
      'Chapter route is the player-observed report. Chapter-change timing is unavailable unless a separate checkpoint was recorded.',
      'A clean WebSocket close without session.ended does not confirm remote termination.',
    ],
    boundary: 'Synthetic source and digital rendered capture only. No physical microphone, loudspeaker routing, room acoustics, human listening, or enjoyment was measured.',
  }
}

function run(command, args, timeout = 30_000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let output = ''; let settled = false
    child.stdout.on('data', chunk => { if (output.length < 100_000) output += chunk })
    child.stderr.resume()
    const timer = setTimeout(() => { child.kill('SIGTERM'); if (!settled) { settled = true; reject(new Error('Local media inspection exceeded its finite deadline.')) } }, timeout)
    child.once('error', () => { clearTimeout(timer); if (!settled) { settled = true; reject(new Error('The requested local media tool is unavailable.')) } })
    child.once('close', code => { clearTimeout(timer); if (settled) return; settled = true; code === 0 ? resolveRun(output) : reject(new Error('Local media processing failed.')) })
  })
}

export async function probeMedia(path) {
  const result = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,sample_rate,channels,width,height:format=duration', '-of', 'json', path]))
  return { file: basename(path), durationSeconds: Number.isFinite(Number(result.format?.duration)) ? Number(result.format.duration) : null, streams: (result.streams ?? []).map(stream => ({ type: stream.codec_type, codec: stream.codec_name, ...(stream.codec_type === 'audio' ? { sampleRate: Number(stream.sample_rate), channels: stream.channels } : {}), ...(stream.codec_type === 'video' ? { width: stream.width, height: stream.height } : {}) })) }
}

async function prepareLocalMedia(directory, { mux, videoOffsetMs }) {
  const names = (await readdir(directory)).filter(name => /\.(wav|webm|mp4)$/i.test(name) && !name.startsWith('qa-combined'))
  const probes = []
  for (const name of names) {
    try { probes.push(await probeMedia(join(directory, name))) }
    catch { probes.push({ file: name, inspection: 'Unavailable or invalid; no stream claim is made.' }) }
  }
  const video = probes.find(probe => probe.streams?.some(stream => stream.type === 'video'))
  const result = { files: probes, videoStatus: video ? video.streams.some(stream => stream.type === 'audio') ? 'Video contains an audio stream; its content still requires verification.' : 'Source video is silent; separate captured digital WAV files retain the test audio.' : 'No source video file exists for this attempt.', mux: 'Not requested.' }
  if (!mux) return result
  const input = join(directory, 'input-digital.wav')
  const rendered = join(directory, 'rendered-digital.wav')
  if (!await exists(input) || !await exists(rendered)) return { ...result, mux: 'Missing captured source WAV; no substitute audio was produced.' }
  const combined = join(directory, 'qa-combined-digital.wav')
  if (!await exists(combined)) await run('ffmpeg', ['-nostdin', '-n', '-v', 'error', '-i', input, '-i', rendered, '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:weights=0.5 0.5:normalize=0[a]', '-map', '[a]', '-c:a', 'pcm_s16le', combined], 60_000)
  result.combinedDigitalAudio = await probeMedia(combined)
  result.mux = 'Original synthetic input and actual rendered output combined on their shared recorded QA timeline, at half gain each. No generated or replaced Pip answer.'
  if (!video) return result
  if (!Number.isFinite(videoOffsetMs)) return { ...result, mux: `${result.mux} Video alignment was not measured; video remains silent rather than inventing synchronization.` }
  if (videoOffsetMs < 0 || videoOffsetMs > 30_000) throw new Error('Video alignment must be a measured 0–30000 ms offset from video start to the QA audio origin.')
  const muxed = join(directory, 'qa-combined-video.mp4')
  if (!await exists(muxed)) await run('ffmpeg', ['-nostdin', '-n', '-v', 'error', '-i', join(directory, video.file), '-itsoffset', String(videoOffsetMs / 1000), '-i', combined, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', muxed], 60_000)
  result.muxedVideo = await probeMedia(muxed)
  result.videoOffsetMs = videoOffsetMs
  return result
}

function conversationMarkdown(attempt) {
  const lines = [`# ${LABEL}`, '', `Scenario: ${attempt.scenario}. Runtime SHA-256: \`${attempt.runtimeSha256}\`.`, '', 'Provider final transcripts are preserved separately from the application’s visible history. An interrupted provider transcript is not relabelled as a visible or fully played reply.', '', '## Real provider final transcripts', '']
  for (const row of attempt.finalTranscripts) lines.push(`- ${row.atMs} ms — **${row.source}**: ${row.text}`, '')
  lines.push('## Visible application history', '')
  for (const row of attempt.visibleHistory) lines.push(`- **${row.speaker}**: ${row.text}`, '')
  lines.push(`Outcome: ${attempt.failure ? `Failed: ${attempt.failure}` : attempt.completion ? 'Mission completed.' : 'See the scoped metrics; this was not a full mission.'}`, '', `Explicit session.end: ${attempt.ending.explicitEndSent}. session.ended received: ${attempt.ending.endAcknowledged}.`, '', attempt.boundary, '')
  return lines.join('\n')
}

export async function exportCampaign({ directory = resolve('.validation/goal-004b-live'), output = resolve('artifacts/goal-004b/live'), mux = false, videoOffsetMs } = {}) {
  directory = resolve(directory); output = resolve(output)
  const state = inspectCampaign(directory)
  if (mux) {
    const location = relative(resolve('.validation'), directory)
    if (!location || location === '..' || location.startsWith(`..${sep}`) || resolve('.validation', location) !== directory) throw new Error('Large processed media must remain within the ignored .validation directory.')
  }
  const attempts = []
  await mkdir(output, { recursive: true })
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}T[\d-]+Z-(canary|mission)$/.test(entry.name)) continue
    const path = join(directory, entry.name)
    if (!await exists(join(path, 'report.json')) || !await exists(join(path, 'audio-evidence.json'))) continue
    const reportBytes = await readFile(join(path, 'report.json')); const evidenceBytes = await readFile(join(path, 'audio-evidence.json'))
    const attempt = summarizeAttempt(JSON.parse(reportBytes), JSON.parse(evidenceBytes))
    attempt.evidenceDirectory = entry.name
    attempt.sourceHashes = { report: sha256(reportBytes), audioEvidence: sha256(evidenceBytes) }
    attempt.media = await prepareLocalMedia(path, { mux, videoOffsetMs })
    await writeFile(join(output, `${entry.name}-metrics.json`), `${JSON.stringify(attempt, null, 2)}\n`)
    await writeFile(join(output, `${entry.name}-conversation.md`), conversationMarkdown(attempt))
    attempts.push({ evidenceDirectory: entry.name, runtimeSha256: attempt.runtimeSha256, failure: attempt.failure, completion: attempt.completion, endAcknowledged: attempt.ending.endAcknowledged })
  }
  const last = state.attempts.at(-1)
  const remainingAttempts = state.header.maxAttempts - state.attempts.length
  const nextPermittedAt = remainingAttempts > 0 && last && !(last.result?.endAcknowledged && last.closedAt !== null) ? last.leaseUntil : null
  const summary = {
    label: LABEL, attempts: state.attempts.length, productionAttempts: state.productionAttempts, remainingAttempts,
    reservedSeconds: state.reservedSeconds, estimatedReservedDollars: state.estimatedReservedDollars, verifiedRateDollarsPerHour: state.header.hourlyRate,
    localConnectedSeconds: state.attempts.map(attempt => attempt.result?.connectedSeconds ?? null), endAcknowledgements: state.attempts.map(attempt => attempt.result?.endAcknowledged ?? false),
    nextPermittedAt: iso(nextPermittedAt), admissionStatus: remainingAttempts === 0 ? 'exhausted' : nextPermittedAt > Date.now() ? 'waiting_for_uncertain_session_lease' : 'ready_for_explicit_supervised_attempt', inspectedAt: new Date().toISOString(), ledgerSha256: sha256(await readFile(join(directory, 'campaign.jsonl'))),
    results: attempts, accountingBoundary: 'Conservative campaign reservations never decrease. These are planning estimates, not an invoice or an account-wide cap. Balance and unrelated account usage are unknown.',
    redaction: 'Narrow allowlist export: no keys, tokens, cookies, signed URLs, access codes, tool arguments, tool-result payloads, configuration echoes, or hidden state. Provider final transcripts and visible history retain distinct source labels.',
  }
  await writeFile(join(output, 'campaign-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined
  try {
    const summary = await exportCampaign({ directory: value('--directory'), output: value('--output'), mux: args.includes('--mux'), videoOffsetMs: value('--video-offset-ms') === undefined ? undefined : Number(value('--video-offset-ms')) })
    console.log(JSON.stringify({ attempts: summary.attempts, remainingAttempts: summary.remainingAttempts, reservedSeconds: summary.reservedSeconds, nextPermittedAt: summary.nextPermittedAt, exportedResults: summary.results.length }))
  } catch (error) { console.error(error instanceof Error ? error.message : 'Local QA evidence export failed.'); process.exitCode = 1 }
}
