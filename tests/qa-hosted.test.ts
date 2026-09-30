import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { Page } from '@playwright/test';
import { hostedOrigin, verifyHostedAllocation, verifyPricing, readHostedCredential, auditHostedDecisions, hostedMeasurements, finalizeSupervisedReport, publicHostedSummary } from '../scripts/qa-hosted-policy.mjs';
import { main, parseHostedArgs, captureHostedHttp } from '../scripts/qa-hosted-live.mjs';
import { communicatedRecorderDiscovery, PHRASES, proposalLabelForRequest, RECORDER_DISCOVERY_REQUESTS } from '../scripts/qa-mission-player.mjs';
import { playerSpeechTexts } from '../scripts/qa-live-speech.mjs';
import { classifyProposalResponse } from '../scripts/qa-player-policy.mjs';
import { evaluateAcceptanceBehavior } from '../scripts/qa-acceptance-behavior.mjs';
import { sanitizeWireEvent } from '../scripts/qa-browser-instrumentation.mjs';

const hash = 'a'.repeat(64); const now = Date.now();
const allocation = { grantId: 'goal-007-release-2026-09-30', purpose: 'qa', mode: 'voice', remaining: 8, reservationSeconds: 970, maxSessionSeconds: 900, runtimeSha256: hash, leaseUntil: null, accepted: false, halted: false, textRemaining: 2 };

test('hosted QA default stays offline, and explicit execution requires all frozen inputs', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('No network allowed in default invocation'); }) as typeof fetch;
  try { await main([]); } finally { globalThis.fetch = original; }
  assert.equal(calls, 0);
  assert.throws(() => parseHostedArgs(['--live']), /HTTPS/);
  assert.throws(() => parseHostedArgs(['--live', '--origin', 'https://game.example']), /frozen/);
  for (const origin of ['http://game.example', 'https://game.example/', 'https://user:password@game.example', 'https://game.example?token=private', 'https://localhost']) assert.throws(() => hostedOrigin(origin));
  assert.equal(hostedOrigin('https://game.example'), 'https://game.example');
  const disabled = process.env.GAME_DISABLE_LIVE; process.env.GAME_DISABLE_LIVE = '1';
  try {
    await assert.rejects(main(['--live', '--origin', 'https://game.example', '--expected-commit', 'a'.repeat(40), '--expected-runtime-sha256', hash, '--expected-config-sha256', hash,
      '--credential-file', 'absent-private-file', '--pricing-file', 'absent-price', '--speech-manifest', 'absent-speech', '--run-id', 'offline-guard']), /disabled in CI/);
  } finally { if (disabled === undefined) delete process.env.GAME_DISABLE_LIVE; else process.env.GAME_DISABLE_LIVE = disabled; }
});

test('hosted authority rejects reviewer reserve, stale runtime, active leases and exhausted Text quota', () => {
  const args = { mode: 'voice', runtimeSha256: hash, now };
  assert.deepEqual(verifyHostedAllocation(allocation, args), allocation);
  for (const change of [{ purpose: 'reviewer' }, { grantId: 'another-grant' }, { remaining: 0 }, { remaining: 9 }, { runtimeSha256: 'b'.repeat(64) }, { leaseUntil: now + 1 }, { halted: true }, { reservationSeconds: 670 }, { maxSessionSeconds: 600 }]) assert.throws(() => verifyHostedAllocation({ ...allocation, ...change }, args));
  assert.throws(() => verifyHostedAllocation({ ...allocation, mode: 'text', textRemaining: 0 }, { ...args, mode: 'text' }));
  const receipt = { ...allocation, attempt: 3, poolAttempt: 2, reservedSeconds: 970, leaseUntil: now + 970_000 };
  assert.equal(verifyHostedAllocation(receipt, { ...args, token: true }).poolAttempt, 2);
  assert.throws(() => verifyHostedAllocation({ ...receipt, poolAttempt: 9 }, { ...args, token: true }));
});

test('pricing ceiling includes both separate pools and never relies on an account lookup', () => {
  const receipt = { checkedAt: new Date(now).toISOString(), source: 'https://www.assemblyai.com/pricing/', usdPerHour: 4.5 };
  assert.equal(verifyPricing(receipt, now).fullAllocationEstimate, 19.4);
  assert.throws(() => verifyPricing({ ...receipt, usdPerHour: 4.7 }, now));
  assert.throws(() => verifyPricing({ ...receipt, usdPerHour: 4.6 }, now), /frozen grant rate/);
  assert.throws(() => verifyPricing(receipt, now + 86_400_001));
  assert.throws(() => verifyPricing({ ...receipt, source: 'https://unverified.example' }, now));
});

test('private QA code file is origin-bound and rejects publicly readable permissions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tmh-hosted-test-')); const path = join(dir, 'code.json');
  try {
    await writeFile(path, JSON.stringify({ origin: 'https://game.example', qaVoiceAccessCode: 'synthetic-test-only-code-32-characters' }), { mode: 0o600 });
    assert.equal(await readHostedCredential(path, 'https://game.example', 'voice'), 'synthetic-test-only-code-32-characters');
    await assert.rejects(readHostedCredential(path, 'https://other.example', 'voice'));
    await assert.rejects(readHostedCredential(path, 'https://game.example', 'text'));
    await writeFile(path, '{"qaVoiceAccessCode":"malformed-synthetic-sentinel-to-redact" BROKEN');
    await assert.rejects(readHostedCredential(path, 'https://game.example', 'voice'), error => error instanceof Error && /could not be decoded/.test(error.message) && !error.message.includes('synthetic-sentinel'));
    await chmod(path, 0o644); await assert.rejects(readHostedCredential(path, 'https://game.example', 'voice'), /owner-only/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('explicit refusal evidence preserves only a safe category and leaves expired tokens unclassified', () => {
  assert.equal(sanitizeWireEvent({ type: 'session.error', code: 'session_forbidden', message: 'synthetic-private-diagnostic' }, 'received')?.accountRefusal, 'provider_credential_or_account_refused');
  assert.equal(sanitizeWireEvent({ type: 'session.error', code: 'UNAUTHORIZED' }, 'received')?.accountRefusal, undefined);
  assert.doesNotMatch(JSON.stringify(sanitizeWireEvent({ type: 'session.error', error: { message: 'insufficient credits synthetic-private-diagnostic' } }, 'received')), /synthetic-private-diagnostic/);
});

test('passive ordinary HTTP observation retains durable refusal ACKs while dropping token and config values', async () => {
  const page = new EventEmitter(); const observer = captureHostedHttp(page as unknown as Page, 'https://game.example');
  const respond = (path: string, body: unknown, request: unknown) => page.emit('response', {
    url: () => `https://game.example/api/sessions/owned/${path}`, ok: () => true, status: () => 200,
    json: async () => body, allHeaders: async () => ({}), request: () => ({ postDataJSON: () => request }),
  });
  respond('voice-token', { token: 'synthetic-private-token', sessionConfig: { secret: 'synthetic-private-config' }, maxSessionSeconds: 900, allocation }, {});
  respond('live-refusal', { stopped: true, source: 'client_report', privateExtra: 'synthetic-private-extra' }, { reason: 'provider_credit_refused', roundId: 'owned-round' });
  respond('record', { messages: [{ text: 'A faithful human report.' }], debrief: null }, {});
  await observer.settle(); observer.close();
  assert.equal(observer.refusals.length, 1); assert.equal(observer.refusals[0].source, 'client_report');
  assert.equal(observer.refusals[0].reason, 'provider_credit_refused');
  assert.equal(observer.records.length, 1);
  assert.doesNotMatch(JSON.stringify(observer), /synthetic-private/);
});

test('passive HTTP audit requires exact UI matching, declined immobility and server home consequence', () => {
  const proposal = { id: 'pickup', label: 'Secure the flight recorder', status: 'committed', result: { ok: true } };
  const decisions = [{ request: { proposalId: 'declined', decision: 'decline' }, proposal: { id: 'declined', status: 'declined' } }, { request: { proposalId: 'pickup', decision: 'confirm' }, proposal }];
  const views = [{ completed: true, chaptersCleared: ['cargo', 'gallery', 'return_dock'], recoveredFlightRecorder: true, proposal }];
  const input = { decisions, views, confirmations: [{ proposalId: 'pickup', label: proposal.label, status: 'committed' }], recovery: { completed: true, proposalId: 'declined' }, recorder: true };
  assert.equal(auditHostedDecisions(input).passed, true);
  assert.equal(auditHostedDecisions({ ...input, confirmations: [] }).passed, false);
  assert.equal(auditHostedDecisions({ ...input, views: [{ ...views[0], recoveredFlightRecorder: undefined }] }).passed, false);
  assert.equal(auditHostedDecisions({ ...input, decisions: [...decisions, { request: { proposalId: 'declined', decision: 'confirm' }, proposal: { ...proposal, id: 'declined' } }] }).passed, false);
  const summary = JSON.stringify(publicHostedSummary({ mode: 'voice', steps: [{ utterance: 'private-raw-dialogue' }], authorization: 'private-credential', failure: 'private-diagnostic' }));
  assert.doesNotMatch(summary, /private-raw-dialogue|private-credential|private-diagnostic/);
});

test('recorder player requires local discovery and freezes all purposeful speech before running', () => {
  assert.equal(communicatedRecorderDiscovery('A small flight recorder rests in a cradle within reach.'), true);
  for (const text of ['There is no flight recorder here.', 'I might see a flight recorder.', 'The flight recorder was here.', 'Should I inspect the flight recorder?', 'Your document mentions a flight recorder.']) assert.equal(communicatedRecorderDiscovery(text), false);
  assert.equal(proposalLabelForRequest(PHRASES.pickupRecorder), 'Secure the flight recorder');
  const texts = playerSpeechTexts();
  for (const request of RECORDER_DISCOVERY_REQUESTS) assert.ok(texts.includes(request.text));
  assert.ok(texts.includes(PHRASES.pickupRecorder));
  assert.equal(classifyProposalResponse({ expectedLabel: 'Secure the flight recorder', before: null, current: { proposalId: 'new', status: 'awaiting_confirmation', label: 'Secure the flight recorder' }, reply: 'I have secured the flight recorder.' }).kind, 'false_completion');
  assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [{ turnId: 1, utterance: PHRASES.pickupRecorder, startedAtMs: 0, endedAtMs: 4, settled: true,
    proposal: { proposalId: 'test-recorder', label: 'Secure the flight recorder', status: 'awaiting_confirmation' }, messages: [] }] }).status, 'pass');
});

test('supervisor failure overrides a saved worker pass and missing timing stays unknown', () => {
  const passed = { status: 'PASS', failure: null };
  assert.equal(finalizeSupervisedReport(passed, { finished: true, workerExitCode: 0, localCleanupObserved: true }).status, 'PASS');
  for (const change of [{ finished: false }, { workerExitCode: 1 }, { localCleanupObserved: false }]) {
    const report = finalizeSupervisedReport(passed, { finished: true, workerExitCode: 0, localCleanupObserved: true, ...change });
    assert.equal(report.status, 'FAIL'); assert.equal(publicHostedSummary(report).status, 'FAIL');
  }
  assert.equal(hostedMeasurements({}).endToAckMilliseconds, null);
  const metrics = hostedMeasurements({ checkpoints: [{ title: 'You brought Pip home.', atMs: 200 }], acquisitions: [{ exchanges: [{ text: 'Please inspect.', outcome: 'needs_fresh_report' }, { outcome: 'acquired' }] }] }, [
    { type: 'session.ready', atMs: 1 }, { type: 'input.speech.stopped', atMs: 2 }, { type: 'transcript.user', final: true, atMs: 10 },
    { type: 'tool.call', callRef: 1, atMs: 20 }, { type: 'tool.result', callRef: 1, atMs: 30 },
    { type: 'transcript.agent', final: true, atMs: 50 }, { type: 'session.end', atMs: 201 }, { type: 'session.ended', atMs: 210 },
  ]);
  assert.equal(metrics.timeToHomeMilliseconds, 199); assert.equal(metrics.endToAckMilliseconds, 9);
  assert.equal(metrics.failedFirstInspectionCount, 1); assert.equal(metrics.recoveryExchanges, 1);
  assert.deepEqual(metrics.asrFinalDelays, [{ itemRef: undefined, milliseconds: 8 }]);
});
