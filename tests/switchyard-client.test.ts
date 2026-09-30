import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRouting, executeTool, type RobotToolContext } from '../game/client/api';
import { VoiceProtocol, type TranscriptEntry } from '../game/client/voice-protocol';
import { SessionStore } from '../game/server/sessions';

const context = (): RobotToolContext => ({ sessionId: 'owned-session', roundId: 'current-round', chapter: 'switchyard',
  chapterEpoch: 0, revision: 11, actionEpoch: 7, inspectionScope: { visitId: 'reported-visit' },
  switchyardPanel: { appliedRotations: [0, 0, 0, 0, 0, 0], panelRevision: 3, poweredTerminals: ['amber'] } } as RobotToolContext);

test('routing apply binds the full draft to the acknowledged round, mission revision and panel revision', async t => {
  const current = context(); let captured: { path: string; body: Record<string, unknown> } | undefined;
  t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    captured = { path, body: JSON.parse(String(init.body)) };
    return Response.json({ ...current, revision: 12 });
  });
  const rotations = [1, 2, 0, 3, 0, 1];
  const result = await applyRouting(current, rotations);
  assert.equal(result.revision, 12);
  assert.equal(captured?.path, '/api/sessions/owned-session/routing-panel');
  assert.equal(typeof captured?.body.requestId, 'string');
  assert.deepEqual(Object.keys(captured!.body).sort(), ['chapterEpoch', 'panelRevision', 'requestId', 'revision', 'rotations', 'roundId']);
  assert.deepEqual({ ...captured!.body, requestId: 'generated' }, {
    roundId: 'current-round', chapterEpoch: 0, revision: 11, requestId: 'generated', panelRevision: 3, rotations,
  });
});

test('all local Switchyard operations carry app-captured visit scope separately from model arguments', async t => {
  const bodies: Record<string, unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (_path: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body))); return Response.json({ ok: true, message: 'Server-owned outcome.' });
  });
  const args = { object: 'switchyard.lift', visitId: 'untrusted-model-value' };
  for (const name of ['inspect_object', 'propose_interaction', 'interact_object', 'propose_move', 'move_to']) {
    await executeTool(context(), { callId: name, name, arguments: args });
    assert.deepEqual(bodies.at(-1)?.inspectionScope, { visitId: 'reported-visit' });
    assert.deepEqual(bodies.at(-1)?.arguments, args);
  }
  for (const name of ['observe_room', 'get_action_status']) {
    await executeTool(context(), { callId: name, name, arguments: {} });
    assert.equal('inspectionScope' in bodies.at(-1)!, false);
  }
  const unobserved = context(); delete unobserved.inspectionScope;
  await executeTool(unobserved, { callId: 'unobserved', name: 'inspect_object', arguments: args });
  assert.equal('inspectionScope' in bodies.at(-1)!, false, 'Transport must not manufacture a visit from a target or argument.');
  await executeTool({ ...context(), chapter: 'cargo' }, { callId: 'cargo', name: 'inspect_object', arguments: { object: 'latch' } });
  assert.equal('inspectionScope' in bodies.at(-1)!, false, 'Existing Cargo calls retain their original envelope.');
});

test('injected provider tools retain local visit authority, strip human projections and preserve raw provider dialogue', async t => {
  const store = new SessionStore(); let view = store.create('classic', 'switchyard', 'browser-owner');
  let visitId: string | undefined; let requests = 0;
  const sent: Record<string, unknown>[] = []; const speech: TranscriptEntry[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    assert.equal(path, `/api/sessions/${view.sessionId}/tools`, 'The injected test can call only the local tool boundary.');
    requests++;
    const result = await store.tool(view.sessionId, JSON.parse(String(init.body)));
    return Response.json(result);
  });
  const protocol = new VoiceProtocol({
    captureToolContext: () => ({ ...view, ...(visitId ? { inspectionScope: { visitId } } : {}) }),
    executeTool: async (call, signal, captured) => {
      const result = await executeTool(captured as RobotToolContext, call, signal);
      view = result.view;
      if (result.switchyardObservation?.stateRevision === view.revision) visitId = result.switchyardObservation.visitId;
      return result;
    },
    send: event => sent.push(event), cancelPending: async () => {}, onTranscript: entry => speech.push(entry),
    onStatus() {}, onError: assert.fail, playAudio() {}, stopAudio() {},
  });
  const call = async (id: string, name: string, args: Record<string, string>) => {
    protocol.receive({ type: 'reply.started', reply_id: id });
    protocol.receive({ type: 'tool.call', call_id: id, name, arguments: args });
    protocol.receive({ type: 'reply.done', reply_id: id, status: 'completed' });
    await new Promise<void>(resolve => setImmediate(resolve));
    const packet = sent.find(event => event.type === 'tool.result' && event.call_id === id);
    assert.ok(packet); return JSON.parse(String(packet.result));
  };
  try {
    protocol.receive({ type: 'session.ready' });
    const observed = await call('local-observe', 'observe_room', {});
    assert.equal(observed.ok, true); assert.match(observed.message, /Route directory \(switchyard.directory\)/);
    assert.ok(visitId, 'Only the actual server observation supplies the next visit scope.');
    assert.deepEqual(Object.keys(observed).sort(), ['message', 'ok']);
    const inspected = await call('local-inspect', 'inspect_object', { object: 'switchyard.directory' });
    assert.equal(inspected.ok, true); assert.match(inspected.message, /direct lift/);
    const proposed = await call('local-proposal', 'propose_move', { target: 'switchyard.to_transfer' });
    assert.equal(proposed.ok, true); assert.equal(proposed.proposal.status, 'awaiting_confirmation');
    assert.equal(view.completed, false); assert.equal(view.proposal?.status, 'awaiting_confirmation');
    const raw = 'These are my exact injected provider words: switchyard.directory, before any action is confirmed.';
    protocol.receive({ type: 'reply.started', reply_id: 'spoken' });
    protocol.receive({ type: 'transcript.agent', reply_id: 'spoken', text: raw });
    protocol.receive({ type: 'reply.done', reply_id: 'spoken', status: 'completed' });
    assert.equal(speech.at(-1)?.text, raw);
    assert.equal(requests, 3);
    for (const packet of sent.filter(event => event.type === 'tool.result')) {
      const result = JSON.parse(String(packet.result));
      for (const key of ['view', 'switchyardPanel', 'appliedRotations', 'switchyardObservation', 'inspectionScope', 'configuration', 'manual']) assert.equal(key in result, false);
      assert.doesNotMatch(String(packet.result), /appliedRotations|poweredTerminals|panelRevision/);
    }
  } finally { await protocol.stop(); }
});
