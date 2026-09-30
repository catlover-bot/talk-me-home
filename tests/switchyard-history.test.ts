import test from 'node:test';
import assert from 'node:assert/strict';
import { clearJourneyHistory, mergeJourneyHistory, readJourneyHistory, saveJourneyHistory, SWITCHYARD_HISTORY_KEY, type JourneyEntry } from '../game/client/switchyard-history';
import { createSession, lifecycle, remixAvailability } from '../game/client/api';
import type { HumanView } from '../game/shared/contracts';

const makeEntry = (number = 1): JourneyEntry => ({ id: `entry-${number}`, code: `R1-00-00-0-${number.toString(16).toUpperCase().padStart(8, '0')}-1234ABCD`,
  startedAt: number, updatedAt: number, outcome: 'started', assignment: 'rescue', provenance: 'practice', recentToken: 'a'.repeat(32) });
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};

test('journey history keeps twelve recent starts, upserts home, and never retains transcript or owner fields', () => {
  const store = memory();
  const started = Array.from({ length: 15 }, (_, index) => makeEntry(index + 1));
  saveJourneyHistory(started, store);
  assert.deepEqual(readJourneyHistory(store).map(item => item.id), started.slice(3).reverse().map(item => item.id));
  const finished: JourneyEntry = { ...makeEntry(15), updatedAt: 100, outcome: 'home', approach: 'bypass', assignmentStatus: 'completed' };
  saveJourneyHistory([{ ...finished, transcript: 'Private words', ownerToken: 'not-a-history-field' } as JourneyEntry], store);
  const saved = readJourneyHistory(store);
  assert.equal(saved.length, 12); assert.deepEqual(saved[0], finished);
  assert.equal(store.getItem(SWITCHYARD_HISTORY_KEY)?.includes('Private words'), false);
  assert.equal(store.getItem(SWITCHYARD_HISTORY_KEY)?.includes('ownerToken'), false);
  saveJourneyHistory([makeEntry(15)], store);
  assert.equal(readJourneyHistory(store)[0]?.outcome, 'home', 'A delayed start cannot erase completion.');
  clearJourneyHistory(store); assert.deepEqual(readJourneyHistory(store), []);
});

test('corrupt, oversized, unsupported and blocked history safely falls back without mission authority', () => {
  const store = memory();
  for (const value of ['bad JSON', '{}', JSON.stringify(Array(13).fill(makeEntry())), 'x'.repeat(32_001)]) {
    store.setItem(SWITCHYARD_HISTORY_KEY, value); assert.deepEqual(readJourneyHistory(store), []);
  }
  store.setItem(SWITCHYARD_HISTORY_KEY, JSON.stringify([{ ...makeEntry(), code: 'R9-not-supported' }, { ...makeEntry(2), outcome: 'home' }, { ...makeEntry(3), startedAt: -1 }, makeEntry(4)]));
  assert.deepEqual(readJourneyHistory(store), [makeEntry(4)]);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); } };
  assert.deepEqual(readJourneyHistory(blocked), []);
  assert.deepEqual(saveJourneyHistory([makeEntry()], blocked), [makeEntry()]);
  assert.doesNotThrow(() => clearJourneyHistory(blocked));
});

test('independent tabs merge bounded entries on write; stale starts cannot replace home', () => {
  const store = memory(); const firstTab = [makeEntry(1)]; const secondTab = [makeEntry(2)];
  saveJourneyHistory(firstTab, store); saveJourneyHistory(secondTab, store);
  assert.deepEqual(readJourneyHistory(store).map(item => item.id), ['entry-2', 'entry-1']);
  const home: JourneyEntry = { ...makeEntry(1), updatedAt: 10, outcome: 'home', approach: 'lift', assignmentStatus: 'completed' };
  assert.deepEqual(mergeJourneyHistory([home], firstTab).find(item => item.id === home.id), home);
  assert.deepEqual(mergeJourneyHistory(firstTab, [home]).find(item => item.id === home.id), home);
});

test('dispatch API sends selection only at explicit create/reset, and availability is a read-only GET', async t => {
  const requests: { path: string; body: unknown; method?: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    requests.push({ path, body: init.body ? JSON.parse(String(init.body)) : undefined, method: init.method });
    return Response.json({});
  });
  await remixAvailability(); assert.deepEqual(requests[0], { path: '/api/remix', method: 'GET', body: undefined });
  const remix = { kind: 'replay' as const, code: makeEntry().code };
  await createSession('classic', 'switchyard', undefined, remix);
  assert.deepEqual(requests[1]?.body, { scenario: 'classic', missionKind: 'switchyard', remix });
  await createSession('classic', 'rescue', undefined, remix);
  assert.deepEqual(requests[2]?.body, { scenario: 'classic', missionKind: 'rescue' });
  await lifecycle({ sessionId: 'owned', roundId: 'round', chapterEpoch: 0 } as HumanView, 'reset', { missionKind: 'switchyard', remix });
  assert.deepEqual(Object.keys(requests[3]?.body as object).sort(), ['chapterEpoch', 'missionKind', 'remix', 'requestId', 'roundId']);
  assert.equal(requests.some(request => /token|tools|routing-panel|proposal-decision/.test(request.path)), false);
});
