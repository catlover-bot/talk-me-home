// Explicit bounded real-provider QA. Default invocation generates local fixtures only.
// The player policy reads rendered human documents and finalized visible Pip reports.
import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeCampaign, inspectCampaign } from './qa-budget.mjs';
import { runSupervised, requestAttempt, registerOwnedProcess, finishAttempt } from './qa-supervisor.mjs';
import { ensureSpeechFixture } from './qa-speech-fixtures.mjs';
import { installAudioInstrumentation, queueSpeech, audioSnapshot, collectAudioEvidence, cleanupAudioInstrumentation } from './qa-browser-instrumentation.mjs';
import { communicatedEmblem, communicatedPassability, crossCargoWithRecovery } from './qa-player-policy.mjs';

const SELF = fileURLToPath(import.meta.url);
const DIRECTORY = resolve('.validation/goal-004b-live');
const LABEL = 'AUTOMATED QA — SYNTHETIC PLAYER SPEECH — REAL ASSEMBLYAI';
const PHRASES = {
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
  for (const text of Object.values(PHRASES)) await fixture(text);
  for (const direction of ['east', 'west', 'northeast', 'northwest', 'southeast', 'southwest']) {
    await fixture(`Please inspect the ${direction} gate and tell me whether anything blocks it.`);
    await fixture(`Please go through the ${direction} gate, then look around and report the emblem where you arrive.`);
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
  return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runtimeSha256: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'), harnessSha256: createHash('sha256').update(await readFile(SELF)).digest('hex'), files: hashes, node: process.version };
}
async function availablePort() {
  const server = createServer(); await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port; await new Promise(resolveClose => server.close(resolveClose)); return port;
}
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));

async function worker(scenario) {
  if (process.env.QA_SUPERVISED_WORKER !== '1' || !process.send) throw new Error('An independently supervised worker is required.');
  if (!['canary', 'mission'].includes(scenario)) throw new Error('Choose canary or mission.');
  const identity = await buildIdentity();
  // This private parent loader parses dotenv data; it never executes shell content.
  const envFile = parseEnv(await readFile('.env', 'utf8'));
  const key = envFile.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error('The local provider credential is unavailable.');
  const port = await availablePort(); const origin = `http://127.0.0.1:${port}`;
  const accessCode = randomBytes(24).toString('base64url');
  const productionEnv = { ...process.env, ASSEMBLYAI_API_KEY: key, PORT: String(port), GAME_BIND_ADDRESS: '127.0.0.1', GAME_ORIGIN: origin, GAME_PUBLIC_LIVE_ENABLED: '1', GAME_DEMO_ACCESS_CODE: accessCode, GAME_LIVE_ALLOWANCE_FILE: join(DIRECTORY, 'allowance.jsonl'), GAME_LIVE_CONCURRENT_LIMIT: '2' };
  delete productionEnv.GAME_DISABLE_LIVE; delete productionEnv.NODE_OPTIONS;
  const server = spawn(process.execPath, ['dist/server/server/production.js'], { env: productionEnv, stdio: 'ignore' });
  await registerOwnedProcess(server.pid);
  let browserServer; let browser; let context; let page; let reservation; let stopping = false; let endPromise; let failure; let evidence; let directory;
  const report = { label: LABEL, scenario, identity, player: 'Bounded scripted expert policy; only rendered human documents, finalized visible Pip replies, and human controls steer actions.', route: [], steps: [], inputMode: 'synthetic microphone only', completion: false, tokenRequests: 0 };
  const end = () => {
    if (endPromise) return endPromise;
    stopping = true;
    endPromise = (async () => {
    try { if (page && !page.isClosed()) {
      const button = page.getByRole('button', { name: 'Pause / End call', exact: true });
      if (await button.count() && await button.isVisible()) await button.click({ timeout: 2000 }).catch(() => {});
      await page.waitForFunction(() => globalThis.__qaAudio?.snapshot().events.some(event => event.type === 'socket.close'), null, { timeout: 6500 }).catch(() => {});
    } } catch { /* The independent watchdog still owns every browser/server process. */ }
    })();
    return endPromise;
  };
  const onMessage = message => { if (message?.type === 'qa.stop') void end(); };
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
    report.browserVersion = browser.version();
    directory = join(DIRECTORY, `${new Date().toISOString().replace(/[:.]/g, '-')}-${scenario}`);
    await mkdir(directory, { mode: 0o700 });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
    report.videoPageCreationStartedAt = Date.now();
    page = await context.newPage(); report.videoPageCreatedAt = Date.now(); page.setDefaultTimeout(6000);
    await installAudioInstrumentation(page, { label: LABEL });
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
    }, LABEL);
    await page.route('**/voice-token', async route => {
      report.tokenRequests++;
      if (report.tokenRequests !== 1) { await route.abort(); return; }
      try { reservation = await requestAttempt({ name: scenario, maxRunSeconds: scenario === 'canary' ? 60 : 570 }); await route.continue(); }
      catch { failure = 'Supervisor refused the token attempt.'; await route.abort(); }
    });
    const screenshot = async name => { await page.screenshot({ path: join(directory, `${name}.png`), mask: [page.locator('#demo-code')], animations: 'disabled' }); };
    await page.goto(origin);
    report.audioTimeOriginWallMs = await page.evaluate(() => Date.now() - globalThis.__qaAudio.snapshot().elapsedMs);
    await screenshot('title');
    await page.getByRole('button', { name: 'Play with voice', exact: true }).click();
    await page.getByLabel('Demo access code', { exact: true }).fill(accessCode);
    await page.getByRole('button', { name: 'Unlock Live', exact: true }).click();
    await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
    await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connect Live Voice', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Connect Live Voice', exact: true }).click();
    await page.waitForFunction(() => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'session.ready'), null, { timeout: 25000 });
    await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    const visibleHistory = () => page.locator('.history-message').evaluateAll(articles => articles.filter(article => !/Partial transcript|Interrupted \/ incomplete speech/.test(article.textContent)).map(article => ({ speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent })));
    async function settled(afterMs = -1) {
      await page.waitForFunction(after => {
        const snapshot = globalThis.__qaAudio.snapshot();
        const relevant = snapshot.events.filter(event => event.atMs > after);
        const user = relevant.findLast(event => event.type === 'transcript.user');
        if (after >= 0 && !user) return false;
        const lastTool = relevant.findLast(event => event.type === 'tool.result');
        const boundary = Math.max(user?.atMs ?? after, lastTool?.atMs ?? after);
        const speech = relevant.findLast(event => event.type === 'transcript.agent' && event.final && event.atMs > boundary);
        const done = speech && relevant.some(event => event.type === 'reply.done' && event.replyRef === speech.reference && event.status === 'completed');
        const pending = relevant.some(event => event.type === 'tool.call' && !relevant.some(result => result.type === 'tool.result' && result.callRef === event.callRef));
        const readout = document.querySelector('.connection-readout')?.textContent ?? '';
        return done && speech && !pending && /microphone ready/.test(readout) && snapshot.elapsedMs - (snapshot.counters.rendered.lastNonzeroMs ?? 0) > 350;
      }, afterMs, { timeout: scenario === 'mission' ? 40000 : 25000 });
    }
    await settled();
    async function say(text) {
      if (stopping) throw new Error('The supervised session deadline ended this attempt.');
      const before = await audioSnapshot(page); const previous = (await visibleHistory()).length;
      const speech = await fixture(text); await queueSpeech(page, speech);
      let waitTimedOut = false;
      try { await settled(before.elapsedMs); } catch (error) {
        if (stopping || !/Timeout/.test(String(error))) throw error;
        waitTimedOut = true;
      }
      const messages = (await visibleHistory()).slice(previous);
      const replies = messages.filter(message => message.speaker === 'Pip').map(message => message.text).join(' ');
      report.steps.push({ utterance: text, fixture: speech.id, messages, waitTimedOut, elapsedMs: (await audioSnapshot(page)).elapsedMs });
      console.log(JSON.stringify({ scenario, step: report.steps.length, pip: replies }));
      // Empty/late output is a stalled step, not invented dialogue. Callers can
      // ask their one bounded status clarification; they never guess an action.
      return waitTimedOut ? '' : replies;
    }
    const ensureSaid = (text, pattern, failureText) => { if (!pattern.test(text)) throw new Error(failureText); };
    let observation = await say(scenario === 'mission' ? PHRASES.observeBrief : PHRASES.observe);
    if (scenario === 'mission' && !/latch/i.test(observation)) observation = await say('Please look around and report the objects you can reach from the platform.');
    if (scenario === 'mission' && !/latch/i.test(observation)) throw new Error('No Latch was communicated in the current visible observation.');
    if (scenario === 'canary') {
      const snapshot = await audioSnapshot(page);
      const toolResult = snapshot.events.find(event => event.type === 'tool.result' && !event.isError && snapshot.events.some(call => call.type === 'tool.call' && call.callRef === event.callRef && call.atMs < event.atMs));
      if (!snapshot.events.some(event => event.type === 'transcript.user' && event.text?.trim()) || !toolResult || !snapshot.events.some(event => event.type === 'transcript.agent' && event.atMs > toolResult.atMs) || snapshot.counters.input.nonzeroSamples < 1000 || snapshot.counters.provider.nonzeroSamples < 1000 || snapshot.counters.rendered.nonzeroSamples < 1000) throw new Error('Canary did not establish the complete microphone/tool/render chain.');
      if (Date.now() < reservation.gracefulAt - 18000) {
        const beforeWait = (await audioSnapshot(page)).elapsedMs;
        await queueSpeech(page, await fixture(PHRASES.wait));
        await page.waitForFunction(after => globalThis.__qaAudio.snapshot().events.some(event => event.type === 'transcript.user' && event.atMs > after && /wait/i.test(event.text)), beforeWait, { timeout: 8000 });
        report.waitRequest = { recognized: true, replyRequired: false, explanation: 'A spoken wait may interrupt a reply; later interrupted text is not evidence of delivered speech.' };
      }
      await screenshot('canary');
    } else {
      await page.getByRole('tab', { name: 'Equipment manual', exact: true }).click();
      report.cargoManual = await page.getByRole('tabpanel', { name: 'Equipment manual' }).innerText();
      ensureSaid(report.cargoManual, /Door and Conveyor use one supply/, 'Visible shared Power document was unavailable.');
      let latch = await say(PHRASES.latch);
      ensureSaid(latch, /latch/i, 'Pip did not communicate a Latch observation.');
      const power = page.getByTestId('acknowledged-power');
      if ((await power.innerText()) !== 'ON') await page.getByRole('button', { name: 'Power ON', exact: true }).click();
      await expect(power).toHaveText('ON');
      const latchConfirmed = text => !/not engaged|not latched|not secured|cannot engage|can't engage/i.test(text) && /\bI (?:have )?(?:engaged|latched|secured)|\bI've (?:engaged|latched|secured)|\blatch (?:is|has been) (?:now )?(?:engaged|latched|secured|set)|\b(?:engaged|latched|secured) the latch/i.test(text);
      let engaged = await say(PHRASES.engage);
      if (!latchConfirmed(engaged)) engaged = await say('Please confirm whether the Latch is engaged now.');
      if (!latchConfirmed(engaged)) engaged = await say('Please engage the Latch now and report when that is done.');
      if (!latchConfirmed(engaged)) throw new Error('Pip did not confirm engaging the Latch after bounded clarification.');
      await page.getByRole('button', { name: 'Power OFF', exact: true }).click(); await expect(power).toHaveText('OFF');
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
      for (let moves = 0; moves < 8 && current !== 'dock'; moves++) {
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
        let passability = communicatedPassability(inspection);
        if (!passability) {
          inspection = await say(`Is the opening of the ${direction} gate physically clear or blocked?`);
          passability = communicatedPassability(inspection);
        }
        if (!passability) {
          inspection = await say(`Please check the ${direction} gate again and report whether cargo blocks passage.`);
          passability = communicatedPassability(inspection);
        }
        if (passability === 'blocked') { blocked.add(gate.rooms.join('/')); report.steps.at(-1).reportedBlocked = gate.rooms; continue; }
        if (passability !== 'clear') throw new Error('Gate inspection remained ambiguous after one clarification and one rephrased retry.');
        const arrived = await say(`Please go through the ${direction} gate, then look around and report the emblem where you arrive.`);
        if (await page.getByRole('heading', { name: 'Return Dock', exact: true }).isVisible()) current = 'dock';
        else current = await communicatedRoom(arrived);
        report.route.push(current);
      }
      await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible(); report.route.push('Return Dock');
      await screenshot('dock');
      report.dockManual = await page.locator('.return-document').innerText();
      await say(PHRASES.dock);
      const contactConfirmed = text => !/not holding|not held|cannot hold|can't hold/i.test(text) && /\bI (?:am holding|have (?:gripped|held))|\bI'm holding|\bI've (?:gripped|held)|\bcontact (?:is|has been) (?:now )?(?:held|secured)|^holding (?:the )?contact/i.test(text);
      let held = await say(PHRASES.contact);
      if (!contactConfirmed(held)) held = await say('Are you holding the contact steady right now?');
      if (!contactConfirmed(held)) held = await say('Please hold the contact now and tell me when you are holding it.');
      if (!contactConfirmed(held)) throw new Error('Pip did not confirm holding the contact after bounded clarification.');
      await page.getByRole('button', { name: 'Charge', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
      await page.getByRole('button', { name: 'Store', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
      await say(PHRASES.board); await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
      await page.getByRole('button', { name: 'Authorize return', exact: true }).click(); await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
      // Final home disconnects automatically; unlike intermediate turns it need not return to listening.
      const finalSpeech = await fixture(PHRASES.home); await queueSpeech(page, finalSpeech);
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
      report.visibleHistory = await page.locator('.history-message').evaluateAll(articles => articles.map(article => ({ speaker: article.querySelector('strong')?.textContent, text: article.querySelector('p')?.textContent }))).catch(() => []);
      evidence = await collectAudioEvidence(page, directory).catch(() => undefined);
      await cleanupAudioInstrumentation(page).catch(() => {});
      report.cleanup = await audioSnapshot(page).then(snapshot => ({ activeTracks: snapshot.activeTracks, activeSources: snapshot.activeSources, openApplicationContexts: snapshot.openApplicationContexts })).catch(() => null);
    }
    const events = evidence?.events ?? []; const opened = events.find(event => event.type === 'socket.open'); const ended = events.find(event => event.type === 'session.ended'); const closed = events.find(event => event.type === 'socket.close');
    report.endAcknowledged = Boolean(ended); report.explicitEndSent = events.some(event => event.type === 'session.end');
    report.providerDurationSeconds = ended?.durationSeconds ?? null;
    report.connectedSeconds = opened && (ended || closed) ? ((ended ?? closed).atMs - opened.atMs) / 1000 : null;
    if (reservation && opened && (!report.endAcknowledged || !report.explicitEndSent)) failure ??= 'The provider ending was not explicitly sent and acknowledged.';
    report.failure = failure ?? null;
    if (directory) await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (reservation) await finishAttempt({ endAcknowledged: report.endAcknowledged, connectedSeconds: report.connectedSeconds, outcome: failure ? 'failed' : 'passed' }).catch(() => {});
    const video = page?.video();
    await context?.close().catch(() => {});
    if (video && directory) {
      await video.saveAs(join(directory, 'browser-silent.webm')).then(() => { report.video = 'browser-silent.webm'; }).catch(() => { report.videoFailure = 'Browser video could not be saved.'; });
      report.videoAlignment = 'Audio uses browser QA time origin; video page creation wall-clock interval is retained for approximate alignment, not sample-accurate synchronization.';
    }
    if (directory) await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser?.close().catch(() => {}); await browserServer?.close().catch(() => {});
    server.kill('SIGTERM'); await Promise.race([new Promise(resolveExit => server.once('exit', resolveExit)), pause(1500)]);
    process.off('message', onMessage); if (process.connected) process.disconnect();
  }
  console.log(JSON.stringify({ scenario, directory, completion: report.completion, failure, connectedSeconds: report.connectedSeconds, endAcknowledged: report.endAcknowledged }));
  if (failure) process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--worker')) {
  try { await worker(args[args.indexOf('--scenario') + 1]); } catch { console.error('QA worker preparation failed before a usable session; inspect the preserved local campaign.'); process.exitCode = 1; if (process.connected) process.disconnect(); }
} else if (args.includes('--inspect')) {
  const state = inspectCampaign(DIRECTORY); console.log(JSON.stringify({ attempts: state.attempts.length, productionAttempts: state.productionAttempts, reservedSeconds: state.reservedSeconds, estimatedReservedDollars: state.estimatedReservedDollars }));
} else {
  await prepareFixtures();
  if (!args.includes('--live')) console.log('DRY RUN: local speech fixtures validated; no credentials loaded, allowance created, or provider contacted. Use --live --scenario canary only for the authorized campaign.');
  else {
    const scenario = args[args.indexOf('--scenario') + 1]; if (!['canary', 'mission'].includes(scenario)) throw new Error('Explicit --scenario canary or mission required.');
    const { initializeAllowance } = await import('../dist/server/server/admission.js');
    const campaign = initializeCampaign(DIRECTORY, initializeAllowance, { hourlyRate: 4.5 });
    if (campaign.attempts.length >= campaign.header.maxAttempts) throw new Error('The authorized QA campaign is exhausted; no new provider attempt is permitted.');
    const result = await runSupervised({ directory: DIRECTORY, worker: SELF, args: ['--worker', '--scenario', scenario] }); process.exitCode = result.exitCode ?? 1;
  }
}
