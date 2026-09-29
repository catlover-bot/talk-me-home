import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProtocol, type ProtocolHooks } from '../game/client/voice-protocol.ts';
import { simulationReply } from '../game/client/mock.ts';
import { robotTools } from '../game/agent/config.ts';
import { executeTool, MissionServiceError, type RobotToolContext } from '../game/client/api.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function peer(executeTool: ProtocolHooks['executeTool']) {
  const sent: Record<string, unknown>[] = [];
  const protocol = new VoiceProtocol({ executeTool, send: event => sent.push(event), cancelPending: async () => {},
    onTranscript() {}, onStatus() {}, onError: message => assert.fail(message), playAudio() {}, stopAudio() {} });
  protocol.receive({ type: 'session.ready' });
  return { protocol, sent };
}
function inspect(protocol: VoiceProtocol, name = 'inspect_gate') {
  protocol.receive({ type: 'reply.started', reply_id: 'read' });
  protocol.receive({ type: 'tool.call', call_id: 'read-one', name, arguments: { direction: 'southeast' } });
  protocol.receive({ type: 'reply.done', reply_id: 'read', status: 'completed' });
}

test('direction inspection is a declared read-only tool and Practice uses the observed direction', () => {
  const tool = robotTools.find(tool => tool.name === 'inspect_gate');
  assert.ok(tool, 'A direction-targeted read must be declared in the actual inline configuration.');
  assert.deepEqual(tool.parameters.required, ['direction']);
  assert.equal(tool.parameters.additionalProperties, false);
  const memory = { chapter: 'gallery' as const, gates: [{ id: 'gallery.g4', label: 'southeast' }] };
  assert.deepEqual(simulationReply('Please inspect the southeast gate.', memory).call?.arguments, { direction: 'southeast' });
  assert.equal(simulationReply('Please inspect the southeast gate.', memory).call?.name, 'inspect_gate');
  assert.equal(simulationReply('Please move through the southeast gate.', memory).call?.name, 'propose_move');
  assert.equal(simulationReply('Inspect northeast or southeast gate.', memory).call, undefined);
});

test('HTTP mapping retains trusted inspection scope and allowlisted validation errors', async t => {
  let envelope: Record<string, unknown> | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    envelope = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ error: 'This request belongs to an earlier chapter.', code: 'stale_scope', recovery: 'observe_room', secret: 'excluded' }), { status: 409 });
  });
  const scope = { sessionId: 'local', roundId: 'round', chapterEpoch: 2, actionEpoch: 3, inspectionScope: { visitId: 'captured-visit' } } as RobotToolContext;
  await assert.rejects(executeTool(scope, { callId: 'read', name: 'inspect_gate', arguments: { direction: 'southeast' } }), error => {
    assert.ok(error instanceof MissionServiceError);
    assert.equal(error.code, 'stale_scope'); assert.equal(error.recovery, 'observe_room');
    assert.equal('secret' in error, false); return true;
  });
  assert.deepEqual(envelope?.inspectionScope, { visitId: 'captured-visit' });
  assert.deepEqual(envelope?.arguments, { direction: 'southeast' });
  t.mock.restoreAll();
});

test('protocol executes a direction read once at the valid boundary and strips private diagnostic extras', async () => {
  let executed = 0;
  const h = peer(async call => { executed++; assert.equal(call.name, 'inspect_gate'); return {
    ok: true, message: 'The southeast gate is closed and the passage is clear.',
    diagnostic: { visitId: 'private', target: 'private' }, view: { location: 'private' },
  }; });
  try {
    inspect(h.protocol); await tick();
    h.protocol.receive({ type: 'tool.call', call_id: 'read-one', name: 'inspect_gate', arguments: { direction: 'southeast' } });
    await tick();
    assert.equal(executed, 1); assert.equal(h.sent.length, 1);
    assert.deepEqual(JSON.parse(String(h.sent[0]!.result)), { ok: true, message: 'The southeast gate is closed and the passage is clear.' });
  } finally { await h.protocol.stop(); }
});

test('classified inspection rejection survives projection without passing unrestricted recovery data', async () => {
  for (const code of ['invalid_arguments', 'unknown_target', 'nonlocal_target', 'direction_unavailable', 'direction_ambiguous', 'target_unobserved', 'stale_scope', 'mission_stopped', 'tool_unavailable']) {
    const h = peer(async () => ({ ok: false, code, recovery: 'observe_room', message: 'Take a fresh local survey, then inspect its direction.',
      diagnostic: { rejected: 'private' }, view: { privateNotes: 'private' } }));
    try {
      inspect(h.protocol, 'inspect_object'); await tick();
      assert.deepEqual(JSON.parse(String(h.sent[0]!.result)), { ok: false, code, recovery: 'observe_room', message: 'Take a fresh local survey, then inspect its direction.' });
    } finally { await h.protocol.stop(); }
  }
  const h = peer(async () => ({ ok: false, code: 'arbitrary-private-value', recovery: 'secret payload', message: 'No verified observation.' }));
  try {
    inspect(h.protocol, 'inspect_object'); await tick();
    assert.deepEqual(JSON.parse(String(h.sent[0]!.result)), { ok: false, code: 'precondition_failed', message: 'No verified observation.' });
  } finally { await h.protocol.stop(); }
});

test('a failed direction read never suggests that a physical action might have committed', async () => {
  const h = peer(async () => { throw new Error('Constructed transport loss'); });
  try {
    inspect(h.protocol); await tick();
    const result = JSON.parse(String(h.sent[0]!.result));
    assert.equal(result.code, 'outcome_unknown');
    assert.match(result.message, /read-only check.*changed nothing/);
    assert.doesNotMatch(result.message, /already have committed/);
  } finally { await h.protocol.stop(); }
});

test('completed tool delivery remains visibly awaiting a reply through playback drain and duplicate completion', async () => {
  const statuses: string[] = [];
  // A separate peer records actual stage callbacks, with no wall-clock delay.
  const p = new VoiceProtocol({ send() {}, executeTool: async () => ({ ok: true, message: 'A local report.' }),
    cancelPending: async () => {}, onTranscript() {}, onStatus: value => statuses.push(value), onError: assert.fail,
    playAudio() {}, stopAudio() {} });
  try {
    p.receive({ type: 'session.ready' }); inspect(p, 'inspect_object'); await tick();
    assert.equal(statuses.at(-1), 'awaiting_reply');
    p.playbackDrained();
    p.receive({ type: 'reply.done', reply_id: 'read', status: 'completed' });
    assert.equal(statuses.at(-1), 'awaiting_reply');
    p.receive({ type: 'reply.started', reply_id: 'answer' });
    assert.equal(statuses.at(-1), 'responding');
    p.receive({ type: 'reply.done', reply_id: 'answer', status: 'completed' });
    assert.equal(statuses.at(-1), 'listening');
  } finally { await p.stop(); }
});
