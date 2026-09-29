// Local, actual compiled Practice captures. Uses ordinary UI and communicated reports.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { confirmProposalForRequest, confirmVisibleProposal } from '../../scripts/qa-mission-player.mjs';

const baseline = process.argv.includes('--baseline');
const recorder = process.argv.includes('--recorder');
const recordVideo = process.argv.includes('--video');
const source = baseline ? '/home/mhirotaka/workspace/talk-me-home' : process.cwd();
const label = baseline ? 'before' : recorder ? 'after-recorder' : 'after-core';
const output = resolve(`artifacts/goal-006/ui/${label}`);
const media = resolve(`.validation/goal-006-capture/${label}`);
mkdirSync(output, { recursive: true }); mkdirSync(media, { recursive: true });
const files = {};
function hashTree(path) {
  for (const name of readdirSync(join(source, path), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const item = `${path}/${name.name}`;
    if (name.isDirectory()) hashTree(item);
    else files[item] = createHash('sha256').update(readFileSync(join(source, item))).digest('hex');
  }
}
hashTree('dist/client'); hashTree('dist/server');
const report = { label: 'Actual compiled Practice — no provider connection', source,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }).trim()),
  runtimeManifestSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), recorderSelected: recorder,
  screenshots: [], conversations: [], confirmations: [], realProviderCalls: 0, videos: [], startedAt: new Date().toISOString() };
const listener = createServer(); await new Promise(done => listener.listen(0, '127.0.0.1', done));
const port = listener.address().port; await new Promise(done => listener.close(done));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/server/server/production.js'], { cwd: source,
  env: { ...process.env, PORT: String(port), GAME_ORIGIN: origin, GAME_BIND_ADDRESS: '127.0.0.1', GAME_DISABLE_LIVE: '1',
    GAME_PUBLIC_LIVE_ENABLED: '0', GAME_LIVE_ALLOWANCE_FILE: '', GAME_DEMO_ACCESS_CODE: '', ASSEMBLYAI_API_KEY: '', GAME_LOCAL_TOOL_DIAGNOSTICS: '' },
  stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw new Error('Capture service exited.');
    try { ready = (await fetch(origin + '/api/health')).ok; } catch {} if (ready) break; await delay(100); }
  assert.ok(ready, 'Local production service did not become ready');
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  for (const [width, height] of recordVideo ? [[1440,900]] : [[1280,720],[1440,900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: recordVideo ? 'no-preference' : 'reduce',
      serviceWorkers: 'block', ...(recordVideo ? { recordVideo: { dir: media, size: { width, height } } } : {}) });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.endsWith('/voice-token')) throw new Error('Unexpected network request in offline capture');
      await route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => { throw error; });
    const started = Date.now();
    const pause = async () => { if (recordVideo) await delay(1700); };
    const shot = async name => {
      await page.evaluate(() => scrollTo(0,0)); await pause();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const path = `${output}/${name}-${width}.png`;
      await page.screenshot({ path, animations: 'disabled' });
      report.screenshots.push({ path, name, width, height, atSeconds: (Date.now()-started)/1000 });
    };
    const say = async text => {
      await page.getByLabel('Type a message').fill(text); await pause();
      const response = page.waitForResponse(r => r.url().endsWith('/tools'));
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      let result = await (await response).json();
      if (result.code === 'awaiting_confirmation') {
        await pause();
        const decision = page.waitForResponse(r => r.url().endsWith('/proposal-decision'));
        if (text === 'Pick up the flight recorder') await confirmVisibleProposal(page, 'Secure the flight recorder', text, report.confirmations);
        else await confirmProposalForRequest(page, text, report);
        result = await (await decision).json();
      }
      assert.ok(result.ok, `Practice request failed: ${text}`);
      await expect(page.getByTestId('caption')).not.toHaveText(text); await pause();
      report.conversations.push({ width, request: text, response: await page.getByTestId('caption').innerText(), atSeconds: (Date.now()-started)/1000 });
      return result;
    };
    const relay = async name => {
      const button = page.getByRole('button', { name: 'Relay ' + name, exact: true });
      if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
      await expect(page.getByTestId('acknowledged-relay')).toHaveText(name); await pause();
    };
    const dock = async name => { await page.getByRole('button', { name, exact: true }).click(); await pause(); };
    await page.goto(origin);
    if (recorder) await page.getByLabel('Bring back the flight recorder', { exact: true }).check();
    await shot('title');
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await say('Look around'); await shot('cargo');
    await say('Inspect the latch'); await say('Keep the door open');
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
    await say('Cross to the far side'); await relay('Beacon'); await say('Go through the east gate');
    await shot('gallery');
    await say('Go through the southeast gate');
    if (recorder) { await say('Inspect the flight recorder'); await shot('recorder-observed'); await say('Pick up the flight recorder'); await shot('recorder-secured'); }
    await say('Inspect the northeast gate');
    const reportText = await page.getByTestId('caption').innerText();
    if (/cargo blocks|blocked/i.test(reportText)) {
      await relay('Beacon'); await say('Go through the northwest gate');
      await relay('Harbor'); await say('Go through the northeast gate');
      await say('Inspect the southeast gate'); await relay('Beacon'); await say('Go through the southeast gate');
    } else { await relay('Harbor'); await say('Go through the northeast gate'); }
    await say('Look around'); await shot('dock');
    await say('Inspect the contact'); await say('Hold the contact');
    await dock('Charge'); await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
    await dock('Store'); await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
    await say('Release the contact'); await say('Board the capsule'); await dock('Authorize return');
    await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
    await say('Confirm return'); await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
    if (recordVideo) await delay(4000); await shot('home');
    const video = page.video(); await context.close();
    if (video) report.videos.push(await video.path());
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally {
  await browser?.close(); child.kill('SIGTERM');
  for (let i=0; i<50 && child.exitCode === null; i++) await delay(100);
  if (child.exitCode === null) { child.kill('SIGKILL'); for(let i=0;i<20 && child.exitCode===null;i++) await delay(100); }
  report.cleanup = child.exitCode !== null || child.signalCode !== null;
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${output}/manifest.json`, JSON.stringify(report,null,2)+'\n');
}
