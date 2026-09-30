// Public-origin checks use only normal Practice UI and never mint a provider token.
import { chromium, expect, request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { confirmProposalForRequest, confirmVisibleProposal } from './qa-mission-player.mjs';
const { values: flags } = parseArgs({ options: { run: { type: 'boolean' }, origin: { type: 'string' }, 'expected-commit': { type: 'string' }, output: { type: 'string' }, 'allow-loopback': { type: 'boolean' } } });
if (!flags.run) console.log('Offline dry run: use --run --origin https://actual-host --expected-commit <40-hex> --output <private-directory>.');
else {
  const url = new URL(flags.origin ?? '');
  assert(url.href === `${url.origin}/` && !url.username && !url.password, 'An exact origin is required.');
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  assert(url.protocol === 'https:' || local && flags['allow-loopback'], 'HTTPS required outside explicit loopback verification.');
  assert(/^[a-f0-9]{40}$/.test(flags['expected-commit'] ?? ''), 'Pin the expected source commit.');
  const output = resolve(flags.output ?? `.validation/goal-007/practice-${Date.now()}`); mkdirSync(output, { recursive: true });
  const receipt = { schemaVersion: 1, startedAt: new Date().toISOString(), origin: url.origin, scope: local ? 'LOCAL_COMPILED_PRODUCTION' : 'HOSTED_HTTPS_PRODUCTION', mode: 'Practice / deterministic simulation', checks: [], rescues: [], forbiddenRequests: 0, errors: [], status: 'RUNNING' };
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true, ...(process.env.GAME_QA_BROWSER_CHANNEL ? { channel: process.env.GAME_QA_BROWSER_CHANNEL } : {}) });
  const api = await request.newContext({ baseURL: url.origin, timeout: 10000 });
  async function fresh() {
    const context = await browser.newContext({ baseURL: url.origin, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route(/assemblyai\.com|\/voice-token(?:\?|$)/, async route => { receipt.forbiddenRequests++; await route.abort(); });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(20000);
    page.on('pageerror', e => receipt.errors.push(e.message)); return { page, context };
  }
  try {
    assert.deepEqual(await (await api.get('/api/health')).json(), { ok: true });
    receipt.identity = await (await api.get('/api/version')).json();
    assert.deepEqual(Object.keys(receipt.identity).sort(), ['commit', 'version']); assert.equal(receipt.identity.commit, flags['expected-commit']);
    for (const path of ['/.env', '/.validation/ledger.jsonl', '/game/server/sessions.ts', '/api/unknown']) {
      const response = await api.get(path); assert.equal(response.status(), 404);
      if (path.startsWith('/api/')) assert.match(response.headers()['content-type'], /application\/json/);
    }
    const notes = await api.get('/third-party-notices.txt'); assert.equal(notes.status(), 200); assert.match(notes.headers()['content-type'], /text\/plain/); assert.match(await notes.text(), /MIT License/);
    assert.equal((await (await api.get('/api/access')).json()).authorized, false);
    receipt.checks.push('health', 'exact safe build identity', 'private paths rejected', 'unknown API remains JSON', 'license notices', 'fresh visitor unauthorized');
    const landing = await fresh(); await landing.page.goto(`${url.origin}/mission/control`); await landing.page.reload();
    await expect(landing.page.getByRole('button', { name: 'Start Practice', exact: true })).toBeVisible();
    const assets = await landing.page.locator('script[src],link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('src') ?? n.getAttribute('href')));
    assert(assets.length >= 2);
    for (const asset of assets) { assert(asset.startsWith('/assets/')); const response = await api.get(asset); assert.equal(response.status(), 200); assert.match(response.headers()['cache-control'], /immutable/); assert.match(response.headers()['content-type'], asset.endsWith('.css') ? /text\/css/ : /javascript/); }
    receipt.assets = assets; receipt.checks.push('SPA reload and hashed asset MIME/cache'); await landing.context.close();
    for (const objective of ['collected', 'selected-skipped']) {
      const { page, context } = await fresh();
      const run = { objective, chapters: ['Cargo Bay'], confirmations: 0, declined: 0, reports: [], screenshots: [] }; receipt.rescues.push(run);
      const capture = async name => { const file = `${objective}-${name}.png`; await page.screenshot({ path: resolve(output, file), animations: 'disabled' }); run.screenshots.push(file); };
      const say = async (text, confirm = true) => {
        await page.getByLabel('Type a message').fill(text); const response = page.waitForResponse(r => r.url().endsWith('/tools'));
        await page.getByRole('button', { name: 'Send message', exact: true }).click(); let result = await (await response).json();
        if (result.code === 'awaiting_confirmation' && confirm) {
          const decision = page.waitForResponse(r => r.url().endsWith('/proposal-decision'));
          if (text === 'Pick up the flight recorder') await confirmVisibleProposal(page, 'Secure the flight recorder', text); else await confirmProposalForRequest(page, text);
          result = await (await decision).json(); run.confirmations++;
        }
        assert.equal(result.ok, true, text); await expect(page.getByTestId('caption')).not.toHaveText(text);
        const report = await page.getByTestId('caption').innerText(); run.reports.push({ input: text, report }); return { result, report };
      };
      const relay = async name => { const button = page.getByRole('button', { name: `Relay ${name}`, exact: true }); if (await button.getAttribute('aria-pressed') !== 'true') await button.click(); await expect(page.getByTestId('acknowledged-relay')).toHaveText(name); };
      try {
        await page.goto(url.origin); await page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true }).check();
        const created = page.waitForResponse(r => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Start Practice', exact: true }).click(); const initial = await (await created).json();
        // A separate cookie-free context is not the owner. Never retain a returned token body.
        const denied = await api.post(`/api/sessions/${encodeURIComponent(initial.sessionId)}/voice-token`, { headers: { origin: url.origin }, data: { roundId: initial.roundId } });
        assert.equal(denied.status(), 404, 'Nonowners receive no session-existence disclosure.'); run.nonownerTokenStatus = denied.status();
        const noCode = await context.request.post('/api/sessions/' + encodeURIComponent(initial.sessionId) + '/voice-token', { headers: { origin: url.origin }, data: { roundId: initial.roundId } });
        assert([403, 503].includes(noCode.status()), 'Owning browser without a demo code must be denied before issuance.'); run.noCodeTokenStatus = noCode.status();
        await say('Look around'); await capture('cargo'); await say('Keep the door open');
        await page.getByRole('button', { name: 'Power OFF', exact: true }).click(); await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
        await say('Cross to the far side'); run.chapters.push('Relay Gallery');
        await say('Where are you?'); await relay('Beacon'); await say('Go through the east gate'); await say('Where are you?'); await capture('gallery');
        await page.getByRole('button', { name: 'Pause mission', exact: true }).click(); await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
        // Branches are authored on the human atlas; obstruction decisions use the actual spoken report.
        if (objective === 'collected') {
          await say('Go through the southeast gate'); await say('Inspect the flight recorder'); await say('Pick up the flight recorder', false);
          await page.getByRole('button', { name: 'Not yet', exact: true }).click(); await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined'); run.declined++;
          await say('Pick up the flight recorder'); const { report } = await say('Inspect the northeast gate');
          if (/blocked|cargo blocks/i.test(report)) {
            await relay('Beacon'); await say('Go through the northwest gate'); await relay('Harbor'); await say('Go through the northeast gate'); await say('Inspect the southeast gate'); await relay('Beacon'); await say('Go through the southeast gate'); run.backtracked = true;
          } else { await relay('Harbor'); await say('Go through the northeast gate'); run.backtracked = false; }
        } else {
          await relay('Harbor'); await say('Go through the northeast gate'); const { report } = await say('Inspect the southeast gate');
          if (/blocked|cargo blocks/i.test(report)) {
            await relay('Harbor'); await say('Go through the southwest gate'); await relay('Beacon'); await say('Go through the southeast gate'); await say('Inspect the northeast gate'); await relay('Harbor'); await say('Go through the northeast gate'); run.backtracked = true;
          } else { await relay('Beacon'); await say('Go through the southeast gate'); run.backtracked = false; }
        }
        await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible(); run.chapters.push('Return Dock'); await capture('dock');
        await say('Look around'); await say('Hold the contact'); await page.getByRole('button', { name: 'Charge', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
        await page.getByRole('button', { name: 'Store', exact: true }).click(); await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
        await say('Release the contact'); await say('Board the capsule'); await page.getByRole('button', { name: 'Authorize return', exact: true }).click(); await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
        const home = await say('Confirm return'); assert.equal(home.result.view.completed, true); await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
        await expect(page.locator('.homecoming-recorder')).toHaveCount(objective === 'collected' ? 1 : 0); run.completed = true; run.chapters.push('Confirmed home'); await capture('home');
        await page.getByRole('button', { name: 'Start another rescue', exact: true }).click(); await expect(page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true })).not.toBeChecked();
      } finally { await context.close(); }
    }
    const mic = await fresh(); await mic.page.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); } }); });
    await mic.page.goto(url.origin); await mic.page.getByRole('radio', { name: /Live Voice/ }).check(); await mic.page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
    await mic.page.getByRole('button', { name: 'Enable microphone check', exact: true }).click(); await expect(mic.page.getByRole('alert')).toContainText('Microphone access was denied');
    await expect(mic.page.getByRole('button', { name: 'Retry microphone', exact: true })).toBeEnabled(); await mic.page.getByRole('button', { name: 'Choose Practice', exact: true }).click(); await expect(mic.page.getByLabel('Type a message')).toBeEnabled();
    await mic.context.close(); receipt.checks.push('injected denied microphone keeps explicit Practice alternative');
    assert.equal(receipt.forbiddenRequests, 0); assert.deepEqual(receipt.errors, []); receipt.status = 'PASS';
  } catch (error) { receipt.status = 'FAIL'; receipt.failure = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
  finally { await api.dispose(); await browser.close(); receipt.browserClosed = true; receipt.finishedAt = new Date().toISOString(); writeFileSync(resolve(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`); console.log(JSON.stringify({ status: receipt.status, scope: receipt.scope, receipt: resolve(output, 'receipt.json'), failure: receipt.failure })); }
}
