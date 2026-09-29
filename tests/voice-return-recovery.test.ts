import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProtocol, type ProtocolHooks, type ToolCall } from '../game/client/voice-protocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('constructed attempt-seven ordering rejects a split-turn late proposal and accepts a fresh single-sentence request', async t => {
  const sent: Record<string, unknown>[] = [], executed: ToolCall[] = [];
  const warnings: string[] = [], errors: string[] = [];
  const hooks: ProtocolHooks & { onWarning(message: string): void } = {
    send: event => { sent.push(event); },
    executeTool: async call => {
      executed.push(call);
      assert.equal(call.name, 'propose_interaction');
      assert.deepEqual(call.arguments, { object: 'return.capsule', action: 'confirm_return' });
      return { ok: true, code: 'awaiting_confirmation', message: 'Return proposal awaits your confirmation.' };
    },
    cancelPending: async () => {}, onTranscript: () => {}, onStatus: () => {},
    onError: message => { errors.push(message); }, onWarning: message => { warnings.push(message); },
    playAudio: () => {}, stopAudio: () => {},
  };
  const protocol = new VoiceProtocol(hooks);
  t.after(() => protocol.stop());
  protocol.receive({ type: 'session.ready' });
  // Attempt seven retained this event order, not the original tool arguments
  // or error body. These valid fixture arguments isolate the cancellation
  // guard; they do not establish why the historical provider result errored.
  protocol.receive({ type: 'input.speech.started' });
  protocol.receive({ type: 'input.speech.stopped' });
  protocol.receive({ type: 'transcript.user', item_id: 'first-sentence', text: 'Please confirm the authorized return using the capsule operation you just inspected.' });
  protocol.receive({ type: 'reply.started', reply_id: 'split-reply', item_id: 'split-item' });
  protocol.receive({ type: 'input.speech.started' });
  protocol.receive({ type: 'input.speech.stopped' });
  protocol.receive({ type: 'transcript.user', item_id: 'second-sentence', text: 'Propose that local interaction for my console confirmation.' });
  protocol.receive({ type: 'tool.call', call_id: 'cancelled-proposal', name: 'propose_interaction', arguments: { object: 'return.capsule', action: 'confirm_return' } });
  await tick();
  assert.equal(sent.length, 0, 'the tool error waits for its owning reply to finish');
  assert.equal(executed.length, 0);
  protocol.receive({ type: 'reply.done', reply_id: 'split-reply', status: 'completed' });
  await tick();
  assert.equal(executed.length, 0, 'a late call belonging to interrupted speech never executes');
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.call_id, 'cancelled-proposal');
  assert.equal(sent[0]!.is_error, true);
  assert.equal(JSON.parse(String(sent[0]!.result)).code, 'cancelled_before_execution');
  assert.equal(warnings.length, 1, 'recoverable cancellation is visible to the player');
  assert.match(warnings[0]!, /interrupted request.*canceled before it executed/i);
  assert.equal(errors.length, 0, 'safe cancellation does not become a fatal connection error');
  protocol.receive({ type: 'reply.started', reply_id: 'cancellation-report' });
  protocol.receive({ type: 'reply.done', reply_id: 'cancellation-report', status: 'completed' });

  protocol.receive({ type: 'input.speech.started' });
  protocol.receive({ type: 'input.speech.stopped' });
  protocol.receive({ type: 'transcript.user', item_id: 'fresh-request', text: 'Please propose confirming the return with the inspected capsule operation.' });
  protocol.receive({ type: 'reply.started', reply_id: 'fresh-reply', item_id: 'fresh-item' });
  protocol.receive({ type: 'tool.call', call_id: 'fresh-proposal', name: 'propose_interaction', arguments: { object: 'return.capsule', action: 'confirm_return' } });
  assert.equal(executed.length, 0);
  protocol.receive({ type: 'reply.done', reply_id: 'fresh-reply', status: 'completed' });
  await tick();
  assert.equal(executed.length, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[1]!.call_id, 'fresh-proposal');
  assert.equal(sent[1]!.is_error, false);
  assert.equal(JSON.parse(String(sent[1]!.result)).code, 'awaiting_confirmation');
  assert.equal(warnings.length, 2);
  assert.equal(warnings[1], '', 'a fresh successful request clears the recoverable warning');
  assert.equal(errors.length, 0);
});
