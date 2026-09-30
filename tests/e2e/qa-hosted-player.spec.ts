import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import type { WebSocketRoute } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { sessionConfig } from '../../game/agent/config';
import { simulationReply, simulationToolSpeech, rememberLocalResult, type PracticeMemory } from '../../game/client/mock';
import type { ToolResult, Chapter } from '../../game/shared/contracts';
import { runRescuePlayer, type VisibleConfirmation } from '../../scripts/qa-mission-player.mjs';
import { installAudioInstrumentation, audioSnapshot, cleanupAudioInstrumentation } from '../../scripts/qa-browser-instrumentation.mjs';
import { encodePcmWav } from '../../scripts/qa-speech-fixtures.mjs';
import { submitPlayerTurn, waitBeforePlayerTurn, waitForTurn } from '../../scripts/qa-turn-pacing.mjs';
import { captureHostedHttp } from '../../scripts/qa-hosted-live.mjs';
import { auditHostedDecisions } from '../../scripts/qa-hosted-policy.mjs';
import { evaluateAcceptanceBehavior, type AcceptanceStep } from '../../scripts/qa-acceptance-behavior.mjs';

test.use({ compiledProduction: true });

for (const scenario of ['ordinary', 'recorder-recovery'] as const) test.describe(`Hosted player offline Voice ${scenario}`, () => {
  test.use({ galleryConfiguration: scenario === 'ordinary' ? 'a' : 'b' });
  test('uses microphone-path input, exact UI decisions and safe HTTP evidence through confirmed home', async ({ page, baseURL }, info) => {
    test.setTimeout(90_000);
    expect(process.env.GAME_DISABLE_LIVE).toBe('1');
    const requests: string[] = []; const outside: string[] = []; const sent: Array<Record<string, unknown>> = [];
    const token = { count: 0 }; let peer: WebSocketRoute; let reply = 0; let toolCount = 0;
    let knowledge: PracticeMemory = { chapter: 'cargo', gates: [] };
    let decision: { proposal: { id: string; label: string; status: string }; result: ToolResult } | undefined;
    const configHash = createHash('sha256').update(JSON.stringify({ type: 'session.update', session: sessionConfig })).digest('hex');
    await installAudioInstrumentation(page, { label: 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO', expectedSessionUpdateSha256: configHash, maxProviderSockets: 1 });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { outside.push(url.origin); return route.abort(); }
      return route.fallback();
    });
    await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, message: 'Explicit offline test peer only.' } }));
    await page.route('**/voice-token', route => { token.count++; return route.fulfill({ json: { token: 'offline-fixture-only', sessionConfig, maxSessionSeconds: 900 } }); });
    const emit = (event: Record<string, unknown>) => peer.send(JSON.stringify(event));
    const speak = (text: string) => {
      const id = `offline-voice-${++reply}`;
      emit({ type: 'reply.started', reply_id: id }); emit({ type: 'transcript.agent', reply_id: id, text });
      const pcm = Buffer.alloc(2400 * 2); for (let i = 0; i < 2400; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 10) * 3000), i * 2);
      emit({ type: 'reply.audio', reply_id: id, data: pcm.toString('base64') });
      emit({ type: 'reply.done', reply_id: id, status: 'completed' });
    };
    await page.routeWebSocket('wss://agents.assemblyai.com/**', socket => {
      peer = socket; // No connectToServer. This is a constructed offline peer.
      socket.onMessage(data => {
        const event = JSON.parse(String(data));
        sent.push(event.type === 'input.audio' || event.type === 'session.update' ? { type: event.type } : event);
        if (event.type === 'session.update') emit({ type: 'session.ready' });
        if (event.type === 'session.end') { emit({ type: 'session.ended', session_duration_seconds: 0 }); void peer.close({ code: 1000 }); }
        if (event.type === 'conversation.message' && event.role === 'system' && String(event.content).startsWith('Verified game decision receipt.')) decision = JSON.parse(String(event.content).split('\n').slice(1).join('\n'));
        if (event.type === 'reply.create' && decision && String(event.instructions).includes(decision.proposal.id)) speak(`The game ${decision.proposal.status === 'committed' ? 'confirmed' : 'did not execute'}: ${decision.proposal.label}.`);
      });
    });
    const observer = captureHostedHttp(page, baseURL!);
    const call = async (name: string, args: Record<string, unknown>) => {
      const id = `offline-hosted-tool-${++toolCount}`; const start = sent.length;
      emit({ type: 'reply.started', reply_id: id }); emit({ type: 'tool.call', call_id: id, name, arguments: args }); emit({ type: 'reply.done', reply_id: id, status: 'completed' });
      await expect.poll(() => sent.slice(start).find(e => e.type === 'tool.result' && e.call_id === id)).toBeTruthy();
      const result = JSON.parse(String(sent.slice(start).find(e => e.type === 'tool.result' && e.call_id === id)!.result)) as ToolResult;
      const chapter: Chapter = result.perception ? 'gallery' : /Return Dock/.test(result.message) ? 'return_dock' : knowledge.chapter;
      knowledge = rememberLocalResult(knowledge, result.message, chapter, result.perception);
      if (result.proposal) knowledge.proposalId = result.proposal.id;
      return result;
    };
    const samples = new Int16Array(12_000);
    for (let i = 2400; i < 7200; i++) samples[i] = Math.round(Math.sin(i / 14) * 5000);
    const fixturePath = info.outputPath('synthetic-input.wav'); await writeFile(fixturePath, encodePcmWav(samples));
    await page.goto('/');
    await page.evaluate(() => {
      const label = document.createElement('div'); label.textContent = 'OFFLINE QA / FAKE PROVIDER / SYNTHETIC AUDIO';
      label.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#181e19;color:white;padding:4px 12px;font:13px sans-serif;text-align:center;pointer-events:none'; document.body.append(label);
    });
    if (scenario === 'recorder-recovery') await page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true }).check();
    await page.getByRole('radio', { name: /Live Voice/ }).check(); await page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
    await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click(); await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
    await page.getByRole('button', { name: 'Connect Live Voice', exact: true }).click(); await expect(page.getByLabel('Type a message')).toBeEnabled();
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    const history = () => page.locator('.history-message').evaluateAll(elements => elements.map(element => ({ speaker: element.querySelector('strong')?.textContent ?? '',
      text: element.querySelector('p')?.textContent ?? '', final: !/Partial transcript/.test(element.textContent ?? ''), interrupted: /Interrupted \/ incomplete speech/.test(element.textContent ?? ''),
      displayedAt: element.querySelector('time')?.getAttribute('datetime') ?? null, sourceLabel: element.querySelector('.source-label')?.textContent ?? null,
      chapterLabel: element.querySelector('.chapter-source')?.textContent ?? null })));
    const report: { route: string[]; steps: AcceptanceStep[]; confirmations?: VisibleConfirmation[]; recoveryExercise?: unknown; completion?: boolean } = { route: [], steps: [] };
    const say = async (text: string) => {
      requests.push(text); await waitBeforePlayerTurn(page, { mode: 'voice', confirmation: report.confirmations?.at(-1), timeoutMs: 3000 });
      const before = await audioSnapshot(page);
      const previous = new Set((await history()).map(item => JSON.stringify(item)));
      await submitPlayerTurn(page, { mode: 'voice', text, fixture: { id: `offline-utterance-${requests.length}`, text, path: fixturePath } });
      // The source wave and this transcript are explicitly constructed test data;
      // this proves microphone-path routing, never real speech recognition.
      emit({ type: 'input.speech.started' }); emit({ type: 'input.speech.stopped' }); emit({ type: 'transcript.user', item_id: `offline-asr-${requests.length}`, text });
      const interpreted = simulationReply(text, knowledge);
      const direction = text.match(/\b(east|west|northeast|northwest|southeast|southwest) (?:gate|opening)/i)?.[1]?.toLowerCase();
      // This constructed peer understands a read-only question plus its report
      // clause. It consults only gate labels from its own local observations.
      const inspection = knowledge.chapter === 'gallery' && direction && knowledge.gates.some(gate => gate.label === direction)
        && /inspect|check|clear or blocked/i.test(text) && !/go through|move through/i.test(text);
      let result = inspection ? await call('inspect_gate', { direction }) : interpreted.call ? await call(interpreted.call.name, interpreted.call.arguments as Record<string, unknown>) : null;
      if (/propose confirming.*return|new proposal to confirm the authorized return/i.test(text) && !result?.proposal) result = await call('propose_interaction', { object: 'return.capsule', action: 'confirm_return' });
      const response = result ? simulationToolSpeech(result) : interpreted.message;
      speak(response); await waitForTurn(page, { mode: 'voice', afterMs: before.elapsedMs, timeoutMs: 3000 });
      const proposal = await page.getByTestId('action-proposal').evaluateAll(elements => {
        const element = elements[0]; return element ? { proposalId: element.getAttribute('data-proposal-id') ?? '', label: element.querySelector('[data-testid="proposal-label"]')?.textContent ?? '', status: element.getAttribute('data-status') ?? '' } : null;
      });
      report.steps.push({ turnId: requests.length, utterance: text, startedAtMs: before.elapsedMs, endedAtMs: (await audioSnapshot(page)).elapsedMs, settled: true,
        messages: (await history()).filter(item => !previous.has(JSON.stringify(item))), proposal });
      return response;
    };
    try {
      await runRescuePlayer({ page, say, report, exerciseRecovery: scenario === 'recorder-recovery', optionalObjective: scenario === 'recorder-recovery' ? 'flight_recorder' : undefined,
        waitForReady: () => waitBeforePlayerTurn(page, { mode: 'voice', confirmation: report.confirmations?.at(-1), timeoutMs: 3000 }) });
      await expect.poll(async () => (await audioSnapshot(page)).events.some(e => e.type === 'session.ended')).toBe(true);
      await observer.settle();
      expect(auditHostedDecisions({ decisions: observer.decisions, views: observer.views, confirmations: report.confirmations,
        recorder: scenario === 'recorder-recovery', recovery: scenario === 'recorder-recovery' ? report.recoveryExercise : null }).passed).toBe(true);
      const audio = await audioSnapshot(page);
      const behavior = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: report.steps, events: audio.events, confirmations: report.confirmations });
      expect(behavior.materialDefects).toEqual([]); expect(behavior.uncertainties.filter(item => item.blocking)).toEqual([]); expect(behavior.status).toBe('pass');
      expect(audio.counters.input.nonzeroSamples).toBeGreaterThan(0);
      expect(audio.counters.rendered.nonzeroSamples).toBeGreaterThan(0);
      expect(audio.counters.postVolume.nonzeroSamples).toBeGreaterThan(0);
      expect(token.count).toBe(1); expect(outside).toEqual([]);
      expect(sent.some(event => event.type === 'conversation.message' && event.role === 'user')).toBe(false);
      if (scenario === 'recorder-recovery') {
        expect(report.route).toContain('leaf'); expect(report.route.filter(room => room === 'fork').length).toBeGreaterThan(1);
        expect(requests).toContain('Please pick up the flight recorder.'); await expect(page.locator('.homecoming-recorder')).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(`offline-hosted-${scenario}.png`), animations: 'disabled' });
    } finally { observer.close(); await cleanupAudioInstrumentation(page).catch(() => {}); }
  });
});
