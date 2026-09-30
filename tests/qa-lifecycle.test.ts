import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createLifecycleJournal, waitForTerminalObservation } from '../scripts/qa-lifecycle.mjs';

function terminalPage() {
  let now = 0;
  let deadline = Infinity;
  let evaluate = () => {};
  let rejectWait: (error: Error) => void = () => {};
  let disposed = false;
  const events: Array<{ type: string; atMs: number }> = [];
  const instrumentedGlobal = globalThis as typeof globalThis & { __qaAudio?: { snapshot(): { events: typeof events } } };
  const page = { waitForFunction(predicate: () => unknown, _argument: unknown, { timeout }: { timeout: number }) {
    deadline = now + timeout;
    return new Promise((resolve, reject) => {
      rejectWait = reject;
      evaluate = () => {
        const previous = instrumentedGlobal.__qaAudio;
        try {
          instrumentedGlobal.__qaAudio = { snapshot: () => ({ events }) };
          const value = predicate();
          if (value) resolve({ jsonValue: async () => value, dispose: async () => { disposed = true; } });
        } finally { instrumentedGlobal.__qaAudio = previous; }
      };
      evaluate();
    });
  } } as unknown as Page;
  return { page, get disposed() { return disposed; }, advance(ms: number, type?: string) {
    now += ms;
    if (now >= deadline) { rejectWait(new Error('Synthetic terminal-observation timeout.')); return; }
    if (type) events.push({ type, atMs: now });
    evaluate();
  } };
}

test('terminal observer permits the eight-second closing phase plus a six-second ACK delay', async () => {
  const h = terminalPage();
  const outcome = waitForTerminalObservation(h.page).then(value => ({ value }), error => ({ error }));
  h.advance(8000, 'session.end');
  h.advance(6000, 'session.ended');
  assert.deepEqual(await outcome, { value: { observation: 'provider_ack', endAcknowledged: true, atMs: 14_000 } });
  assert.equal(h.disposed, true);
});

test('terminal observer returns local closure immediately without upgrading it to an ACK', async () => {
  const h = terminalPage();
  let settled = false;
  const outcome = waitForTerminalObservation(h.page).then(value => { settled = true; return value; });
  h.advance(1000, 'socket.close');
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(settled, true);
  assert.deepEqual(await outcome, { observation: 'socket_close_without_ack', endAcknowledged: false, atMs: 1000 });
  assert.equal(h.disposed, true);
});

test('terminal observer still fails at twenty seconds when neither ACK nor socket close is observed', async () => {
  const h = terminalPage();
  let settled = false;
  const outcome = waitForTerminalObservation(h.page).then(() => { settled = true; return null; }, error => { settled = true; return error; });
  h.advance(19_999, 'session.end');
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  h.advance(1);
  assert.match((await outcome)?.message ?? '', /timeout/);
});

test('incremental lifecycle survives an assertion and separates missing ACK from local close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'qa-lifecycle-'));
  try {
    const file = join(directory, 'events.jsonl'); const journal = createLifecycleJournal(file);
    const privateValue = 'private-must-never-be-recorded';
    journal.record('end.requested', { outcome: 'requested', token: privateValue });
    journal.record('session.end', { source: 'browser', atMs: 123, outcome: 'observed' });
    journal.record('socket.close', { source: 'browser', atMs: 5123, code: 1000, clean: true, outcome: 'observed', reason: privateValue });
    assert.throws(() => { throw new Error('simulated browser disconnect'); });
    const saved = await readFile(file, 'utf8'); const events = saved.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(events.map(e => e.type), ['end.requested', 'session.end', 'socket.close']);
    assert.equal(saved.includes(privateValue), false);
    assert.equal(events.some(e => e.type === 'session.ended'), false);
    assert.ok(events.every((e, index) => index === 0 || e.elapsedMs >= events[index - 1].elapsedMs));
    journal.record('session.error', { source: 'browser', accountRefusal: 'provider_credit_refused', message: privateValue });
    const refusal = journal.snapshot().at(-1);
    assert.equal(refusal?.accountRefusal, 'provider_credit_refused');
    assert.equal(JSON.stringify(refusal).includes(privateValue), false);
    journal.record('watchdog.stop.requested', { outcome: 'observed' });
    journal.record('server.closed', { outcome: 'bounded_timeout' });
    assert.equal(journal.snapshot().at(-1)?.outcome, 'bounded_timeout');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
