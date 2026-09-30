import test from 'node:test';
import assert from 'node:assert/strict';
import type { Caption } from '../game/client/useMission';
import { latestSwitchyardPlate, switchyardReportAge } from '../game/client/switchyard-report';

const report = (overrides: Partial<Caption> = {}): Caption => ({ id: 'original-report', text: 'The Lift console plate reads Kite. Index is unset; its last self-test is not passed.', role: 'robot', final: true,
  origin: 'practice', inputMethod: 'robot', roundId: 'round', segmentId: 'call', timestamp: 1000, saved: true, chapter: 'switchyard', chapterEpoch: 0,
  switchyardContext: { visitId: 'visit', stateRevision: 3, panelRevision: 1, locationLabel: 'Lift Station' }, ...overrides });

test('plate comparison uses an exact sourced robot quote from this round; partial, private and other-round words cannot select it', () => {
  const original = report();
  const picked = latestSwitchyardPlate([original, report({ id: 'partial', final: false }), report({ id: 'human', role: 'human' }), report({ id: 'other', roundId: 'other' }), report({ id: 'interrupted', interrupted: true })], 'round', 'lift');
  assert.equal(picked?.caption, original);
  assert.equal(picked?.quote, 'The Lift console plate reads Kite.');
  assert.equal(latestSwitchyardPlate([original], 'round', 'service'), undefined);
  assert.equal(latestSwitchyardPlate([report({ text: 'Please apply the Blue circuit.' })], 'round', 'lift'), undefined);
});

test('comparison preserves a stable quote but never promotes old dynamic readings after routing, actions or a different visit', () => {
  const quote = report();
  assert.match(switchyardReportAge(quote, { visitId: 'visit' }, 1, 3), /Reported on this visit/);
  assert.match(switchyardReportAge(quote, { visitId: 'visit' }, 2, 4), /Routing changed/);
  assert.match(switchyardReportAge(quote, { visitId: 'visit' }, 1, 4), /Earlier conditions/);
  assert.match(switchyardReportAge(quote, null, 1, 3), /Earlier visit/);
  assert.match(switchyardReportAge(quote, { visitId: 'other-visit' }, 1, 3), /Earlier visit/);
  assert.match(switchyardReportAge(report({ switchyardContext: undefined, origin: 'live_voice' }), { visitId: 'visit' }, 1, 3), /Visit not recorded/);
  assert.deepEqual(quote.switchyardContext, { visitId: 'visit', stateRevision: 3, panelRevision: 1, locationLabel: 'Lift Station' });
});

test('a delayed or repeated historical plate cannot replace its attributable original source', () => {
  const original = report();
  const delayed = report({ id: 'delayed', switchyardContext: undefined, text: 'Historical local report, not a current reading. The Lift console plate reads Kite. Index is unset.' });
  assert.equal(latestSwitchyardPlate([original, delayed], 'round', 'lift')?.caption.id, original.id);
  assert.equal(latestSwitchyardPlate([delayed], 'round', 'lift')?.caption.id, delayed.id);
  assert.match(switchyardReportAge(delayed, null, 1, 3), /Visit not recorded/);
});
