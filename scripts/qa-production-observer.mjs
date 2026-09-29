// Evaluator-only IPC around the actual compiled production entry point.
// Nothing here is sent to the browser, shared player, prompt or provider.
import { resolve } from 'node:path';
import { isGoal005ProductionReservationClosed, QA_GOAL005_AMENDMENT_ID } from './qa-amended-budget.mjs';
import { SessionStore } from '../dist/server/server/sessions.js';
import { startProductionServer } from '../dist/server/server/production.js';

if (!process.send) throw new Error('The QA production observer requires its owning process IPC channel.');
const commits = [];
const store = new SessionStore({ onRobotCommit: event => commits.push({ ...event, observedAt: Date.now() }) });
const extended = process.env.QA_CAMPAIGN_AMENDMENT === QA_GOAL005_AMENDMENT_ID;
const server = startProductionServer(store, extended ? { maxVoiceSessionSeconds: 900,
  onProviderAccountRefusal: reason => new Promise((resolveStop, rejectStop) => {
    const id = `account-stop-${Date.now()}`;
    const timer = setTimeout(() => { process.off('message', listener); rejectStop(new Error('The permanent accounting stop was not acknowledged.')); }, 10_000);
    const listener = message => { if (message?.type === 'qa.account-stop.recorded' && message.id === id) { clearTimeout(timer); process.off('message', listener); message.recorded ? resolveStop() : rejectStop(new Error('The permanent accounting stop failed.')); } };
    process.on('message', listener); process.send({ type: 'qa.account-stop', id, reason });
  }), confirmedClosed: reservation => isGoal005ProductionReservationClosed(resolve('.validation/goal-004c-live'), reservation) } : undefined);
process.on('message', message => {
  if (message?.type !== 'qa.physical' || !Number.isSafeInteger(message.id) || typeof message.sessionId !== 'string') return;
  try {
    const digest = store.physicalDigestForEvaluation(message.sessionId);
    const observed = commits.filter(event => event.sessionId === message.sessionId);
    process.send?.({ type: 'qa.physical.result', id: message.id, digest, commits: observed });
  } catch { process.send?.({ type: 'qa.physical.result', id: message.id, error: 'The evaluator session is unavailable.' }); }
});
process.on('disconnect', () => { server.close(); server.closeAllConnections(); });
server.on('close', () => { if (process.connected) process.disconnect(); });
