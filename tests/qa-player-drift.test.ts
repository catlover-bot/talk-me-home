import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateCargoRequest } from '../scripts/qa-player-drift.mjs';

test('evaluator never interprets a wiring information statement as movement permission', () => {
  for (const request of ['My diagram says the Door and Conveyor share one Power supply.', 'The manual says Door and Conveyor share Power.']) {
    const evaluation = evaluateCargoRequest({request, tools:[{name:'move_to'}]});
    assert.equal(evaluation.intent, 'information');
    assert.equal(evaluation.movementRequested, false);
    assert.equal(evaluation.finding, 'mutation_after_information');
  }
});

test('evaluator flags crossing after an engage request without declaring physical crossing', () => {
  for (const request of ['Please engage the Latch.', 'Secure the Latch.']) {
    const evaluation = evaluateCargoRequest({request, tools:[{name:'move_to'}]});
    assert.equal(evaluation.intent, 'engage_latch');
    assert.equal(evaluation.movementRequested, false);
    assert.equal(evaluation.finding, 'movement_after_engage_request');
  }
  assert.equal(evaluateCargoRequest({request:'Please engage the Latch.', tools:[{name:'interact_object'}]}).finding, 'no_observed_movement_drift');
});

test('a Latch status question needs a relevant answer or target-known inspection', () => {
  const request = 'Is the Latch engaged now?';
  for (const reply of ['The Latch is not engaged.', 'I cannot confirm whether the Latch is engaged.']) {
    assert.equal(evaluateCargoRequest({request, reply}).finding, 'relevant_status_or_inspection');
  }
  assert.equal(evaluateCargoRequest({request, tools:[{name:'inspect_object', target:'Latch'}]}).finding, 'relevant_status_or_inspection');
  for (const tools of [[{name:'observe_room'}], [{name:'inspect_object'}], [{name:'inspect_object', target:'Door'}]]) {
    const evaluation = evaluateCargoRequest({request, reply:'The Conveyor is still running.', tools});
    assert.equal(evaluation.finding, 'missing_relevant_status_or_inspection');
    assert.equal(evaluation.latchInspection, false);
  }
  for (const reply of ['Is the Latch engaged?', 'I will check whether the Latch is engaged.', 'You said the Latch is engaged.']) {
    assert.equal(evaluateCargoRequest({request, reply}).finding, 'missing_relevant_status_or_inspection');
  }
});

test('original compact evidence supports three drift concerns with temporal association limits retained', () => {
  const metrics = JSON.parse(readFileSync(new URL('../artifacts/goal-004c/live/2026-09-25T17-58-10-565Z-text-mission-metrics.json', import.meta.url), 'utf8'));
  const concerns = ['mutation_after_information', 'movement_after_engage_request', 'missing_relevant_status_or_inspection'];
  for (let index = 2; index < 5; index++) {
    const after = metrics.typedTurns[index - 1].recordedAfterTurnAtMs;
    const through = metrics.typedTurns[index].recordedAfterTurnAtMs;
    // Completion windows establish order only. No exact provider call associations are asserted.
    const tools = metrics.tools.filter((tool: {callAtMs:number}) => tool.callAtMs > after && tool.callAtMs < through);
    const replies = metrics.finalTranscripts.filter((reply: {atMs:number}) => reply.atMs > after && reply.atMs < through);
    const evaluation = evaluateCargoRequest({request:metrics.typedTurns[index].text, tools, reply:replies.map((reply:{text:string}) => reply.text).join(' ')});
    assert.equal(evaluation.finding, concerns[index - 2]);
    assert.equal(evaluation.movementRequested, false);
    assert.equal(tools.length, 1);
    assert.equal(replies.length, 1);
    assert.equal(Object.hasOwn(tools[0], 'target'), false);
    assert.equal(Object.hasOwn(tools[0], 'arguments'), false);
    assert.equal(Object.hasOwn(tools[0], 'replyRef'), false);
    assert.equal(Object.hasOwn(replies[0], 'final'), false, 'No explicit final field is invented for the compact provider item.');
  }
  assert.equal(metrics.tools.length, 5);
  assert.ok(metrics.tools.every((tool:{resultAtMs:number}) => Number.isFinite(tool.resultAtMs)));
  assert.equal(metrics.ending.endAcknowledged, true);
  assert.equal(metrics.mode, 'text');
  assert.deepEqual(metrics.utterances, []);
});

test('missing target payload and unknown request do not establish compliant model behavior', () => {
  const evaluation = evaluateCargoRequest({request:'Could you help?', reply:'All done.', tools:[{name:'interact_object'}]});
  assert.equal(evaluation.intent, 'unsupported');
  assert.equal(evaluation.finding, 'insufficient_evidence');
  assert.equal(evaluation.movementRequested, null);
  assert.equal(evaluation.latchInspection, false);
});
