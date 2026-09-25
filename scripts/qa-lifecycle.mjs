import { openSync, writeSync, fsyncSync, closeSync } from 'node:fs';

const TYPES = new Set(['worker.started', 'end.requested', 'session.end', 'session.ended', 'socket.open', 'socket.close', 'browser.disconnected', 'browser.close.requested', 'browser.closed', 'server.close.requested', 'server.closed', 'watchdog.stop.requested']);
/** Append and sync each narrow lifecycle record before another action can throw. */
export function createLifecycleJournal(path) {
  const start = performance.now(); const events = [];
  return {
    record(type, detail = {}) {
      if (!TYPES.has(type)) throw new Error('Unsupported lifecycle record.');
      const event = { type, observedAt: new Date().toISOString(), elapsedMs: performance.now() - start, source: detail.source === 'browser' ? 'browser' : 'driver' };
      if (Number.isFinite(detail.atMs)) event.browserAtMs = detail.atMs;
      if (['observed', 'requested', 'not_observed', 'bounded_timeout'].includes(detail.outcome)) event.outcome = detail.outcome;
      if (Number.isInteger(detail.code)) event.code = detail.code;
      if (typeof detail.clean === 'boolean') event.clean = detail.clean;
      if (Number.isFinite(detail.durationSeconds) && detail.durationSeconds >= 0) event.durationSeconds = detail.durationSeconds;
      const fd = openSync(path, 'a', 0o600);
      try { writeSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      events.push(event);
      return event;
    },
    snapshot() { return structuredClone(events); },
  };
}
