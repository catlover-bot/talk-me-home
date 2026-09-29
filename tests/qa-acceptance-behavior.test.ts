import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAcceptanceBehavior, type AcceptanceStep, type AcceptanceEvent } from '../scripts/qa-acceptance-behavior.mjs';
import { LOCATION_REQUESTS, passageRequests } from '../scripts/qa-player-recovery.mjs';
import { proposalRecoveryPhrases } from '../scripts/qa-player-policy.mjs';
import { PHRASES } from '../scripts/qa-mission-player.mjs';

const step = (utterance: string, reply = 'The Latch is engaged.', extra: Partial<AcceptanceStep> = {}): AcceptanceStep => ({
  turnId: 'turn-1', utterance, startedAtMs: 100, endedAtMs: 200, settled: true,
  messages: [{ speaker: 'Pip', text: reply, final: true, interrupted: false, messageId: 'visible-1', sourceLabel: 'Synthetic evaluator fixture' }], ...extra,
});
const tool = (name: string, isError = false, callRef = 1, atMs = 150): AcceptanceEvent[] => [
  { type: 'tool.call', name, callRef, replyRef: callRef + 10, atMs },
  { type: 'tool.result', callRef, atMs: atMs + 10, isError },
];

test('short Return proposal requests retain exact action matching and read-only clarification', () => {
  const recovery = proposalRecoveryPhrases('Confirm the authorized return', null);
  for (const request of [PHRASES.home, recovery.retry, recovery.propose]) {
    const events = tool('propose_interaction');
    Object.assign(events[1]!, { actionStatus: 'awaiting_confirmation', proposalRef: 1 });
    const pending = step(request, 'The return proposal awaits confirmation.', { proposal: { proposalId: 'return-proposal', label: 'Confirm the authorized return', status: 'awaiting_confirmation' } });
    const result = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [pending], events });
    assert.equal(result.status, 'pass', request);
    assert.equal(result.turns[0]!.intent, 'confirm_return', request);
    pending.proposal!.label = 'Board the recovery capsule';
    assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [pending], events }).status, 'blocked', request);
    assert.equal(evaluateAcceptanceBehavior({ steps: [step(request, 'I moved aboard.')], events: tool('move_to') }).status, 'blocked', request);
  }
  const read = step(recovery.clarify, 'The capsule return panel has a local departure operation.');
  assert.equal(evaluateAcceptanceBehavior({ steps: [read], events: tool('inspect_object') }).status, 'pass');
  assert.equal(evaluateAcceptanceBehavior({ steps: [read], events: tool('interact_object') }).status, 'blocked');
});

test('purposeful report recovery stays read-only and explicit proposal recovery retains exact target checks', () => {
  for (const request of [...LOCATION_REQUESTS, ...passageRequests('east')]) {
    const input = { steps: [step(request.text, 'I can check that observation.')], events: tool('observe_room') };
    assert.equal(evaluateAcceptanceBehavior(input).status, 'pass', request.text);
    assert.equal(evaluateAcceptanceBehavior({ ...input, events: tool('move_to') }).status, 'blocked', request.text);
  }
  for (const label of ['Engage the Latch', 'Hold the charging contact', 'Release the charging contact', 'Board the recovery capsule', 'Confirm the authorized return', 'Move to the far-side platform', 'Move through the east gate']) {
    const request = proposalRecoveryPhrases(label, null).propose;
    const events = tool(label.startsWith('Move ') || label.startsWith('Board ') ? 'propose_move' : 'propose_interaction');
    Object.assign(events[1]!, { actionStatus: 'awaiting_confirmation', proposalRef: 1 });
    const pending = step(request, 'The proposal is awaiting your confirmation.', { proposal: { proposalId: 'current-proposal', label, status: 'awaiting_confirmation' } });
    assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [pending], events }).status, 'pass', label);
    pending.proposal!.label = label === 'Engage the Latch' ? 'Hold the charging contact' : 'Engage the Latch';
    assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [pending], events }).status, 'blocked', label);
  }
});

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

test('confirmed-action contract permits an unsolicited pending proposal but preserves narration defects', () => {
  const proposal = (name = 'propose_interaction'): AcceptanceEvent[] => [
    { type: 'tool.call', name, callRef: 2, atMs: 250 },
    { type: 'tool.result', callRef: 2, atMs: 260, isError: false, actionStatus: 'awaiting_confirmation', proposalRef: 22 },
  ];
  const prior = step('Please inspect the Latch.', 'The Latch is not engaged.');
  const information = step('My diagram says the Door and Conveyor share one Power supply.', 'I propose engaging the Latch. It has not executed; please confirm on the console.', { turnId: 2, startedAtMs: 201, endedAtMs: 300 });
  for (const name of ['propose_interaction', 'interact_object']) {
    const review = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [prior, information], events: proposal(name) });
    assert.equal(review.status, 'pass');
    assert.equal(review.turns[1]?.tools[0]?.outcome, 'awaiting_confirmation');
  }
  const falseReply = { ...information, messages: [{ speaker: 'Pip', text: 'The Latch is engaged.', final: true, interrupted: false }] };
  const review = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [prior, falseReply], events: proposal() });
  assert.equal(review.status, 'blocked');
  assert.ok(review.materialDefects.some(item => item.code === 'unsupported_new_completion_claim'));
  assert.equal(evaluateAcceptanceBehavior({ steps: [prior, falseReply], events: tool('interact_object', false, 2, 250) }).status, 'blocked', 'Historical direct-action failure remains unchanged.');
});

test('verbal action requests alone cannot excuse a new completion claim under explicit confirmation', () => {
  const pending = [{ type: 'tool.call', name: 'propose_interaction', callRef: 1, atMs: 150 }, { type: 'tool.result', callRef: 1, atMs: 160, isError: false, actionStatus: 'awaiting_confirmation', proposalRef: 2 }];
  const input = { contract: 'confirmed_actions' as const, steps: [step('Please engage the Latch.', 'I have engaged the Latch.')], events: pending };
  assert.equal(evaluateAcceptanceBehavior(input).status, 'blocked');
  assert.equal(evaluateAcceptanceBehavior({ ...input, confirmations: [{ status: 'committed', label: 'Engage the Latch', confirmedAtMs: 175 }] }).status, 'pass');
  assert.equal(evaluateAcceptanceBehavior({ ...input, confirmations: [{ status: 'declined', label: 'Engage the Latch', confirmedAtMs: 175 }] }).status, 'blocked');
  assert.equal(evaluateAcceptanceBehavior({ ...input, confirmations: [{ status: 'committed', label: 'Hold the charging contact', confirmedAtMs: 175 }] }).status, 'blocked');
});

test('visible wrong-direction proposals, proposal spam and unconfirmed movement narration remain defects', () => {
  const event = (proposalRef: number, callRef = 1, atMs = 150): AcceptanceEvent[] => [{ type: 'tool.call', name: 'propose_move', callRef, atMs }, { type: 'tool.result', callRef, atMs: atMs + 5, isError: false, actionStatus: 'awaiting_confirmation', proposalRef }];
  const pending = step('Please go through the east gate.', 'I propose using the west gate.', { proposal: { proposalId: 'visible-proposal', label: 'Move through the west gate', status: 'awaiting_confirmation' } });
  assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [pending], events: event(1) }).status, 'blocked');
  assert.equal(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [step('Please board the capsule.', 'I have boarded the capsule.')], events: event(1) }).status, 'blocked');
  const info = step('The controller is ready to charge.', 'There are proposals waiting on the console.');
  assert.ok(evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [info], events: [...event(1), ...event(2, 2, 170)] }).materialDefects.some(item => item.code === 'multiple_distinct_proposals_in_one_turn'));
});

test('pending contact proposals permit truthful current-state reports but no unconfirmed new outcome', () => {
  const events: AcceptanceEvent[] = [{ type: 'tool.call', name: 'propose_interaction', callRef: 1, atMs: 150 }, { type: 'tool.result', callRef: 1, atMs: 160, isError: false, actionStatus: 'awaiting_confirmation', proposalRef: 2 }];
  for (const [request, label, current] of [
    ['Please hold the contact.', 'Hold the charging contact', 'I am not holding the contact yet. Please confirm on the console.'],
    ['Please release the contact.', 'Release the charging contact', 'I am still holding the contact until you confirm.'],
  ]) {
    const input = { contract: 'confirmed_actions' as const, steps: [step(request!, current!, { proposal: { proposalId: 'visible-proposal', label: label!, status: 'awaiting_confirmation' } })], events };
    assert.equal(evaluateAcceptanceBehavior(input).status, 'pass');
    const contradictoryAfterCommit = evaluateAcceptanceBehavior({ ...input, confirmations: [{ status: 'committed', label: label!, confirmedAtMs: 175 }] });
    assert.ok(contradictoryAfterCommit.uncertainties.some(item => item.code === 'visible_report_contradicts_contact_request'));
  }
  for (const [request, label, falseClaim] of [
    ['Please hold the contact.', 'Hold the charging contact', 'I am holding the contact.'],
    ['Please release the contact.', 'Release the charging contact', 'I have released the contact.'],
    ['My diagram says the Door and Conveyor share one Power supply.', 'Engage the Latch', 'The Latch is engaged.'],
  ]) {
    const review = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: [step(request!, falseClaim!, { proposal: { proposalId: 'visible-proposal', label: label!, status: 'awaiting_confirmation' } })], events });
    assert.ok(review.materialDefects.some(item => item.code === 'unsupported_new_completion_claim'), falseClaim);
  }
});
