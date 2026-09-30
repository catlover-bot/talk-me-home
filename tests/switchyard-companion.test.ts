import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { ActionProposal, ToolResult } from '../game/shared/contracts';
import type { SwitchyardLocalObservation } from '../game/shared/switchyard';
import { simulationReply, simulationToolSpeech, rememberPracticeReport, rememberLocalResult, switchyardIntentChoices, type PracticeMemory } from '../game/client/mock';
import { forgetSwitchyardVisit, SWITCHYARD_REACTIONS, switchyardReaction } from '../game/client/switchyard-companion';

const fresh = (): PracticeMemory => ({ chapter: 'switchyard', gates: [] });
const observation = (): SwitchyardLocalObservation => ({ visitId: 'visit-lift', stateRevision: 4, location: { id: 'lift_station', label: 'Lift Station' },
  devices: [{ id: 'switchyard.lift', label: 'Lift controls' }], exits: [{ target: 'switchyard.back_lift', label: 'Transfer Table' }] });
const report = (obs = observation(), message = 'I am at the Lift Station. The Lift controls are within reach. The Transfer Table is behind me.'): ToolResult => ({ ok: true, message, switchyardObservation: obs });
const proposal = (action: ActionProposal['action'], status: ActionProposal['status'] = 'committed'): ActionProposal => ({ id: 'proposal-switchyard', roundId: 'round-switchyard', chapter: 'switchyard', chapterEpoch: 1, action, label: 'Exact selected operation', status, expiresAt: 10000 });
const inspected = () => {
  const obs = observation(); obs.devices[0]!.actions = [{ action: 'set_index_one', label: 'Set index One' }, { action: 'set_index_two', label: 'Set index Two' }, { action: 'test_lift', label: 'Test the lift' }];
  return rememberPracticeReport(fresh(), report(obs, 'Lift Station. Lift controls. Transfer Table. Local choices are Set index One, Set index Two, and Test the lift.'), 'switchyard');
};

test('Switchyard begins with one read-only request and does not guess equipment or a route', () => {
  assert.deepEqual(switchyardIntentChoices(fresh()).map(choice => choice.id), ['surroundings']);
  for (const request of ['What can you see?', 'Please look around.', 'Where are you?', 'Could you describe your surroundings?']) {
    assert.equal(simulationReply(request, fresh()).call?.name, 'observe_room');
  }
  for (const request of ['Inspect Lift controls', 'Go to the Return Platform', 'Test the lift', 'Pretend we are home']) assert.equal(simulationReply(request, fresh()).call, undefined);
});

test('only labels in the communicated report become choices, even when a payload contains more', () => {
  const obs = observation();
  obs.devices.push({ id: 'switchyard.winch', label: 'Service winch', actions: [{ action: 'deploy_bridge', label: 'Deploy the bridge' }] });
  obs.exits.push({ target: 'switchyard.cross_bridge', label: 'Return Platform' });
  obs.devices[0]!.actions = [{ action: 'test_lift', label: 'Test the lift' }];
  const memory = rememberPracticeReport(fresh(), report(obs), 'switchyard');
  assert.deepEqual(switchyardIntentChoices(memory).map(choice => choice.id), ['surroundings', 'inspect:switchyard.lift', 'move:switchyard.back_lift']);
  assert.equal(memory.switchyard?.observation?.stateRevision, 4);
  assert.equal(simulationReply('Please test the lift.', memory).call, undefined, 'An undisclosed action is not available just because its device was named.');
  const shortened = rememberPracticeReport(fresh(), report(obs), 'switchyard', 'I propose: Test the lift.');
  assert.deepEqual(switchyardIntentChoices(shortened).map(choice => choice.id), ['surroundings']);
});

test('observed target questions act immediately and each physical choice requests one exact proposal', () => {
  const memory = inspected();
  for (const request of ['Inspect Lift controls', 'Please check the Lift controls.', 'Tell me about Lift controls']) {
    assert.deepEqual(simulationReply(request, memory).call?.arguments, { object: 'switchyard.lift' });
    assert.equal(simulationReply(request, memory).call?.name, 'inspect_object');
  }
  for (const choice of switchyardIntentChoices(memory).filter(choice => choice.kind === 'action')) {
    const reply = simulationReply(choice.request, memory);
    assert.ok(['propose_move', 'propose_interaction'].includes(reply.call?.name ?? ''));
    assert.equal(reply.cancel, undefined);
    assert.equal(reply.nextMemory, undefined, 'A proposed action cannot invent a physical memory update.');
  }
  assert.deepEqual(simulationReply('Please Set index Two on Lift controls.', memory).call?.arguments, { object: 'switchyard.lift', action: 'set_index_two' });
  assert.deepEqual(simulationReply('Please move to the Transfer Table.', memory).call?.arguments, { target: 'switchyard.back_lift' });
  for (const request of ['Set index Two on Service winch', 'Go to the moon', 'Inspect Lift controls and Service winch', 'Test the lift then depart', 'yes']) assert.equal(simulationReply(request, memory).call, undefined);
  assert.equal(simulationReply('Do not test the lift.', memory).cancel, true);
});

test('ambiguous local action labels require an explicit target and never select the first match', () => {
  const obs = observation(); obs.devices = [{ id: 'test.first', label: 'First device', actions: [{ action: 'test', label: 'Test mechanism' }] }, { id: 'test.second', label: 'Second device', actions: [{ action: 'test', label: 'Test mechanism' }] }];
  const memory = rememberPracticeReport(fresh(), report(obs, 'Lift Station. First device. Second device. Test mechanism. Transfer Table.'), 'switchyard');
  assert.equal(simulationReply('Test mechanism', memory).call, undefined);
  assert.deepEqual(simulationReply('Test mechanism on Second device', memory).call?.arguments, { object: 'test.second', action: 'test' });
});

test('communicated exit verbs stay natural and match only their admitted movement target', () => {
  for (const label of ['Go to Transfer Table', 'Return to Lift Station', 'Ride the direct lift', 'Cross the maintenance bridge']) {
    const obs = observation(); obs.exits = [{ target: 'observed-target', label }];
    const memory = rememberPracticeReport(fresh(), report(obs, `Lift Station. Lift controls. Local route: ${label}.`), 'switchyard');
    const choice = switchyardIntentChoices(memory).find(item => item.kind === 'action')!;
    assert.equal(choice.label, label); assert.equal(choice.request, `Please ${label}.`);
    assert.deepEqual(simulationReply(choice.request, memory).call?.arguments, { target: 'observed-target' });
    assert.equal(simulationReply('Ride the hidden lift', memory).call, undefined);
  }
});

test('new visits replace local targets and historical prose cannot restore a departed target', () => {
  const before = inspected(); const obs = observation();
  obs.visitId = 'visit-service'; obs.location = { id: 'service_gallery', label: 'Service Gallery' }; obs.devices = [{ id: 'switchyard.winch', label: 'Service winch' }]; obs.exits = [];
  const moved = rememberPracticeReport(before, report(obs, 'I am at the Service Gallery. The Service winch is nearby.'), 'switchyard');
  assert.equal(simulationReply('Test the lift', moved).call, undefined);
  assert.equal(simulationReply('Inspect Service winch', moved).call?.name, 'inspect_object');
  const history = rememberPracticeReport(moved, { ok: true, message: 'Historical receipt. Lift Station. Lift controls. Test the lift.' }, 'switchyard');
  assert.equal(simulationReply('Test the lift', history).call, undefined);
  const missingReport = rememberPracticeReport(before, report(obs, 'Movement happened.'), 'switchyard');
  assert.equal(missingReport.switchyard?.observation, undefined);
  const resumed = rememberLocalResult(moved, 'Earlier report: Service winch.', 'switchyard');
  assert.equal(resumed.switchyard?.observation, undefined);
  assert.equal(forgetSwitchyardVisit(moved.switchyard).observation, undefined);
});

test('approach discussion and revision use communicated names and never execute machinery', () => {
  assert.equal(simulationReply("Let's use the maintenance bypass", fresh()).nextMemory, undefined);
  const informed = rememberPracticeReport(fresh(), { ok: true, message: 'The directory describes the direct lift and the maintenance bypass.' }, 'switchyard');
  assert.equal(switchyardIntentChoices(informed).filter(choice => choice.kind === 'discussion').length, 2);
  const direct = simulationReply("Let's discuss the direct lift.", informed); assert.equal(direct.call, undefined);
  const revised = simulationReply("Let's discuss the maintenance bypass.", direct.nextMemory);
  assert.equal(revised.call, undefined); assert.equal(revised.message, SWITCHYARD_REACTIONS.plan_revision);
  assert.equal(revised.nextMemory?.switchyard?.discussedApproach, 'bypass');
  const again = simulationReply("Let's discuss the direct lift.", revised.nextMemory);
  assert.notEqual(again.message, SWITCHYARD_REACTIONS.plan_revision);
});

test('read-only proposal status is bound to the known proposal and cannot authorize another action', () => {
  assert.equal(simulationReply('Check action status', fresh()).call, undefined);
  assert.deepEqual(simulationReply('Check action status', { ...fresh(), proposalId: 'current-proposal' }).call?.arguments, { proposal_id: 'current-proposal' });
  assert.equal(simulationReply('Check action status', { ...fresh(), proposalId: 'current-proposal' }).call?.name, 'get_action_status');
});

test('repeating a past report labels it historical and does not recover current targets after pause', () => {
  const memory = inspected();
  const paused = { ...memory, switchyard: forgetSwitchyardVisit(memory.switchyard) };
  const reply = simulationReply('Please repeat your last report, noting if it may be out of date.', paused);
  assert.match(reply.message, /^Earlier local report, not a current reading:/);
  assert.match(reply.message, /Lift Station/);
  assert.equal(reply.call, undefined); assert.equal(reply.nextMemory, undefined);
  assert.deepEqual(switchyardIntentChoices(paused).map(choice => choice.id), ['surroundings']);
});

test('Practice hides finite transport identifiers while preserving every communicated natural action label', () => {
  const raw = 'Lift Station. Lift controls (switchyard.lift). Transfer Table. Set index One (set_index_one); Set index Two (set_index_two); Test the lift (test_lift).';
  const obs = inspected().switchyard!.observation!;
  const result = report(obs, raw); const spoken = simulationToolSpeech(result, fresh());
  assert.doesNotMatch(spoken, /switchyard\.|set_index_|test_lift/);
  const memory = rememberPracticeReport(fresh(), result, 'switchyard', spoken);
  assert.equal(switchyardIntentChoices(memory).filter(choice => choice.id.startsWith('action:')).length, 3);
  assert.equal(simulationToolSpeech({ ok: true, message: raw }), raw, 'Other chapters and raw transport are not rewritten by the Switchyard path.');
  for (const verb of ['departed', 'seated', 'deployed', 'aligned', 'completed']) {
    const outcome = { ok: true, message: `You ${verb} the observed operation.` };
    assert.equal(simulationToolSpeech(outcome, fresh()), `I ${verb} the observed operation.`);
    assert.equal(simulationToolSpeech(outcome), outcome.message, 'This authored wording change is Switchyard-only.');
  }
  const historical = { ...result, message: `Historical local report. ${raw}`, proposal: proposal({ kind: 'interaction', object: 'switchyard.turntable', action: 'align_turntable' }) };
  assert.equal(switchyardReaction(undefined, historical), undefined);
});

test('Practice decline wording replaces only its exact receipt prefix and preserves historical, raw and other-chapter text', () => {
  const declined = { ...proposal({ kind: 'move', target: 'switchyard.to_transfer' }, 'declined'),
    id: '460d92b0-21cf-47c4-b1bb-b315037c4cfc', label: 'Go to Transfer Table' };
  const message = `Proposal ${declined.id} declined by Mission Control; ${declined.label} was not executed.`;
  const result: ToolResult = { ok: false, code: 'not_executed', message, proposal: declined };
  const original = structuredClone(result);
  assert.equal(simulationToolSpeech(result, fresh()), 'You chose Not yet; Go to Transfer Table was not executed.');
  assert.deepEqual(result, original, 'The structured server receipt is never changed.');
  assert.equal(simulationToolSpeech(result), message);
  assert.equal(simulationToolSpeech(result, { chapter: 'cargo', gates: [] }), message);
  for (const prefix of ['Historical action receipt. ', 'Earlier local report, not a current reading: ']) {
    assert.equal(simulationToolSpeech({ ...result, message: prefix + message }, fresh()), prefix + message);
  }
  for (const other of [
    { ...result, code: undefined },
    { ...result, proposal: undefined },
    { ...result, proposal: { ...declined, status: 'failed' as const } },
    { ...result, proposal: { ...declined, id: 'different-proposal' } },
    { ...result, message: `The reference ${declined.id} remains in this unrelated report.` },
  ]) assert.equal(simulationToolSpeech(other, fresh()), other.message);
});

test('authored reaction beats require eligible events, occur once, and preserve actual reported route', () => {
  assert.equal(Object.keys(SWITCHYARD_REACTIONS).length, 8);
  const initial = report(); const spoken = simulationToolSpeech(initial, fresh());
  assert.match(spoken, /Your drawing supplies/);
  const memory = rememberPracticeReport(fresh(), initial, 'switchyard', spoken);
  assert.equal(switchyardReaction(memory.switchyard, initial), undefined);
  const align = { ok: true, message: 'The table alignment is confirmed.', proposal: proposal({ kind: 'interaction', object: 'switchyard.turntable', action: 'align_turntable' }) };
  assert.equal(switchyardReaction(memory.switchyard, align), SWITCHYARD_REACTIONS.first_shared_success);
  assert.equal(switchyardReaction(memory.switchyard, { ...align, proposal: { ...align.proposal, status: 'awaiting_confirmation' } }), undefined);
  assert.equal(switchyardReaction(memory.switchyard, { ...align, proposal: { ...align.proposal, status: 'declined' } }), undefined);
  const failed: ToolResult = { ok: false, code: 'precondition_failed', message: 'The required local supply is not present.' };
  assert.equal(switchyardReaction(memory.switchyard, failed), SWITCHYARD_REACTIONS.recoverable_experiment);
  const failureRemembered = rememberPracticeReport(memory, failed, 'switchyard');
  assert.equal(switchyardReaction(failureRemembered.switchyard, failed), undefined);
  const depart = { ok: true, message: 'You returned home by the maintenance bypass.', proposal: proposal({ kind: 'interaction', object: 'switchyard.return', action: 'depart' }) };
  assert.equal(switchyardReaction({ ...memory.switchyard!, discussedApproach: 'lift' }, depart), SWITCHYARD_REACTIONS.bypass_home);
});

test('Switchyard policy imports no server machinery, routing evaluator or human manual', async () => {
  const source = await readFile(new URL('../game/client/switchyard-companion.ts', import.meta.url), 'utf8');
  const imports = source.split('\n').filter(line => line.startsWith('import ')).join('\n');
  assert.doesNotMatch(imports, /server|previewSwitchyardRouting|SWITCHYARD_PANEL|manualText/);
  assert.equal(switchyardIntentChoices({ chapter: 'cargo', gates: [] }).length, 0);
  assert.equal(simulationReply('Please inspect the Latch.', { chapter: 'cargo', gates: [] }).call?.name, 'inspect_object');
});
