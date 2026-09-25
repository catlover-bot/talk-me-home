// Explicit bounded real-provider QA. Default invocation generates local fixtures only.
// The player policy reads rendered human documents and finalized visible Pip reports.
import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCampaign } from './qa-budget.mjs';
import { assertGoal004CLiveAuthorized, assertGoal004CNextAttempt, GOAL_004C_PROPOSAL } from './qa-live-authorization.mjs';
import { runSupervised, requestAttempt, registerOwnedProcess, finishAttempt } from './qa-supervisor.mjs';
import { ensureSpeechFixture } from './qa-speech-fixtures.mjs';
import { installAudioInstrumentation, audioSnapshot, collectAudioEvidence, cleanupAudioInstrumentation } from './qa-browser-instrumentation.mjs';
import { communicatedEmblem, communicatedPassability, crossCargoWithRecovery, confirmedAction } from './qa-player-policy.mjs';
import { waitForTurn, submitPlayerTurn } from './qa-turn-pacing.mjs';
import { createLifecycleJournal } from './qa-lifecycle.mjs';

const SELF = fileURLToPath(import.meta.url);
const DIRECTORY = resolve('.validation/goal-004c-live');
const HISTORICAL_DIRECTORY = resolve('.validation/goal-004b-live');
const LABEL = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI';
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
const PHRASES = {
  observe: 'Pip, please look around.',
  latch: 'Please inspect the Latch.',
  wiring: 'My diagram says the Door and Conveyor share one Power supply.',
  powerOff: 'Power is now off.',
  engage: 'Please engage the Latch.',
  confirmLatch: 'Is the Latch engaged now?',
  retryLatch: 'Please set the Latch to hold the Door open.',
  location: 'Please look around.',
  clarify: 'What emblem is beside you now?',
  dock: 'Please look around.',
  inspectContact: 'Please inspect the contact.',
  contact: 'Please hold the contact.',
  confirmContact: 'Are you holding the contact now?',
  retryContact: 'Please grip the contact steadily.',
  release: 'Please release the contact.',
  board: 'Please board the capsule.',
  home: 'Please confirm the return.',
  wait: 'Please wait.',
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
  for (const file of ['qa-live-browser.mjs', 'qa-player-policy.mjs', 'qa-turn-pacing.mjs', 'qa-browser-instrumentation.mjs', 'qa-lifecycle.mjs', 'qa-live-authorization.mjs', 'qa-budget.mjs', 'qa-supervisor.mjs', 'qa-speech-fixtures.mjs', 'qa-evidence.mjs']) harnessFiles[file] = createHash('sha256').update(await readFile(join('scripts', file))).digest('hex');
  return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), digest: 'SHA-256; aggregate hashes serialize the ordered per-file hexadecimal manifest as JSON', runtimeSha256: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), harnessSha256: createHash('sha256').update(JSON.stringify(harnessFiles)).digest('hex'), harnessFiles, files: hashes, node: process.version };
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

async function checkNextAttempt(mode, identity, currentDirectory) {
  const campaign = inspectCampaign(DIRECTORY);
  const reports = [];
  for (const entry of await readdir(DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-(?:text|voice)-mission$/.test(entry.name)) continue;
    const path = join(DIRECTORY, entry.name);
    if (path === currentDirectory) continue;
    // Missing/corrupt prior evidence refuses continuation; never guess a pass.
    reports.push(JSON.parse(await readFile(join(path, 'report.json'), 'utf8')));
  }
  assertGoal004CNextAttempt({ campaign, mode, identity, reports });
}

async function worker(scenario, mode) {
  assertGoal004CLiveAuthorized();
  if (process.env.QA_SUPERVISED_WORKER !== '1' || !process.send) throw new Error('An independently supervised worker is required.');
  if (scenario !== 'mission' || !['voice', 'text'].includes(mode)) throw new Error('An explicit mission and text or voice input mode are required.');
  const identity = await buildIdentity();
  await checkNextAttempt(mode, identity);
  // This private parent loader parses dotenv data; it never executes shell content.
  const envFile = parseEnv(await readFile('.env', 'utf8'));
  const key = envFile.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('The local provider credential is unavailable.');
  const port = await availablePort(); const origin = `http://127.0.0.1:${port}`;
  const accessCode = randomBytes(24).toString('base64url');
  // A finished first session retains its conservative admission lease. Two
  // admission slots permit the ordered second test; supervisor still allows
  // exactly one real connection and never refunds either reservation.
  const productionEnv = { ...process.env, ASSEMBLYAI_API_KEY: key, PORT: String(port), GAME_BIND_ADDRESS: '127.0.0.1', GAME_ORIGIN: origin, GAME_PUBLIC_LIVE_ENABLED: '1', GAME_DEMO_ACCESS_CODE: accessCode, GAME_LIVE_ALLOWANCE_FILE: join(DIRECTORY, 'allowance.jsonl'), GAME_LIVE_CONCURRENT_LIMIT: '2' };
  delete productionEnv.GAME_DISABLE_LIVE; delete productionEnv.NODE_OPTIONS;
  const server = spawn(process.execPath, ['dist/server/server/production.js'], { env: productionEnv, stdio: 'ignore' });
  await registerOwnedProcess(server.pid);
  let browserServer; let browser; let context; let page; let reservation; let stopping = false; let endPromise; let failure; let evidence;
  const directory = join(DIRECTORY, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mode}-${scenario}`);
  await mkdir(directory, { mode: 0o700 });
  const journal = createLifecycleJournal(join(directory, 'lifecycle.jsonl'));
  journal.record('worker.started', { outcome: 'observed' });
  server.once('exit', code => journal.record('server.closed', { outcome: 'observed', code }));
  const label = mode === 'voice' ? LABEL : 'AUTOMATED QA — UI LIVE TEXT — REAL ASSEMBLYAI';
  const report = { label, scenario, mode, identity, player: 'Bounded scripted expert policy; only rendered human documents, finalized visible Pip replies, and human controls steer actions.', pacingBoundary: 'Monotonic browser fixture/capture events and numeric ASR/reply/call aliases establish observed ordering. A 450 ms event quiet window is bounded observation, not a provider guarantee against arbitrarily late events. No end-of-input/commit message is invented.', route: [], steps: [], inputMode: mode === 'voice' ? 'synthetic microphone only' : 'normal UI typed messages; microphone off', completion: false, tokenRequests: 0 };
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
  try {
    for (let count = 0; count < 80; count++) {
      try { if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok) break; } catch {}
      if (count === 79) throw new Error('Owned production service did not become healthy.');
      await pause(100);
    }
    browserServer = await chromium.launchServer({ headless: true, chromiumSandbox: true });
    await registerOwnedProcess(browserServer.process().pid);
    browser = await chromium.connect(browserServer.wsEndpoint());
    browser.on('disconnected', () => journal.record('browser.disconnected', { outcome: 'observed' }));
    report.browserVersion = browser.version();
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
    report.videoPageCreationStartedAt = Date.now();
    page = await context.newPage(); report.videoPageCreatedAt = Date.now(); page.setDefaultTimeout(6000);
    await installAudioInstrumentation(page, { label, onLifecycle: event => journal.record(event.type, { ...event, source: 'browser', outcome: 'observed' }) });
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
        reservation = await requestAttempt({ name: `${mode}-mission`, maxRunSeconds: 570 });
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
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    const visibleHistory = () => page.locator('.history-message').evaluateAll(articles => articles.filter(article => !/Partial transcript|Interrupted \/ incomplete speech/.test(article.textContent)).map(article => ({ speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent })));
    const settled = (afterMs = -1, requireReply = true) => waitForTurn(page, { afterMs, mode, requireReply, timeoutMs: 40_000 });
    await settled();
    async function say(text, { requireReply = true, terminal = false } = {}) {
      if (stopping) throw new Error('The supervised session deadline ended this attempt.');
      const before = await audioSnapshot(page); const previous = (await visibleHistory()).length;
      const speech = mode === 'voice' ? await fixture(text) : undefined;
      await submitPlayerTurn(page, { mode, text, fixture: speech });
      let pacing;
      try { if (!terminal) pacing = await settled(before.elapsedMs, requireReply); }
      catch (error) {
        report.steps.push({ utterance: text, fixture: speech?.id ?? null, inputMode: mode, failureLayer: 'turn_pacing', reason: String(error.message), elapsedMs: (await audioSnapshot(page)).elapsedMs });
        // An unresolved cycle is not permission to overlap it with a clarification.
        throw error;
      }
      const messages = (await visibleHistory()).slice(previous);
      const replies = messages.filter(message => message.speaker === 'Pip').map(message => message.text).join(' ');
      report.steps.push({ utterance: text, fixture: speech?.id ?? null, inputMode: mode, messages, pacing, elapsedMs: (await audioSnapshot(page)).elapsedMs });
      await persistReport(directory, report);
      console.log(JSON.stringify({ scenario, mode, step: report.steps.length, pip: replies }));
      return replies;
    }
    const ensureSaid = (text, pattern, failureText) => { if (!pattern.test(text)) throw new Error(failureText); };
    let observation = await say(PHRASES.observe);
    if (scenario === 'mission' && !/latch/i.test(observation)) observation = await say('Please look around and report the objects you can reach from the platform.');
    if (scenario === 'mission' && !/latch/i.test(observation)) throw new Error('No Latch was communicated in the current visible observation.');
    {
      await page.getByRole('tab', { name: 'Equipment manual', exact: true }).click();
      report.cargoManual = await page.getByRole('tabpanel', { name: 'Equipment manual' }).innerText();
      ensureSaid(report.cargoManual, /Door and Conveyor use one supply/, 'Visible shared Power document was unavailable.');
      await say(PHRASES.latch);
      const power = page.getByTestId('acknowledged-power');
      if ((await power.innerText()) !== 'ON') await page.getByRole('button', { name: 'Power ON', exact: true }).click();
      await expect(power).toHaveText('ON');
      await say(PHRASES.wiring);
      if (!await confirmedAction({ say, request: PHRASES.engage, clarify: PHRASES.confirmLatch, retry: PHRASES.retryLatch, action: 'latch', checkpoint: () => page.getByRole('heading', { name: 'Relay Gallery', exact: true }).isVisible() })) throw new Error('Player oracle: Latch completion remained unconfirmed after bounded recovery.');
      const atGallery = () => page.getByRole('heading', { name: 'Relay Gallery', exact: true }).isVisible();
      if (!await atGallery()) {
        await page.getByRole('button', { name: 'Power OFF', exact: true }).click(); await expect(power).toHaveText('OFF');
        if (!await atGallery()) await say(PHRASES.powerOff);
      }
      if (!await crossCargoWithRecovery({ say, atGallery: () => page.getByRole('heading', { name: 'Relay Gallery', exact: true }).isVisible() })) throw new Error('Cargo crossing did not commit after one clarification and one rephrased retry.');
      await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
      await screenshot('gallery');
      report.route.push('Cargo Bay', 'Relay Gallery');
      // Read the rendered static atlas, including its visible positions, never internal map/state.
      const atlas = await page.locator('.gallery-document').evaluate(root => {
        const rooms = [...root.querySelectorAll('.atlas-room')].map(room => ({ name: room.querySelector('.room-name').textContent.toLowerCase(), position: room.getAttribute('transform').match(/[\d.]+/g).map(Number) }));
        const gates = [...root.querySelectorAll('.atlas-gate')].map(gate => {
          const [x1, y1, x2, y2] = gate.querySelector('.atlas-track').getAttribute('d').match(/[\d.]+/g).map(Number);
          return { rooms: [[x1, y1], [x2, y2]].map(([x, y]) => rooms.find(room => room.position[0] === x && room.position[1] === y).name), circuit: gate.querySelector('.gate-full-name').textContent };
        });
        return { rooms, gates };
      });
      report.atlas = atlas;
      const roomFrom = text => communicatedEmblem(text, atlas.rooms.map(room => room.name));
      async function communicatedRoom(text) {
        const room = roomFrom(text); if (room) return room;
        const clarified = await say(PHRASES.clarify); const result = roomFrom(clarified);
        if (!result) throw new Error('Current emblem remained ambiguous after one clarification.');
        return result;
      }
      let current = await communicatedRoom(await say(PHRASES.location));
      const blocked = new Set(); report.route.push(current);
      const atDock = () => page.getByRole('heading', { name: 'Return Dock', exact: true }).isVisible();
      for (let moves = 0; moves < 8 && current !== 'dock'; moves++) {
        if (await atDock()) { current = 'dock'; break; }
        const queue = [[current]]; let path;
        while (queue.length) {
          const candidate = queue.shift(); const last = candidate.at(-1);
          if (last === 'dock') { path = candidate; break; }
          for (const gate of atlas.gates) if (!blocked.has(gate.rooms.join('/')) && gate.rooms.includes(last)) {
            const next = gate.rooms.find(name => name !== last); if (!candidate.includes(next)) queue.push([...candidate, next]);
          }
        }
        if (!path || path.length < 2) throw new Error('No documented route remained after spoken obstruction reports.');
        const next = path[1]; const gate = atlas.gates.find(gate => gate.rooms.includes(current) && gate.rooms.includes(next));
        const [x1, y1] = atlas.rooms.find(room => room.name === current).position; const [x2, y2] = atlas.rooms.find(room => room.name === next).position;
        const direction = (y2 < y1 ? 'north' : y2 > y1 ? 'south' : '') + (x2 > x1 ? 'east' : x2 < x1 ? 'west' : '');
        const button = page.getByRole('button', { name: `Relay ${gate.circuit}`, exact: true });
        if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
        await expect(page.getByTestId('acknowledged-relay')).toHaveText(gate.circuit);
        let inspection = await say(`Please inspect the ${direction} gate and tell me whether anything blocks it.`);
        if (await atDock()) { current = 'dock'; break; }
        let passability = communicatedPassability(inspection);
        if (!passability) {
          inspection = await say(`Is the opening of the ${direction} gate physically clear or blocked?`);
          if (await atDock()) { current = 'dock'; break; }
          passability = communicatedPassability(inspection);
        }
        if (!passability) {
          inspection = await say(`Please check the ${direction} gate again and report whether cargo blocks passage.`);
          if (await atDock()) { current = 'dock'; break; }
          passability = communicatedPassability(inspection);
        }
        if (passability === 'blocked') { blocked.add(gate.rooms.join('/')); report.steps.at(-1).reportedBlocked = gate.rooms; continue; }
        if (passability !== 'clear') throw new Error('Gate inspection remained ambiguous after one clarification and one rephrased retry.');
        const arrived = await say(`Please go through the ${direction} gate.`);
        if (await page.getByRole('heading', { name: 'Return Dock', exact: true }).isVisible()) current = 'dock';
        else current = await communicatedRoom(arrived);
        report.route.push(current);
      }
      await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible(); report.route.push('Return Dock');
      await screenshot('dock');
      report.dockManual = await page.locator('.return-document').innerText();
      await say(PHRASES.dock);
      await say(PHRASES.inspectContact);
      if (!await confirmedAction({ say, request: PHRASES.contact, clarify: PHRASES.confirmContact, retry: PHRASES.retryContact, action: 'contact', checkpoint: async () => ['Primed', 'Stored'].includes(await page.getByTestId('dock-energy').innerText()) })) throw new Error('Player oracle: contact holding remained unconfirmed after bounded recovery.');
      await page.getByRole('button', { name: 'Charge', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
      await page.getByRole('button', { name: 'Store', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
      await say(PHRASES.release);
      await say(PHRASES.board); await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
      await page.getByRole('button', { name: 'Authorize return', exact: true }).click(); await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
      // Final home disconnects automatically; unlike intermediate turns it need not return to listening.
      await say(PHRASES.home, { terminal: true });
      await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible({ timeout: 25000 });
      report.completion = true; report.route.push('home'); await screenshot('home');
      await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'session.ended'), null, { timeout: 12000 });
    }
  } catch (error) {
    // Playwright errors can contain transport URLs: retain only the first safe line.
    failure = String(error?.message ?? error).split('\n')[0].replace(/(?:https?|wss?):\/\/\S+/g, '[URL omitted]');
    if (page && !page.isClosed() && directory) await page.screenshot({ path: join(directory, 'failure.png'), mask: [page.locator('#demo-code')] }).catch(() => {});
  } finally {
    await end();
    if (page && !page.isClosed()) {
      report.checkpoints = await page.evaluate(() => globalThis.__qaPublicCheckpoints ?? []).catch(() => []);
      report.visibleHistory = await page.locator('.history-message').evaluateAll(articles => articles.map(article => ({ speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent, sourceLabel: article.querySelector('.source-label')?.textContent ?? null, chapterLabel: article.querySelector('.chapter-source')?.textContent ?? null, displayedAt: article.querySelector('time')?.getAttribute('datetime') ?? null, final: !/Partial transcript/.test(article.textContent), interrupted: /Interrupted \/ incomplete speech/.test(article.textContent), provenance: 'rendered DOM labels; no inferred delivery status beyond these labels' }))).catch(() => []);
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
    report.failure = failure ?? null;
    report.lifecycle = journal.snapshot();
    report.watchdogCleanup = 'Independent supervisor cleanup.jsonl; a local cleanup record is not a remote end ACK.';
    if (directory) await persistReport(directory, report);
    if (reservation) await finishAttempt({ endAcknowledged: report.endAcknowledged, connectedSeconds: report.connectedSeconds, outcome: failure ? 'failed' : 'passed' }).catch(() => {});
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
  try { assertGoal004CLiveAuthorized(); }
  catch (error) { console.error(error.message); process.exitCode = 1; if (process.connected) process.disconnect(); }
}
if (process.exitCode) {
  // Deliberately stop without touching either campaign.
} else if (args.includes('--worker')) {
  try { await worker(args[args.indexOf('--scenario') + 1], args[args.indexOf('--mode') + 1]); } catch { console.error('QA worker preparation failed before a usable session; inspect the preserved local campaign.'); process.exitCode = 1; if (process.connected) process.disconnect(); }
} else if (args.includes('--inspect')) {
  const state = inspectCampaign(HISTORICAL_DIRECTORY); console.log(JSON.stringify({ historical: 'Goal 004B', attempts: state.attempts.length, productionAttempts: state.productionAttempts, reservedSeconds: state.reservedSeconds, estimatedReservedDollars: state.estimatedReservedDollars }));
} else {
  await prepareFixtures();
  if (!args.includes('--live')) console.log(JSON.stringify({ status: 'DRY_RUN', result: 'Local standard and retained stress fixtures validated; no credentials loaded, allowance created, or provider contacted.', live: 'Explicit supervised Part B command only; the single existing campaign and sequencing gates still apply.', campaignLimits: GOAL_004C_PROPOSAL }));
  else {
    const scenario = args[args.indexOf('--scenario') + 1]; const mode = args[args.indexOf('--mode') + 1];
    if (scenario !== 'mission' || !['text', 'voice'].includes(mode)) throw new Error('Explicit --scenario mission --mode text or voice required.');
    // An approved campaign must already exist. Missing accounting never initializes one.
    await checkNextAttempt(mode, await buildIdentity());
    const result = await runSupervised({ directory: DIRECTORY, worker: SELF, args: ['--worker', '--scenario', scenario, '--mode', mode] }); process.exitCode = result.exitCode ?? 1;
  }
}
