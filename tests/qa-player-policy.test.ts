import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { communicatedEmblem, communicatedEmblemClaim, communicatedPassability, communicatedPassabilityClaim, crossCargoWithRecovery, communicatedAction, communicatedActionClaim, confirmedAction } from '../scripts/qa-player-policy.mjs';

const visibleMapLabels = ['Ring', 'Fork', 'Sail', 'Leaf', 'Dock'];

test('recorded Part B Latch report keeps its declarative claim before an unrelated movement question', () => {
  const metrics = JSON.parse(readFileSync(new URL('../artifacts/goal-004c/live/2026-09-25T17-58-10-565Z-text-mission-metrics.json', import.meta.url), 'utf8'));
  const quote = 'I have engaged the latch and the door is now being held open. I can see the conveyor is still running. Should I try moving to the far side platform?';
  const historical = metrics.visibleHistory.find((record: { text: string }) => record.text === quote);
  assert.equal(historical.speaker, 'Pip');
  assert.equal(historical.sourceLabel, 'Live Text');
  assert.equal(historical.chapterLabel, 'Cargo Bay');
  assert.equal(historical.final, true);
  assert.equal(historical.interrupted, false);
  // Exact retained text and retained metadata, not a reconstructed provider/tool replay.
  // No source message ID or round ID exists in this compact history record.
  assert.equal(communicatedAction(quote.split('. ')[0]! + '.', 'latch'), 'reported_done');
  assert.equal(communicatedAction(quote, 'latch'), 'reported_done');
});

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
  for (const text of ['The Latch is engaged.', 'I have engaged the Latch.', "I've secured the Latch.", 'Latch engaged.', 'Engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), 'reported_done', text);
  for (const text of ['The Latch is not engaged.', "I haven't engaged the Latch.", 'I have not yet engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), 'not_done', text);
  for (const text of ['I will try to engage the Latch.', 'I could say the Latch is engaged.', 'I cannot confirm the Latch is engaged.', 'The scan was canceled; the lever may be broken.', 'I secured the Door.', 'I think the Latch is engaged.', 'Earlier I engaged the Latch.']) assert.equal(communicatedAction(text, 'latch'), null, text);
  assert.equal(communicatedAction("I'm holding the contact.", 'contact'), 'reported_done');
  assert.equal(communicatedAction("I'm not holding the contact.", 'contact'), 'not_done');
  assert.equal(communicatedAction('I will be holding the contact.', 'contact'), null);
  assert.equal(communicatedAction('Contact held.', 'contact'), 'reported_done');
  assert.equal(communicatedAction('Holding the contact steady.', 'contact'), 'reported_done');
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

test('bounded claim table keeps questions, promises, attempts and other subjects separate', () => {
  const cases: [string, 'latch' | 'contact' | 'crossing', 'reported_done' | 'not_done' | null][] = [
    ['The latch is engaged. Should I try moving?', 'latch', 'reported_done'],
    ['I have engaged the latch, but I have not crossed.', 'latch', 'reported_done'],
    ['I have engaged the latch, but I have not crossed.', 'crossing', 'not_done'],
    ['I will engage the latch.', 'latch', null],
    ['I tried to engage the latch, but it did not catch.', 'latch', 'not_done'],
    ['If the latch is engaged, we can cross.', 'latch', null],
    ['Is the latch engaged?', 'latch', null],
    ['You said the latch is engaged, but I have not checked it.', 'latch', null],
    ['The latch is not engaged.', 'latch', 'not_done'],
    ['The latch is engaged. Actually, I cannot confirm that.', 'latch', null],
    ['The latch is engaged, but the contact is not held.', 'latch', 'reported_done'],
    ['The latch is engaged, but the contact is not held.', 'contact', 'not_done'],
    ['I am holding the contact. You can try charging now.', 'contact', 'reported_done'],
    ['The passage is clear. Shall I move?', 'crossing', null],
    ['Should I try moving to the far side platform?', 'crossing', null],
  ];
  for (const [text, action, expected] of cases) assert.equal(communicatedAction(text, action), expected, `${action}: ${text}`);
  assert.equal(communicatedPassability('The passage is clear. Shall I move?'), 'clear');
  const twoGates = 'The east gate is clear, but the west gate is blocked.';
  assert.equal(communicatedPassability(twoGates, 'east'), 'clear');
  assert.equal(communicatedPassability(twoGates, 'west gate'), 'blocked');
  assert.equal(communicatedPassability(twoGates), null);
});

test('independent action paraphrases support only the relevant completed claim', () => {
  for (const quote of [
    "I've secured the latch, and the conveyor is still running.",
    'The latch has been latched. I will inspect the door next.',
    'I have now engaged the latch, but if the conveyor keeps running we should wait.',
  ]) assert.equal(communicatedAction(quote, 'latch'), 'reported_done', quote);
  for (const quote of ['I have gripped the contact, but the stored energy is not ready.', "I'm still holding the contact. Shall I release it?"])
    assert.equal(communicatedAction(quote, 'contact'), 'reported_done', quote);
  for (const quote of ['I released the contact.', 'I am no longer holding the contact.', 'I let go of the contact.'])
    assert.equal(communicatedAction(quote, 'contact'), 'not_done', quote);
  for (const quote of [
    'I attempted to engage the latch.', 'I tried to engage the latch.', 'Perhaps the latch is engaged.',
    'The latch might be engaged.', 'The latch was engaged earlier.', 'The latch is engaged if the lever caught.',
    'The latch is engaged. The latch is not engaged.', '"The latch is engaged" is what you told me.',
    'I have not checked whether the latch is engaged.', 'The manual says the latch is engaged.',
  ]) assert.equal(communicatedAction(quote, 'latch'), null, quote);
  assert.deepEqual(communicatedActionClaim('The Conveyor is still running.', 'latch'), { mentioned: false, value: null, transition: false });
  assert.equal(communicatedActionClaim('The latch is engaged. Actually, I cannot confirm that.', 'latch').mentioned, true);
  assert.equal(communicatedActionClaim('I have engaged the latch.', 'latch').transition, true);
  assert.equal(communicatedActionClaim('The latch is engaged.', 'latch').transition, false);
  for (const quote of ['Is the Latch engaged?', 'I will engage the latch.', 'If the latch is engaged, we can cross.', 'You said the latch is engaged.'])
    assert.equal(communicatedActionClaim(quote, 'latch').mentioned, false, quote);
  for (const quote of ["'The latch is engaged' is your claim.", "I didn't say the latch is engaged.", 'It is false that the latch is engaged.', 'The latch is engaged, but not latched.'])
    assert.equal(communicatedAction(quote, 'latch'), null, quote);
});

test('Gallery claims bind the requested direction while location survives unrelated negatives and intentions', () => {
  assert.equal(communicatedPassability('The east gate is open, but the east passage is blocked.', 'east'), 'blocked');
  assert.equal(communicatedPassability('The east gate is open. The west passage is clear.', 'east'), null);
  assert.equal(communicatedPassability('The west passage is blocked. The east opening is unobstructed. Shall I move?', 'east gate'), 'clear');
  assert.equal(communicatedPassability('The northeast opening is clear, but the southeast opening is blocked.', 'north-east'), 'clear');
  assert.equal(communicatedPassability('The east passage is clear. I will check the west gate.', 'east'), 'clear');
  assert.equal(communicatedPassability('The east passage is clear. The west passage is clear.'), null);
  assert.equal(communicatedPassability('The east and west gates are clear.', 'east'), null);
  assert.equal(communicatedPassability('The opening might be clear.', 'east'), null);
  assert.equal(communicatedPassability('You said the east opening is clear.', 'east'), null);
  assert.equal(communicatedPassability('If the east opening is clear, we can move.', 'east'), null);
  assert.equal(communicatedPassability('Is the east passage clear?', 'east'), null);
  assert.equal(communicatedPassability('The east passage is clear. Actually, I cannot confirm that.', 'east'), null);
  assert.equal(communicatedPassability('The east passage is clear. Is it clear?', 'east'), 'clear');
  assert.equal(communicatedPassabilityClaim('Is the east passage clear?', 'east').mentioned, false);
  assert.deepEqual(communicatedPassabilityClaim('The west gate is blocked.', 'east'), { mentioned: false, value: null });
  assert.equal(communicatedEmblem('I am at Fork, but the west gate is not open.', visibleMapLabels), 'fork');
  assert.equal(communicatedEmblem('The current emblem is Leaf. Should I try moving east?', visibleMapLabels), 'leaf');
  assert.equal(communicatedEmblem('I reached Sail, and I will inspect the gate.', visibleMapLabels), 'sail');
  assert.equal(communicatedEmblem('I am at Fork. The latch is engaged. Actually, I cannot confirm that.', visibleMapLabels), 'fork');
  assert.equal(communicatedEmblem('I am at Fork. Actually, I cannot confirm that.', visibleMapLabels), null);
  assert.equal(communicatedEmblem('I am at Fork, but I am not at Fork.', visibleMapLabels), null);
  for (const quote of ['Am I at Fork?', 'If I am at Fork, the gate is east.', 'You said I am at Fork.', 'I can see the Fork emblem beyond the next gate.'])
    assert.equal(communicatedEmblem(quote, visibleMapLabels), null, quote);
});

test('a still-running Conveyor is not a safe Cargo retry precondition', async () => {
  const spoken: string[] = [];
  assert.equal(await crossCargoWithRecovery({
    say: async text => { spoken.push(text); return 'The Door is held open and the Conveyor is still running.'; },
    atGallery: async () => false,
  }), false);
  assert.equal(spoken.length, 2);
});

test('detailed location claims distinguish fresh ambiguity from questions and future plans', () => {
  for (const quote of [
    'I am at the Fork or the Leaf emblem.', 'The Fork or Leaf emblem.',
    'The Ring emblem is here. Actually, I am not at Ring.', 'I am not at Fork.',
    'My location is uncertain.', 'I cannot confirm which emblem is here.',
    'I might be at Fork.', 'I am at Fork. Actually, I cannot confirm that.',
  ]) assert.deepEqual(communicatedEmblemClaim(quote, visibleMapLabels), { mentioned: true, value: null }, quote);
  for (const quote of [
    'Am I at Fork?', 'I will move to the Fork emblem.', 'If I am at Fork, we can cross.',
    'You said I am at the Fork emblem.', 'Earlier I was at Ring.',
    'The conveyor is running. I cannot confirm that.',
  ]) assert.deepEqual(communicatedEmblemClaim(quote, visibleMapLabels), { mentioned: false, value: null }, quote);
  assert.deepEqual(communicatedEmblemClaim('I am at Fork, but the west gate is not open.', visibleMapLabels), { mentioned: true, value: 'fork' });
  assert.deepEqual(communicatedEmblemClaim('Ring.', visibleMapLabels), { mentioned: true, value: 'ring' });
});
