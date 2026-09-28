import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProtocol, type CancellationReason, type ProviderEvent } from '../game/client/voice-protocol.ts';
import { SessionStore } from '../game/server/sessions.ts';
import type { HumanView, ToolRequest, ToolResponse } from '../game/shared/contracts.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
let sequence = 0;
const identifier = () => `authority-${++sequence}`;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function envelope(view: HumanView, extra: Record<string, unknown> = {}) {
  return { roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: identifier(), ...extra };
}
function request(view: HumanView, name: string, args: Record<string, unknown> = {}): ToolRequest {
  return { roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch, callId: identifier(), name, arguments: args };
}
const owner = 'authority-test-owner';
const confirm = (store: SessionStore, result: ToolResponse) => store.decideProposal(result.view.sessionId, {
  roundId: result.view.roundId, proposalId: result.proposal!.id, requestId: identifier(), decision: 'confirm',
}, owner);
async function confirmedFixtureTool(store: SessionStore, view: HumanView, name: string, args: Record<string, unknown> = {}) {
  const proposed = await store.tool(view.sessionId, request(view, name, args));
  assert.equal(proposed.code, 'awaiting_confirmation');
  const result = await confirm(store, proposed);
  assert.equal(result.ok, true, result.message);
  return result.view;
}

/** Deterministic server fixture only; none of this setup is supplied to the robot. */
async function authorizedDock(store: SessionStore): Promise<HumanView> {
  let view = store.create('classic', 'rescue', owner);
  view = await confirmedFixtureTool(store, view, 'interact_object', { object: 'latch', action: 'latch_open' });
  view = await store.power(view.sessionId, envelope(view, { revision: view.revision, powerOn: false }));
  view = await confirmedFixtureTool(store, view, 'move_to', { target: 'far_side' });
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'beacon' }));
  for (const target of ['gallery.g1', 'gallery.g4']) view = await confirmedFixtureTool(store, view, 'move_to', { target });
  view = await store.control(view.sessionId, 'relay', envelope(view, { revision: view.revision, relay: 'harbor' }));
  view = await confirmedFixtureTool(store, view, 'move_to', { target: 'gallery.g5' });
  view = await confirmedFixtureTool(store, view, 'interact_object', { object: 'return.contact', action: 'hold_contact' });
  for (const action of ['charge', 'store']) view = await store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action }));
  view = await confirmedFixtureTool(store, view, 'interact_object', { object: 'return.contact', action: 'release_contact' });
  view = await confirmedFixtureTool(store, view, 'move_to', { target: 'return.aboard' });
  return store.control(view.sessionId, 'dock', envelope(view, { revision: view.revision, action: 'authorize_return' }));
}

function authorityProtocol(t: TestContext, store: SessionStore, initial: HumanView, afterResponse?: (result: ToolResponse) => Promise<void>) {
  const sent: Record<string, unknown>[] = [];
  const reasons: CancellationReason[] = [];
  const errors: string[] = [];
  const requests: ToolRequest[] = [];
  const results: ToolResponse[] = [];
  const signals: AbortSignal[] = [];
  const protocol = new VoiceProtocol({
    send: event => sent.push(event),
    captureToolContext: () => {
      const view = store.get(initial.sessionId);
      return { roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch };
    },
    executeTool: async (call, signal, context) => {
      const captured = context as Pick<ToolRequest, 'roundId' | 'chapterEpoch' | 'actionEpoch'>;
      const input = { ...captured, callId: call.callId, name: call.name, arguments: call.arguments };
      requests.push(input); signals.push(signal);
      const result = await store.tool(initial.sessionId, input);
      results.push(result);
      await afterResponse?.(result);
      return result;
    },
    cancelPending: async reason => {
      reasons.push(reason);
      const current = store.get(initial.sessionId);
      await store.lifecycle(current.sessionId, 'cancel', envelope(current, { reason }));
    },
    onTranscript: () => {}, onStatus: () => {}, onError: error => errors.push(error), playAudio: () => {}, stopAudio: () => {},
  });
  t.after(async () => { await protocol.stop(); }, { timeout: 1000 });
  protocol.receive({ type: 'session.ready' });
  const receive = (event: ProviderEvent) => protocol.receive(event);
  return {
    protocol, receive, sent, reasons, errors, requests, results, signals,
    start: (id: string) => receive({ type: 'reply.started', reply_id: id }),
    done: (id: string) => receive({ type: 'reply.done', reply_id: id, status: 'completed' }),
    call: (id: string, name: string, args: Record<string, unknown>) => receive({ type: 'tool.call', call_id: id, name, arguments: args }),
    view: () => store.get(initial.sessionId),
  };
}

test('authority integration: ordinary input during a pending reply preserves an executable Dock return grant', { timeout: 2000 }, async t => {
  const store = new SessionStore({ galleryConfiguration: 'a' });
  const initial = await authorizedDock(store);
  const h = authorityProtocol(t, store, initial);
  h.start('awaiting-confirmation');
  h.receive({ type: 'input.speech.started' });
  await tick();
  assert.deepEqual(h.reasons, ['supersede']);
  assert.equal(h.view().returnDock?.returnAuthorized, true);
  h.receive({ type: 'input.speech.stopped' });
  h.start('confirmation');
  h.call('return-once', 'interact_object', { object: 'return.capsule', action: 'confirm_return' });
  h.done('confirmation');
  await tick();
  assert.equal(h.view().completed, false);
  assert.equal(h.results[0]?.code, 'awaiting_confirmation');
  await confirm(store, h.results[0]!);
  assert.equal(h.view().completed, true);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.is_error, false);
  assert.equal(store.record(initial.sessionId, initial.roundId).debrief?.timeline.filter(event => event.kind === 'completion').length, 1);
  assert.doesNotMatch(JSON.stringify(h.sent), /returnDock|actionEpoch|chapterEpoch|sessionId|"view"/);
});

for (const mode of ['provider-interrupted', 'explicit-hold'] as const) {
  test(`authority integration: ${mode} revokes Dock authorization while preserving physical readiness`, { timeout: 2000 }, async t => {
    const store = new SessionStore({ galleryConfiguration: 'a' });
    const initial = await authorizedDock(store);
    const h = authorityProtocol(t, store, initial);
    h.start('return-plan');
    h.receive({ type: 'input.speech.started' });
    await tick();
    assert.equal(h.view().returnDock?.returnAuthorized, true);
    if (mode === 'provider-interrupted') h.receive({ type: 'reply.done', reply_id: 'return-plan', status: 'interrupted' });
    else await h.protocol.interrupt(true);
    await tick();
    assert.equal(h.reasons.at(-1), 'interrupt');
    const current = h.view();
    assert.equal(current.returnDock?.returnAuthorized, false);
    assert.equal(current.returnDock?.readyForReturn, true);
    assert.equal(current.returnDock?.energy, 'stored');
    const proposed = await store.tool(current.sessionId, request(current, 'interact_object', { object: 'return.capsule', action: 'confirm_return' }));
    assert.equal(proposed.code, 'awaiting_confirmation');
    const attempted = await confirm(store, proposed);
    assert.equal(attempted.ok, false);
    assert.equal(store.get(current.sessionId).completed, false);
    assert.equal(h.sent.length, 0);
  });
}

test('authority integration: owner commit before speech cancellation retains one success and never rewrites the finalized proposal result', { timeout: 2000 }, async t => {
  const store = new SessionStore();
  const initial = store.create('classic', 'rescue', owner);
  const delivery = deferred<void>();
  t.after(() => delivery.resolve(), { timeout: 1000 });
  const h = authorityProtocol(t, store, initial, () => delivery.promise);
  h.start('physical-reply');
  h.call('physical-once', 'interact_object', { object: 'latch', action: 'latch_open' });
  h.done('physical-reply');
  await tick();
  assert.equal(h.results.length, 1);
  const proposed = h.results[0]!;
  assert.equal(proposed.code, 'awaiting_confirmation');
  const committed = await confirm(store, proposed);
  assert.equal(committed.ok, true); assert.equal(committed.proposal?.status, 'committed');
  assert.equal(h.sent.length, 0);
  h.receive({ type: 'input.speech.started' });
  await tick();
  assert.equal(h.signals[0]?.aborted, true);
  delivery.resolve(); await tick();
  assert.equal(h.sent.length, 0, 'Committed output must wait until the new user turn settles.');
  h.receive({ type: 'input.speech.stopped' });
  h.start('fresh-reply'); h.done('fresh-reply'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'physical-once');
  assert.deepEqual(JSON.parse(String(h.sent[0]?.result)), { ok: true, message: proposed.message, code: 'awaiting_confirmation',
    proposal: { id: proposed.proposal!.id, status: 'awaiting_confirmation', label: proposed.proposal!.label, expiresAt: proposed.proposal!.expiresAt } });
  assert.equal(h.sent[0]?.is_error, false);
  assert.doesNotMatch(JSON.stringify(h.sent), /"view"|roundId|sessionId|actionEpoch|powerOn/);
  h.call('physical-once', 'interact_object', { object: 'latch', action: 'latch_open' });
  h.done('fresh-reply'); await tick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.sent.length, 1);
  const revision = h.view().revision;
  assert.deepEqual(await store.tool(initial.sessionId, h.requests[0]!), proposed);
  assert.equal(h.view().revision, revision, 'A server idempotency retry cannot repeat the physical commit.');
  const inspection = await store.tool(initial.sessionId, request(h.view(), 'inspect_object', { object: 'latch' }));
  assert.match(inspection.message, /The Latch is engaged\./);
  assert.equal(store.recap(initial.sessionId, initial.roundId).entries.filter(entry => entry.kind === 'action').length, 1);
});

test('authority integration: speech cancellation before commit prevents physical change and returns its actual safe cause', { timeout: 2000 }, async t => {
  const commit = deferred<void>();
  t.after(() => commit.resolve(), { timeout: 1000 });
  const store = new SessionStore({ beforeToolCommit: () => commit.promise });
  const initial = store.create('classic', 'rescue');
  const h = authorityProtocol(t, store, initial);
  h.start('uncommitted-reply');
  h.call('uncommitted-call', 'interact_object', { object: 'latch', action: 'latch_open' });
  h.done('uncommitted-reply'); await tick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.results.length, 0);
  h.receive({ type: 'input.speech.started' }); await tick();
  assert.equal(h.view().actionEpoch, initial.actionEpoch + 1);
  commit.resolve(); await tick();
  assert.equal(h.results[0]?.ok, false);
  assert.equal(h.results[0]?.code, 'cancelled_before_execution');
  assert.equal(h.sent.length, 0);
  h.receive({ type: 'input.speech.stopped' });
  h.start('after-cancellation'); h.done('after-cancellation'); await tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.call_id, 'uncommitted-call');
  assert.equal(h.sent[0]?.is_error, true);
  const payload = JSON.parse(String(h.sent[0]?.result));
  assert.equal(payload.code, 'cancelled_before_execution');
  assert.equal(payload.message, h.results[0]?.message);
  assert.doesNotMatch(JSON.stringify(payload), /"view"|roundId|sessionId|actionEpoch|powerOn/);
  const inspection = await store.tool(initial.sessionId, request(h.view(), 'inspect_object', { object: 'latch' }));
  assert.match(inspection.message, /The Latch is not engaged\./);
  assert.equal(store.recap(initial.sessionId, initial.roundId).entries.filter(entry => entry.kind === 'action').length, 0);
});
