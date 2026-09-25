import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLifecycleJournal } from '../scripts/qa-lifecycle.mjs';

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
    journal.record('watchdog.stop.requested', { outcome: 'observed' });
    journal.record('server.closed', { outcome: 'bounded_timeout' });
    assert.equal(journal.snapshot().at(-1)?.outcome, 'bounded_timeout');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
