import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HumanView, ToolResult } from '../game/shared/contracts';
import { switchyardCaptionContext } from '../game/client/useMission';
import { rememberPracticeReport, switchyardIntentChoices, simulationReply, type PracticeMemory } from '../game/client/mock';

const view = (): HumanView => ({ sessionId: 'session-one', roundId: 'round-one', chapter: 'switchyard', chapterEpoch: 0,
  missionKind: 'switchyard', scenario: 'classic', status: 'active', revision: 4, actionEpoch: 1, powerOn: true,
  completed: false, chaptersCleared: [], switchyardPanel: { panelRevision: 2, appliedRotations: [0, 0, 1, 0, 0, 0], poweredTerminals: [] } });
const result = (): ToolResult => ({ ok: true, message: 'Lift Station. Lift console plate reads Crescent. Set index one. Test the lift. Return to Transfer Table.',
  switchyardObservation: { visitId: 'visited-lift', stateRevision: 4, location: { id: 'lift_station', label: 'Lift Station' },
    devices: [{ id: 'switchyard.lift', label: 'Lift console', actions: [{ action: 'set_index_one', label: 'Set index one' }, { action: 'test_lift', label: 'Test the lift' }] }],
    exits: [{ target: 'switchyard.to_transfer', label: 'Return to Transfer Table' }] } });

test('communicated Practice report context preserves its original visit and panel/state revisions', () => {
  const current = view(); const reading = result();
  const context = switchyardCaptionContext(reading, current, 'practice', reading.message);
  assert.deepEqual(context, { visitId: 'visited-lift', stateRevision: 4, panelRevision: 2, locationLabel: 'Lift Station' });
  current.revision += 1; current.switchyardPanel!.panelRevision += 1;
  assert.equal(context!.stateRevision, 4); assert.equal(context!.panelRevision, 2);
  assert.equal(switchyardCaptionContext(reading, current, 'practice', reading.message), undefined, 'A delayed old report is not assigned fresh context after Apply.');
});

test('uncommunicated, historical, failed and raw provider results cannot acquire local caption provenance', () => {
  const current = view(); const reading = result();
  for (const origin of ['live_voice', 'live_text', 'game'] as const) assert.equal(switchyardCaptionContext(reading, current, origin, reading.message), undefined);
  assert.equal(switchyardCaptionContext(reading, current, 'practice', 'I propose: Test the lift.'), undefined);
  assert.equal(switchyardCaptionContext(reading, current, 'practice', `Historical local report. ${reading.message}`), undefined);
  assert.equal(switchyardCaptionContext({ ...reading, ok: false }, current, 'practice', reading.message), undefined);
  assert.equal(switchyardCaptionContext({ ok: true, message: reading.message }, current, 'practice', reading.message), undefined);
  assert.equal(switchyardCaptionContext(reading, { ...current, status: 'stopped' }, 'practice', reading.message), undefined);
  assert.equal(switchyardCaptionContext(reading, { ...current, chapter: 'cargo' }, 'practice', reading.message), undefined);
});

test('retained local intent knowledge does not acquire readiness or auto-confirm an operation', () => {
  const memory = rememberPracticeReport({ chapter: 'switchyard', gates: [] } as PracticeMemory, result(), 'switchyard');
  const original = structuredClone(memory.switchyard!.observation);
  const choice = switchyardIntentChoices(memory).find(item => item.label === 'Test the lift')!;
  assert(choice);
  const reply = simulationReply(choice.request, memory);
  assert.equal(reply.call?.name, 'propose_interaction');
  assert.deepEqual(reply.call?.arguments, { object: 'switchyard.lift', action: 'test_lift' });
  assert.deepEqual(memory.switchyard!.observation, original);
  assert.equal(memory.switchyard!.observation!.stateRevision, 4);
  assert.doesNotMatch(JSON.stringify(memory.switchyard!.observation), /powered|ready|panel|rotation|configuration/);
  assert.match(simulationReply('Please repeat your last report, noting if it may be out of date.', memory).message, /^Earlier local report, not a current reading:/);
});
