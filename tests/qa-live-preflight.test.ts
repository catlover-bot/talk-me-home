import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { playerSpeechTexts, readFrozenSpeechFixture, speechFixtureId } from '../scripts/qa-live-speech.mjs';
import { proposalRecoveryPhrases } from '../scripts/qa-player-policy.mjs';
import { preSubmitStatus, turnCycleStatus, waitBeforePlayerTurn } from '../scripts/qa-turn-pacing.mjs';
import { encodePcmWav } from '../scripts/qa-speech-fixtures.mjs';
import { sanitizeWireEvent } from '../scripts/qa-browser-instrumentation.mjs';
import type { AudioSnapshot, QaAudioEvent } from '../scripts/qa-browser-instrumentation.mjs';

const event = (atMs: number, type: string, extra = {}): QaAudioEvent => ({ atMs, type, ...extra });
const snapshot = (events: QaAudioEvent[], extra = {}): AudioSnapshot => ({ label: 'Constructed offline preflight scheduling', elapsedMs: 5000, events, activeSources: 0, activeTracks: 1, openApplicationContexts: 2, playbackPending: false, counters: Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(kind => [kind, { chunks: 0, samples: 0, nonzeroSamples: 0, energy: 0 }])) as AudioSnapshot['counters'], ...extra });
const completed = [event(100, 'reply.started', { replyRef: 1 }), event(200, 'transcript.agent', { reference: 1, final: true }), event(210, 'reply.done', { replyRef: 1, status: 'completed' })];

test('pre-freeze speech includes the delivered committed-Latch crossing recovery and Dock rephrasing', () => {
  const texts = playerSpeechTexts();
  assert.ok(texts.includes('The console confirms "Engage the Latch" completed. Please check the relevant proposal result and local conditions needed for "Move to the far-side platform".'));
  assert.ok(texts.includes('Please board the capsule when it is safe to board.'));
});

test('pre-submit gate cannot use an old reply boundary while a confirmation acknowledgement is requested but not started', () => {
  const events = [...completed, event(1000, 'conversation.message', { role: 'other' }), event(1150, 'reply.create', { direction: 'sent', purpose: 'decision_acknowledgement' })];
  assert.equal(preSubmitStatus(snapshot(events), { confirmation: { confirmationRequestedAtMs: 900, confirmedAtMs: 1010 } }).settled, false);
});

test('all finite delivered action-label pairs and no-receipt recovery variants are prepared without choosing a route', () => {
  const labels = ['Engage the Latch', 'Move to the far-side platform', 'Hold the charging contact', 'Release the charging contact', 'Board the recovery capsule', 'Confirm the authorized return',
    ...['Neutral', 'Anchor', 'Bridge'].map(value => `Set the Latch selector to ${value}`),
    ...['east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'].map(value => `Move through the ${value} gate`)];
  const texts = new Set(playerSpeechTexts());
  for (const expectedLabel of labels) for (const previousLabel of [null, ...labels]) {
    const phrases = proposalRecoveryPhrases(expectedLabel, previousLabel ? { proposalId: 'synthetic-only', label: previousLabel, status: 'committed' } : null);
    assert.ok(texts.has(phrases.clarify)); assert.ok(texts.has(phrases.retry));
  }
  assert.ok(texts.size < 320, 'The catalog stays finite, with no model text or identifier interpolation.');
});

test('frozen speech reader refuses unknown, absent, changed or mismatched files without synthesis or repair', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tmh-frozen-speech-'));
  try {
    const text = 'Please inspect the Latch.'; const id = speechFixtureId(text);
    const samples = new Int16Array(24_000); for (let i = 4320; i < 16_000; i++) samples[i] = Math.round(Math.sin(i / 24) * 7000);
    const wav = encodePcmWav(samples); const metadata = Buffer.from(JSON.stringify({ id, text, source: 'Constructed local tone, not speech evidence' }));
    const files = { [`${id}.json`]: createHash('sha256').update(metadata).digest('hex'), [`${id}.wav`]: createHash('sha256').update(wav).digest('hex') };
    await writeFile(join(directory, `${id}.json`), metadata); await writeFile(join(directory, `${id}.wav`), wav);
    assert.equal((await readFrozenSpeechFixture(text, files, directory)).text, text);
    const before = await readdir(directory);
    await assert.rejects(readFrozenSpeechFixture('Uncatalogued request.', files, directory), /absent from the frozen/);
    await assert.rejects(readFrozenSpeechFixture(text, {}, directory), /absent from the frozen/);
    assert.deepEqual(await readdir(directory), before);
    await writeFile(join(directory, `${id}.json`), Buffer.concat([metadata, Buffer.from(' ')]));
    await assert.rejects(readFrozenSpeechFixture(text, files, directory), /bytes changed/);
    await writeFile(join(directory, `${id}.json`), metadata);
    const changed = Buffer.from(wav); changed[9000] = changed[9000]! ^ 1; await writeFile(join(directory, `${id}.wav`), changed);
    await assert.rejects(readFrozenSpeechFixture(text, files, directory), /bytes changed/);
    assert.deepEqual(await readFile(join(directory, `${id}.wav`)), changed, 'A rejected file is never repaired.');
    await rm(join(directory, `${id}.wav`));
    await assert.rejects(readFrozenSpeechFixture(text, files, directory), /ENOENT/);
    assert.deepEqual(await readdir(directory), [`${id}.json`]);
  } finally { await rm(directory, { recursive: true }); }
});

test('ACK opportunity expires once at the shipped bound, while no-new-confirmation has no extra delay', () => {
  const confirmation = { confirmationRequestedAtMs: 900, confirmedAtMs: 1010 };
  assert.equal(preSubmitStatus(snapshot(completed, { elapsedMs: 1600 })).settled, true);
  assert.equal(preSubmitStatus(snapshot(completed, { elapsedMs: 5009 }), { confirmation }).reason, 'acknowledgement_opportunity_pending');
  assert.equal(preSubmitStatus(snapshot(completed, { elapsedMs: 5010 }), { confirmation }).reason, 'acknowledgement_opportunity_expired');
  assert.equal(preSubmitStatus(snapshot(completed, { elapsedMs: 9000 }), { confirmation }).settled, true);
});

test('late old completions cannot finish a requested ACK, while its own cancelled reply can drain', () => {
  const events = [...completed, event(1150, 'reply.create', { purpose: 'decision_acknowledgement' }), event(1200, 'reply.done', { replyRef: 1, status: 'cancelled' })];
  assert.equal(preSubmitStatus(snapshot(events)).reason, 'acknowledgement_response_pending');
  events.push(event(1300, 'reply.started', { replyRef: 2 }), event(1400, 'reply.done', { replyRef: 2, status: 'cancelled' }));
  assert.equal(preSubmitStatus(snapshot(events)).reason, 'acknowledgement_cancelled_and_drained');
  assert.equal(preSubmitStatus(snapshot(events, { playbackPending: true })).settled, false);
});

test('an older completed ACK cannot conceal a later confirmation opportunity expiring without an ACK', () => {
  const events = [event(50, 'reply.create', { purpose: 'decision_acknowledgement', proposalRef: 1 }), ...completed,
    event(1000, 'conversation.message', { purpose: 'decision_receipt', proposalRef: 2, role: 'other' })];
  const options = { confirmation: { confirmationRequestedAtMs: 900, confirmedAtMs: 1010 } };
  assert.equal(preSubmitStatus(snapshot(events), options).reason, 'acknowledgement_opportunity_pending');
  assert.equal(preSubmitStatus(snapshot(events, { elapsedMs: 5010 }), options).reason, 'acknowledgement_opportunity_expired');
});

test('ACK completion requires its own reply, tool continuation and actual playback drain', () => {
  const events = [...completed, event(1150, 'reply.create', { purpose: 'decision_acknowledgement' }), event(1200, 'reply.started', { replyRef: 2 }), event(1250, 'transcript.agent', { reference: 2, final: true }), event(1260, 'reply.done', { replyRef: 2, status: 'completed' })];
  assert.equal(preSubmitStatus(snapshot(events, { playbackPending: true })).settled, false);
  assert.equal(preSubmitStatus(snapshot(events)).settled, true);
  events.push(event(1300, 'tool.call', { callRef: 3 }));
  assert.equal(preSubmitStatus(snapshot(events)).reason, 'tool_result_pending');
  events.push(event(1400, 'tool.result', { callRef: 3 }));
  assert.equal(preSubmitStatus(snapshot(events)).reason, 'tool_continuation_pending');
  events.push(event(1450, 'reply.started', { replyRef: 4 }), event(1500, 'transcript.agent', { reference: 4, final: true }), event(1550, 'reply.done', { replyRef: 4, status: 'completed' }));
  assert.equal(preSubmitStatus(snapshot(events)).settled, true);
  const noAck = [...completed, event(1300, 'tool.call', { callRef: 3 }), event(1400, 'tool.result', { callRef: 3 })];
  assert.equal(preSubmitStatus(snapshot(noAck, { elapsedMs: 9000 }), { confirmation: { confirmationRequestedAtMs: 900, confirmedAtMs: 1010 } }).reason, 'tool_continuation_pending');
});

test('system receipt is never a typed user turn and safe ACK metadata retains no payload or identifier', () => {
  const secret = 'private-fixture-identifier'; const refs = new Map<string, number>();
  const receipt = sanitizeWireEvent({ type: 'conversation.message', role: 'system', content: `Verified game decision receipt.\n${JSON.stringify({ proposal: { id: secret }, result: { message: secret } })}` }, 'sent', refs)!;
  const ack = sanitizeWireEvent({ type: 'reply.create', instructions: `Briefly acknowledge only the verified result for proposal ${secret} in one short sentence. ${secret}` }, 'sent', refs)!;
  assert.equal(receipt.purpose, 'decision_receipt'); assert.equal(ack.purpose, 'decision_acknowledgement'); assert.equal(receipt.proposalRef, ack.proposalRef);
  assert.ok(!JSON.stringify([receipt, ack]).includes(secret));
  assert.equal(turnCycleStatus(snapshot([{ ...receipt, atMs: 100 } as QaAudioEvent, ...completed]), { mode: 'text', afterMs: 0 }).reason, 'input_not_observed');
});

test('provider failure in the actual pre-submit waiter stops immediately, before the caller can submit', async () => {
  let submitted = false;
  const page = { evaluate: async () => snapshot([...completed, event(300, 'session.error')]) } as unknown as Page;
  await assert.rejects((async () => { await waitBeforePlayerTurn(page); submitted = true; })(), /pre-submit stopped: provider_error/);
  assert.equal(submitted, false);
});

test('settled pre-submit waiter records its own browser-clock window separately from the next turn', async () => {
  const page = { evaluate: async () => snapshot(completed) } as unknown as Page;
  const result = await waitBeforePlayerTurn(page);
  assert.equal(result.startedAtMs, 5000); assert.equal(result.endedAtMs, 5000); assert.equal(result.waitedMs, 0);
});
