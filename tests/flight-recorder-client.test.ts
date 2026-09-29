import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, executeTool, type RobotToolContext } from '../game/client/api.ts';
import { rememberLocalResult, simulationReply, simulationSpeech, type PracticeMemory } from '../game/client/mock.ts';
import type { RobotLocalPerception } from '../game/shared/contracts.ts';

const perception = (visitId: string): RobotLocalPerception => ({ origin: 'local_survey', roundId: 'round', chapter: 'gallery', chapterEpoch: 1,
  visitId, observationRevision: 1, stateRevision: 1, actionEpoch: 1, observedAt: 10, emblem: 'Leaf', compass: 'north',
  gates: [{ handle: 'gallery.g4', direction: 'Northwest', power: 'powered', door: 'open', passage: 'unchecked' }] });

test('Practice learns a recorder only from a current local result, and information does not propose pickup', () => {
  const empty: PracticeMemory = { chapter: 'gallery', gates: [] };
  assert.equal(simulationReply('Pick up the flight recorder', empty).call, undefined);
  const observed = rememberLocalResult(empty, 'A small flight recorder (flight_recorder) rests within reach.', 'gallery', perception('first'));
  assert.equal(simulationReply('The flight recorder could be useful.', observed).call, undefined);
  assert.equal(simulationReply('Should we pick up the flight recorder?', observed).call, undefined);
  assert.equal(simulationReply('Do not pick up the flight recorder.', observed).cancel, true);
  assert.deepEqual(simulationReply('Inspect the flight recorder', observed).call?.arguments, { object: 'flight_recorder' });
  assert.deepEqual(simulationReply('Please pick up the flight recorder.', observed).call?.arguments, { object: 'flight_recorder', action: 'pick_up' });
  assert.equal(simulationReply('Pick up the flight recorder', observed).call?.name, 'propose_interaction');
  const same = rememberLocalResult(observed, 'The northwest passage is clear.', 'gallery', perception('first'));
  assert.equal(same.recorder, 'observed');
  const changed = rememberLocalResult(same, 'You reached another safe room.', 'gallery', { ...perception('second'), emblem: 'Fork' });
  assert.equal(changed.recorder, undefined);
  assert.equal(simulationReply('Pick up the flight recorder', changed).call, undefined);
  const secured = rememberLocalResult(observed, 'You secured the flight recorder in your carrying pouch. The cradle is empty.', 'gallery', null);
  assert.equal(secured.recorder, 'secured');
  assert.equal(simulationReply('Pick up the flight recorder', secured).call, undefined);
  const dock = rememberLocalResult(secured, 'You arrived at the return platform.', 'return_dock', null);
  assert.equal(dock.recorder, 'secured');
  assert.match(simulationReply('Do you still have the flight recorder?', dock).message, /have the flight recorder secured/);
  assert.equal(rememberLocalResult(observed, 'You arrived at the return platform.', 'return_dock', null).recorder, undefined);
  assert.doesNotMatch(simulationSpeech('A flight recorder (flight_recorder). The local interaction is pick_up on flight_recorder; a pickup needs Mission Control\'s exact confirmation.'), /flight_recorder|pick_up/);
});

test('recorder request-time visit travels outside model arguments for reads and proposals', async t => {
  const envelopes: Record<string, unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    envelopes.push(JSON.parse(String(init.body))); return Response.json({ ok: true });
  });
  const context = { sessionId: 'session', roundId: 'round', chapterEpoch: 1, actionEpoch: 4, inspectionScope: { visitId: 'captured' } } as RobotToolContext;
  for (const name of ['inspect_object', 'propose_interaction', 'interact_object']) {
    const args = { object: 'flight_recorder', ...(name !== 'inspect_object' ? { action: 'pick_up' } : {}) };
    await executeTool(context, { callId: name, name, arguments: args });
    assert.deepEqual(envelopes.at(-1)?.inspectionScope, { visitId: 'captured' });
    assert.deepEqual(envelopes.at(-1)?.arguments, args);
  }
  await executeTool(context, { callId: 'ordinary', name: 'inspect_object', arguments: { object: 'latch' } });
  assert.equal(Object.hasOwn(envelopes.at(-1)!, 'inspectionScope'), false);
});

test('session creation selects the modifier explicitly and preserves the original off payload', async t => {
  const bodies: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body))); return Response.json({});
  });
  await createSession('classic', 'rescue');
  await createSession('classic', 'rescue', 'flight_recorder');
  await createSession('maintenance', 'training');
  assert.deepEqual(bodies, [{ scenario: 'classic', missionKind: 'rescue' },
    { scenario: 'classic', missionKind: 'rescue', optionalObjective: 'flight_recorder' }, { scenario: 'maintenance', missionKind: 'training' }]);
});
