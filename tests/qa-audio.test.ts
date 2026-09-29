import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import type { Page } from '@playwright/test';
import { encodePcmWav, parsePcmWav, validateSpeechWav } from '../scripts/qa-speech-fixtures.mjs';
import { sanitizeWireEvent, assembleRecording, installAudioInstrumentation } from '../scripts/qa-browser-instrumentation.mjs';

test('confirmed-action evidence label installs without weakening the explicit-label guard', async () => {
  const label = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI';
  const scripts: Array<{ content: string }> = [];
  const page = { addInitScript: async (script: { content: string }) => { scripts.push(script); } } as unknown as Page;
  await installAudioInstrumentation(page, { label });
  assert.equal(scripts.length, 1);
  assert.ok(scripts[0]!.content.includes(JSON.stringify(label)));
  await assert.rejects(installAudioInstrumentation(page, { label: 'LIVE VERIFIED' }), /explicit QA evidence label/);
  assert.equal(scripts.length, 1);
});

test('QA speech validation rejects silent, unclean, wrong-rate and malformed fixtures', () => {
  const samples = new Int16Array(24000);
  for (let i = 4320; i < 16000; i++) samples[i] = Math.round(Math.sin(i / 24) * 7000);
  const wave = encodePcmWav(samples);
  const result = validateSpeechWav(wave);
  assert.equal(result.cleanEnd, true); assert.equal(result.cleanStart, true);
  assert.ok(result.nonzeroSamples > 10000); assert.equal(result.durationSeconds, 1);
  assert.deepEqual(parsePcmWav(wave).samples, samples);
  assert.throws(() => validateSpeechWav(encodePcmWav(new Int16Array(24000))), /silence/);
  assert.throws(() => validateSpeechWav(encodePcmWav(samples, 16000)), /24 kHz/);
  samples[23999] = 3;
  assert.throws(() => validateSpeechWav(encodePcmWav(samples)), /unclean/);
  assert.throws(() => parsePcmWav(wave.subarray(0, -1)), /Truncated/);
});

test('QA wire allowlist excludes config, result payloads, URLs, cookie values and tool arguments', () => {
  const secret = 'private-sentinel-must-not-survive'; const references = new Map<string, number>();
  assert.equal(sanitizeWireEvent({ type: 'session.update', config: secret }, 'sent'), null);
  const request = sanitizeWireEvent({ type: 'tool.call', call_id: secret, name: 'observe_room', arguments: { hidden: secret }, token: secret }, 'received', references);
  const response = sanitizeWireEvent({ type: 'tool.result', call_id: secret, result: secret, is_error: false, url: secret, cookie: secret }, 'sent', references);
  assert.equal(request?.callRef, response?.callRef);
  assert.equal(JSON.stringify([request, response]).includes(secret), false);
  const error = sanitizeWireEvent({ type: 'session.error', code: secret, message: secret }, 'received');
  assert.deepEqual(error, { type: 'session.error', direction: 'received', failed: true });
  const asr = 'Could you inspect the latch?';
  assert.equal(sanitizeWireEvent({ type: 'transcript.user', item_id: 'one', text: asr }, 'received')?.text, asr);
  assert.equal(sanitizeWireEvent({ type: 'transcript.user', item_id: 'one', text: asr }, 'received')?.final, true);
  assert.equal(sanitizeWireEvent({ type: 'transcript.agent', reply_id: 'one', text: asr, interrupted: true }, 'received')?.interrupted, true);
  assert.equal(sanitizeWireEvent({ type: 'conversation.message', role: 'user', content: secret }, 'sent')?.role, 'human');
  assert.equal(JSON.stringify(sanitizeWireEvent({ type: 'conversation.message', role: 'user', content: secret }, 'sent')).includes(secret), false);
  const canonical = sanitizeWireEvent({ type: 'reply.done', reply_id: `fc-${secret}`, status: 'completed' }, 'received', references);
  assert.equal(canonical?.callRef, request?.callRef);
  assert.equal(JSON.stringify(canonical).includes(secret), false);
  for (const code of ['cancelled_before_execution', 'precondition_failed', 'outcome_unknown', 'invalid_arguments', 'unknown_target', 'nonlocal_target', 'direction_unavailable', 'direction_ambiguous', 'target_unobserved', 'stale_scope', 'mission_stopped', 'tool_unavailable']) {
    const outcome = sanitizeWireEvent({ type: 'tool.result', call_id: secret, is_error: true,
      result: JSON.stringify({ ok: false, code, message: secret, arguments: { object: secret }, view: { hidden: secret } }) }, 'sent', references);
    assert.equal(outcome?.outcomeCode, code);
    assert.equal(JSON.stringify(outcome).includes(secret), false);
  }
  assert.equal(sanitizeWireEvent({ type: 'tool.result', result: JSON.stringify({ code: secret }) }, 'sent')?.outcomeCode, undefined);
});

test('QA digital recording preserves time gaps and real PCM sample values', () => {
  const pcm = Buffer.alloc(480); for (let i = 0; i < 240; i++) pcm.writeInt16LE(6000, i * 2);
  const wave = assembleRecording([{ atMs: 100, sampleRate: 24000, data: pcm.toString('base64') }], 250);
  const { samples } = parsePcmWav(wave);
  assert.equal(samples.length, 6000); assert.equal(samples[2399], 0);
  assert.equal(samples[2400], 6000); assert.equal(samples[2639], 6000); assert.equal(samples[2640], 0);
});

test('QA proposal metadata records nonexecution and an aliased identity without retaining raw descriptors', () => {
  const references = new Map<string, number>();
  const result = sanitizeWireEvent({ type: 'tool.result', call_id: 'call', is_error: false, result: JSON.stringify({ code: 'awaiting_confirmation', proposal: { id: 'private-proposal-id', status: 'awaiting_confirmation', label: 'Private descriptor', action: { object: 'hidden-target' } } }) }, 'sent', references);
  assert.equal(result?.actionStatus, 'awaiting_confirmation');
  assert.equal(typeof result?.proposalRef, 'number');
  assert.doesNotMatch(JSON.stringify(result), /private-proposal-id|Private descriptor|hidden-target/);
  assert.equal(sanitizeWireEvent({ type: 'tool.call', name: 'propose_move' }, 'received')?.name, 'propose_move');
  assert.equal(sanitizeWireEvent({ type: 'tool.call', name: 'get_action_status' }, 'received')?.name, 'get_action_status');
});

test('received provider errors retain only explicit account refusal classification', () => {
  for (const [error, expected] of [
    [{ code: 'insufficient_credits', message: 'PRIVATE_DETAIL' }, 'provider_credit_refused'],
    [{ message: 'Insufficient balance: PRIVATE_DETAIL' }, 'provider_credit_refused'],
    [{ error: 'Workspace mismatch: PRIVATE_DETAIL' }, 'provider_credential_or_account_refused'],
    [{ error: { message: 'ACCOUNT DOES NOT MATCH: PRIVATE_DETAIL' } }, 'provider_credential_or_account_refused'],
    [{ code: 'server_error', message: 'PRIVATE_DETAIL' }, undefined],
  ] as const) {
    const safe = sanitizeWireEvent({ type: 'session.error', ...error }, 'received');
    assert.equal(safe?.failed, true);
    assert.equal(safe?.accountRefusal, expected);
    assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_DETAIL|message|server_error|insufficient_credits/);
  }
});


test('actual installed QA instrumentation blocks a second socket before native construction', async () => {
  let script = '';
  const page = { addInitScript: async (value: { content: string }) => { script = value.content; } } as unknown as Page;
  await installAudioInstrumentation(page, { label: 'OFFLINE QA \u2014 FAKE PROVIDER \u2014 SYNTHETIC AUDIO', maxProviderSockets: 1 });
  let constructed = 0;
  class FakeSocket { constructor() { constructed++; } addEventListener() {} send() {} }
  class FakeAudioNode { connect() {} }
  class FakeWorklet { addModule() {} }
  const globals = { WebSocket: FakeSocket, AudioContext: class {}, AudioWorkletNode: class {}, AudioNode: FakeAudioNode, AudioWorklet: FakeWorklet,
    URL: { createObjectURL: () => 'blob:offline', revokeObjectURL() {} }, navigator: { mediaDevices: {} }, document: { addEventListener() {} }, performance: { now: () => 0 } };
  runInNewContext(script, globals);
  new globals.WebSocket();
  assert.equal(constructed, 1);
  assert.throws(() => new globals.WebSocket(), /one provider socket/);
  assert.equal(constructed, 1, 'the second attempt never reaches the native constructor');
  assert.match(runInNewContext('JSON.stringify(__qaAudio.snapshot())', globals), /socket.attempt.blocked/);
})
