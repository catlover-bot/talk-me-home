import assert from 'node:assert/strict';
import { test } from 'node:test';
import { communicatedEmblem, communicatedPassability } from '../scripts/qa-player-policy.mjs';

const visibleMapLabels = ['Ring', 'Fork', 'Sail', 'Leaf', 'Dock'];

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
  for (const text of ['The gate is open.', "I can't tell whether it is blocked.", 'The opening might be clear.', 'This gate is clear; another gate is blocked.', 'It is not unobstructed.']) assert.equal(communicatedPassability(text), null, text);
  // Actual canary reply: an open Door is not an inspected Gallery passage.
  const canary = 'I am on a safe platform and can reach a latch lever and the conveyor. The door is open, but I can see a far side platform across the gap. Should I inspect the latch lever first?';
  assert.equal(communicatedPassability(canary), null);
  assert.equal(communicatedEmblem(canary, visibleMapLabels), null);
});
