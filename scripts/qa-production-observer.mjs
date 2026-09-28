// Evaluator-only IPC around the actual compiled production entry point.
// Nothing here is sent to the browser, shared player, prompt or provider.
import { SessionStore } from '../dist/server/server/sessions.js';
import { startProductionServer } from '../dist/server/server/production.js';

if (!process.send) throw new Error('The QA production observer requires its owning process IPC channel.');
const commits = [];
const store = new SessionStore({ onRobotCommit: event => commits.push({ ...event, observedAt: Date.now() }) });
const server = startProductionServer(store);
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
