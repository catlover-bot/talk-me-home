import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createPlayerMemory, confirmReportedAction, type PlayerReport } from '../scripts/qa-player-memory.mjs';

const round = 'synthetic test round';
const chapter = 'Cargo Bay';
const quote = 'I have engaged the latch and the door is now being held open. I can see the conveyor is still running. Should I try moving to the far side platform?';
const record = (text: string, id: string, overrides: Partial<PlayerReport> = {}): PlayerReport => ({
  text, speaker:'Pip', source:'explicit synthetic eligible visible-history fixture', sourceLabel:'Fake provider',
  round, chapter, messageId:id, final:true, interrupted:false, ...overrides,
});
const confirm = (memory: ReturnType<typeof createPlayerMemory>, say: (text: string) => Promise<unknown>, checkpoint = async () => false) => confirmReportedAction({memory, consume:async () => {}, say, request:'Please engage the Latch.', clarify:'Is the Latch engaged now?', retry:'Please set the Latch to hold the Door open.', action:'latch', checkpoint});

test('offline continuation retains historical wiring report, omits duplicate engage, and reaches next human Power decision', async () => {
  const metrics = JSON.parse(readFileSync(new URL('../artifacts/goal-004c/live/2026-09-25T17-58-10-565Z-text-mission-metrics.json', import.meta.url), 'utf8'));
  const original = metrics.visibleHistory.find((entry: {text:string}) => entry.text === quote);
  assert.equal(original.final, true); assert.equal(original.interrupted, false);
  assert.equal(original.sourceLabel, 'Live Text'); assert.equal(original.chapterLabel, 'Cargo Bay');
  const memory = createPlayerMemory({round, chapter}); const sent: string[] = [];
  const say = async (text: string) => {
    sent.push(text);
    // The original has no round/message ID. This assigned scope and continuation are synthetic.
    memory.consume([{...original, round, chapter:original.chapterLabel, identityBasis:'synthetic current-round fixture around retained historical text; message ID absent', order:7}]);
    return original.text;
  };
  await say('My diagram says the Door and Conveyor share one Power supply.');
  const reported = await confirm(memory, say);
  const nextHumanDecision = reported ? 'Power OFF after consulting the shared-supply manual' : null;
  assert.equal(memory.value('latch'), 'reported_done');
  assert.deepEqual(sent, ['My diagram says the Door and Conveyor share one Power supply.']);
  assert.equal(nextHumanDecision, 'Power OFF after consulting the shared-supply manual');
  const [retained] = memory.snapshot();
  assert.equal(retained!.quote, quote); assert.equal(retained!.messageId, null);
  assert.equal(retained!.sourceLabel, 'Live Text'); assert.equal(retained!.chapter, chapter);
  assert.equal(retained!.final, true); assert.equal(retained!.interrupted, false);
  assert.equal(retained!.reportedValue, 'reported_done');
});

test('earlier historical negative followed by wiring success never authorizes duplicate engage', async () => {
  const memory = createPlayerMemory({round, chapter});
  memory.consume([record('The latch is not engaged, but the plate says it holds the door open. I can use the lever to engage it if you want. Should I do that?', 'inspection'), record(quote, 'wiring')]);
  const sent: string[] = [];
  assert.equal(await confirm(memory, async text => { sent.push(text); memory.consume([record('The Latch is engaged.', 'fresh-status')]); }), true);
  assert.deepEqual(sent, [], 'The explicit completed-action report explains the update from the earlier negative inspection.');
  assert.equal(memory.value('latch'), 'reported_done');
});

test('unrelated discussion and a question retain the independent Latch report', () => {
  const memory = createPlayerMemory({round, chapter});
  memory.consume([record('The Latch is engaged.', 'one'), record('The Conveyor is still running. Should I try moving?', 'two'), record('Is the Latch engaged?', 'three')]);
  assert.equal(memory.value('latch'), 'reported_done');
  assert.equal(memory.get('latch')!.quote, 'The Latch is engaged.');
});

test('explicit contradiction requires uncertainty or a fresh status check', async () => {
  const memory = createPlayerMemory({round, chapter});
  memory.consume([record('The Latch is engaged.', 'one'), record('The Latch is not engaged.', 'two')]);
  assert.equal(memory.value('latch'), null); assert.equal(memory.get('latch')!.contradiction, true);
  const sent: string[] = [];
  assert.equal(await confirm(memory, async text => { sent.push(text); memory.consume([record('The Latch is engaged.', 'fresh')]); }), true);
  assert.deepEqual(sent, ['Is the Latch engaged now?']);
});

test('same eligible message revision is deduplicated without losing exact quote and source', () => {
  const memory = createPlayerMemory({round, chapter});
  const report = record('The Latch is engaged.', 'unique', {order:4});
  memory.consume([report]); memory.consume([report, report]);
  assert.equal(memory.snapshot().length, 1);
  assert.equal(memory.get('latch')!.messageId, 'unique');
  assert.equal(memory.get('latch')!.messageOrder, 4);
  assert.equal(memory.get('latch')!.source, report.source);
});

test('wrong scope, human, historical, interrupted, partial and missing-eligibility reports never satisfy a current action', () => {
  for (const overrides of [{round:'old'}, {chapter:'Return Dock'}, {speaker:'Mission Control'}, {historical:true}, {interrupted:true}, {final:false}, {final:null}, {interrupted:null}]) {
    const memory = createPlayerMemory({round, chapter});
    memory.consume([record('The Latch is engaged.', 'excluded', overrides)]);
    assert.equal(memory.value('latch'), null, JSON.stringify(overrides));
    assert.equal(memory.snapshot().length, 0);
  }
});

test('round and chapter changes clear current beliefs while preserving explicitly scoped evidence history', () => {
  const memory = createPlayerMemory({round, chapter});
  const old = record('The Latch is engaged.', 'old'); memory.consume([old]);
  memory.scope({round:'replacement round', chapter}); memory.consume([old]);
  assert.equal(memory.value('latch'), null);
  memory.consume([record('The Latch is engaged.', 'new', {round:'replacement round'})]);
  memory.scope({round:'replacement round', chapter:'Relay Gallery'});
  assert.equal(memory.value('latch'), null);
  assert.equal(memory.snapshot()[0]!.round, round);
  assert.equal(memory.snapshot()[1]!.round, 'replacement round');
});

test('unknown mutation outcome receives one clarification and no blind physical retry', async () => {
  const memory = createPlayerMemory({round, chapter}); memory.invalidate('latch');
  const sent: string[] = [];
  assert.equal(await confirm(memory, async text => { sent.push(text); memory.consume([record('I cannot confirm whether the Latch is engaged.', 'uncertain')]); }), false);
  assert.deepEqual(sent, ['Is the Latch engaged now?']);
});

test('a fresh explicit negative permits one bounded retry; an advanced public checkpoint suppresses every request', async () => {
  const memory = createPlayerMemory({round, chapter}); memory.invalidate('latch');
  const sent: string[] = [];
  assert.equal(await confirm(memory, async text => { sent.push(text); memory.consume([record(sent.length === 1 ? 'The Latch is not engaged.' : 'The Latch is engaged.', String(sent.length))]); }), true);
  assert.deepEqual(sent, ['Is the Latch engaged now?', 'Please set the Latch to hold the Door open.']);
  sent.length = 0;
  assert.equal(await confirm(memory, async text => { sent.push(text); }, async () => true), true);
  assert.deepEqual(sent, []);
});

test('held contact survives a separate charging discussion without treating charging as reported physical energy', () => {
  const memory = createPlayerMemory({round, chapter:'Return Dock'});
  memory.consume([
    record('I am holding the contact. You can try charging now.', 'hold', {chapter:'Return Dock'}),
    record('The controller is ready. Shall I wait?', 'discussion', {chapter:'Return Dock'}),
  ]);
  assert.equal(memory.value('contact'), 'reported_done');
  assert.equal(memory.value('energy'), null);
  memory.invalidate('contact'); assert.equal(memory.value('contact'), null);
});

test('an explicitly completed contact action updates an earlier negative report without a duplicate hold request', async () => {
  const memory = createPlayerMemory({round, chapter:'Return Dock'});
  memory.consume([
    record('The contact is not held.', 'inspection', {chapter:'Return Dock'}),
    record('I have gripped the contact. You can try charging now.', 'completed-action', {chapter:'Return Dock'}),
  ]);
  const sent: string[] = [];
  assert.equal(await confirmReportedAction({memory, consume:async () => {}, say:async text => {sent.push(text);}, request:'Please hold the contact.', clarify:'Are you holding the contact now?', retry:'Please grip the contact steadily.', action:'contact'}), true);
  assert.deepEqual(sent, []);
});

test('visible target and room scope preserve east/west distinctions and never equate open with clear', () => {
  const memory = createPlayerMemory({round, chapter:'Relay Gallery', visibleNames:['Ring', 'Fork']});
  memory.consume([record('I am at the Ring. The east gate is clear, but the west gate is blocked.', 'ring', {chapter:'Relay Gallery'})]);
  assert.equal(memory.value('location'), 'ring');
  assert.equal(memory.value('passage', 'ring:east'), 'clear');
  assert.equal(memory.value('passage', 'ring:west'), 'blocked');
  memory.consume([record('I am at the Fork. The east gate is open.', 'fork', {chapter:'Relay Gallery'})]);
  assert.equal(memory.value('location'), 'fork');
  assert.equal(memory.value('passage', 'fork:east'), null);
  assert.equal(memory.value('passage', 'ring:east'), 'clear');
  memory.consume([record('I am at the Ring. Shall I move?', 'backtrack', {chapter:'Relay Gallery'})]);
  assert.equal(memory.value('location'), 'ring');
  assert.equal(memory.value('passage', 'ring:west'), 'blocked');
});

test('a later interruption or previous-call marker invalidates the same previously eligible source message', () => {
  for (const revision of [{interrupted:true}, {historical:true}, {final:false}]) {
    const memory = createPlayerMemory({round, chapter}); const original = record('The Latch is engaged.', 'changing-source');
    memory.consume([original]); assert.equal(memory.value('latch'), 'reported_done');
    memory.consume([{...original, ...revision}]);
    assert.equal(memory.value('latch'), null, JSON.stringify(revision));
  }
});

test('a late older report does not overwrite a newer communicated observation', () => {
  const memory = createPlayerMemory({round, chapter});
  memory.consume([record('The Latch is engaged.', 'new', {order:10})]);
  memory.consume([record('The Latch is not engaged.', 'old', {order:4})]);
  assert.equal(memory.value('latch'), 'reported_done');
  assert.equal(memory.get('latch')!.messageId, 'new');
});

test('timestamp identity remains deduplicated if the visible bounded-history index changes', () => {
  const memory = createPlayerMemory({round, chapter});
  const report = record('The Latch is engaged.', 'unused', {messageId:null, displayedAt:'2026-09-26T01:00:00.000Z', order:10});
  memory.consume([report]); memory.consume([{...report, order:3}]);
  assert.equal(memory.snapshot().length, 1);
  assert.equal(memory.value('latch'), 'reported_done');
});

test('a new ambiguous current-location assertion invalidates the older location until a fresh check', () => {
  for (const text of ['I am at Fork, but I am not at Fork.', 'The current emblem is Ring or Fork.']) {
    const memory = createPlayerMemory({round, chapter:'Relay Gallery', visibleNames:['Ring', 'Fork']});
    memory.consume([record('I am at the Ring.', 'prior', {chapter:'Relay Gallery'})]);
    memory.consume([record(text, 'ambiguous', {chapter:'Relay Gallery'})]);
    assert.equal(memory.value('location'), null, text);
    memory.consume([record('I am at Fork.', 'fresh-check', {chapter:'Relay Gallery'})]);
    assert.equal(memory.value('location'), 'fork');
  }
});

test('release confirmation advances only after reported release or public readiness, with one justified retry', async () => {
  const request = 'Please release the contact.';
  const clarify = 'Are you still holding the contact?';
  const retry = 'Please let go of the contact.';
  const cases = [
    {responses:['I cannot confirm whether the contact is released.', 'I cannot confirm whether the contact is held.'], expected:false, sent:[request, clarify]},
    {responses:['I cannot confirm whether the contact is released.', 'I am still holding the contact.', 'I have released the contact.'], expected:true, sent:[request, clarify, retry]},
    {responses:['I have released the contact.'], expected:true, sent:[request]},
  ];
  for (const scenario of cases) {
    const memory = createPlayerMemory({round, chapter:'Return Dock'});
    memory.consume([record('I am holding the contact.', 'held', {chapter:'Return Dock'})]);
    const sent: string[] = [];
    const result = await confirmReportedAction({memory, consume:async () => {}, action:'contact', expectedValue:'not_done', request, clarify, retry,
      say:async text => { sent.push(text); memory.consume([record(scenario.responses[sent.length - 1]!, String(sent.length), {chapter:'Return Dock'})]); }});
    assert.equal(result, scenario.expected); assert.deepEqual(sent, scenario.sent);
  }
  const memory = createPlayerMemory({round, chapter:'Return Dock'});
  memory.consume([record('I am holding the contact.', 'old-held', {chapter:'Return Dock'})]);
  const sent: string[] = [];
  assert.equal(await confirmReportedAction({memory, consume:async () => {}, say:async text => {sent.push(text);}, action:'contact', expectedValue:'not_done', request, clarify, retry, checkpoint:async () => true}), true);
  assert.deepEqual(sent, []);
});

test('newer visible timestamp wins over a lower index after bounded history slides', () => {
  const memory = createPlayerMemory({round, chapter});
  memory.consume([record('The Latch is engaged.', 'prior', {order:199, displayedAt:'2026-09-26T01:00:00.000Z'})]);
  memory.consume([record('The Latch is not engaged.', 'newer', {order:190, displayedAt:'2026-09-26T01:00:01.000Z'})]);
  assert.equal(memory.value('latch'), null);
  assert.equal(memory.get('latch')!.reportedValue, 'not_done');
  assert.equal(memory.get('latch')!.messageId, 'newer');
});
