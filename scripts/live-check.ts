import { existsSync, readFileSync, writeFileSync, mkdirSync, rmdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createGameServer } from '../game/server/http.ts';
import type { HumanView, ToolResponse } from '../game/shared/contracts.ts';
import { VoiceProtocol, type ProviderEvent, type ProtocolDiagnostic } from '../game/client/voice-protocol.ts';
import { ProbeReplyTracker, settleAttempts, startProbeSupervisor, type ProbeSupervisor } from './live-check-support.ts';

// Opt-in only. An independent watchdog kills a stalled probe at 50 seconds.
// Reserve 50 seconds + possible 30-second disconnect grace + 2 seconds margin.
// Clean historical sessions settle from their acknowledged durations; uncertain
// legacy attempts retain their original 90-second reservation. Never erase attempts.
const ledgerPath = fileURLToPath(new URL('../.live-test-budget.json', import.meta.url));
const lockPath = fileURLToPath(new URL('../.live-test-lock', import.meta.url));
const allowance = 180;
const reserve = 82;
interface ProbeResult {
  reservedSeconds: number;
  accountedSeconds?: number;
  startedAt: string;
  outcome: string;
  ready: boolean;
  textSent: boolean;
  toolCalls: number;
  toolResults: number;
  successfulToolResults: number;
  robotRepliesAfterTool: number;
  audioEvents: number;
  endedAcknowledged: boolean;
  connectedSeconds: number;
  providerSessionSeconds: number | null;
  protocolTrace: { type: string; hasReplyId?: boolean; matchesToolReply?: boolean; status?: string }[];
  protocolDiagnostics: Partial<Record<ProtocolDiagnostic['event'], number>>;
}
interface Budget { reservedSeconds: number; attempts: ProbeResult[] }

async function main() {
  if (process.env.CI || process.env.GAME_DISABLE_LIVE === '1') throw new Error('Live checks are disabled in CI and Mock test environments.');
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
  catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw new Error('Could not load the local credential file.'); }
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.log('SKIPPED: no AssemblyAI credential. Provider connected time: 0 seconds.');
    return;
  }
  let locked = false;
  let server: ReturnType<typeof createGameServer> | undefined;
  let socket: WebSocket | undefined;
  let protocol: VoiceProtocol | undefined;
  let supervisor: ProbeSupervisor | undefined;
  let budget: Budget | undefined;
  const result: ProbeResult = {
    reservedSeconds: reserve, startedAt: new Date().toISOString(), outcome: 'not connected', ready: false, textSent: false,
    toolCalls: 0, toolResults: 0, successfulToolResults: 0, robotRepliesAfterTool: 0, audioEvents: 0,
    endedAcknowledged: false, connectedSeconds: 0, providerSessionSeconds: null, protocolTrace: [], protocolDiagnostics: {},
  };
  let connectedAt = 0;
  let closedAt = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let closeWatchdog: ReturnType<typeof setTimeout> | undefined;
  let finishing = false;
  let finish: (outcome: string) => void = () => {};
  const shutdown = new AbortController();
  const observationsRequestedAfterText = new Set<string>();
  const validatedObservations = new Set<string>();
  const replyTracker = new ProbeReplyTracker();
  const requestedCalls = new Set<string>();
  const stopOnSignal = () => {
    finish('probe stopped by signal');
    shutdown.abort();
  };
  const sendEnd = () => {
    try {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'session.end' }));
    } catch { /* A disconnected socket cannot acknowledge explicit termination. */ }
  };
  const closeSocket = () => { try { socket?.close(); } catch { /* Already disconnected. */ } };
  process.once('SIGINT', stopOnSignal);
  process.once('SIGTERM', stopOnSignal);
  try {
    try { mkdirSync(lockPath); locked = true; }
    catch { throw new Error('A live-check lock exists. Check for an active probe; do not run concurrent paid checks.'); }
    const loaded = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) as Budget : { reservedSeconds: 0, attempts: [] };
    if (!loaded || !Number.isFinite(loaded.reservedSeconds) || loaded.reservedSeconds < 0 || !Array.isArray(loaded.attempts)) throw new Error('Live-test budget ledger is invalid; preserve it for review.');
    loaded.reservedSeconds = settleAttempts(loaded.attempts);
    budget = loaded;
    if (budget.reservedSeconds + reserve > allowance) throw new Error('The Goal 001 live-test allowance is exhausted. No provider connection was opened.');
    budget.reservedSeconds += reserve;
    budget.attempts.push(result);
    writeFileSync(ledgerPath, JSON.stringify(budget, null, 2));
    server = createGameServer({ maxVoiceSessionSeconds: 60 });
    await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
      const signals = [shutdown.signal, AbortSignal.timeout(12_000), ...(signal ? [signal] : [])];
      const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any(signals) });
      if (!response.ok) throw new Error(`Local game API returned HTTP ${response.status}. No provider diagnostic was logged.`);
      return await response.json() as T;
    }
    let view = await post<HumanView>('/api/sessions', {});
    const path = `/api/sessions/${view.sessionId}`;
    const tokenData = await post<{ token: string; sessionConfig: unknown }>(`${path}/voice-token`, { roundId: view.roundId });
    if (shutdown.signal.aborted) throw new Error('Live probe stopped before the provider connection opened.');
    const url = new URL('wss://agents.assemblyai.com/v1/ws');
    url.searchParams.set('token', tokenData.token);
    supervisor = await startProbeSupervisor(process.pid);
    if (shutdown.signal.aborted) throw new Error('Live probe stopped before the provider connection opened.');
    const completed = new Promise<void>(resolve => {
      finish = (outcome: string) => {
        if (finishing) return;
        finishing = true;
        result.outcome = outcome;
        sendEnd();
        void protocol?.stop();
        closeWatchdog = setTimeout(() => { closeSocket(); resolve(); }, 3000);
      };
      socket = new WebSocket(url);
      protocol = new VoiceProtocol({
        send(event) {
          if (finishing || socket?.readyState !== WebSocket.OPEN) return;
          try {
            socket.send(JSON.stringify(event));
            if (event.type === 'tool.result') {
              result.toolResults++;
              if (typeof event.call_id === 'string' && validatedObservations.has(event.call_id) && event.is_error === false) result.successfulToolResults++;
            }
          } catch { finish('provider send failed'); }
        },
        async executeTool(call, signal) {
          const response = await post<ToolResponse>(`${path}/tools`, { roundId: view.roundId, actionEpoch: view.actionEpoch, callId: call.callId, name: call.name, arguments: call.arguments }, signal);
          view = response.view;
          if (observationsRequestedAfterText.has(call.callId) && call.name === 'observe_room' && response.ok) validatedObservations.add(call.callId);
          return { ok: response.ok, message: response.message };
        },
        async cancelPending() {
          view = await post<HumanView>(`${path}/cancel`, { roundId: view.roundId, requestId: crypto.randomUUID() });
        },
        onTranscript(entry) {
          if (entry.role === 'robot' && entry.final) {
            replyTracker.markFinal(entry.id);
            result.robotRepliesAfterTool = replyTracker.finalCount;
            if (replyTracker.complete && result.textSent && result.successfulToolResults > 0) finish('passed real configuration, text, tool, and reply round trip');
          }
        },
        onDiagnostic(event) {
          if (['tool.queued', 'reply.completed', 'tool.execute.started', 'tool.execute.finished', 'tool.result.sent'].includes(event.event)) {
            result.protocolDiagnostics[event.event] = (result.protocolDiagnostics[event.event] ?? 0) + 1;
          }
        },
        onStatus() {}, onError() { finish('protocol failure'); }, playAudio() {}, stopAudio() {},
      });
      socket.addEventListener('open', () => {
        connectedAt = performance.now();
        if (finishing || shutdown.signal.aborted) { sendEnd(); closeSocket(); return; }
        try { socket!.send(JSON.stringify({ type: 'session.update', session: tokenData.sessionConfig })); }
        catch { finish('provider configuration send failed'); }
      });
      socket.addEventListener('message', event => {
        try {
        let message: ProviderEvent;
        try { message = JSON.parse(String(event.data)) as ProviderEvent; }
        catch { finish('invalid provider JSON'); return; }
        if (!message || typeof message.type !== 'string') { finish('invalid provider event'); return; }
        // Never log session.ready, raw errors, tokens, configuration echoes, or URLs.
        if (message.type === 'tool.call' && typeof message.call_id === 'string') requestedCalls.add(message.call_id);
        if (['session.ready', 'reply.started', 'reply.done', 'tool.call', 'input.speech.started', 'session.error', 'session.ended'].includes(message.type) && result.protocolTrace.length < 60) {
          result.protocolTrace.push({ type: message.type,
            ...(['reply.started', 'reply.done'].includes(message.type) ? { hasReplyId: typeof message.reply_id === 'string' } : {}),
            ...(message.type === 'reply.done' ? {
              matchesToolReply: typeof message.reply_id === 'string' && [...requestedCalls].some(id => message.reply_id === `fc-${id}`),
              status: message.status === 'completed' || message.status === 'interrupted' ? message.status : 'other',
            } : {}),
          });
        }
        if (message.type === 'session.ready') result.ready = true;
        if (message.type === 'reply.audio') result.audioEvents++;
        if (message.type === 'tool.call') {
          result.toolCalls++;
          if (result.textSent && message.name === 'observe_room' && typeof message.call_id === 'string') observationsRequestedAfterText.add(message.call_id);
        }
        if (message.type === 'session.error' || message.type === 'error') { finish('provider rejected configuration or protocol'); return; }
        if (message.type === 'session.ended') {
          result.endedAcknowledged = true;
          if (typeof message.session_duration_seconds === 'number') result.providerSessionSeconds = message.session_duration_seconds;
          if (!finishing) result.outcome = 'provider ended before probe completed';
          finishing = true;
          closeSocket();
          resolve();
          return;
        }
        if (finishing) return;
        if (message.type === 'reply.started' && typeof message.reply_id === 'string' && !message.reply_id.startsWith('fc-') && result.successfulToolResults > 0) {
          replyTracker.markStarted(`robot:${message.reply_id}`);
        }
        if (message.type === 'reply.done' && message.status === 'completed' && typeof message.reply_id === 'string') {
          replyTracker.markDone(`robot:${message.reply_id}`);
        }
        protocol!.receive(message);
        if (message.type === 'reply.done' && typeof message.reply_id === 'string' && !message.reply_id.startsWith('fc-') && message.status === 'completed' && result.ready && !result.textSent && !finishing) {
          result.textSent = true;
          socket!.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'Mission Control here. Could you take a look around and tell me what you can see?' }));
          socket!.send(JSON.stringify({ type: 'reply.create' }));
        } else if (replyTracker.complete && result.textSent && result.successfulToolResults > 0 && !finishing) {
          finish('passed real configuration, text, tool, and reply round trip');
        }
        } catch { finish('provider event processing failed'); }
      });
      socket.addEventListener('error', () => finish('provider connection error'));
      socket.addEventListener('close', () => { closedAt = performance.now(); if (!finishing) result.outcome = 'connection closed before probe completed'; resolve(); });
      watchdog = setTimeout(() => finish('45-second probe watchdog reached'), 45_000);
    });
    await completed;
    if (!result.outcome.startsWith('passed') || !result.endedAcknowledged) process.exitCode = 1;
  } catch (error) {
    result.outcome = error instanceof Error && !connectedAt ? error.message : 'Live probe failed; raw diagnostics withheld.';
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    clearTimeout(closeWatchdog);
    sendEnd();
    closeSocket();
    await protocol?.stop();
    if (server) await new Promise<void>(resolve => { server!.close(() => resolve()); server!.closeAllConnections(); });
    await supervisor?.stop();
    result.connectedSeconds = connectedAt ? Math.round(((closedAt || performance.now()) - connectedAt) / 100) / 10 : 0;
    if (budget) {
      budget.reservedSeconds = settleAttempts(budget.attempts);
      writeFileSync(ledgerPath, JSON.stringify(budget, null, 2));
    }
    if (locked) rmdirSync(lockPath);
    process.removeListener('SIGINT', stopOnSignal);
    process.removeListener('SIGTERM', stopOnSignal);
    console.log(JSON.stringify({ ...result, reservedGoalSeconds: budget?.reservedSeconds ?? 0, goalLimitSeconds: allowance, microphoneTested: false, audiblePlaybackTested: false }, null, 2));
  }
}

await main().catch(() => { console.error('Live probe did not start. Check the local environment; no secrets were logged.'); process.exitCode = 1; });
