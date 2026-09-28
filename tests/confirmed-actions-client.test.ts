import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProtocol } from '../game/client/voice-protocol.ts';
import { LiveVoice, type VoiceSocket } from '../game/client/voice.ts';
import type { VoiceAudio } from '../game/client/audio.ts';
import { simulationReply, simulationToolSpeech } from '../game/client/mock.ts';
import { acceptsHumanViewSnapshot } from '../game/client/view-order.ts';
import { SessionStore } from '../game/server/sessions.ts';
import { randomUUID } from 'node:crypto';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('delayed pending and declined snapshots cannot replace a newer proposal at the same physical revision', async () => {
  const store = new SessionStore(); const owner = 'test-owner';
  const initial = store.create('classic', 'rescue', owner);
  const propose = () => store.tool(initial.sessionId, { roundId: initial.roundId, chapterEpoch: initial.chapterEpoch,
    actionEpoch: initial.actionEpoch, callId: randomUUID(), name: 'propose_interaction', arguments: { object: 'latch', action: 'latch_open' } });
  const pending = await propose();
  assert.equal(simulationToolSpeech(pending), 'I propose: Engage the Latch. Please confirm on the console, or choose Not yet.');
  const declined = await store.decideProposal(initial.sessionId, { roundId: initial.roundId, proposalId: pending.proposal!.id,
    requestId: randomUUID(), decision: 'decline' }, owner);
  const replacement = await propose();
  assert.equal(initial.revision, declined.view.revision);
  assert.equal(declined.view.revision, replacement.view.revision);
  assert.notEqual(pending.proposal!.id, replacement.proposal!.id);
  let displayed = initial;
  for (const snapshot of [pending.view, declined.view, pending.view, replacement.view, declined.view, pending.view]) {
    if (acceptsHumanViewSnapshot(displayed, snapshot)) displayed = snapshot;
  }
  assert.equal(displayed.proposal?.id, replacement.proposal!.id);
  assert.equal(displayed.proposal?.status, 'awaiting_confirmation');
  assert.equal(acceptsHumanViewSnapshot(declined.view, pending.view), false);
  const reset = await store.lifecycle(initial.sessionId, 'reset', { roundId: initial.roundId, chapterEpoch: initial.chapterEpoch, requestId: randomUUID() });
  assert.equal(reset.proposalRevision, 0);
  assert.equal(acceptsHumanViewSnapshot(displayed, reset), true, 'A new round starts a fresh counter.');
});

test('proposal result is prompt, correlated and single; human projection and model claims never become execution receipts', async () => {
  const sent: Record<string, unknown>[] = [];
  const captions: string[] = [];
  let calls = 0;
  const protocol = new VoiceProtocol({ send: event => sent.push(event), cancelPending: async () => {},
    onTranscript: entry => captions.push(entry.text), onStatus() {}, onError: message => assert.fail(message), playAudio() {}, stopAudio() {},
    executeTool: async () => { calls++; return { ok: true, code: 'awaiting_confirmation', message: 'Waiting for confirmation; not executed.',
      proposal: { id: 'known-proposal', status: 'awaiting_confirmation', label: 'Secure the Door with the Latch', expiresAt: 100_000,
        action: { object: 'latch', action: 'latch_open' }, roundId: 'private-round', chapterEpoch: 1 },
      view: { sessionId: 'private-session', powerOn: true }, decisionEvent: { text: 'must not forward' } }; },
  });
  protocol.receive({ type: 'session.ready' });
  protocol.receive({ type: 'reply.started', reply_id: 'proposal-reply' });
  protocol.receive({ type: 'tool.call', call_id: 'proposal-call', name: 'propose_interaction', arguments: { object: 'latch', action: 'latch_open', approved: true } });
  await tick(); assert.equal(calls, 0, 'The existing valid reply boundary still applies.');
  protocol.receive({ type: 'reply.done', reply_id: 'proposal-reply', status: 'completed' });
  await tick();
  assert.equal(calls, 1); assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'tool.result'); assert.equal(sent[0].call_id, 'proposal-call');
  assert.equal(sent[0].is_error, false);
  const result = JSON.parse(String(sent[0].result));
  assert.equal(result.code, 'awaiting_confirmation'); assert.equal(result.proposal.status, 'awaiting_confirmation');
  assert.equal(result.proposal.id, 'known-proposal');
  assert.doesNotMatch(String(sent[0].result), /private|powerOn|decisionEvent|latch_open|"view"/);
  protocol.receive({ type: 'tool.call', call_id: 'proposal-call', name: 'propose_interaction', arguments: {} });
  protocol.receive({ type: 'reply.done', reply_id: 'proposal-reply', status: 'completed' });
  protocol.receive({ type: 'reply.started', reply_id: 'false-narration' });
  protocol.receive({ type: 'transcript.agent', reply_id: 'false-narration', text: 'I already engaged it.' });
  await tick();
  assert.equal(sent.length, 1); assert.equal(calls, 1);
  assert.deepEqual(captions, ['I already engaged it.'], 'False narration remains faithful evidence, not a rewritten success.');
  await protocol.stop();
});

test('verified owner receipt uses system context once without human transcript, second tool result or automatic reply', async () => {
  const sent: Record<string, unknown>[] = [];
  const captions: unknown[] = [];
  const socket: VoiceSocket = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send: data => { const event = JSON.parse(data); sent.push(event); if (event.type === 'session.end') queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ type: 'session.ended' }) } as MessageEvent)); },
    close: () => { socket.readyState = 3; },
  };
  const audio: VoiceAudio = { async prepare() {}, play() {}, stopPlayback() {}, async close() {} };
  let cancellations = 0;
  const live = new LiveVoice({ onTranscript: entry => captions.push(entry), onStatus() {}, onError: message => assert.fail(message) },
    { createAudio: () => audio, createSocket: () => { queueMicrotask(() => { socket.onopen?.(new Event('open')); socket.onmessage?.({ data: JSON.stringify({ type: 'session.ready' }) } as MessageEvent); }); return socket; }, endGraceMs: 50 });
  assert.equal(live.sendGameEvent('event1', 'p1', 'Engage the Latch: completed.'), false);
  await live.start({ token: 'offline-placeholder', config: {}, microphone: false, executeTool: async () => assert.fail('A context receipt cannot execute a tool.'), cancelPending: async () => { cancellations++; } });
  assert.equal(live.sendGameEvent('event1', 'p1', 'Engage the Latch: completed.'), true);
  assert.equal(live.sendGameEvent('event1', 'p1', 'Engage the Latch: completed.'), false);
  const messages = sent.filter(event => event.type === 'conversation.message');
  assert.equal(messages.length, 1); assert.equal(messages[0].role, 'system'); assert.match(String(messages[0].content), /proposal p1/);
  assert.match(String(messages[0].content), /Engage the Latch: completed/);
  assert.equal(sent.some(event => event.type === 'reply.create' || event.type === 'tool.result'), false);
  assert.equal(cancellations, 0); assert.deepEqual(captions, []);
  await live.stop(); assert.equal(live.endAcknowledged, true);
  assert.equal(live.sendGameEvent('event2', 'p2', 'Engage the Latch: declined.'), false);
});

test('Practice proposes physical work and ordinary consent never becomes a confirmation channel', () => {
  assert.equal(simulationReply('Please engage the Latch.').call?.name, 'propose_interaction');
  assert.equal(simulationReply('Please cross to the far side.').call?.name, 'propose_move');
  for (const text of ['yes', 'go ahead', 'My diagram says the Door and Conveyor share one Power supply.']) {
    assert.equal(simulationReply(text).call, undefined);
  }
  assert.equal(simulationReply('Please inspect the Latch.').call?.name, 'inspect_object');
  assert.deepEqual(simulationReply('Please check the proposal status.', { chapter: 'cargo', gates: [], proposalId: 'known-proposal' }).call?.arguments, { proposal_id: 'known-proposal' });
});
