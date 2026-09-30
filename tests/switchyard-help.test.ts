import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { HintLevel, HintResult, HumanView } from '../game/shared/contracts';
import { SessionStore } from '../game/server/sessions';
import { createGameServer } from '../game/server/http';
import type { LiveAdmission } from '../game/server/admission';

const levels: HintLevel[] = [1, 2, 3];
const envelope = (view: HumanView) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: randomUUID() });
const tool = (view: HumanView, name: string, args = {}, visitId?: string) => ({
  roundId: view.roundId, chapterEpoch: view.chapterEpoch, actionEpoch: view.actionEpoch,
  callId: randomUUID(), name, arguments: args, ...(visitId ? { inspectionScope: { visitId } } : {}),
});

test('Switchyard help is identical for both hidden installations and cannot discover, power or report local equipment', async () => {
  const answers: string[][] = [];
  for (const configuration of ['a', 'b'] as const) {
    let commits = 0;
    const store = new SessionStore({ switchyardConfiguration: configuration, onRobotCommit: () => { commits++; } });
    const view = store.create('classic', 'switchyard');
    const physical = store.physicalDigestForEvaluation(view.sessionId);
    const text: string[] = [];
    for (const level of levels) {
      const request = { ...envelope(view), level };
      const answer = await store.hint(view.sessionId, request);
      assert.deepEqual(await store.hint(view.sessionId, request), answer, 'Repeated receipt is idempotent.');
      assert.deepEqual(Object.keys(answer).sort(), ['chapter', 'chapterEpoch', 'level', 'roundId', 'text']);
      assert.equal(answer.chapter, 'switchyard');
      assert.doesNotMatch(answer.text, /directory|Crescent|Kite|Rivet|Slot|Amber|Blue|White|set index|single test supply|paired running supply|switchyard\./i);
      text.push(answer.text);
    }
    answers.push(text);
    assert.deepEqual(store.get(view.sessionId), view);
    assert.equal(store.physicalDigestForEvaluation(view.sessionId), physical);
    assert.equal(commits, 0);
    assert.deepEqual(store.recap(view.sessionId, view.roundId).entries, []);
    const record = store.record(view.sessionId, view.roundId);
    assert.deepEqual(record.messages, []);
    assert.deepEqual(record.notebook, []);
    assert.deepEqual(record.hintUses, levels.map(level => ({ chapter: 'switchyard', level })));
    const undiscovered = await store.tool(view.sessionId, tool(view, 'inspect_object', { object: 'switchyard.directory' }));
    assert.equal(undiscovered.ok, false);
    assert.equal(undiscovered.code, 'stale_scope', 'Reading help cannot establish an observed visit.');
    assert.equal(undiscovered.switchyardObservation, undefined);
  }
  assert.deepEqual(answers[0], answers[1]);
});

test('help preserves a pending or declined exact proposal and remains outside the robot recap', async () => {
  let commits = 0;
  const owner = 'help-owner';
  const store = new SessionStore({ switchyardConfiguration: 'a', onRobotCommit: () => { commits++; } });
  const initial = store.create('classic', 'switchyard', owner);
  const observed = await store.tool(initial.sessionId, tool(initial, 'observe_room'));
  const pending = await store.tool(initial.sessionId, tool(observed.view, 'propose_move', { target: 'switchyard.to_transfer' }, observed.switchyardObservation!.visitId));
  assert.equal(pending.proposal?.status, 'awaiting_confirmation');
  const physical = store.physicalDigestForEvaluation(initial.sessionId);
  const recap = store.recap(initial.sessionId, initial.roundId);
  for (const level of levels) await store.hint(initial.sessionId, { ...envelope(pending.view), level });
  assert.deepEqual(store.get(initial.sessionId), pending.view);
  assert.deepEqual(store.recap(initial.sessionId, initial.roundId), recap);
  assert.equal(store.physicalDigestForEvaluation(initial.sessionId), physical);
  const declined = await store.decideProposal(initial.sessionId, { roundId: pending.view.roundId, requestId: randomUUID(), proposalId: pending.proposal!.id, decision: 'decline' }, owner);
  for (const level of levels) await store.hint(initial.sessionId, { ...envelope(declined.view), level });
  assert.deepEqual(store.get(initial.sessionId), declined.view);
  assert.equal(store.get(initial.sessionId).proposal?.status, 'declined');
  assert.equal(commits, 0);
  assert.equal(store.physicalDigestForEvaluation(initial.sessionId), physical);
});

test('the existing owned HTTP hint route uses no provider or allowance and rejects private context fields', async () => {
  let providerCalls = 0; let allowanceTouches = 0;
  // A trap-only test double: no allowance file is created or initialized.
  const admission = new Proxy({} as LiveAdmission, { get() { allowanceTouches++; throw new Error('Help must not touch Live accounting.'); } });
  const store = new SessionStore({ switchyardConfiguration: 'b' });
  const server = createGameServer({ apiKey: '', store, admission,
    fetch: async () => { providerCalls++; throw new Error('Help must not contact a provider.'); } });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown, cookie = '') => fetch(base + path, { method: 'POST',
      headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const created = await post('/api/sessions', { scenario: 'classic', missionKind: 'switchyard' });
    assert.equal(created.status, 201);
    const cookie = created.headers.getSetCookie().find(value => value.startsWith('tmh_browser='))!.split(';')[0]!;
    const view = await created.json() as HumanView;
    const physical = store.physicalDigestForEvaluation(view.sessionId);
    const path = `/api/sessions/${view.sessionId}/hint`;
    assert.equal((await post(path, { ...envelope(view), level: 1 })).status, 404);
    for (const level of levels) {
      const response = await post(path, { ...envelope(view), level }, cookie);
      assert.equal(response.status, 200);
      const answer = await response.json() as HintResult;
      assert.equal(answer.level, level);
      assert.equal(answer.chapter, 'switchyard');
    }
    for (const extra of [{ intendedApproach: 'lift' }, { configuration: 'b' }, { switchyardObservation: {} }]) {
      assert.equal((await post(path, { ...envelope(view), level: 1, ...extra }, cookie)).status, 400);
    }
    assert.deepEqual(store.get(view.sessionId), view);
    assert.equal(store.physicalDigestForEvaluation(view.sessionId), physical);
    assert.deepEqual(store.recap(view.sessionId, view.roundId).entries, []);
    assert.equal(providerCalls, 0);
    assert.equal(allowanceTouches, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
