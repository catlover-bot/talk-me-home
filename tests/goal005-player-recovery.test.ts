import test from 'node:test';
import assert from 'node:assert/strict';
import { acquirePlayerReport, LOCATION_REQUESTS, passageRequests } from '../scripts/qa-player-recovery.mjs';
import { communicatedEmblem, communicatedPassability } from '../scripts/qa-player-policy.mjs';
import { createPlayerMemory } from '../scripts/qa-player-memory.mjs';

const names = ['ring', 'fork', 'sail', 'leaf', 'dock'];
test('the actual fifth-attempt observation question receives a bounded explicit survey recovery', async () => {
  const replies = ['I cannot see an emblem right now, as I have just arrived through the gate. Should I observe the room to see what is around me?', 'I see a Fork emblem and gates to the west, northeast and southeast.'];
  const report: Record<string, any> = {}; const requests: string[] = []; let location: string | null = null;
  assert.equal(await acquirePlayerReport({ subject: 'location', read: () => location, requests: LOCATION_REQUESTS, report,
    exchange: async text => { requests.push(text); const reply = replies.shift()!; location = communicatedEmblem(reply, names); return reply; } }), 'fork');
  assert.equal(requests.length, 2); assert.match(requests[1], /observe the room now/);
  assert.equal(report.acquisitions[0].recovered, true); assert.equal(report.acquisitions[0].strictFirstResponse, false);
});

test('a fresh communicated arrival needs no extra question; no emblem exhausts exactly four purposeful exchanges', async () => {
  let calls = 0;
  assert.equal(await acquirePlayerReport({ subject: 'location', read: () => 'leaf', requests: LOCATION_REQUESTS, exchange: async () => { calls++; } }), 'leaf');
  assert.equal(calls, 0);
  const report: Record<string, any> = {};
  await assert.rejects(acquirePlayerReport({ subject: 'location', read: () => null, requests: LOCATION_REQUESTS, report,
    exchange: async () => { calls++; return 'I moved. Would you like me to look?'; } }), /unknown after 4 purposeful exchanges/);
  assert.equal(calls, 4);
  assert.equal(new Set(report.acquisitions[0].exchanges.map((step: any) => step.reason)).size, 4);
});

test('unresolved recovery has a fixed 120-second deadline and scope invalidity is never retried', async () => {
  let time = 0; let calls = 0;
  await assert.rejects(acquirePlayerReport({ subject: 'location', read: () => null, requests: LOCATION_REQUESTS, now: () => time,
    exchange: async () => { calls++; time += 60_001; } }), /exceeded 120 seconds/);
  assert.equal(calls, 2);
  await assert.rejects(acquirePlayerReport({ subject: 'location', read: () => null, requests: LOCATION_REQUESTS,
    checkScope: async () => { throw new Error('Stopped current round.'); }, exchange: async () => { calls++; } }), /Stopped current round/);
  assert.equal(calls, 2);
});

test('open gate never supplies passability and read-only obstruction clarification can recover', async () => {
  const replies = ['The east gate is open.', 'Should I inspect the opening?', 'The east opening is unobstructed.'];
  let passage: 'clear' | 'blocked' | null = null;
  assert.equal(await acquirePlayerReport({ subject: 'east passage', read: () => passage, requests: passageRequests('east'),
    exchange: async () => { const reply = replies.shift()!; passage = communicatedPassability(reply, 'east'); return reply; } }), 'clear');
});

test('old/new room references and conservative shape synonyms resolve only current communicated position', () => {
  for (const quote of ['I left Ring, but I am now at the Fork emblem.', 'Earlier I was at Ring. This room has the Fork emblem.', 'I was at Ring, now the Fork emblem is beside me.']) assert.equal(communicatedEmblem(quote, names), 'fork', quote);
  assert.equal(communicatedEmblem('The circular emblem is here.', names), 'ring');
  assert.equal(communicatedEmblem('This platform has a Y-shaped emblem.', names), 'fork');
  for (const quote of ['Ring or Fork may be the emblem.', 'I see the Fork emblem beyond the next gate.', 'The Ring emblem was beside me.', 'The emblem might be a leaf.']) assert.equal(communicatedEmblem(quote, names), null, quote);
});

test('departed or interrupted reports cannot establish a revisited room; relay change clears only passage beliefs', () => {
  const memory = createPlayerMemory({ round: 'r', chapter: 'Relay Gallery', visibleNames: names });
  const report = (id: string, text: string, displayedAt: string) => ({ messageId: id, text, displayedAt, speaker: 'Pip', source: 'rendered visible history', round: 'r', chapter: 'Relay Gallery', final: true, interrupted: false });
  const old = report('old', 'I am at Fork. The east opening is clear.', '2026-09-29T10:00:00.000Z');
  memory.consume([old]); assert.equal(memory.value('location'), 'fork');
  memory.invalidatePassages(); assert.equal(memory.value('location'), 'fork'); assert.equal(memory.value('passage', 'fork:east'), null);
  memory.depart('2026-09-29T10:00:02.000Z');
  memory.consume([old, report('delayed', 'I am at Fork.', '2026-09-29T10:00:01.000Z')]); assert.equal(memory.value('location'), null);
  const fresh = report('fresh', 'I am at Sail.', '2026-09-29T10:00:03.000Z');
  memory.consume([fresh]); assert.equal(memory.value('location'), 'sail');
  memory.consume([{ ...fresh, interrupted: true }]); assert.equal(memory.value('location'), null);
});
