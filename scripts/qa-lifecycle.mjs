import { openSync, writeSync, fsyncSync, closeSync } from 'node:fs';

const TYPES = new Set(['worker.started', 'end.requested', 'session.end', 'session.ended', 'session.error', 'socket.open', 'socket.close', 'browser.disconnected', 'browser.close.requested', 'browser.closed', 'server.close.requested', 'server.closed', 'watchdog.stop.requested']);

// Observe the existing close protocol only: up to 8s closing + 10s End + 2s
// processing. Local close finishes observation, but never confirms remote end.
export async function waitForTerminalObservation(page, { timeoutMs = 20_000 } = {}) {
  const timeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(20_000, timeoutMs)) : 20_000;
  const handle = await page.waitForFunction(() => {
    const events = globalThis.__qaAudio?.snapshot().events ?? [];
    const ended = events.find(event => event.type === 'session.ended');
    if (ended) return { observation: 'provider_ack', endAcknowledged: true, atMs: ended.atMs };
    const closed = events.find(event => event.type === 'socket.close');
    return closed ? { observation: 'socket_close_without_ack', endAcknowledged: false, atMs: closed.atMs } : false;
  }, null, { timeout });
  try { return await handle.jsonValue(); } finally { await handle.dispose(); }
}

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
      if (['provider_credit_refused', 'provider_credential_or_account_refused'].includes(detail.accountRefusal)) event.accountRefusal = detail.accountRefusal;
      const fd = openSync(path, 'a', 0o600);
      try { writeSync(fd, JSON.stringify(event) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      events.push(event);
      return event;
    },
    snapshot() { return structuredClone(events); },
  };
}
