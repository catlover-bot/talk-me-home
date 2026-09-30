// One explicit hosted attempt. Accounting belongs exclusively to the hosted service.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, copyFile, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSpeechFixture } from './qa-speech-fixtures.mjs';
import { playerSpeechTexts, speechFixtureId, readFrozenSpeechFixture, validateFrozenPlayerSpeech } from './qa-live-speech.mjs';
import { installAudioInstrumentation, audioSnapshot, collectAudioEvidence, cleanupAudioInstrumentation } from './qa-browser-instrumentation.mjs';
import { runRescuePlayer } from './qa-mission-player.mjs';
import { evaluateAcceptanceBehavior } from './qa-acceptance-behavior.mjs';
import { waitForTurn, waitBeforePlayerTurn, submitPlayerTurn } from './qa-turn-pacing.mjs';
import { createLifecycleJournal, waitForTerminalObservation } from './qa-lifecycle.mjs';
import { hostedOrigin, verifyHostedAllocation, verifyPricing, readHostedCredential, auditHostedDecisions, hostedMeasurements, finalizeSupervisedReport, publicHostedSummary } from './qa-hosted-policy.mjs';

const SELF = fileURLToPath(import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const HARNESS = ['qa-hosted-live.mjs', 'qa-hosted-policy.mjs', 'qa-mission-player.mjs', 'qa-player-policy.mjs', 'qa-player-memory.mjs', 'qa-player-recovery.mjs', 'qa-acceptance-behavior.mjs', 'qa-live-speech.mjs', 'qa-speech-fixtures.mjs', 'qa-browser-instrumentation.mjs', 'qa-turn-pacing.mjs', 'qa-lifecycle.mjs'];
const labelFor = mode => mode === 'voice' ? 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI' : 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI';
const safeError = error => String(error?.message ?? error).split('\n')[0].replace(/(?:https?|wss?):\/\/\S+/g, '[URL omitted]').replace(/\b(?:Bearer|token|authorization|cookie)\s*[:=]?\s*\S+/gi, '[credential detail omitted]').slice(0, 400);

export function parseHostedArgs(args) {
  const result = { mode: 'voice', scenario: 'ordinary', fixtureDir: resolve('.validation/goal-007/speech') };
  const flags = new Set(['live', 'worker', 'prepare-speech']);
  const values = new Map([['origin', 'origin'], ['credential-file', 'credentialFile'], ['expected-commit', 'expectedCommit'],
    ['expected-runtime-sha256', 'expectedRuntimeSha256'], ['expected-config-sha256', 'expectedConfigSha256'], ['speech-manifest', 'speechManifest'],
    ['pricing-file', 'pricingFile'], ['mode', 'mode'], ['scenario', 'scenario'], ['diagnostic-reason', 'diagnosticReason'],
    ['run-id', 'runId'], ['fixture-dir', 'fixtureDir'], ['reuse-fixtures', 'reuseFixtures']]);
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--')) throw new Error('Use named hosted QA options.');
    if (flags.has(name)) result[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
    else if (values.has(name) && args[i + 1] && !args[i + 1].startsWith('--')) result[values.get(name)] = args[++i];
    else throw new Error('Unknown or incomplete hosted QA option.');
  }
  if (!['voice', 'text'].includes(result.mode) || !['ordinary', 'recorder-recovery'].includes(result.scenario)) throw new Error('Choose a supported hosted scenario and mode.');
  if (result.live) {
    result.origin = hostedOrigin(result.origin);
    if (result.prepareSpeech || !/^[a-f0-9]{40}$/.test(result.expectedCommit ?? '') || !/^[a-f0-9]{64}$/.test(result.expectedRuntimeSha256 ?? '')
      || !/^[a-f0-9]{64}$/.test(result.expectedConfigSha256 ?? '') || !/^[a-z0-9][a-z0-9-]{2,80}$/.test(result.runId ?? '')
      || !result.credentialFile || !result.pricingFile || !result.speechManifest || result.mode === 'text' && !result.diagnosticReason) throw new Error('Explicit hosted execution requires frozen identities, private credentials, pricing, speech manifest and a unique run ID; Text also needs a diagnostic reason.');
  }
  return result;
}

async function harnessIdentity() {
  const files = {};
  for (const name of HARNESS) files[name] = digest(await readFile(new URL(name, import.meta.url)));
  return { files, sha256: digest(JSON.stringify(files)) };
}
async function persist(directory, report) {
  const pending = join(directory, 'report.pending.json');
  await writeFile(pending, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flush: true });
  await rename(pending, join(directory, 'report.json'));
}
async function prepareSpeech(options) {
  const directory = resolve(options.fixtureDir); await mkdir(directory, { recursive: true, mode: 0o700 });
  const files = {};
  for (const text of playerSpeechTexts()) {
    const id = speechFixtureId(text);
    if (options.reuseFixtures) for (const ext of ['wav', 'json']) {
      try { await copyFile(join(resolve(options.reuseFixtures), `${id}.${ext}`), join(directory, `${id}.${ext}`), constants.COPYFILE_EXCL); }
      catch (error) { if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error; }
    }
    await ensureSpeechFixture({ id, text, directory });
    for (const ext of ['wav', 'json']) files[`${id}.${ext}`] = digest(await readFile(join(directory, `${id}.${ext}`)));
  }
  const hash = digest(JSON.stringify(files)); const path = join(directory, `manifest-${hash}.json`);
  const manifest = { label: 'OFFLINE SYNTHETIC SPEECH FIXTURES; NO PROVIDER CALLS', directory, fixtureFiles: files, fixtureSha256: hash };
  try { await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return { utterances: playerSpeechTexts().length, manifest: path, fixtureSha256: hash };
}

export function captureHostedHttp(page, origin) {
  const decisions = []; const views = []; const records = []; const refusals = []; const pending = new Set(); const errors = [];
  const allocation = { value: null, failureAttempt: null };
  const listener = response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !/^\/api\/sessions(?:\/[^/]+(?:\/(?:tools|proposal-decision|power|relay|dock-control|stop|end|resume|messages|record|voice-token|live-refusal))?)?$/.test(url.pathname)) return;
    const task = (async () => {
      if (url.pathname.endsWith('/voice-token')) {
        allocation.failureAttempt = (await response.allHeaders())['x-tmh-allocation-attempt'] ?? null;
        allocation.httpStatus = response.status();
        if (response.ok()) { const body = await response.json(); allocation.value = body.allocation; allocation.maxSessionSeconds = body.maxSessionSeconds; }
        return; // Never retain the token or session configuration response.
      }
      if (!response.ok()) return;
      const body = await response.json();
      if (url.pathname.endsWith('/record')) { records.push(structuredClone(body)); return; } // Normal human mission history only.
      if (url.pathname.endsWith('/live-refusal')) {
        const reason = response.request().postDataJSON()?.reason;
        if (body.stopped === true && body.source === 'client_report' && ['provider_credit_refused', 'provider_credential_or_account_refused'].includes(reason)) refusals.push({ at: new Date().toISOString(), reason, stopped: true, source: 'client_report' });
        return;
      }
      const view = body.view ?? (typeof body.completed === 'boolean' ? body : null);
      if (view) views.push(structuredClone(view)); // Only the browser-safe HumanView.
      if (url.pathname.endsWith('/proposal-decision')) {
        const request = response.request().postDataJSON();
        decisions.push({ at: new Date().toISOString(), request: { proposalId: request.proposalId, decision: request.decision }, proposal: structuredClone(body.view?.proposal ?? body.proposal) });
      }
    })().catch(() => { errors.push('An ordinary HTTP evidence response could not be captured.'); }).finally(() => pending.delete(task));
    pending.add(task);
  };
  page.on('response', listener);
  return { decisions, views, records, refusals, allocation, errors, async settle() { await Promise.allSettled([...pending]); }, close() { page.off('response', listener); } };
}

async function worker(options, directory) {
  if (!process.send || !process.connected) throw new Error('Hosted QA requires its independent parent supervisor.');
  const pricing = verifyPricing(JSON.parse(await readFile(options.pricingFile, 'utf8')));
  const fixtures = JSON.parse(await readFile(options.speechManifest, 'utf8'));
  if (digest(JSON.stringify(fixtures.fixtureFiles)) !== fixtures.fixtureSha256) throw new Error('The frozen speech manifest does not match its digest.');
  await validateFrozenPlayerSpeech(fixtures.fixtureFiles, fixtures.directory);
  const frozenHarness = await harnessIdentity();
  const accessCode = await readHostedCredential(options.credentialFile, options.origin, options.mode);
  const journal = createLifecycleJournal(join(directory, 'lifecycle.jsonl')); journal.record('worker.started', { outcome: 'observed' });
  const report = { label: labelFor(options.mode), origin: options.origin, scenario: options.scenario, mode: options.mode,
    expectedCommit: options.expectedCommit, expectedRuntimeSha256: options.expectedRuntimeSha256, expectedConfigSha256: options.expectedConfigSha256,
    harness: frozenHarness, fixtureSha256: fixtures.fixtureSha256, pricing, diagnosticReason: options.diagnosticReason,
    route: [], steps: [], tokenRequests: 0, completion: false, startedAt: new Date().toISOString() };
  let server; let browser; let context; let page; let observer; let evidence; let failure; let stopping = false; let endPromise; let tokenArmed = false; let ownedBrowser; let disconnectTimer;
  const end = () => endPromise ??= (async () => {
    stopping = true; journal.record('end.requested', { outcome: 'requested' });
    if (!page || page.isClosed()) return;
    try {
      const button = page.getByRole('button', { name: 'Pause / End call', exact: true });
      if (await button.isVisible()) await button.click({ timeout: 2000 });
      await waitForTerminalObservation(page, { timeoutMs: 12_000 }).catch(() => {});
    } catch { /* The independent watchdog still closes owned resources. */ }
  })();
  const stop = message => { if (message?.type === 'qa.stop') { failure ??= 'Independent hosted QA watchdog stopped this attempt.'; void end(); } };
  process.on('message', stop);
  const disconnected = () => {
    failure ??= 'The independent hosted supervisor disconnected.'; void end();
    disconnectTimer = setTimeout(() => { void terminateOwned(ownedBrowser, 'SIGKILL'); }, 15_000);
  };
  process.once('disconnect', disconnected);
  try {
    const versionResponse = await fetch(`${options.origin}/api/version`, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    const version = await versionResponse.json();
    if (!versionResponse.ok || version.commit !== options.expectedCommit) throw new Error('The active hosted commit differs from the frozen tested main revision.');
    report.hostedVersion = { commit: version.commit, version: version.version };
    server = await chromium.launchServer({ headless: true, chromiumSandbox: true });
    ownedBrowser = await processIdentity(server.process().pid);
    await new Promise((resolveOwned, rejectOwned) => {
      const finish = error => { clearTimeout(timer); process.off('message', registered); process.off('disconnect', lost); error ? rejectOwned(error) : resolveOwned(); };
      const registered = message => { if (message?.type === 'qa.browser-owned' && message.pid === ownedBrowser?.pid) finish(); };
      const lost = () => finish(new Error('The independent supervisor disconnected before browser ownership was established.'));
      const timer = setTimeout(() => finish(new Error('The independent supervisor did not establish browser ownership.')), 5000);
      process.on('message', registered); process.once('disconnect', lost);
      process.send({ type: 'qa.browser', pid: ownedBrowser?.pid }, error => { if (error) finish(new Error('The browser ownership request could not reach the supervisor.')); });
    });
    browser = await chromium.connect(server.wsEndpoint()); report.browserVersion = browser.version();
    report.browserExecutableSha256 = digest(await readFile(chromium.executablePath())); report.nodeVersion = process.version;
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce', recordVideo: { dir: directory, size: { width: 1920, height: 1080 } } });
    report.videoPageCreationStartedAt = Date.now(); page = await context.newPage(); report.videoPageCreatedAt = Date.now(); page.setDefaultTimeout(6000);
    observer = captureHostedHttp(page, options.origin);
    await installAudioInstrumentation(page, { label: report.label, expectedSessionUpdateSha256: options.expectedConfigSha256, maxProviderSockets: 1,
      onLifecycle: event => { journal.record(event.type, { ...event, source: 'browser', outcome: 'observed' }); } });
    await page.addInitScript(label => { document.addEventListener('DOMContentLoaded', () => {
      const badge = document.createElement('div'); badge.textContent = label;
      badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#181e19;color:white;padding:4px 12px;font:13px sans-serif;text-align:center;pointer-events:none'; document.body.append(badge);
      globalThis.__qaPublicCheckpoints = []; const seen = new Set();
      new MutationObserver(() => { for (const h of document.querySelectorAll('h1,h2')) {
        const title = h.textContent.trim();
        if (['Cargo Bay', 'Relay Gallery', 'Return Dock', 'You brought Pip home.'].includes(title) && !seen.has(title) && h.getClientRects().length) { seen.add(title); globalThis.__qaPublicCheckpoints.push({ title, atMs: globalThis.__qaAudio.snapshot().elapsedMs }); }
      } }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }); }, report.label);
    await page.route('**/*', route => new URL(route.request().url()).origin === options.origin ? route.fallback() : route.abort());
    await page.route('**/voice-token', async route => {
      report.tokenRequests++;
      if (report.tokenRequests !== 1 || stopping || !tokenArmed) { failure = 'An unsolicited or repeated token request was blocked.'; return route.abort(); }
      try {
        verifyPricing(pricing); // Refuse stale price evidence again immediately before spending.
        if ((await harnessIdentity()).sha256 !== frozenHarness.sha256) throw new Error('Frozen harness changed before the token request.');
        await new Promise((resolveArmed, rejectArmed) => {
          const finish = error => { clearTimeout(timer); process.off('message', armed); process.off('disconnect', lost); error ? rejectArmed(error) : resolveArmed(); };
          const armed = message => { if (message?.type === 'qa.watchdog-armed') finish(); };
          const lost = () => finish(new Error('The independent supervisor disconnected before token execution.'));
          const timer = setTimeout(() => finish(new Error('The independent token watchdog was not armed.')), 5000);
          process.on('message', armed); process.once('disconnect', lost);
          process.send({ type: 'qa.token-attempt' }, error => { if (error) finish(new Error('The token watchdog request could not reach the supervisor.')); });
        });
        await persist(directory, report);
        if (!process.connected || stopping) throw new Error('The independent supervisor is unavailable; token execution was blocked.');
        await route.continue(); // The server reserves before contacting AssemblyAI.
      } catch (error) { failure = safeError(error); await route.abort(); }
    });
    const screenshot = name => page.screenshot({ path: join(directory, `${name}.png`), mask: [page.locator('#demo-code')], animations: 'disabled' });
    await page.goto(options.origin, { waitUntil: 'networkidle' });
    report.audioTimeOriginWallMs = await page.evaluate(() => Date.now() - globalThis.__qaAudio.snapshot().elapsedMs);
    if (options.scenario === 'recorder-recovery') await page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true }).check();
    await screenshot('title');
    await page.getByRole('radio', { name: options.mode === 'voice' ? /Live Voice/ : /Live Text/ }).check();
    await page.getByRole('button', { name: options.mode === 'voice' ? 'Start with Voice' : 'Start with Text', exact: true }).click();
    if (await page.getByLabel('Demo access code', { exact: true }).getAttribute('type') !== 'password') throw new Error('The access-code field must conceal its value before private recording.');
    await page.getByLabel('Demo access code', { exact: true }).fill(accessCode);
    const unlocked = page.waitForResponse(response => response.url() === `${options.origin}/api/access` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Unlock Live', exact: true }).click();
    const access = await (await unlocked).json();
    report.admissionBefore = verifyHostedAllocation(access.allocation, { mode: options.mode, runtimeSha256: options.expectedRuntimeSha256 });
    if (!access.authorized || !access.available) throw new Error('The normal access-code route did not authorize available hosted QA.');
    if (options.mode === 'voice') await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
    await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
    tokenArmed = true;
    await page.getByRole('button', { name: options.mode === 'voice' ? 'Connect Live Voice' : 'Connect Live Text', exact: true }).click();
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'session.ready'), null, { timeout: 25_000 });
    await observer.settle();
    report.allocation = verifyHostedAllocation(observer.allocation.value, { mode: options.mode, runtimeSha256: options.expectedRuntimeSha256, token: true });
    if (observer.allocation.maxSessionSeconds !== 900) throw new Error('The protected token duration does not match the approved configuration.');
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'configuration.delivery'), null, { timeout: 5000 });
    const delivered = (await audioSnapshot(page)).events.filter(event => event.type === 'configuration.delivery');
    if (delivered.length !== 1 || delivered[0].sha256 !== options.expectedConfigSha256 || !delivered[0].matchesExpected) throw new Error('The actual serialized inline configuration differs from the frozen candidate.');
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    const visibleHistory = () => page.locator('.history-message').evaluateAll(articles => articles.map((article, historyIndex) => ({ historyIndex,
      speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent,
      sourceLabel: article.querySelector('.source-label')?.textContent ?? null, chapterLabel: article.querySelector('.chapter-source')?.textContent ?? null,
      displayedAt: article.querySelector('time')?.getAttribute('datetime') ?? null, final: !/Partial transcript/.test(article.textContent),
      interrupted: /Interrupted \/ incomplete speech/.test(article.textContent) })));
    const remaining = deadline => { const ms = deadline === undefined ? 40_000 : Math.min(40_000, deadline - performance.now()); if (ms <= 0) throw new Error('The 120-second unresolved subgoal bound expired.'); return ms; };
    await waitForTurn(page, { mode: options.mode, timeoutMs: 40_000 });
    async function say(text, { terminal = false, deadlineAt } = {}) {
      if (stopping) throw new Error('This hosted attempt is ending.');
      const boundary = await waitBeforePlayerTurn(page, { mode: options.mode, confirmation: report.confirmations?.at(-1), timeoutMs: remaining(deadlineAt) });
      const before = await audioSnapshot(page); const old = new Set((await visibleHistory()).map(item => JSON.stringify(item)));
      const speech = options.mode === 'voice' ? await readFrozenSpeechFixture(text, fixtures.fixtureFiles, fixtures.directory) : undefined;
      const step = { turnId: report.steps.length + 1, utterance: text, inputMode: options.mode, fixture: speech?.id ?? null, startedAtMs: before.elapsedMs, settled: false, terminal, boundary };
      report.steps.push(step);
      try {
        await submitPlayerTurn(page, { mode: options.mode, text, fixture: speech });
        step.pacing = await waitForTurn(page, { mode: options.mode, afterMs: before.elapsedMs, timeoutMs: remaining(deadlineAt) });
        step.settled = true;
      } catch (error) { step.failureLayer = 'turn_pacing'; throw error; }
      finally {
        step.messages = (await visibleHistory()).filter(item => !old.has(JSON.stringify(item))); step.endedAtMs = (await audioSnapshot(page)).elapsedMs;
        step.proposal = await page.getByTestId('action-proposal').evaluateAll(elements => {
          const element = elements[0]; return element ? { proposalId: element.getAttribute('data-proposal-id'), status: element.getAttribute('data-status'), label: element.querySelector('[data-testid="proposal-label"]')?.textContent } : null;
        });
      }
      await persist(directory, report);
      const behavior = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: report.steps, events: (await audioSnapshot(page)).events, confirmations: report.confirmations });
      if (behavior.materialDefects.length) { report.behavior = behavior; throw new Error('Material action-control mismatch; this attempt stops without a repair or retry.'); }
      const refusal = (await audioSnapshot(page)).events.find(event => event.type === 'session.error' && event.accountRefusal);
      if (refusal) { report.accountRefusal = refusal.accountRefusal; throw new Error('Provider credit/account refusal stopped this attempt; verify the durable halt before any later action.'); }
      return step.messages.filter(item => item.speaker === 'Pip' && item.final && !item.interrupted).map(item => item.text).join(' ');
    }
    await runRescuePlayer({ page, say, report, screenshot, exerciseRecovery: options.scenario === 'recorder-recovery',
      optionalObjective: options.scenario === 'recorder-recovery' ? 'flight_recorder' : undefined,
      waitForReady: () => waitBeforePlayerTurn(page, { mode: options.mode, confirmation: report.confirmations?.at(-1), timeoutMs: 40_000 }) });
  } catch (error) { failure ??= safeError(error); }
  finally {
    await end();
    if (page && !page.isClosed()) {
      report.checkpoints = await page.evaluate(() => globalThis.__qaPublicCheckpoints ?? []).catch(() => []);
      evidence = await collectAudioEvidence(page, directory).catch(() => null);
      await cleanupAudioInstrumentation(page).catch(() => {});
      report.cleanup = await audioSnapshot(page).then(s => ({ activeTracks: s.activeTracks, activeSources: s.activeSources, openApplicationContexts: s.openApplicationContexts })).catch(() => null);
    }
    await observer?.settle();
    if (observer) {
      report.allocation ??= observer.allocation.value; report.reservedAttemptHeader = observer.allocation.failureAttempt; report.tokenHttpStatus = observer.allocation.httpStatus;
      report.refusalReports = observer.refusals;
      report.confirmationAudit = auditHostedDecisions({ decisions: observer.decisions, views: observer.views, confirmations: report.confirmations,
        recovery: options.scenario === 'recorder-recovery' ? report.recoveryExercise ?? {} : null, recorder: options.scenario === 'recorder-recovery' });
      await writeFile(join(directory, 'ordinary-http-evidence.json'), JSON.stringify({ decisions: observer.decisions, views: observer.views, records: observer.records, refusals: observer.refusals, errors: observer.errors }, null, 2) + '\n', { mode: 0o600 });
      if (observer.errors.length || !report.confirmationAudit.passed) failure ??= 'Authoritative human-safe HTTP confirmation/home audit did not pass.';
      observer.close();
    }
    const events = evidence?.events ?? journal.snapshot().filter(e => e.source === 'browser').map(e => ({ ...e, atMs: e.browserAtMs }));
    report.accountRefusal ??= events.find(event => event.type === 'session.error' && event.accountRefusal)?.accountRefusal ?? report.refusalReports?.[0]?.reason ?? null;
    report.durableRefusalHalt = report.refusalReports?.some(item => item.stopped && item.source === 'client_report') ? 'ordinary_http_acknowledged_client_report' : null;
    if (report.accountRefusal) failure ??= 'Observed account/credit refusal; no further attempt is permitted until the halt is reviewed.';
    const opened = events.find(e => e.type === 'socket.open'); const ended = events.find(e => e.type === 'session.ended'); const closed = events.find(e => e.type === 'socket.close');
    report.endAcknowledged = Boolean(ended); report.explicitEndSent = events.some(e => e.type === 'session.end');
    report.providerDurationSeconds = ended?.durationSeconds ?? null;
    report.connectedSeconds = opened && (ended || closed) ? ((ended ?? closed).atMs - opened.atMs) / 1000 : null;
    report.durationBoundary = 'Provider ACK duration and local observation are separate from the nonrefundable 970-second estimate. Missing ACK remains unknown after local cleanup.';
    report.behavior = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: report.steps, events, confirmations: report.confirmations });
    report.measurements = hostedMeasurements(report, events);
    if (report.behavior.status !== 'pass') failure ??= `Behavioral acceptance ${report.behavior.status}; inspect the protected findings.`;
    if (!report.explicitEndSent || !report.endAcknowledged) failure ??= 'Explicit provider ending ACK was not observed.';
    if (!report.completion || report.tokenRequests !== 1 || events.filter(e => e.type === 'socket.open').length !== 1) failure ??= 'The single-connection full Rescue gate did not pass.';
    if (options.mode === 'voice') {
      report.voicePath = { syntheticMicrophoneOnly: report.steps.length > 0 && report.steps.every(s => s.inputMode === 'voice' && s.fixture),
        actualAsrFinalObserved: events.some(e => e.type === 'transcript.user' && e.final && e.role === 'human'),
        ...Object.fromEntries(['input', 'provider', 'rendered', 'postVolume'].map(name => [`${name}Nonzero`, (evidence?.counters?.[name]?.nonzeroSamples ?? 0) > 0])) };
      report.voicePath.noTypedUserInput = !events.some(event => event.type === 'conversation.message' && event.direction === 'sent' && event.role === 'human');
      if (!Object.values(report.voicePath).every(Boolean)) failure ??= 'Synthetic microphone, ASR or shipped digital playback evidence was incomplete.';
    } else {
      report.textPath = { noMicrophoneInput: (evidence?.counters?.input?.samples ?? 0) === 0,
        normalUiTextObserved: events.some(event => event.type === 'conversation.message' && event.direction === 'sent' && event.role === 'human'),
        ...Object.fromEntries(['provider', 'rendered', 'postVolume'].map(name => [`${name}Nonzero`, (evidence?.counters?.[name]?.nonzeroSamples ?? 0) > 0])) };
      if (!Object.values(report.textPath).every(Boolean)) failure ??= 'Normal UI Text or shipped digital playback evidence was incomplete.';
    }
    if (!['activeTracks', 'activeSources', 'openApplicationContexts'].every(key => report.cleanup?.[key] === 0)) failure ??= 'Audio cleanup was incomplete.';
    if ((await harnessIdentity()).sha256 !== frozenHarness.sha256) failure ??= 'Harness bytes changed during the frozen attempt.';
    const video = page?.video();
    try {
      const after = await fetch(`${options.origin}/api/version`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!after.ok || (await after.json()).commit !== options.expectedCommit) failure ??= 'The hosted commit changed during the frozen attempt.';
      if (context && report.admissionBefore) {
        const accessAfter = await context.request.get(`${options.origin}/api/access`, { timeout: 5000, maxRedirects: 0 });
        const allocationAfter = (await accessAfter.json()).allocation;
        if (!accessAfter.ok() || allocationAfter?.runtimeSha256 !== options.expectedRuntimeSha256 || allocationAfter?.purpose !== 'qa' || allocationAfter?.mode !== options.mode) failure ??= 'The hosted runtime or QA capability changed during this frozen attempt.';
        report.admissionAfter = allocationAfter;
        if (allocationAfter?.halted) report.durableRefusalHalt ??= 'authenticated_access_summary_reports_halted';
      }
    } catch { failure ??= 'The hosted commit could not be revalidated after this attempt.'; }
    await context?.close().catch(() => {});
    if (video) await video.saveAs(join(directory, 'browser-silent.webm')).then(() => { report.video = 'browser-silent.webm'; }).catch(() => { failure ??= 'Private browser recording was not preserved.'; });
    await browser?.close().catch(() => {}); await server?.close().catch(() => {});
    journal.record('browser.closed', { outcome: 'observed' }); report.lifecycle = journal.snapshot();
    report.failure = failure ?? null; report.status = failure ? 'FAIL' : 'PASS'; report.finishedAt = new Date().toISOString();
    await persist(directory, report);
    await writeFile(join(directory, 'public-summary.json'), JSON.stringify(publicHostedSummary(report), null, 2) + '\n', { mode: 0o600 });
    process.off('message', stop); process.off('disconnect', disconnected); clearTimeout(disconnectTimer);
    if (process.connected) process.send({ type: 'qa.finished', status: report.status }, () => { if (process.connected) process.disconnect(); });
  }
}

// Only locally spawned descendants are eligible for emergency cleanup. PID reuse
// is checked against the original Linux process start tick before every signal.
async function processIdentity(pid) {
  try { const stat = await readFile(`/proc/${pid}/stat`, 'utf8'); const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' '); return { pid, parent: Number(fields[1]), started: fields[19] }; }
  catch { return null; }
}
async function terminateOwned(identity, signal) {
  const current = await processIdentity(identity?.pid); if (!current || current.started !== identity.started) return;
  const children = [];
  for (const entry of await readdir('/proc')) if (/^\d+$/.test(entry)) { const info = await processIdentity(Number(entry)); if (info?.parent === identity.pid) children.push(info); }
  for (const child of children) await terminateOwned(child, signal);
  try { process.kill(identity.pid, signal); } catch { /* Already exited. */ }
}
async function supervised(options, args) {
  if (process.platform !== 'linux') throw new Error('The bounded hosted supervisor requires the supported Linux/WSL runner.');
  const directory = resolve('.validation/goal-007/hosted', options.runId);
  await mkdir(resolve('.validation/goal-007/hosted'), { recursive: true, mode: 0o700 }); await mkdir(directory, { mode: 0o700 });
  const journal = createLifecycleJournal(join(directory, 'supervisor.jsonl'));
  const child = spawn(process.execPath, [SELF, ...args, '--worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, QA_HOSTED_OUTPUT: directory } });
  const identity = await processIdentity(child.pid); let browserIdentity; let tokenSeen = false; let finished = false; const timers = [];
  const stop = () => { journal.record('watchdog.stop.requested', { outcome: 'requested' }); if (child.connected) child.send({ type: 'qa.stop' }, () => {}); };
  const kill = async () => { if (browserIdentity) await terminateOwned(browserIdentity, 'SIGKILL'); await terminateOwned(identity, 'SIGTERM'); };
  timers.push(setTimeout(() => { stop(); timers.push(setTimeout(kill, 15_000)); }, 1_080_000));
  child.on('message', async message => {
    if (message?.type === 'qa.browser' && Number.isSafeInteger(message.pid)) {
      const candidate = await processIdentity(message.pid);
      if (candidate?.parent === child.pid) { browserIdentity = candidate; if (child.connected) child.send({ type: 'qa.browser-owned', pid: candidate.pid }, () => {}); }
      else { stop(); await kill(); }
    }
    if (message?.type === 'qa.token-attempt') {
      if (tokenSeen || !browserIdentity) { stop(); await kill(); return; } tokenSeen = true;
      timers.push(setTimeout(stop, 890_000));
      timers.push(setTimeout(async () => { if (browserIdentity) await terminateOwned(browserIdentity, 'SIGKILL'); stop(); }, 900_000));
      timers.push(setTimeout(kill, 945_000));
      if (child.connected) child.send({ type: 'qa.watchdog-armed' }, () => {});
    }
    if (message?.type === 'qa.finished') finished = true;
  });
  const interrupt = () => { stop(); timers.push(setTimeout(kill, 15_000)); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', resolveExit); });
  timers.forEach(clearTimeout); process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
  if (browserIdentity) await terminateOwned(browserIdentity, 'SIGKILL');
  const receipt = { finished, workerExitCode: code, tokenRequestObserved: tokenSeen, browserRegistered: Boolean(browserIdentity), localCleanupObserved: browserIdentity ? !await processIdentity(browserIdentity.pid) : !tokenSeen,
    boundary: 'Supervisor owns no quota and grants no refunds. Remote ending is established only by the provider ACK in the worker evidence.' };
  await writeFile(join(directory, 'supervisor-outcome.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  let report; try { report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')); } catch {}
  report = finalizeSupervisedReport(report ?? { mode: options.mode, scenario: options.scenario, expectedCommit: options.expectedCommit, expectedRuntimeSha256: options.expectedRuntimeSha256 }, receipt);
  await persist(directory, report);
  await writeFile(join(directory, 'public-summary.json'), JSON.stringify(publicHostedSummary(report), null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ status: report.status, privateEvidence: directory, tokenRequestObserved: tokenSeen }));
  if (report.status !== 'PASS') process.exitCode = 1;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseHostedArgs(args);
  if (options.live && (process.env.CI || process.env.GAME_DISABLE_LIVE === '1')) throw new Error('Explicit hosted execution is disabled in CI and offline validation environments.');
  if (options.prepareSpeech && !options.live) { console.log(JSON.stringify(await prepareSpeech(options))); return; }
  if (!options.live) { console.log(JSON.stringify({ status: 'OFFLINE_DRY_RUN', providerCalls: 0, reservations: 0, utterances: playerSpeechTexts().length,
    next: 'Prepare immutable local speech separately; explicit --live requires hosted identity, private access, pricing and a unique run ID.' })); return; }
  if (options.worker) await worker(options, process.env.QA_HOSTED_OUTPUT);
  else await supervised(options, args);
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) main().catch(() => { console.error('Hosted QA could not complete. Inspect protected local evidence; no automatic retry is performed.'); process.exitCode = 1; if (process.connected) process.disconnect(); });
