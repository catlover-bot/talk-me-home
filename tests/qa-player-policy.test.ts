import assert from 'node:assert/strict';
import { test } from 'node:test';
import { communicatedEmblem, communicatedPassability, crossCargoWithRecovery, communicatedAction, confirmedAction } from '../scripts/qa-player-policy.mjs';

const visibleMapLabels = ['Ring', 'Fork', 'Sail', 'Leaf', 'Dock'];

test('observed canceled Cargo scan allows a bounded clarification and retry, never a repeated crossing after a checkpoint', async () => {
  for (const successAt of [1, 2, 3, Infinity]) {
    const spoken: string[] = [];
    const result = await crossCargoWithRecovery({
      say: async text => { spoken.push(text); return 'The Door is held open and the Conveyor has stopped.'; },
      atGallery: async () => spoken.length >= successAt,
    });
    assert.equal(result, successAt !== Infinity);
    assert.equal(spoken.length, Math.min(successAt, 3));
    if (spoken.length > 1) assert.match(spoken[1]!, /look around/);
    if (spoken.length > 2) assert.match(spoken[2]!, /if the route is clear/);
  }
});

test('canceled Cargo observations and ambiguous commit outcomes never justify guessed retries', async () => {
  const spoken: string[] = [];
  assert.equal(await crossCargoWithRecovery({ say: async text => { spoken.push(text); return 'The scan was canceled. I will try again.'; }, atGallery: async () => false }), false);
  assert.equal(spoken.length, 2);
  spoken.length = 0;
  assert.equal(await crossCargoWithRecovery({ say: async text => { spoken.push(text); return ''; }, atGallery: async () => true }), true);
  assert.equal(spoken.length, 0);
});

test('action oracle rejects negation, future intentions, and cancellation as completion', () => {
  for (const text of ['The Latch is engaged.', 'I have engaged the Latch.', "I've secured the Latch.", 'Latch engaged.', 'Engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), 'done', text);
  for (const text of ['The Latch is not engaged.', "I haven't engaged the Latch.", 'I have not yet engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), 'not_done', text);
  for (const text of ['I will try to engage the Latch.', 'I could say the Latch is engaged.', 'I cannot confirm the Latch is engaged.', 'The scan was canceled; the lever may be broken.', 'I secured the Door.', 'I think the Latch is engaged.', 'Earlier I engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), null, text);
  assert.equal(communicatedAction("I'm holding the contact.", 'contact'), 'done');
  assert.equal(communicatedAction("I'm not holding the contact.", 'contact'), 'not_done');
  assert.equal(communicatedAction('I will be holding the contact.', 'contact'), null);
  assert.equal(communicatedAction('Contact held.', 'contact'), 'done');
  assert.equal(communicatedAction('Holding the contact steady.', 'contact'), 'done');
});

test('physical steps allow one clarification and one justified retry, checking public checkpoints before repeats', async () => {
  for (const clarified of ['The Latch is not engaged.', 'I cannot confirm the Latch is engaged.']) {
    const requests: string[] = []; const responses = ['I will try.', clarified, 'The Latch is engaged.'];
    const result = await confirmedAction({ say: async text => { requests.push(text); return responses.shift()!; }, request: 'engage', clarify: 'status', retry: 'set', action: 'latch' });
    assert.equal(result, clarified === 'The Latch is not engaged.');
    assert.equal(requests.length, result ? 3 : 2);
  }
  let calls = 0;
  assert.equal(await confirmedAction({ say: async () => { calls++; return 'Canceled delivery.'; }, request: 'engage', clarify: 'status', retry: 'set', action: 'latch', checkpoint: async () => calls === 1 }), true);
  assert.equal(calls, 1);
});

test('QA player recognizes communicated current emblems, including a short clarification', () => {
  for (const [text, room] of [
    ['Ring.', 'ring'], ["It's a Fork.", 'fork'], ['The emblem is a leaf.', 'leaf'],
    ['A leaf.', 'leaf'], ['It looks like a fork.', 'fork'],
    ['I am in a safe room with the Fork emblem. West gate is open.', 'fork'],
    ['I passed through the gate and reached Sail.', 'sail'],
    ['The current emblem is Dock.', 'dock'],
  ]) assert.equal(communicatedEmblem(text!, visibleMapLabels), room);
  assert.equal(communicatedEmblem('The unfamiliar Star emblem is here.', visibleMapLabels), null);
  assert.equal(communicatedEmblem('I could reach the Sail emblem or the Leaf emblem.', visibleMapLabels), null);
  assert.equal(communicatedEmblem('I was by the Ring emblem. Now at Fork.', visibleMapLabels), 'fork');
  assert.equal(communicatedEmblem('Ring emblem and Fork emblem.', visibleMapLabels), null);
  assert.equal(communicatedEmblem('I am not at Fork.', visibleMapLabels), null);
});

test('QA player separates open gates from physically clear openings and handles explicit negation', () => {
  for (const text of ['The gate is open, but the opening is blocked.', 'Cargo blocks the opening.', 'The gate is obstructed.', 'Debris is blocking it.']) assert.equal(communicatedPassability(text), 'blocked', text);
  for (const text of ['The opening is clear.', 'No cargo blocks it.', "It isn't blocked.", 'There is no obstruction.', 'It is unobstructed.', 'Nothing is blocking the gate.']) assert.equal(communicatedPassability(text), 'clear', text);
  for (const text of ['The gate is open.', "I can't tell whether it is blocked.", 'The opening might be clear.', 'This gate is clear; another gate is blocked.', 'It is not unobstructed.', 'I will check whether the gate is clear.', 'The scan was canceled. The opening is clear.']) assert.equal(communicatedPassability(text), null, text);
  // Actual canary reply: an open Door is not an inspected Gallery passage.
  const canary = 'I am on a safe platform and can reach a latch lever and the conveyor. The door is open, but I can see a far side platform across the gap. Should I inspect the latch lever first?';
  assert.equal(communicatedPassability(canary), null);
  assert.equal(communicatedEmblem(canary, visibleMapLabels), null);
});
