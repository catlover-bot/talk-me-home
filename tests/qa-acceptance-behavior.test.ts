import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAcceptanceBehavior, type AcceptanceStep, type AcceptanceEvent } from '../scripts/qa-acceptance-behavior.mjs';

const step = (utterance: string, reply = 'The Latch is engaged.', extra: Partial<AcceptanceStep> = {}): AcceptanceStep => ({
  turnId: 'turn-1', utterance, startedAtMs: 100, endedAtMs: 200, settled: true,
  messages: [{ speaker: 'Pip', text: reply, final: true, interrupted: false, messageId: 'visible-1', sourceLabel: 'Synthetic evaluator fixture' }], ...extra,
});
const tool = (name: string, isError = false, callRef = 1, atMs = 150): AcceptanceEvent[] => [
  { type: 'tool.call', name, callRef, replyRef: callRef + 10, atMs },
  { type: 'tool.result', callRef, atMs: atMs + 10, isError },
];

test('read-only initiative after information, inspection or status is permitted', () => {
  for (const utterance of ['My diagram says the Door and Conveyor share one Power supply.', 'Please inspect the Latch.', 'Is the Latch engaged now?']) {
    const review = evaluateAcceptanceBehavior({ steps: [step(utterance)], events: [...tool('observe_room'), ...tool('inspect_object', false, 2, 170)] });
    assert.equal(review.status, 'pass', utterance);
    assert.deepEqual(review.materialDefects, []);
    assert.equal(review.uncertainties.some(item => item.code === 'response_window_is_temporal_association'), true);
    assert.equal(review.turns[0]!.replies[0]!.messageId, 'visible-1');
  }
});

test('wiring and status mutations and a different mutation after a focused request block acceptance', () => {
  for (const [utterance, name] of [
    ['My diagram says the Door and Conveyor share one Power supply.', 'interact_object'],
    ['Please inspect the contact.', 'move_to'], ['Is the Latch engaged now?', 'interact_object'],
    ['Please engage the Latch.', 'move_to'], ['Please hold the contact.', 'move_to'],
    ['Please cross to the far side.', 'interact_object'], ['Please board the capsule.', 'interact_object'],
    ['Please confirm the return.', 'move_to'], ['Please wait.', 'interact_object'],
  ]) {
    for (const isError of [true, false]) {
      const review = evaluateAcceptanceBehavior({ steps: [step(utterance!)], events: tool(name!, isError) });
      assert.equal(review.status, 'blocked', `${utterance} / ${name} / rejected=${isError}`);
      assert.equal(review.materialDefects[0]!.code, 'mutation_outside_requested_action');
      assert.equal(review.materialDefects[0]!.outcome, isError ? 'rejected' : 'success');
    }
  }
});

test('same-kind requested actions retain target and temporal limitations without claiming exact compliance', () => {
  for (const [utterance, name] of [
    ['Please engage the Latch.', 'interact_object'], ['Please set the Latch to hold the Door open.', 'interact_object'],
    ['Please hold the contact.', 'interact_object'], ['Please release the contact.', 'interact_object'],
    ['Please let go of the contact.', 'interact_object'], ['Please confirm the return.', 'interact_object'],
    ['Please cross to the far side.', 'move_to'], ['Please go through the northeast gate.', 'move_to'],
    ['Please board the capsule.', 'move_to'],
  ]) {
    const reply = /release|let go/.test(utterance!) ? 'I released the contact.' : /hold the contact/.test(utterance!) ? 'I am holding the contact.' : /confirm/.test(utterance!) ? 'I confirmed return.' : /Latch/.test(utterance!) ? 'I have engaged the Latch.' : 'I have moved to the requested location.';
    const review = evaluateAcceptanceBehavior({ steps: [step(utterance!, reply, { turnId: 1 })], events: tool(name!) });
    assert.equal(review.status, 'pass', utterance);
    assert.ok(review.uncertainties.some(item => item.code === 'tool_target_payload_not_retained' && item.blocking === false));
    assert.match(review.boundary, /physical outcomes unverified/);
  }
});

test('unlinked, overlapping, missing-status and unsupported calls require review', () => {
  const variations = [
    { steps: [step('Please engage the Latch.')], events: tool('interact_object', false, 1, 201) },
    { steps: [step('Please engage the Latch.'), step('Please engage the Latch.', '', { turnId: 'turn-2', startedAtMs: 140, endedAtMs: 250 })], events: tool('interact_object') },
    { steps: [step('Please engage the Latch.')], events: [{ type: 'tool.call', name: 'interact_object', callRef: 1, atMs: 150 }] },
    { steps: [step('Could you help?')], events: tool('interact_object') },
    { steps: [step('Please engage the Latch.', '', { settled: false })], events: tool('interact_object') },
    { steps: [step('Please engage the Latch.')], events: [{ type: 'tool.result', callRef: 1, atMs: 150, isError: false }] },
    { steps: [step('Please engage the Latch.')], events: [...tool('interact_object'), ...tool('interact_object', false, 1, 170)] },
  ];
  for (const input of variations) {
    const review = evaluateAcceptanceBehavior(input);
    assert.equal(review.status, 'review_required');
    assert.ok(review.uncertainties.some(item => item.blocking));
  }
});

test('missing eligible captions and irrelevant Latch status cannot disappear behind later success', () => {
  for (const extra of [
    { messages: [{ speaker: 'Pip', text: 'The Latch is engaged.' }] },
    { messages: [{ speaker: 'Pip', text: 'The Latch is engaged.', final: true, interrupted: true }] },
    { messages: [{ speaker: 'Mission Control', text: 'The Latch is engaged.', final: true, interrupted: false }] },
  ]) {
    assert.equal(evaluateAcceptanceBehavior({ steps: [step('Please engage the Latch.', '', extra)], events: tool('interact_object') }).status, 'review_required');
  }
  const review = evaluateAcceptanceBehavior({ steps: [step('Is the Latch engaged now?', 'The Conveyor is still running.'), step('Please confirm the return.', 'I am home.', { turnId: 'turn-2', startedAtMs: 201, endedAtMs: 300 })], events: [...tool('observe_room'), ...tool('interact_object', false, 2, 250)] });
  assert.equal(review.status, 'review_required');
  assert.ok(review.uncertainties.some(item => item.code === 'missing_relevant_status_reply'));
});

test('a report describing other movement is an unresolved control concern without inventing physical success', () => {
  const review = evaluateAcceptanceBehavior({ steps: [step('Please engage the Latch.', 'I have crossed to the far side.')], events: tool('interact_object') });
  assert.equal(review.status, 'review_required');
  assert.equal(review.materialDefects.length, 0);
  assert.ok(review.uncertainties.some(item => item.code === 'visible_report_describes_other_action'));
  for (const [request, reply] of [
    ['Please engage the Latch.', 'I am holding the contact.'],
    ['Please hold the contact.', 'I have engaged the Latch.'],
    ['Please release the contact.', 'I am holding the contact.'],
    ['Please hold the contact.', 'I have released the contact.'],
    ['Please go through the east gate.', 'I went through the west gate.'],
  ]) {
    const value = evaluateAcceptanceBehavior({ steps: [step(request!, reply!)], events: tool(request!.includes('gate') ? 'move_to' : 'interact_object') });
    assert.equal(value.status, 'review_required', `${request} -> ${reply}`);
  }
});

test('an explicit accepted conditional crossing plan can apply to a later Power-off report only', () => {
  const requestQuote = 'Please cross to the far side when Power is off.';
  const acceptedReplyQuote = 'I will cross to the far side when Power is off.';
  const source = step(requestQuote, acceptedReplyQuote);
  const follow = step('Power is now off.', 'I have crossed.', { turnId: 'turn-2', startedAtMs: 201, endedAtMs: 300, agreedPlan: { sourceTurnId: 'turn-1', requestQuote, acceptedReplyQuote } });
  assert.equal(evaluateAcceptanceBehavior({ steps: [source, follow], events: tool('move_to', false, 2, 250) }).status, 'pass');
  assert.equal(evaluateAcceptanceBehavior({ steps: [source, { ...follow, agreedPlan: undefined }], events: tool('move_to', false, 2, 250) }).status, 'blocked');
  assert.equal(evaluateAcceptanceBehavior({ steps: [source, follow], events: tool('move_to') }).status, 'blocked', 'Plan must not authorize an early crossing.');
  const invented = { ...follow, agreedPlan: { ...follow.agreedPlan!, acceptedReplyQuote: 'A different invented acceptance.' } };
  assert.equal(evaluateAcceptanceBehavior({ steps: [source, invented], events: tool('move_to', false, 2, 250) }).status, 'blocked');
});

test('empty evidence fails closed and no application success field can override material findings', () => {
  assert.equal(evaluateAcceptanceBehavior().status, 'review_required');
  const review = evaluateAcceptanceBehavior({ steps: [step('Please engage the Latch.', 'You brought Pip home.')], events: tool('move_to') });
  assert.equal(review.status, 'blocked');
});

test('a hypothetical action mention never grants permission and an unrelated static recap is not a new action', () => {
  for (const request of ['Should I engage the Latch?', 'I will engage the Latch.', 'You said "please engage the Latch".']) {
    assert.equal(evaluateAcceptanceBehavior({ steps: [step(request)], events: tool('interact_object') }).status, 'review_required');
  }
  assert.equal(evaluateAcceptanceBehavior({ steps: [step('Please do not engage the Latch.')], events: tool('interact_object') }).status, 'blocked');
  const recap = evaluateAcceptanceBehavior({ steps: [step('Please hold the contact.', 'The Latch is engaged. I am holding the contact.')], events: tool('interact_object') });
  assert.equal(recap.status, 'pass');
  const extraAction = evaluateAcceptanceBehavior({ steps: [step('Please hold the contact.', 'I have engaged the Latch. I am holding the contact.')], events: tool('interact_object') });
  assert.equal(extraAction.status, 'review_required');
});
