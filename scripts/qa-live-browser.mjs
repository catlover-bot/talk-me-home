// Explicit bounded real-provider QA. Default invocation generates local fixtures only.
// The player policy reads rendered human documents and finalized visible Pip reports.
import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { release } from 'node:os';
import { inspectCampaign } from './qa-budget.mjs';
import { QA_CONFIRMED_AMENDMENT_ID, QA_CONFIRMED_AMENDMENT_ALLOWANCE } from './qa-amended-budget.mjs';
import { assertGoal004ELiveAuthorized, assertGoal004EReservationAuthorized, GOAL_004E_AMENDMENT, GOAL_004E_FROZEN_FILE, GOAL_004E_RUNTIME_SHA256, GOAL_004E_SESSION_UPDATE_SHA256, GOAL_004E_CANARY_INPUTS } from './qa-live-authorization.mjs';
import { evaluateAcceptanceBehavior } from './qa-acceptance-behavior.mjs';
import { runSupervised, requestAttempt, registerOwnedProcess, finishAttempt, assertSupervisedParent } from './qa-supervisor.mjs';
import { ensureSpeechFixture } from './qa-speech-fixtures.mjs';
import { installAudioInstrumentation, audioSnapshot, collectAudioEvidence, cleanupAudioInstrumentation } from './qa-browser-instrumentation.mjs';
import { runRescuePlayer, PHRASES } from './qa-mission-player.mjs';
import { waitForTurn, submitPlayerTurn } from './qa-turn-pacing.mjs';
import { createLifecycleJournal } from './qa-lifecycle.mjs';

const SELF = fileURLToPath(import.meta.url);
const DIRECTORY = resolve('.validation/goal-004c-live');
const HISTORICAL_DIRECTORY = resolve('.validation/goal-004b-live');
const LABEL = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI';
// Keep the original multi-clause inputs for explicitly labelled offline stress replay.
const STRESS_PHRASES = {
  observe: 'Pip, please look around and tell me what you can reach.',
  observeBrief: 'Pip, please keep your replies to one short sentence and look around to tell me what you can reach.',
  latch: 'Please inspect the Latch and tell me how it works.',
  engage: 'My diagram says the Door and Conveyor share one Power supply, so please engage the Latch to hold the Door open.',
  cross: 'Power is now off, so please check that the route is safe and then cross to the far side.',
  location: 'Please look around and tell me your current emblem and the directions of the gates you can reach.',
  clarify: 'Please tell me only the name or shape of the emblem where you are standing now.',
  dock: 'Please look around and inspect the local equipment for preparing the return capsule.',
  contact: 'My procedure says Charge needs the contact held and Store retains that energy, so please inspect and hold the contact while I use the controller.',
  board: 'The console confirms energy is stored, so please release the contact and board the capsule.',
  home: 'The return authorization is granted, so please confirm the return and come home.',
  wait: 'Please wait. Do not move or take another action until I ask you to continue.',
  correction: 'Sorry, I meant the Latch, not the Door. Please inspect the Latch.',
  confirmLatch: 'Please confirm whether the Latch is engaged now.',
  retryLatch: 'Please engage the Latch now and report when that is done.',
  confirmContact: 'Are you holding the contact steady right now?',
  retryContact: 'Please hold the contact now and tell me when you are holding it.',
};
async function fixture(text) {
  const id = 'speech-' + createHash('sha256').update(text).digest('hex').slice(0, 16);
  return ensureSpeechFixture({ text, id });
}
async function prepareFixtures() {
  for (const text of [...Object.values(PHRASES), ...Object.values(STRESS_PHRASES)]) await fixture(text);
  for (const text of ['Please cross to the far side.', 'Please cross to the far side now if the route is clear.', 'Please look around and report the objects you can reach from the platform.']) await fixture(text);
  for (const direction of ['east', 'west', 'northeast', 'northwest', 'southeast', 'southwest']) {
    await fixture(`Please inspect the ${direction} gate and tell me whether anything blocks it.`);
    await fixture(`Please go through the ${direction} gate, then look around and report the emblem where you arrive.`);
    await fixture(`Please go through the ${direction} gate.`);
    await fixture(`Is the opening of the ${direction} gate physically clear or blocked?`);
    await fixture(`Please check the ${direction} gate again and report whether cargo blocks passage.`);
  }
}
async function buildIdentity() {
  const hashes = {};
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
  }
  await walk('dist');
  const harnessFiles = {};
  for (const file of ['qa-live-browser.mjs', 'qa-production-observer.mjs', 'qa-player-policy.mjs', 'qa-player-memory.mjs', 'qa-mission-player.mjs', 'qa-turn-pacing.mjs', 'qa-browser-instrumentation.mjs', 'qa-lifecycle.mjs', 'qa-live-authorization.mjs', 'qa-budget.mjs', 'qa-supervisor.mjs', 'qa-speech-fixtures.mjs', 'qa-evidence.mjs', 'qa-amended-budget.mjs', 'qa-acceptance-behavior.mjs']) harnessFiles[file] = createHash('sha256').update(await readFile(join('scripts', file))).digest('hex');
  const fixtureFiles = {};
  for (const file of (await readdir('.validation/goal-004b-media')).filter(name => /^speech-[a-f0-9]{16}\.(?:json|wav)$/.test(name)).sort()) fixtureFiles[file] = createHash('sha256').update(await readFile(join('.validation/goal-004b-media', file))).digest('hex');
  const { sessionConfig } = await import(pathToFileURL(resolve('dist/server/agent/config.js')).href);
  const sessionUpdateSha256 = createHash('sha256').update(JSON.stringify({ type: 'session.update', session: sessionConfig })).digest('hex');
  return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), digest: 'SHA-256; aggregate hashes serialize the ordered per-file hexadecimal manifest as JSON', runtimeSha256: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), harnessSha256: createHash('sha256').update(JSON.stringify(harnessFiles)).digest('hex'), harnessFiles, files: hashes, fixtureFiles, fixtureSha256: createHash('sha256').update(JSON.stringify(fixtureFiles)).digest('hex'), sessionUpdateSha256, browser: execFileSync(chromium.executablePath(), ['--version'], { encoding: 'utf8' }).trim(), browserExecutableSha256: createHash('sha256').update(await readFile(chromium.executablePath())).digest('hex'), node: process.version, environment: { platform: process.platform, arch: process.arch, kernel: release(), viewport: '1440x900', reducedMotion: 'reduce', chromiumSandbox: true } };
}
async function availablePort() {
  const server = createServer(); await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port; await new Promise(resolveClose => server.close(resolveClose)); return port;
}
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));

async function persistReport(directory, report) {
  const temporary = join(directory, 'report.pending.json');
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flush: true });
  await rename(temporary, join(directory, 'report.json'));
}

async function checkNextAttempt(mode, identity) {
  assertGoal004EReservationAuthorized({ directory: DIRECTORY, mode, identity });
}

async function worker(scenario, mode) {
  assertGoal004ELiveAuthorized();
  if (process.env.QA_SUPERVISED_WORKER !== '1' || !process.send) throw new Error('An independently supervised worker is required.');
  assertSupervisedParent(DIRECTORY);
  if (scenario !== 'mission' || mode !== 'voice') throw new Error('The final slot permits only mission Voice with UI confirmation.');
  const identity = await buildIdentity();
  await checkNextAttempt(mode, identity);
  // This private parent loader parses dotenv data; it never executes shell content.
  const envFile = parseEnv(await readFile('.env', 'utf8'));
  const key = envFile.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('The local provider credential is unavailable.');
  const port = await availablePort(); const origin = `http://127.0.0.1:${port}`;
  const accessCode = randomBytes(24).toString('base64url');
  const productionEnv = { ...process.env, ASSEMBLYAI_API_KEY: key, PORT: String(port), GAME_BIND_ADDRESS: '127.0.0.1', GAME_ORIGIN: origin, GAME_PUBLIC_LIVE_ENABLED: '1', GAME_DEMO_ACCESS_CODE: accessCode, GAME_LIVE_ALLOWANCE_FILE: join(DIRECTORY, QA_CONFIRMED_AMENDMENT_ALLOWANCE), GAME_LIVE_CONCURRENT_LIMIT: '1' };
  delete productionEnv.GAME_DISABLE_LIVE; delete productionEnv.NODE_OPTIONS;
  const server = spawn(process.execPath, ['scripts/qa-production-observer.mjs'], { env: productionEnv, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  await registerOwnedProcess(server.pid);
  let evaluationSequence = 0; let sessionId;
  const physicalTruth = () => new Promise((resolveTruth, rejectTruth) => {
    if (!sessionId || !server.connected) return rejectTruth(new Error('The independent physical evaluator is unavailable.'));
    const id = ++evaluationSequence;
    const timer = setTimeout(() => { server.off('message', listener); rejectTruth(new Error('The physical evaluator did not return within its finite deadline.')); }, 5000);
    const listener = message => {
      if (message?.type !== 'qa.physical.result' || message.id !== id) return;
      clearTimeout(timer); server.off('message', listener);
      if (message.error) rejectTruth(new Error(message.error));
      else resolveTruth({ digest: message.digest, commits: message.commits, observedAt: Date.now() });
    };
    server.on('message', listener); server.send({ type: 'qa.physical', id, sessionId });
  });
  let browserServer; let browser; let context; let page; let reservation; let stopping = false; let endPromise; let failure; let evidence;
  const directory = join(DIRECTORY, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mode}-${scenario}`);
  await mkdir(directory, { mode: 0o700 });
  const journal = createLifecycleJournal(join(directory, 'lifecycle.jsonl'));
  journal.record('worker.started', { outcome: 'observed' });
  server.once('exit', code => journal.record('server.closed', { outcome: 'observed', code }));
  const label = mode === 'voice' ? LABEL : 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI';
  const report = { label, scenario, mode, identity, player: 'Bounded scripted expert policy; rendered human documents, finalized visible Pip replies, exact visible proposals and human controls steer actions.', pacingBoundary: 'Monotonic browser fixture/capture events and numeric ASR/reply/call aliases establish observed ordering. A 450 ms event quiet window is bounded observation, not a provider guarantee against arbitrarily late events. No end-of-input/commit message is invented.', route: [], steps: [], inputMode: 'synthetic microphone speech plus deliberate matching UI confirmations', completion: false, tokenRequests: 0 };
  const end = () => {
    if (endPromise) return endPromise;
    stopping = true;
    journal.record('end.requested', { outcome: 'requested' });
    endPromise = (async () => {
    try { if (page && !page.isClosed()) {
      const button = page.getByRole('button', { name: 'Pause / End call', exact: true });
      if (await button.count() && await button.isVisible()) await button.click({ timeout: 2000 }).catch(() => {});
      await page.waitForFunction(() => globalThis.__qaAudio?.snapshot().events.some(event => event.type === 'socket.close'), null, { timeout: 6500 }).catch(() => {});
    } } catch { /* The independent watchdog still owns every browser/server process. */ }
    })();
    return endPromise;
  };
  const onMessage = message => { if (message?.type === 'qa.stop') { journal.record('watchdog.stop.requested', { outcome: 'observed' }); void end(); } };
  process.on('message', onMessage);
  await persistReport(directory, report);
  try {
    for (let count = 0; count < 80; count++) {
      try { if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok) break; } catch {}
      if (count === 79) throw new Error('Owned production service did not become healthy.');
      await pause(100);
    }
    browserServer = await chromium.launchServer({ headless: true, chromiumSandbox: true, executablePath: chromium.executablePath() });
    await registerOwnedProcess(browserServer.process().pid);
    browser = await chromium.connect(browserServer.wsEndpoint());
    browser.on('disconnected', () => journal.record('browser.disconnected', { outcome: 'observed' }));
    report.browserVersion = browser.version();
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
    report.videoPageCreationStartedAt = Date.now();
    page = await context.newPage(); report.videoPageCreatedAt = Date.now(); page.setDefaultTimeout(6000);
    page.on('response', response => {
      if (response.url() === `${origin}/api/sessions` && response.request().method() === 'POST' && response.status() === 201) {
        void response.json().then(view => { sessionId = view.sessionId; }).catch(() => {});
      }
    });
    await installAudioInstrumentation(page, { label, expectedSessionUpdateSha256: GOAL_004E_SESSION_UPDATE_SHA256, onLifecycle: event => journal.record(event.type, { ...event, source: 'browser', outcome: 'observed' }) });
    await page.addInitScript(label => {
      document.addEventListener('DOMContentLoaded', () => {
        const badge = document.createElement('div'); badge.textContent = label;
        badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#181e19;color:white;padding:4px 12px;font:13px sans-serif;text-align:center;pointer-events:none';
        document.body.append(badge);
        globalThis.__qaPublicCheckpoints = [];
        const publicTitles = new Set(['Cargo Bay', 'Relay Gallery', 'Return Dock', 'You brought Pip home.']);
        const observed = new Set();
        new MutationObserver(() => {
          for (const heading of document.querySelectorAll('h1,h2')) {
            const title = heading.textContent.trim();
            if (!publicTitles.has(title) || observed.has(title) || !heading.getClientRects().length) continue;
            observed.add(title); globalThis.__qaPublicCheckpoints.push({ title, observedAtMs: globalThis.__qaAudio.snapshot().elapsedMs });
          }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
    }, label);
    await page.route('**/voice-token', async route => {
      report.tokenRequests++;
      if (report.tokenRequests !== 1) { await route.abort(); return; }
      try {
        await checkNextAttempt(mode, identity, directory);
        reservation = await requestAttempt({ name: `${mode}-mission`, maxRunSeconds: 570, identity });
        report.reservation = reservation;
        await persistReport(directory, report);
        await route.continue();
      }
      catch { failure = 'Supervisor refused the token attempt.'; await route.abort(); }
    });
    const screenshot = async name => { await page.screenshot({ path: join(directory, `${name}.png`), mask: [page.locator('#demo-code')], animations: 'disabled' }); };
    await page.goto(origin);
    report.audioTimeOriginWallMs = await page.evaluate(() => Date.now() - globalThis.__qaAudio.snapshot().elapsedMs);
    await screenshot('title');
    await page.getByRole('radio', { name: mode === 'voice' ? /Live Voice/ : /Live Text/ }).check();
    await page.getByRole('button', { name: mode === 'voice' ? 'Start with Voice' : 'Start with Text', exact: true }).click();
    await page.getByLabel('Demo access code', { exact: true }).fill(accessCode);
    await page.getByRole('button', { name: 'Unlock Live', exact: true }).click();
    if (mode === 'voice') await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
    await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
    await expect(page.getByRole('button', { name: mode === 'voice' ? 'Connect Live Voice' : 'Connect Live Text', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: mode === 'voice' ? 'Connect Live Voice' : 'Connect Live Text', exact: true }).click();
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'session.ready'), null, { timeout: 25000 });
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'configuration.delivery'), null, { timeout: 5000 });
    const policySnapshot = await audioSnapshot(page);
    const deliveries = policySnapshot.events.filter(event => event.type === 'configuration.delivery');
    report.runtimePolicyDelivery = { ...deliveries[0], messageCount: policySnapshot.configurationUpdatesSent };
    await persistReport(directory, report);
    if (deliveries.length !== 1 || report.runtimePolicyDelivery.messageCount !== 1
      || report.runtimePolicyDelivery.sha256 !== GOAL_004E_SESSION_UPDATE_SHA256 || report.runtimePolicyDelivery.matchesExpected !== true) {
      throw new Error('The actual serialized session.update did not match the frozen repaired runtime policy.');
    }
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    const visibleHistory = () => page.locator('.history-message').evaluateAll(articles => articles.map((article, historyIndex) => ({ historyIndex, speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent, sourceLabel: article.querySelector('.source-label')?.textContent ?? null, chapterLabel: article.querySelector('.chapter-source')?.textContent ?? null, displayedAt: article.querySelector('time')?.getAttribute('datetime') ?? null, final: !/Partial transcript/.test(article.textContent), interrupted: /Interrupted \/ incomplete speech/.test(article.textContent), provenance: 'Rendered history DOM at this snapshot; index is not a provider message identifier' })).filter(item => item.final && !item.interrupted));
    const settled = (afterMs = -1, requireReply = true) => waitForTurn(page, { afterMs, mode, requireReply, timeoutMs: 40_000 });
    await settled();
    report.initialPhysicalTruth = await physicalTruth();
    const captionIdentity = item => JSON.stringify([item.displayedAt, item.sourceLabel, item.chapterLabel, item.speaker, item.text]);
    async function say(text, { requireReply = true, terminal = false } = {}) {
      if (stopping) throw new Error('The supervised session deadline ended this attempt.');
      {
        const index = report.steps.length;
        if (index < 3 && text !== GOAL_004E_CANARY_INPUTS[index]) throw new Error('The shared player deviated from the required three-input Voice canary; no alternate input was sent.');
        if (index >= 3 && !report.regressionCanary?.explicitLatchRequest) {
          if ([PHRASES.engage, PHRASES.retryLatch].includes(text)) report.regressionCanary.explicitLatchRequest = { turnId: index + 1, text };
          else if (text !== PHRASES.confirmLatch) throw new Error('An explicit Latch operation must follow the passed canary before continuing.');
        }
      }
      const before = await audioSnapshot(page); const previous = new Set((await visibleHistory()).map(captionIdentity));
      const newMessages = async () => (await visibleHistory()).filter(item => !previous.has(captionIdentity(item)));
      const step = { turnId: report.steps.length + 1, utterance: text, inputMode: mode, inputSource: mode === 'text' ? 'Normal UI typed submission; not ASR' : 'Offline synthetic fixture through browser microphone capture', startedAtMs: before.elapsedMs, settled: false, terminal };
      const speech = mode === 'voice' ? await fixture(text) : undefined;
      await submitPlayerTurn(page, { mode, text, fixture: speech });
      let pacing;
      // The final return first produces a proposal; settle it before UI confirmation.
      try { pacing = await settled(before.elapsedMs, requireReply); }
      catch (error) {
        const endedAtMs = (await audioSnapshot(page)).elapsedMs;
        report.steps.push({ ...step, fixture: speech?.id ?? null, messages: await newMessages(), failureLayer: 'turn_pacing', reason: String(error.message), endedAtMs, elapsedMs: endedAtMs });
        // An unresolved cycle is not permission to overlap it with a clarification.
        throw error;
      }
      const messages = await newMessages();
      const replies = messages.filter(message => message.speaker === 'Pip').map(message => message.text).join(' ');
      const endedAtMs = (await audioSnapshot(page)).elapsedMs;
      const proposal = await page.getByTestId('action-proposal').evaluateAll(elements => {
        const element = elements[0];
        return element ? { label: element.querySelector('[data-testid="proposal-label"]')?.textContent, status: element.getAttribute('data-status'), proposalId: element.getAttribute('data-proposal-id') } : null;
      });
      report.steps.push({ ...step, fixture: speech?.id ?? null, messages, proposal, pacing, settled: true, endedAtMs, elapsedMs: endedAtMs });
      await persistReport(directory, report);
      console.log(JSON.stringify({ scenario, mode, step: report.steps.length, pip: replies }));
      // Diagnostic stop only: sanitized tool metadata never selects a player action.
      // A known control failure is not a reason to spend the rest of the session.
      {
        const behavior = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: report.steps, events: (await audioSnapshot(page)).events, confirmations: report.confirmations });
        if (report.steps.length <= 3 && (report.confirmations?.length ?? 0) !== 0) throw new Error('A confirmation occurred during the information-only regression phase.');
        if (report.steps.length === 3) {
          const physical = await physicalTruth();
          const unchanged = physical.digest === report.initialPhysicalTruth.digest && physical.commits.length === 0 && report.initialPhysicalTruth.commits.length === 0;
          report.regressionCanary = { status: behavior.status === 'pass' && unchanged ? 'passed' : 'failed',
            inputs: [...GOAL_004E_CANARY_INPUTS], informationTurnId: 3, behavior,
            noPhysicalCommit: unchanged, confirmationCount: report.confirmations?.length ?? 0, physical,
            boundary: 'Physical-state digest and commits are evaluator-only IPC from the actual production server; they never steer the player or enter the browser/provider. A nonexecuting proposal is allowed; false completion claims remain defects.' };
          await persistReport(directory, report);
        }
        if (behavior.materialDefects.length) {
          report.behavior = behavior; await persistReport(directory, report);
          throw new Error('Material instruction/action-control mismatch; the attempt stopped without a repair or retry.');
        }
        if (report.steps.length === 3) {
          if (report.regressionCanary.status !== 'passed') throw new Error('The information-only Voice canary did not establish no unconfirmed commit and truthful narration; no retry is permitted.');
          await screenshot('voice-unconfirmed-canary');
        }
      }
      return replies;
    }
    await runRescuePlayer({ page, say, screenshot, report });
    report.finalPhysicalTruth = await physicalTruth();
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'session.ended'), null, { timeout: 12000 });
  } catch (error) {
    // Playwright errors can contain transport URLs: retain only the first safe line.
    failure = String(error?.message ?? error).split('\n')[0].replace(/(?:https?|wss?):\/\/\S+/g, '[URL omitted]');
    if (page && !page.isClosed() && directory) await page.screenshot({ path: join(directory, 'failure.png'), mask: [page.locator('#demo-code')] }).catch(() => {});
  } finally {
    await end();
    // Read again after shutdown so an in-flight owner decision is not omitted.
    report.finalPhysicalTruth = await physicalTruth().catch(() => null);
    if (report.finalPhysicalTruth) {
      const receipts = report.confirmations ?? [];
      const commits = report.finalPhysicalTruth.commits;
      report.confirmationAudit = { commits: commits.length, confirmations: receipts.length,
        everyCommitHasExactConfirmation: commits.every(commit => receipts.filter(receipt => receipt.proposalId === commit.proposalId && receipt.status === 'committed').length === 1),
        everyCommittedConfirmationHasCommit: receipts.filter(receipt => receipt.status === 'committed').every(receipt => commits.filter(commit => commit.proposalId === receipt.proposalId).length === 1),
        uniqueCommitIds: new Set(commits.map(commit => commit.proposalId)).size === commits.length,
        boundary: 'Evaluator-only server commit receipts matched against exact UI confirmation IDs; no physical state steers player decisions.' };
      if (!report.confirmationAudit.everyCommitHasExactConfirmation || !report.confirmationAudit.everyCommittedConfirmationHasCommit || !report.confirmationAudit.uniqueCommitIds) failure ??= 'Physical commits and exact recorded owner confirmations did not match.';
    } else failure ??= 'Final independent physical evidence was unavailable.';
    if (page && !page.isClosed()) {
      report.checkpoints = await page.evaluate(() => globalThis.__qaPublicCheckpoints ?? []).catch(() => []);
      report.visibleHistory = await page.locator('.history-message').evaluateAll(articles => articles.map((article, historyIndex) => ({ historyIndex, speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent, sourceLabel: article.querySelector('.source-label')?.textContent ?? null, chapterLabel: article.querySelector('.chapter-source')?.textContent ?? null, displayedAt: article.querySelector('time')?.getAttribute('datetime') ?? null, final: !/Partial transcript/.test(article.textContent), interrupted: /Interrupted \/ incomplete speech/.test(article.textContent), provenance: 'rendered DOM labels; no inferred delivery status beyond these labels' }))).catch(() => []);
      evidence = await collectAudioEvidence(page, directory).catch(() => undefined);
      await cleanupAudioInstrumentation(page).catch(() => {});
      report.cleanup = await audioSnapshot(page).then(snapshot => ({ activeTracks: snapshot.activeTracks, activeSources: snapshot.activeSources, openApplicationContexts: snapshot.openApplicationContexts })).catch(() => null);
    }
    // Incremental journal survives a browser disconnect that prevents a final snapshot.
    const events = evidence?.events ?? journal.snapshot().filter(event => event.source === 'browser').map(event => ({ ...event, atMs: event.browserAtMs })); const opened = events.find(event => event.type === 'socket.open'); const ended = events.find(event => event.type === 'session.ended'); const closed = events.find(event => event.type === 'socket.close');
    report.endAcknowledged = Boolean(ended); report.explicitEndSent = events.some(event => event.type === 'session.end');
    report.providerDurationSeconds = ended?.durationSeconds ?? null;
    report.connectedSeconds = opened && (ended || closed) ? ((ended ?? closed).atMs - opened.atMs) / 1000 : null;
    const lastReceived = events.findLast(event => event.direction === 'received');
    report.durationEvidence = { clock: 'browser performance.now; lifecycle driver receipts have their separate monotonic clock', endObservation: ended ? 'provider ACK observed' : closed ? 'socket close observed without ACK' : 'exact remote/local socket end not observed', lastPeerEventAfterOpenSeconds: opened && lastReceived ? Math.max(0, lastReceived.atMs - opened.atMs) / 1000 : null, reservedSeconds: reservation?.reservedSeconds ?? null, boundary: 'Last peer event bounds local observation only; it is not a billing duration. Missing ACK neither proves indefinite billing nor confirms remote end.' };
    if (reservation && opened && (!report.endAcknowledged || !report.explicitEndSent)) failure ??= 'The provider ending was not explicitly sent and acknowledged.';
    const terminal = report.steps.at(-1);
    if (terminal?.terminal) {
      terminal.endedAtMs = ended?.atMs ?? closed?.atMs ?? terminal.endedAtMs;
      terminal.settled = report.completion === true && report.endAcknowledged;
      terminal.messages = report.visibleHistory.filter(item => item.final && !item.interrupted && Date.parse(item.displayedAt) >= report.audioTimeOriginWallMs + terminal.startedAtMs);
    }
    report.behavior = evaluateAcceptanceBehavior({ contract: 'confirmed_actions', steps: report.steps, events, confirmations: report.confirmations });
    if (report.behavior.status !== 'pass') failure ??= `Behavioral acceptance ${report.behavior.status}; see separate findings.`;
    const finalDeliveries = events.filter(event => event.type === 'configuration.delivery');
    report.runtimePolicyDelivery = { ...finalDeliveries[0], messageCount: evidence?.configurationUpdatesSent ?? null };
    if (finalDeliveries.length !== 1 || report.runtimePolicyDelivery.messageCount !== 1
      || report.runtimePolicyDelivery.sha256 !== GOAL_004E_SESSION_UPDATE_SHA256 || report.runtimePolicyDelivery.matchesExpected !== true) {
      failure ??= 'The actual session configuration delivery was missing, changed or repeated.';
    }
    if (report.regressionCanary?.status !== 'passed' || !report.regressionCanary.explicitLatchRequest) {
      failure ??= 'The required unconfirmed Voice canary and subsequent explicit Latch request were incomplete.';
    }
    if (mode === 'voice') {
      report.voicePath = { syntheticMicrophoneOnly: report.steps.every(step => step.inputMode === 'voice' && step.fixture),
        actualAsrFinalObserved: events.some(event => event.type === 'transcript.user' && event.final === true && event.role === 'human'),
        nonzeroInput: (evidence?.counters?.input?.nonzeroSamples ?? 0) > 0,
        nonzeroProviderAudio: (evidence?.counters?.provider?.nonzeroSamples ?? 0) > 0,
        nonzeroRenderedAudio: (evidence?.counters?.rendered?.nonzeroSamples ?? 0) > 0,
        nonzeroPostVolumeAudio: (evidence?.counters?.postVolume?.nonzeroSamples ?? 0) > 0 };
      if (!Object.values(report.voicePath).every(Boolean)) failure ??= 'Voice capture, ASR or shipped nonzero playback evidence was incomplete.';
    }
    if (!report.completion) failure ??= 'The mission did not reach confirmed home.';
    if (!['activeTracks', 'activeSources', 'openApplicationContexts'].every(key => report.cleanup?.[key] === 0)) failure ??= 'Application audio cleanup was missing or incomplete.';
    report.failure = failure ?? 'Cleanup pending; this is not a final acceptance result.';
    report.lifecycle = journal.snapshot();
    report.watchdogCleanup = 'Independent supervisor amendment-confirmed-actions-cleanup.jsonl; a local cleanup record is not a remote end ACK.';
    if (directory) await persistReport(directory, report);
    const video = page?.video();
    await context?.close().catch(() => {});
    if (video && directory) {
      await video.saveAs(join(directory, 'browser-silent.webm')).then(() => { report.video = 'browser-silent.webm'; }).catch(() => { report.videoFailure = 'Browser video could not be saved.'; });
      report.videoAlignment = 'Audio uses browser QA time origin; video page creation wall-clock interval is retained for approximate alignment, not sample-accurate synchronization.';
    }
    if (directory) await persistReport(directory, report);
    journal.record('browser.close.requested', { outcome: 'requested' });
    await browser?.close().catch(() => {}); await browserServer?.close().catch(() => {});
    const browserProcess = browserServer?.process();
    journal.record('browser.closed', { outcome: browserProcess && (browserProcess.exitCode !== null || browserProcess.signalCode !== null) ? 'observed' : 'not_observed' });
    journal.record('server.close.requested', { outcome: 'requested' });
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolveExit => server.once('exit', resolveExit));
      server.kill('SIGTERM'); await Promise.race([exited, pause(1500)]);
    }
    if (server.exitCode === null && server.signalCode === null) journal.record('server.closed', { outcome: 'bounded_timeout' });
    else if (!journal.snapshot().some(event => event.type === 'server.closed')) journal.record('server.closed', { outcome: 'observed', code: server.exitCode });
    report.lifecycle = journal.snapshot();
    if (!['browser.closed', 'server.closed'].every(type => report.lifecycle.some(event => event.type === type && event.outcome === 'observed'))) failure ??= 'Owned process closure was not fully observed.';
    if (reservation) await finishAttempt({ endAcknowledged: report.endAcknowledged, connectedSeconds: report.connectedSeconds, outcome: failure ? 'failed' : 'passed' }).catch(() => { failure ??= 'The supervisor did not acknowledge the final attempt result.'; });
    report.failure = failure ?? null;
    await persistReport(directory, report);
    process.off('message', onMessage); if (process.connected) process.disconnect();
  }
  console.log(JSON.stringify({ scenario, directory, completion: report.completion, failure, connectedSeconds: report.connectedSeconds, endAcknowledged: report.endAcknowledged }));
  if (failure) process.exitCode = 1;
}

const args = process.argv.slice(2);
// No flag, environment variable or locally generated file supplies owner approval.
// This gate executes before fixtures, credentials, allowance reads or child processes.
if (args.includes('--live') || args.includes('--worker')) {
  try { assertGoal004ELiveAuthorized(); }
  catch (error) { console.error(error.message); process.exitCode = 1; if (process.connected) process.disconnect(); }
}
if (process.exitCode) {
  // Deliberately stop without touching either campaign.
} else if (args.includes('--worker')) {
  try { await worker(args[args.indexOf('--scenario') + 1], args[args.indexOf('--mode') + 1]); } catch { console.error('QA worker preparation failed before a usable session; inspect the preserved local campaign.'); process.exitCode = 1; if (process.connected) process.disconnect(); }
} else if (args.includes('--freeze')) {
  await prepareFixtures();
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Commit activation and clean the worktree before freezing.');
  const identity = await buildIdentity();
  if (identity.runtimeSha256 !== GOAL_004E_RUNTIME_SHA256 || identity.sessionUpdateSha256 !== GOAL_004E_SESSION_UPDATE_SHA256) throw new Error('Compiled runtime differs from the approved confirmed-action candidate.');
  const frozenPath = join(DIRECTORY, GOAL_004E_FROZEN_FILE);
  let existing;
  try { existing = JSON.parse(await readFile(frozenPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (existing.amendmentId !== QA_CONFIRMED_AMENDMENT_ID || JSON.stringify(existing.identity) !== JSON.stringify(identity)) throw new Error('The one-time frozen runtime candidate already exists with a different identity.');
  } else await writeFile(frozenPath, JSON.stringify({ amendmentId: QA_CONFIRMED_AMENDMENT_ID, frozenAt: new Date().toISOString(), identity }, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
  console.log(JSON.stringify({ status: 'OFFLINE_CANDIDATE_FROZEN', commit: identity.commit, runtimeSha256: identity.runtimeSha256, harnessSha256: identity.harnessSha256, fixtureSha256: identity.fixtureSha256 }));
} else if (args.includes('--inspect')) {
  const state = inspectCampaign(HISTORICAL_DIRECTORY); console.log(JSON.stringify({ historical: 'Goal 004B', attempts: state.attempts.length, productionAttempts: state.productionAttempts, reservedSeconds: state.reservedSeconds, estimatedReservedDollars: state.estimatedReservedDollars }));
} else {
  await prepareFixtures();
  if (!args.includes('--live')) console.log(JSON.stringify({ status: 'DRY_RUN', result: 'Local standard and retained stress fixtures validated; no credentials loaded, allowance created, or provider contacted.', live: 'Explicit supervised Goal 004E final Voice test only; aggregate sequencing gates apply.', campaignLimits: GOAL_004E_AMENDMENT }));
  else {
    const scenario = args[args.indexOf('--scenario') + 1]; const mode = args[args.indexOf('--mode') + 1];
    if (scenario !== 'mission' || mode !== 'voice') throw new Error('Explicit --scenario mission --mode voice required for the final slot.');
    // An approved campaign must already exist. Missing accounting never initializes one.
    await checkNextAttempt(mode, await buildIdentity());
    const result = await runSupervised({ directory: DIRECTORY, worker: SELF, amendmentId: QA_CONFIRMED_AMENDMENT_ID, args: ['--worker', '--scenario', scenario, '--mode', mode] }); process.exitCode = result.exitCode ?? 1;
  }
}
