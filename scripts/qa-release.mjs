// Default acceptance is offline. No .env is loaded and no real provider is contacted.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { confirmProposalForRequest, proposalLabelForRequest } from './qa-mission-player.mjs';

const args = process.argv.slice(2);
let target;
let smokeOnly = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--target') { target = args[++index]; if (!target) throw new Error('--target requires an exact origin.'); }
  else if (args[index] === '--smoke-only') smokeOnly = true;
  else throw new Error('Use qa-release.mjs [--smoke-only] [--target exact-origin].');
}
if (target) {
  const url = new URL(target);
  if (url.origin !== target || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('Target must be an exact HTTP(S) origin without credentials or a path.');
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('A remote approved target requires HTTPS.');
}
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceBase = `.validation/goal-005-offline/${sourceCommit}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const directory = resolve(evidenceBase);
mkdirSync(join(directory, 'screenshots'), { recursive: true });
const environment = { ...process.env, CI: '1', GAME_DISABLE_LIVE: '1', GAME_PUBLIC_LIVE_ENABLED: '0', GAME_QA_PREBUILT: '0', ASSEMBLYAI_API_KEY: '', GAME_DEMO_ACCESS_CODE: '', GAME_LIVE_ALLOWANCE_FILE: '' };
const children = new Set();
let browser;
const report = {
  label: 'AUTOMATED QA - OFFLINE PRACTICE / INJECTED PROVIDERS ONLY',
  startedAt: new Date().toISOString(),
  commit: sourceCommit,
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  node: process.version, platform: process.platform, checks: [], screenshots: [],
  realProviderCalls: 0, publicHost: target ? 'Explicit target; scope reported by origin.' : 'Blocked only by absent deployment; local production exercised.',
};
function buildHash() {
  const hash = createHash('sha256');
  function visit(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else { hash.update(path.replaceAll('\\', '/')); hash.update(readFileSync(path)); }
    }
  }
  visit('dist/client'); visit('dist/server'); return hash.digest('hex');
}
function runtimeManifestHash() {
  const files = {};
  function visit(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else files[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  }
  visit('dist');
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}
function start(command, arguments_, extra = {}) {
  const child = spawn(command, arguments_, { env: { ...environment, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  children.add(child);
  child.on('close', () => children.delete(child));
  return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const signal = name => {
    try { if (process.platform === 'win32') child.kill(name); else process.kill(-child.pid, name); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  signal('SIGTERM');
  for (let count = 0; count < 50 && child.exitCode === null && child.signalCode === null; count++) await delay(100);
  if (child.exitCode === null && child.signalCode === null) signal('SIGKILL');
  for (let count = 0; count < 20 && child.exitCode === null && child.signalCode === null; count++) await delay(100);
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'Owned process did not stop.');
}
async function command(label, executable, arguments_, timeout = 240_000) {
  console.log(`QA: ${label}`);
  const started = performance.now();
  const child = start(executable, arguments_);
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-60_000); });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void stop(child); }, timeout);
  let code;
  try { code = await new Promise((done, reject) => { child.on('error', reject); child.on('close', done); }); }
  finally { clearTimeout(timer); await stop(child); }
  const result = { label, status: code === 0 && !timedOut ? 'passed' : 'failed', durationMs: Math.round(performance.now() - started), exitCode: code, timedOut };
  // Retain bounded diagnostics so a failing suite can be investigated directly.
  const log = `${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`;
  writeFileSync(join(directory, log), output);
  result.diagnosticLog = `${evidenceBase}/${log}`;
  const passed = output.match(/(?:#|\u2139) pass (\d+)/)?.[1] ?? output.match(/(\d+) passed(?:\s|\()/)?.[1];
  if (passed) result.passedCases = Number(passed);
  report.checks.push(result);
  assert.equal(result.status, 'passed', `${label} failed; inspect ${result.diagnosticLog}.`);
}
async function freePort() {
  const listener = createServer();
  await new Promise((done, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', done); });
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  return port;
}
async function productionSmoke(origin) {
  const forbidden = [];
  const errors = [];
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.endsWith('/voice-token')) { forbidden.push('Unexpected external or token request'); return route.abort(); }
    return route.continue();
  });
  await context.routeWebSocket(/.*/, socket => { forbidden.push('Unexpected socket'); socket.close(); });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', () => errors.push('Uncaught browser error'));
  const screenshot = async name => {
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
    await page.screenshot({ path: join(directory, 'screenshots', `${name}.png`), animations: 'disabled', fullPage: true });
    report.screenshots.push(`${evidenceBase}/screenshots/${name}.png`);
  };
  report.confirmedActions = { confirmations: 0, confirmedHome: false, screenshots: [] };
  const say = async (text, { decision = 'confirm' } = {}) => {
    await page.getByLabel('Type a message').fill(text);
    const response = page.waitForResponse(response => response.url().endsWith('/tools'));
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    assert.equal((await response).status(), 200);
    await expect(page.getByTestId('caption')).not.toHaveText(text);
    const expectedLabel = proposalLabelForRequest(text);
    if (expectedLabel) {
      await expect(page.getByTestId('proposal-label')).toHaveText(expectedLabel);
      await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
      if (!report.confirmedActions.screenshots.includes('pending')) {
        await screenshot('action-pending'); report.confirmedActions.screenshots.push('pending');
      }
      if (decision === 'decline') {
        await page.getByTestId('action-proposal').getByRole('button', { name: 'Not yet', exact: true }).click();
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
        await screenshot('action-declined'); report.confirmedActions.screenshots.push('declined');
      } else {
        const receipt = await confirmProposalForRequest(page, text, report);
        assert.equal(receipt.status, 'committed', 'The intended visible proposal must actually commit.');
        report.confirmedActions.confirmations++;
        if (!report.confirmedActions.screenshots.includes('committed')) {
          await screenshot('action-confirmed'); report.confirmedActions.screenshots.push('committed');
        }
      }
    }
    if (await page.getByRole('heading', { name: 'You brought Pip home.', exact: true }).isVisible()) return 'Server-confirmed home';
    return page.getByTestId('caption').innerText();
  };
  const relay = async name => {
    const button = page.getByRole('button', { name: `Relay ${name}`, exact: true });
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
    await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);
  };
  await page.goto(origin);
  await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const label = document.createElement('div');
    label.textContent = 'AUTOMATED QA - OFFLINE PRACTICE + UI CONFIRMATION';
    label.style.cssText = 'position:fixed;bottom:0;left:0;padding:3px 8px;background:#17252f;color:#fff;z-index:99999;font:12px sans-serif;pointer-events:none';
    document.body.append(label);
  });
  await screenshot('title');
  await page.locator('.settings-panel > summary').click();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await page.locator('.settings-panel > summary').click();
  const access = await context.request.get(`${origin}/api/access`);
  assert.equal(access.status(), 200);
  const accessStatus = await access.json();
  assert.equal(typeof accessStatus.liveEnabled, 'boolean');
  report.access = { liveEnabled: accessStatus.liveEnabled, authorized: accessStatus.authorized, available: accessStatus.available };
  for (const path of ['/.env', '/game/server/http.ts', '/docs/goal-003-gameplay.md', '/.validation/goal-004b-live/allowance.jsonl', '/api/unknown']) {
    assert.equal((await context.request.get(origin + path)).status(), 404, 'A source, secret, private ledger or unknown API path must not be served.');
  }
  const created = page.waitForResponse(response => response.url().endsWith('/api/sessions') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  const initial = await (await created).json();
  // A separate browser context learns the IDs only for labelled low-level ownership assertions.
  const outsider = await browser.newContext({ baseURL: origin });
  try {
    const response = await outsider.request.post('/api/sessions', { headers: { Origin: origin }, data: { missionKind: 'rescue', scenario: 'classic' } });
    assert.equal(response.status(), 201);
    for (const suffix of ['', `/record?roundId=${initial.roundId}`, `/recap?roundId=${initial.roundId}`]) assert.equal((await outsider.request.get(`/api/sessions/${initial.sessionId}${suffix}`)).status(), 404);
    for (const action of ['power', 'relay', 'dock-control', 'annotations', 'tools', 'proposal-decision', 'stop', 'resume', 'reset', 'end', 'cancel', 'voice-token', 'messages', 'notebook', 'hint']) {
      assert.equal((await outsider.request.post(`/api/sessions/${initial.sessionId}/${action}`, { headers: { Origin: origin }, data: {} })).status(), 404, action);
    }
  } finally { await outsider.close(); }
  await say('Look around'); await say('Inspect the latch');
  await say('Keep the door open', { decision: 'decline' });
  await say('Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say('Cross to the far side'); await say('Where are you?');
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
  await relay('Beacon'); await say('Go through the east gate'); await say('Where are you?');
  await screenshot('gallery');
  await page.getByRole('button', { name: 'Open transcript history' }).click();
  await expect(page.getByRole('region', { name: 'Conversation history', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open transcript history' })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot('gallery-narrow');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); await screenshot('gallery-zoom-200');
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await say('Go through the southeast gate');
  const observed = await say('Inspect the northeast gate');
  report.route = /Cargo blocks/i.test(observed) ? 'Fork to lower platform; obstruction reported; backtracked through Fork and upper platform.' : 'Fork to lower platform; northeast gate reported clear.';
  if (/Cargo blocks/i.test(observed)) {
    await relay('Beacon'); await say('Go through the northwest gate'); await relay('Harbor');
    await say('Go through the northeast gate'); await say('Inspect the southeast gate');
    await relay('Beacon'); await say('Go through the southeast gate');
  } else { await relay('Harbor'); await say('Go through the northeast gate'); }
  await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible();
  await say('Look around'); await say('Inspect the contact'); await say('Hold the contact');
  await page.getByRole('button', { name: 'Charge', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
  await say('Release the contact'); await say('Board the capsule'); await screenshot('dock');
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await say('Confirm return');
  await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
  const final = await (await context.request.get(`${origin}/api/sessions/${initial.sessionId}`)).json();
  assert.equal(final.completed, true); // Oracle assertion after UI actions only.
  await screenshot('home');
  report.confirmedActions.confirmedHome = true; report.confirmedActions.screenshots.push('home');
  await page.getByRole('button', { name: 'Start another rescue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeVisible();
  assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
  report.checks.push({ label: 'Fresh-context compiled-production Practice, all-route ownership, settings/history, narrow/zoom, confirmed home and replay', status: 'passed' });
  report.browser = browser.version(); report.chromiumSandbox = true; report.origin = origin;
  await context.close(); await browser.close(); browser = undefined;
}

let successful = false;
try {
  if (!smokeOnly) {
    await command('typecheck', 'npm', ['run', 'typecheck']);
    await command('unit tests', 'npm', ['test']);
    await command('production build', 'npm', ['run', 'build:game']);
    // Browser tests and screenshots exercise this exact compiled candidate.
    const frozen = buildHash();
    environment.GAME_QA_PREBUILT = '1';
    await command('compiled-production browser tests', 'npm', ['run', 'test:e2e']);
    assert.equal(buildHash(), frozen, 'Compiled candidate changed during browser tests.');
    await command('diff whitespace', 'git', ['diff', '--check']);
  }
  assert.ok(existsSync('dist/server/server/production.js'), 'Build the production game before --smoke-only.');
  report.localBuildSha256 = buildHash();
  report.runtimeManifestSha256 = runtimeManifestHash();
  if (!target) report.runtimeBuildSha256 = report.localBuildSha256;
  else report.targetBuildIdentity = 'Remote runtime identity is unverified; local build hash does not identify the remote deployment.';
  let origin = target;
  if (!origin) {
    const port = await freePort(); origin = `http://127.0.0.1:${port}`;
    const server = start(process.execPath, ['dist/server/server/production.js'], { PORT: String(port), GAME_ORIGIN: origin, GAME_BIND_ADDRESS: '127.0.0.1' });
    server.stdout.resume(); server.stderr.resume();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(server.exitCode, null, 'Owned production server exited before readiness.');
      try { ready = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok; } catch {}
      if (ready) break; await delay(100);
    }
    assert.ok(ready, 'Owned production server did not become ready.');
  }
  await productionSmoke(origin);
  assert.equal(buildHash(), report.localBuildSha256, 'Build changed while collecting visual evidence.');
  successful = true;
} catch (error) {
  report.failure = String(error.message).slice(0, 1500);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const child of children) await stop(child);
  report.finishedAt = new Date().toISOString(); report.status = successful ? 'passed' : 'failed';
  report.cleanup = 'Owned browser contexts and child process groups stopped; no provider connection opened.';
  const output = `${evidenceBase}${smokeOnly ? '-smoke' : ''}.json`;
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Offline QA ${report.status}. Evidence: ${output}`);
}
