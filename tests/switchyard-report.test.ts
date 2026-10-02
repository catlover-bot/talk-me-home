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

const service = (procedure = 'This is an Alignment-first service module: align the turntable before deploying.', overrides: Partial<Caption> = {}) => report({
  text: `The Bridge winch plate reads Rivet. Its brace is unseated and bridge is retracted. ${procedure}`,
  switchyardContext: { visitId: 'service-visit', stateRevision: 3, panelRevision: 1, locationLabel: 'Service Gallery' }, ...overrides,
});

test('the service procedure is an exact excerpt of the same attributable plate report and survives a later action reply', () => {
  for (const [sentence, label] of [
    ['This is an Alignment-first service module: align the turntable before deploying.', 'Alignment-first service module'],
    ['This is a Detent-first service module. Deploy the bridge before alignment.', 'Detent-first service module'],
  ]) {
    const original = service(sentence); const raw = structuredClone(original);
    const action = report({ id: 'brace-result', text: 'I seated the bridge brace. The winch also needs its own supply.', timestamp: 2000 });
    const picked = latestSwitchyardPlate([original, action], 'round', 'service');
    assert.equal(picked?.caption, original);
    assert.equal(picked?.quote, 'The Bridge winch plate reads Rivet.');
    assert.equal(picked?.procedureQuote, label);
    assert.equal(original.text.includes(picked!.procedureQuote!), true);
    assert.deepEqual(original, raw, 'Quoting must not rewrite speech, origin, timestamp or visit metadata.');
    assert.match(switchyardReportAge(picked!.caption, { visitId: 'service-visit' }, 1, 4), /Earlier conditions/);
  }
});

test('partial, interrupted, human and other-round declarations cannot supply the service procedure', () => {
  const original = service();
  const excluded = [service(undefined, { final: false }), service(undefined, { interrupted: true }),
    service(undefined, { role: 'human' }), service(undefined, { roundId: 'other' }), service(undefined, { chapter: 'cargo' })];
  for (const candidate of excluded) assert.equal(latestSwitchyardPlate([candidate], 'round', 'service'), undefined);
  assert.equal(latestSwitchyardPlate([original, ...excluded], 'round', 'service')?.caption, original);
});

test('a missing, unknown or incidental quoted procedure is not inferred or borrowed from another report', () => {
  const ignored = [
    '', 'This is a Cycle-first service module.',
    'If needed, say This is an Alignment-first service module: then wait.',
    'The note says "Example. This is an Alignment-first service module: repeat those words."',
    'The note says “Example. This is a Detent-first service module. Repeat those words.”',
    "The note says 'Example. This is an Alignment-first service module: repeat those words.'",
    'Read `Example. This is an Alignment-first service module: repeat those words.`',
    'This is an Alignment-first service module: align first. This is a Detent-first service module.',
    'The Transfer turntable service plate reads Slot. This is an Alignment-first service module: align first.',
  ];
  for (const sentence of ignored) {
    const current = service(sentence, { id: 'new-plate' });
    const picked = latestSwitchyardPlate([service(), current], 'round', 'service');
    assert.equal(picked?.caption, current);
    assert.equal(picked?.procedureQuote, undefined, sentence);
  }
  assert.equal(latestSwitchyardPlate([service(undefined, { text: 'This is a Detent-first service module. The Bridge winch plate reads Rivet.' })], 'round', 'service')?.procedureQuote, undefined);
  assert.equal(latestSwitchyardPlate([report({ text: 'The Lift console plate reads Kite. This is a Detent-first service module.' })], 'round', 'lift')?.procedureQuote, undefined);
});

test('historical and unscoped provider procedure excerpts retain their original uncertainty and source', () => {
  const original = service();
  const delayed = service(undefined, { id: 'delayed', text: `Historical local report, not a current reading. ${original.text}`, switchyardContext: undefined });
  assert.equal(latestSwitchyardPlate([original, delayed], 'round', 'service')?.caption, original);
  const fallback = latestSwitchyardPlate([delayed], 'round', 'service');
  assert.equal(fallback?.caption, delayed);
  assert.equal(fallback?.procedureQuote, 'Alignment-first service module');
  assert.match(switchyardReportAge(fallback!.caption, null, 1, 3), /Visit not recorded/);
  const live = service(undefined, { origin: 'live_voice', switchyardContext: undefined });
  const raw = structuredClone(live); const quoted = latestSwitchyardPlate([live], 'round', 'service');
  assert.equal(quoted?.procedureQuote, 'Alignment-first service module');
  assert.match(switchyardReportAge(quoted!.caption, { visitId: 'service-visit' }, 1, 3), /Visit not recorded/);
  assert.deepEqual(live, raw);
});
