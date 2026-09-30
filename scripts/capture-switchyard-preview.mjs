#!/usr/bin/env node
/** Offline presentation capture through the shipped UI. No provider or private navigation API. */
import { chromium, expect } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { previewSwitchyardRouting } from '../game/shared/switchyard.ts';

const runFile = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const usage = 'Offline only: node --import tsx scripts/capture-switchyard-preview.mjs --capture --origin http://127.0.0.1:PORT --source FULL_COMMIT_SHA [--output .validation/goal-008/unique-directory]';

function options() {
  const parsed = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--capture') { parsed.capture = true; continue; }
    if (!['--origin', '--source', '--output'].includes(key) || !args[index + 1]) throw new Error(usage);
    if (parsed[key.slice(2)]) throw new Error('Each capture argument must occur once.');
    parsed[key.slice(2)] = args[++index];
  }
  if (!parsed.capture || !/^[a-f0-9]{40}$/.test(parsed.source ?? '')) throw new Error(usage);
  let url;
  try { url = new URL(parsed.origin); } catch { throw new Error('Capture requires a valid loopback origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Capture requires a plain loopback origin without credentials, a path, or query parameters.');
  return { ...parsed, origin: url.origin };
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async path => sha256(await readFile(path));
const publicPath = path => relative(root, path).split(sep).join('/');
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

if (!args.length || args.includes('--help')) { console.log(usage); process.exitCode = 0; }
else await main();

async function main() {
  const config = options();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const allowed = resolve(root, '.validation/goal-008');
  const output = resolve(root, config.output ?? `.validation/goal-008/preview-${config.source.slice(0, 12)}-${stamp}`);
  if (!output.startsWith(allowed + sep)) throw new Error('Raw capture must stay in a new directory inside .validation/goal-008.');
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Exclusive: never overwrite a prior success or failure.
  const report = { schema: 1, status: 'STARTED', startedAt: new Date().toISOString(), source: config.source,
    evidence: 'Fresh local/scripted Practice, ordinary selected text requests and manual UI confirmations; no provider connection or human playtest.',
    output: publicPath(output), audio: 'Silent browser video; no microphone, provider speech or presentation narration.',
    route: 'Investigate the direct lift, deliberately choose the maintenance bypass, then confirm actual home departure.',
    shots: [], operations: [], violations: [] };
  let browser; let context; let page; let video; let watchdog; let failure;
  const pending = new Set();
  const journalPath = resolve(output, 'capture-journal.private.json');
  const safeError = cause => cause instanceof Error ? cause.message.split('\n')[0].slice(0, 300) : 'Local capture failed.';
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (head !== config.source) throw new Error('The checkout HEAD does not match the requested capture source.');
    execFileSync('git', ['diff', '--quiet'], { cwd: root });
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: root });
    const versionResponse = await fetch(config.origin + '/api/version', { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!versionResponse.ok) throw new Error('The local version endpoint did not respond successfully.');
    const version = await versionResponse.json();
    if (version.commit !== config.source || version.version !== '0.8.0') throw new Error('The served source or version does not match the clean Goal 008 candidate.');
    report.served = { commit: version.commit, version: version.version };
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    watchdog = setTimeout(() => { report.violations.push('The 180-second capture deadline expired.'); void browser?.close(); }, 180_000);
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: resolve(output, 'raw'), size: { width: 1920, height: 1080 } }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(10_000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== config.origin || /\/voice-token(?:\/|$)/.test(url.pathname)) {
        report.violations.push('A forbidden external origin or token endpoint was requested.');
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => {
      report.violations.push('A WebSocket connection was requested during offline Practice capture.');
      socket.close();
    });
    await context.addInitScript(({ source }) => {
      document.addEventListener('DOMContentLoaded', () => {
        const banner = document.createElement('div'); banner.id = 'capture-label';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#172a20;color:#fff3d7;padding:8px 20px;font:14px/1.35 system-ui;pointer-events:none;box-shadow:0 2px 0 #d7b15a';
        const label = document.createElement('div'); label.textContent = `LOCAL / SCRIPTED PRACTICE · 0.8.0 · source ${source.slice(0, 12)} · selected text + manual confirmation`;
        const caption = document.createElement('div'); caption.id = 'capture-caption'; caption.style.cssText = 'font-size:18px;font-weight:600;margin-top:3px'; caption.textContent = 'The Switchyard — a local candidate preview';
        banner.append(label, caption); document.body.append(banner);
        document.body.style.paddingTop = '72px'; document.documentElement.style.scrollPaddingTop = '90px';
      });
    }, { source: config.source });
    page = await context.newPage(); video = page.video();
    page.on('pageerror', () => report.violations.push('A browser page error occurred.'));
    const captureResponse = async response => {
      const request = response.request(); const path = new URL(response.url()).pathname;
      if (request.method() !== 'POST' || !/^\/api\/sessions\/[^/]+\/(?:tools|messages|proposal-decision|routing-panel|stop|resume)$/.test(path)) return;
      const body = request.postDataJSON(); const result = await response.json(); const endpoint = path.split('/').at(-1);
      // Never persist headers, cookies, authorization data, full views or arbitrary response extras.
      const item = { atMs: Date.now() - report.captureStartedAtMs, endpoint, status: response.status() };
      if (endpoint === 'messages') Object.assign(item, { role: body.role, inputMethod: body.inputMethod, text: body.text });
      if (endpoint === 'tools') Object.assign(item, { name: body.name, ok: result.ok, code: result.code, message: result.message });
      if (endpoint === 'proposal-decision') Object.assign(item, { decision: body.decision, proposalLabel: result.proposal?.label, outcome: result.proposal?.status, ok: result.ok, completed: result.view?.completed });
      if (endpoint === 'routing-panel') Object.assign(item, { rotations: body.rotations, acknowledgedPanelRevision: result.switchyardPanel?.panelRevision });
      report.operations.push(item);
    };
    page.on('response', response => {
      const operation = captureResponse(response).catch(() => report.violations.push('An operation receipt could not be captured.'));
      pending.add(operation); void operation.finally(() => pending.delete(operation));
    });
    report.captureStartedAtMs = Date.now();
    await page.goto(config.origin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('radio', { name: /^Rescue Mission/ })).toBeChecked();
    await page.getByRole('radio', { name: /^The Switchyard/ }).check();
    const beat = async (name, targetSeconds, caption, locator) => {
      await page.locator('#capture-caption').evaluate((element, text) => { element.textContent = text; }, caption);
      if (locator) await locator.scrollIntoViewIfNeeded();
      const start = (Date.now() - report.captureStartedAtMs) / 1000;
      await mkdir(resolve(output, 'screens'), { recursive: true });
      const screenshot = resolve(output, 'screens', `${String(report.shots.length + 1).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: screenshot, animations: 'disabled' });
      report.shots.push({ name, caption, startsAtSeconds: start, targetEndSeconds: targetSeconds, screenshot: publicPath(screenshot), sha256: await fileHash(screenshot) });
      await delay(Math.max(0, targetSeconds * 1000 - (Date.now() - report.captureStartedAtMs)));
      if (report.violations.length) throw new Error('A capture guard or receipt check failed.');
    };
    const choices = () => page.getByRole('region', { name: 'Local companion requests' });
    const ask = async (label, physical = false, confirm = true) => {
      const response = page.waitForResponse(item => item.url().endsWith('/tools') && item.request().method() === 'POST');
      await choices().getByRole('button', { name: label, exact: true }).click();
      const result = await (await response).json();
      if (!result.ok) throw new Error('An ordinary local request failed during capture.');
      if (physical) {
        await expect(page.getByTestId('proposal-label')).toHaveText(label);
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
        if (confirm) await decide('confirm', label === 'Depart for home');
      }
    };
    const decide = async (decision, home = false) => {
      const response = page.waitForResponse(item => item.url().endsWith('/proposal-decision'));
      await page.getByRole('button', { name: decision === 'confirm' ? 'Confirm this action' : 'Not yet', exact: true }).click();
      await response;
      if (!home) await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', decision === 'confirm' ? 'committed' : 'declined');
    };
    const discuss = async name => {
      await choices().getByRole('button', { name: `Discuss the ${name}`, exact: true }).click();
      await expect(page.getByTestId('caption')).toContainText(/investigate|change the plan/);
    };
    const supply = async names => {
      // These names come from the visible human manual. The search reads only public geometry.
      const wanted = ['amber', 'blue', 'white'].filter(name => names.toLowerCase().includes(name));
      if (!wanted.length) throw new Error('The visible manual row did not name a supply.');
      let layout;
      for (let value = 0; value < 4096; value++) {
        const candidate = Array.from({ length: 6 }, (_, index) => Math.floor(value / 4 ** index) % 4);
        const preview = previewSwitchyardRouting(candidate);
        if (preview.valid && preview.poweredTerminals.length === wanted.length && wanted.every(name => preview.poweredTerminals.includes(name))) { layout = candidate; break; }
      }
      if (!layout) throw new Error('The requested public circuit could not be drawn.');
      for (const [index, rotation] of layout.entries()) {
        const piece = page.locator(`[data-piece="p${index + 1}"]`);
        const current = Number(await piece.getAttribute('data-rotation'));
        for (let turn = 0; turn < (rotation - current + 4) % 4; turn++) await piece.click();
      }
      await page.getByTestId('switchyard-panel').scrollIntoViewIfNeeded();
      await delay(1200); // Deliberate presentation pause on the unapplied draft.
      const apply = page.getByRole('button', { name: 'Apply routing', exact: true });
      if (await apply.isEnabled()) {
        await apply.click();
        await expect(page.getByTestId('switchyard-panel-status')).toContainText('Applied routing acknowledged');
      }
      for (const terminal of ['amber', 'blue', 'white']) await expect(page.getByTestId(`applied-${terminal}`)).toHaveText(wanted.includes(terminal) ? 'Powered' : 'Off');
      await delay(900); await ask('Look around');
    };

    await beat('briefing', 4, 'Choose The Switchyard: a local scripted puzzle with two approaches.');
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await expect(page.getByTestId('switchyard-panel')).toBeVisible();
    await ask('Look around'); await ask('Inspect Route directory'); await discuss('direct lift');
    await beat('shared-information', 10, 'You read the installation drawing. Pip reports the equipment within reach.', choices());
    await ask('Go to Transfer Table', true, false);
    await beat('pending-action', 14, 'A request prepares one exact proposal. The action still needs your confirmation.', page.getByTestId('action-proposal'));
    await decide('decline');
    await beat('deliberate-decline', 17, 'Not yet leaves the movement unexecuted.', page.getByTestId('action-proposal'));
    await ask('Go to Transfer Table', true); await ask('Go to Lift Station', true); await ask('Inspect Lift console');
    const liftReport = await page.getByTestId('caption').innerText();
    const liftPlate = liftReport.match(/plate reads (Crescent|Kite)/)?.[1];
    if (!liftPlate) throw new Error('The local lift report did not communicate its plate.');
    await beat('lift-investigation', 23, 'First investigate the direct lift. Its local plate identifies a row in your document.', page.getByTestId('caption'));
    await page.getByRole('tab', { name: 'Lift plates', exact: true }).click();
    await beat('human-manual', 28, 'The drawing supplies circuit rules that the local companion does not receive.', page.getByRole('rowheader', { name: liftPlate, exact: true }));
    await discuss('maintenance bypass');
    await expect(page.getByTestId('caption')).toContainText('Completed work stays completed');
    await beat('change-plan', 33, 'Change the plan after investigation. Completed work stays completed.', page.getByTestId('caption'));
    await ask('Return to Transfer Table', true); await ask('Go to Service Gallery', true); await ask('Inspect Bridge winch');
    const bridgeReport = await page.getByTestId('caption').innerText();
    const bridgePlate = bridgeReport.match(/plate reads (Rivet|Slot)/)?.[1];
    if (!bridgePlate) throw new Error('The bridge report did not communicate its fitted module.');
    await page.getByRole('tab', { name: 'Service modules', exact: true }).click();
    const cells = await page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: bridgePlate, exact: true }) }).getByRole('cell').allTextContents();
    if (cells.length !== 3) throw new Error('The visible service-module row was incomplete.');
    const [winchSupply, alignmentSupply, crossingSupply] = cells;
    await beat('service-manual', 39, 'Compare the fitted service module with the manual before changing the supply.', page.getByRole('rowheader', { name: bridgePlate, exact: true }));
    await ask('Seat the bridge brace', true); await supply(winchSupply); await ask('Deploy the bridge', true);
    await beat('bridge-deployed', 48, 'Apply the complete circuit, then confirm the separate local bridge operation.', page.getByTestId('caption'));
    await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
    await delay(1000);
    await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
    await ask('Look around'); await ask('Inspect Bridge winch');
    await expect(page.getByTestId('caption')).toContainText('deployed into its retaining detent');
    await beat('fresh-report-after-pause', 55, 'After a pause, request a fresh report. The secured mechanism retains its progress.', page.getByTestId('caption'));
    await ask('Return to Transfer Table', true); await ask('Inspect Transfer turntable'); await supply(alignmentSupply); await ask('Align the turntable', true);
    await beat('alignment', 63, 'The bypass also needs a separate alignment at the transfer table.', page.getByTestId('caption'));
    await ask('Go to Service Gallery', true); await ask('Inspect Bridge winch'); await supply(crossingSupply); await ask('Cross the maintenance bridge', true);
    await expect(page.getByTestId('caption')).toContainText('departure is still a separate confirmed decision');
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toHaveCount(0);
    await ask('Inspect Departure console'); await ask('Depart for home', true, false);
    await beat('departure-pending', 72, 'The route is restored. Departure is still a separate confirmed choice.', page.getByTestId('action-proposal'));
    await decide('confirm', true);
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The maintenance bypass restored', exact: true })).toBeVisible();
    await beat('confirmed-home', 82, 'Pip is home by the maintenance bypass. Local/scripted Practice candidate preview.', page.getByRole('heading', { name: 'Pip is home.', exact: true }));
    report.status = 'CAPTURED_CONFIRMED_HOME';
  } catch (cause) {
    failure = cause; report.status = 'CAPTURE_FAILED'; report.error = safeError(cause);
  } finally {
    if (watchdog) clearTimeout(watchdog);
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await Promise.allSettled([...pending]);
    if (video) {
      try { report.rawVideo = publicPath(await video.path()); report.rawVideoSha256 = await fileHash(resolve(root, report.rawVideo)); }
      catch { report.violations.push('The raw browser video could not be finalized.'); }
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(journalPath, JSON.stringify(report, null, 2) + '\n');
  }
  if (!failure && report.violations.length) failure = new Error('A capture guard, browser check or receipt check failed.');
  if (!failure && report.rawVideo) {
    try {
      const final = resolve(output, 'Talk-Me-Home-Goal-008-Switchyard-Local-Preview.mp4');
      await runFile('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-i', resolve(root, report.rawVideo), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', final], { timeout: 120_000 });
      await runFile('ffmpeg', ['-v', 'error', '-nostdin', '-i', final, '-f', 'null', '-'], { timeout: 120_000 });
      const { stdout } = await runFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', final], { timeout: 15_000 });
      const probe = JSON.parse(stdout); const duration = Number(probe.format.duration);
      if (duration < 60 || duration > 90 || probe.streams.some(stream => stream.codec_type !== 'video')
        || !probe.streams.some(stream => stream.width === 1920 && stream.height === 1080)) throw new Error('The derived preview does not meet its silent full-HD 60–90 second delivery bounds.');
      report.finalVideo = publicPath(final); report.finalVideoSha256 = await fileHash(final); report.probe = probe;
      report.status = 'LOCAL_CAPTURE_AND_DECODE_PASS_PENDING_VISUAL_REVIEW';
    } catch (cause) { failure = cause; report.status = 'ENCODING_OR_VALIDATION_FAILED'; report.error = safeError(cause); }
  }
  if (failure && !report.error) { report.status = 'CAPTURE_FAILED'; report.error = safeError(failure); }
  await writeFile(journalPath, JSON.stringify(report, null, 2) + '\n');
  const manifestDirectory = resolve(root, 'artifacts/goal-008/preview');
  await mkdir(manifestDirectory, { recursive: true });
  const { operations, captureStartedAtMs, ...manifest } = report;
  manifest.counts = {
    selectedRequests: operations.filter(item => item.endpoint === 'messages' && item.role === 'human' && item.inputMethod === 'quick_request').length,
    confirmations: operations.filter(item => item.endpoint === 'proposal-decision' && item.decision === 'confirm').length,
    declines: operations.filter(item => item.endpoint === 'proposal-decision' && item.decision === 'decline').length,
    committedDecisions: operations.filter(item => item.endpoint === 'proposal-decision' && item.outcome === 'committed').length,
    routingApplies: operations.filter(item => item.endpoint === 'routing-panel' && item.status === 200).length,
  };
  const manifestPath = resolve(manifestDirectory, `capture-${config.source.slice(0, 12)}-${stamp}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, manifest: publicPath(manifestPath), video: report.finalVideo, counts: manifest.counts }));
  if (failure) process.exitCode = 1;
}
