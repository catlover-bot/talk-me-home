// Read historical sanitized QA evidence only. Never load credentials or initialize accounting.
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectCampaign } from './qa-budget.mjs'
import { validateSpeechWav } from './qa-speech-fixtures.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const rounded = value => Math.round(value * 10) / 10
const historical = resolve('artifacts/goal-004b/live')
const privateCampaign = resolve('.validation/goal-004b-live')
const output = resolve('artifacts/goal-004c')
const sourceTypes = new Set(['synthetic.speech.queued', 'synthetic.speech.started', 'synthetic.speech.ended', 'input.speech.started', 'input.speech.stopped', 'transcript.user', 'reply.started', 'reply.done', 'tool.call', 'tool.result', 'session.end', 'session.ended', 'socket.open', 'socket.close'])

export function normalizeObservedEvents(events) {
  const references = { reply: new Map(), input: new Map(), call: new Map(), fixture: new Map() }
  const alias = (kind, id) => {
    if (!references[kind].has(id)) references[kind].set(id, `${kind}-${references[kind].size + 1}`)
    return references[kind].get(id)
  }
  return events.filter(event => sourceTypes.has(event.type) && Number.isFinite(event.atMs)).map(event => {
    const safe = { atMs: rounded(event.atMs), type: event.type }
    if (['sent', 'received'].includes(event.direction)) safe.direction = event.direction
    if (Number.isSafeInteger(event.replyRef)) safe.reply = alias('reply', event.replyRef)
    if (Number.isSafeInteger(event.callRef)) safe.call = alias('call', event.callRef)
    if (event.type === 'transcript.user' && Number.isSafeInteger(event.reference)) safe.input = alias('input', event.reference)
    if (event.type.startsWith('synthetic.speech.') && typeof event.id === 'string') safe.fixture = alias('fixture', event.id)
    if (['completed', 'interrupted', 'failed', 'cancelled'].includes(event.status)) safe.status = event.status
    if (['observe_room', 'inspect_object', 'inspect_gate', 'interact_object', 'move_to'].includes(event.name)) safe.name = event.name
    if (typeof event.isError === 'boolean') safe.isError = event.isError
    if (event.type === 'socket.close') { safe.code = Number.isInteger(event.code) ? event.code : null; safe.clean = event.clean === true }
    return safe
  })
}

async function fileInfo(path) {
  try { const details = await stat(path); return { present: details.isFile(), bytes: details.size } }
  catch (error) { if (error.code === 'ENOENT') return { present: false }; throw error }
}

export async function exportRecoveryEvidence() {
  const summary = JSON.parse(await readFile(join(historical, 'campaign-summary.json'), 'utf8'))
  const fixtureManifest = JSON.parse(await readFile(join(historical, 'used-speech-fixtures.json'), 'utf8'))
  const ledgerBefore = await readFile(join(privateCampaign, 'campaign.jsonl'))
  const allowanceBefore = await readFile(join(privateCampaign, 'allowance.jsonl'))
  const campaign = inspectCampaign(privateCampaign)
  if (campaign.attempts.length !== 3 || campaign.reservedSeconds !== 2010) throw new Error('Historical campaign accounting differs from the exhausted source record.')
  await mkdir(output, { recursive: true })
  const attempts = []
  for (const [index, result] of summary.results.entries()) {
    const metricsPath = join(historical, `${result.evidenceDirectory}-metrics.json`)
    const metrics = JSON.parse(await readFile(metricsPath, 'utf8'))
    const directory = join(privateCampaign, result.evidenceDirectory)
    const audioPath = join(directory, 'audio-evidence.json')
    const availability = {}
    for (const file of ['audio-evidence.json', 'report.json', 'input-digital.wav', 'rendered-digital.wav', 'postVolume-digital.wav', 'browser-silent.webm', 'qa-combined-video.mp4']) availability[file] = await fileInfo(join(directory, file))
    let normalizedTrace = null
    if (availability['audio-evidence.json'].present) {
      const bytes = await readFile(audioPath)
      if (hash(bytes) !== metrics.sourceHashes.audioEvidence) throw new Error('Historical audio evidence no longer matches its committed compact source hash.')
      const audio = JSON.parse(bytes)
      const rows = normalizeObservedEvents(audio.events)
      normalizedTrace = `attempt-${index + 1}-observed-metadata.json`
      await writeFile(join(output, normalizedTrace), `${JSON.stringify({
        label: 'HISTORICAL GOAL 004B OBSERVED METADATA — NO NEW PROVIDER CALL',
        source: `.validation/goal-004b-live/${result.evidenceDirectory}/audio-evidence.json`, sourceSha256: hash(bytes),
        runtimeSha256: metrics.runtimeSha256,
        provenance: 'Observed chronological metadata with stable aliases and timestamps rounded to 0.1 ms. No event was invented or reordered.',
        missingFields: ['The original sanitizer omitted raw tool.call reply association and tool arguments/result payloads.', 'Provider final/interrupted caption markers were not fully retained in the old visible-history export.', 'No unobserved end acknowledgement or close time is inferred.'],
        reconstructionBoundary: 'Tests that add arguments, tool-to-reply associations, commit outcomes, chapter transitions, or extra event orders are reconstructed or synthetic adversarial cases, not exact trace replays.',
        events: rows,
      }, null, 2)}\n`)
      if (index === 1) {
        const observed = audio.events.filter(event => sourceTypes.has(event.type) && event.atMs >= 40801 && event.atMs <= 51000)
        const normalized = normalizeObservedEvents(observed)
        const excerpt = normalized.map((row, position) => {
          const event = { type: row.type }
          if (row.reply) event.reply_id = row.reply
          if (row.call) event.call_id = row.call
          if (row.input) { event.item_id = row.input; event.text = observed[position].text }
          if (row.fixture) event.fixture = row.fixture
          if (row.name) event.name = row.name
          if (row.status) event.status = row.status
          return { atMs: row.atMs, event }
        })
        await writeFile(join(output, 'observed-split-turn.json'), `${JSON.stringify({
          label: 'HISTORICAL GOAL 004B OBSERVED SPLIT-TURN METADATA — NO NEW PROVIDER CALL',
          source: `.validation/goal-004b-live/${result.evidenceDirectory}/audio-evidence.json`,
          sourceSha256: hash(bytes), runtimeSha256: metrics.runtimeSha256,
          sourceWindowMs: [40801, 51000],
          sourceFixture: 'speech-e6f422a403694609',
          knownBaseRepair: 'Goal 004B commit 9a0d901 already added safe settlement for a retained interrupted call. This observed replay does not claim that fix was newly introduced in Goal 004C.',
          provenance: 'Only recorded events in the source window are included, in their original order. Reply, input, call, and fixture identifiers are normalized to stable aliases. ASR-final text is unchanged.',
          missingFields: ['tool.call.arguments and explicit tool-to-reply association were not retained by the original sanitizer.', 'No tool.result was recorded for this call before the attempt ended.'],
          testSubstitution: 'The replay supplies synthetic rejected arguments and an initial ready adapter; those are harness setup, not newly observed source events. No physical action may execute from these substituted arguments.',
          events: excerpt,
        }, null, 2)}\n`)
      }
    }
    attempts.push({ attempt: index + 1, sourceMetrics: `../goal-004b/live/${result.evidenceDirectory}-metrics.json`, runtimeSha256: metrics.runtimeSha256, normalizedTrace, availability, completion: metrics.completion, endAcknowledged: metrics.ending.endAcknowledged, exactLocalConnectedSeconds: campaign.attempts[index].result?.connectedSeconds ?? null })
  }
  const fixtures = []
  for (const fixture of fixtureManifest.fixtures) {
    if (!/^speech-[0-9a-f]{16}$/.test(fixture.id)) throw new Error('Unexpected historical fixture identifier.')
    const path = resolve('.validation/goal-004b-media', `${fixture.id}.wav`)
    const present = await fileInfo(path)
    let validation = null
    if (present.present) {
      validation = validateSpeechWav(await readFile(path))
      if (validation.sha256 !== fixture.sha256) throw new Error('Historical synthetic fixture hash changed.')
    }
    fixtures.push({ id: fixture.id, wavPresent: present.present, metadataPresent: (await fileInfo(resolve('.validation/goal-004b-media', `${fixture.id}.json`))).present, matchesCommittedHash: validation ? true : null, durationSeconds: validation?.durationSeconds ?? null, source: fixture.source })
  }
  if (hash(await readFile(join(privateCampaign, 'campaign.jsonl'))) !== hash(ledgerBefore) || hash(await readFile(join(privateCampaign, 'allowance.jsonl'))) !== hash(allowanceBefore)) throw new Error('Historical accounting changed during read-only inspection.')
  const audit = { inspectedAt: new Date().toISOString(), branch: 'work/goal-004c-live-recovery', newProviderAttempts: 0, historicalLedger: { attempts: 3, reservedSeconds: 2010, remainingAttempts: 0, sha256: hash(ledgerBefore), productionAllowanceSha256: hash(allowanceBefore), unchangedDuringInspection: true }, attempts, fixtures, futureCampaignDirectoryExists: await stat(resolve('.validation/goal-004c-live')).then(() => true, error => error.code === 'ENOENT' ? false : Promise.reject(error)), boundary: 'This is a read-only historical inventory and sanitized metadata extraction, not a new Live or audio acceptance result. Missing private artifacts remain missing.' }
  await writeFile(join(output, 'historical-evidence-audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
  return audit
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try { const result = await exportRecoveryEvidence(); console.log(JSON.stringify({ inspectedAttempts: result.attempts.length, availableFixtures: result.fixtures.filter(item => item.wavPresent).length, newProviderAttempts: 0, historicalLedgerUnchanged: result.historicalLedger.unchangedDuringInspection })) }
  catch { console.error('Historical evidence audit failed closed; no provider or accounting initialization was attempted.'); process.exitCode = 1 }
}
