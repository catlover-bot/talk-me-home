#!/usr/bin/env node
/** Goal 010 continuous, silent local presentation. Never contacts a public host or provider. */
import { chromium, expect } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { encodeRemixCode } from '../game/server/remix.ts';
import { RemixUiPlayer, startRemix } from '../tests/e2e/remix-player.ts';

const root = resolve(import.meta.dirname, '..');
const runFile = promisify(execFile);
const args = process.argv.slice(2);
const usage = 'Offline only: node --import tsx scripts/capture-switchyard-remix-preview.mjs --capture --origin http://127.0.0.1:PORT --source FULL_COMMIT_SHA [--output .validation/goal-010/unique-directory]';
const publicPath = file => relative(root, file).split(sep).join('/');
const fileHash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const delay = ms => new Promise(done => setTimeout(done, ms));

function options() {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--capture') { if (parsed.capture) throw Error(usage); parsed.capture = true; continue; }
    if (!['--origin', '--source', '--output'].includes(key) || !args[i + 1] || parsed[key.slice(2)]) throw Error(usage);
    parsed[key.slice(2)] = args[++i];
  }
  if (!parsed.capture || !/^[a-f0-9]{40}$/.test(parsed.source ?? '')) throw Error(usage);
  let origin; try { origin = new URL(parsed.origin); } catch { throw Error('A loopback origin is required.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
    || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw Error('Only a plain loopback origin is permitted.');
  return { ...parsed, origin: origin.origin };
}

if (!args.length || args.includes('--help')) console.log(usage);
else await main();

async function main() {
  const config = options();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const allowed = resolve(root, '.validation/goal-010');
  const output = resolve(root, config.output ?? `.validation/goal-010/remix-preview-${config.source.slice(0, 12)}-${stamp}`);
  if (!output.startsWith(allowed + sep)) throw Error('Raw media must stay inside a new .validation/goal-010 directory.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (head !== config.source) throw Error('The requested source is not this checkout HEAD.');
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw Error('Capture requires a clean committed checkout, including untracked files.');
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const stills = resolve(root, `artifacts/goal-010/preview/remix-${config.source.slice(0, 12)}-${stamp}`);
  await mkdir(dirname(stills), { recursive: true }); await mkdir(stills);
  const deadline = Date.now() + 180_000;
  const remaining = max => { const value = Math.min(max, deadline - Date.now()); if (value < 1) throw Error('The 180-second operation deadline expired.'); return value; };
  const report = { schema: 1, status: 'STARTED', source: config.source, startedAt: new Date().toISOString(),
    evidence: 'LOCAL SCRIPTED PRACTICE. Ordinary visible UI requests and exact manual confirmations. No provider, microphone, human playtest or public deployment.',
    presentation: 'Continuous normal-speed browser recording with authored presentation captions and pauses for reading actual UI. No cuts, loops, old speech, narration, or time stretching.',
    audio: 'Silent; no audio stream.', output: publicPath(output), shots: [], beats: [], operations: [], violations: [] };
  let browser; let context; let page; let video; let watchdog; let failure;
  const pending = new Set(); const posts = [];
  const safeError = cause => cause instanceof Error ? cause.message.split('\n')[0].slice(0, 300) : 'Capture failed.';
  const journal = resolve(output, 'capture-journal.private.json');
  try {
    const readLocal = async path => {
      const response = await fetch(config.origin + path, { signal: AbortSignal.timeout(remaining(10_000)), redirect: 'error' });
      if (!response.ok) throw Error('A required local readiness endpoint was unavailable.');
      return response.json();
    };
    const version = await readLocal('/api/version');
    if (version.commit !== config.source || version.version !== '0.10.0') throw Error('The served release identity is not the requested clean Goal 010 candidate.');
    const access = await readLocal('/api/access');
    if (access.liveEnabled !== false) throw Error('This capture requires an explicitly Live-disabled local server.');
    report.served = { commit: version.commit, version: version.version, liveEnabled: false };
    // Developer-selected coverage case only. Gameplay receives this public code and reads the UI.
    const code = encodeRemixCode(44, 3, 'service_restoration', 1010);
    report.dispatchCode = code;
    report.coverage = 'Third public panel; alignment-first service procedure; maintenance bypass with service-restoration assignment.';
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    watchdog = setTimeout(() => { report.violations.push('The 180-second capture deadline expired.'); void browser?.close(); }, remaining(180_000));
    context = await browser.newContext({ baseURL: config.origin, viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: resolve(output, 'raw'), size: { width: 1920, height: 1080 } }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(8_000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== config.origin || /\/voice-token(?:\/|$)/.test(url.pathname)) {
        report.violations.push('Blocked external-origin or token request.'); return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => { report.violations.push('Blocked WebSocket request.'); socket.close(); });
    await context.addInitScript(({ source }) => {
      document.addEventListener('DOMContentLoaded', () => {
        const label = document.createElement('div'); label.id = 'capture-label';
        label.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:8px 20px;background:#172a20;color:#fff3d7;font:14px/1.35 system-ui;pointer-events:none;box-shadow:0 2px 0 #d7b15a';
        const sourceLine = document.createElement('div'); sourceLine.textContent = `LOCAL SCRIPTED PRACTICE · 0.10.0 · source ${source.slice(0, 12)} · silent / selected text + exact UI confirmation`;
        const caption = document.createElement('div'); caption.id = 'capture-caption'; caption.style.cssText = 'font-size:18px;font-weight:600;margin-top:3px';
        caption.textContent = 'Presentation caption: The Switchyard Remix — different conditions, familiar rules';
        label.append(sourceLine, caption); document.body.append(label);
        document.body.style.paddingTop = '72px'; document.documentElement.style.scrollPaddingTop = '90px';
      });
    }, { source: config.source });
    page = await context.newPage(); video = page.video();
    page.on('pageerror', () => report.violations.push('A browser page error occurred.'));
    page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname.split('/').at(-1)); });
    const receipt = async response => {
      const request = response.request(); const path = new URL(response.url()).pathname;
      if (request.method() !== 'POST' || !/^\/api\/sessions\/[^/]+\/(?:tools|messages|proposal-decision|routing-panel|stop|resume|reset)$/.test(path)) return;
      const body = request.postDataJSON(); const result = await response.json(); const endpoint = path.split('/').at(-1);
      const item = { atMs: Date.now() - report.captureStartedAtMs, endpoint, status: response.status() };
      if (endpoint === 'messages') Object.assign(item, { role: body.role, inputMethod: body.inputMethod, text: body.text });
      if (endpoint === 'tools') Object.assign(item, { name: body.name, ok: result.ok, message: result.message });
      if (endpoint === 'proposal-decision') Object.assign(item, { decision: body.decision, label: result.proposal?.label, outcome: result.proposal?.status, ok: result.ok, completed: result.view?.completed });
      if (endpoint === 'routing-panel') Object.assign(item, { rotations: body.rotations, revision: result.switchyardPanel?.panelRevision });
      report.operations.push(item);
    };
    page.on('response', response => {
      const operation = receipt(response).catch(() => report.violations.push('An operation receipt could not be captured.'));
      pending.add(operation); void operation.finally(() => pending.delete(operation));
    });
    report.captureStartedAtMs = Date.now();
    const beat = async (name, seconds, caption, locator, still = false) => {
      remaining(1);
      await page.locator('#capture-caption').evaluate((element, copy) => { element.textContent = `Presentation caption: ${copy}`; }, caption);
      if (locator) await locator.scrollIntoViewIfNeeded();
      const startsAtSeconds = (Date.now() - report.captureStartedAtMs) / 1000;
      if (still) {
        const file = resolve(stills, `${String(report.shots.length + 1).padStart(2, '0')}-${name}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        report.shots.push({ name, path: publicPath(file), sha256: await fileHash(file) });
      }
      report.beats.push({ name, caption, startsAtSeconds, readingSeconds: seconds });
      await delay(seconds * 1000);
      if (report.violations.length) throw Error('A capture guard or receipt check failed.');
    };
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('radio', { name: /^Rescue Mission/ })).toBeChecked();
    await page.getByRole('radio', { name: /^The Switchyard/ }).check();
    await expect(page.getByRole('radio', { name: /^Original(?:\s|$)/ })).toBeChecked();
    await page.getByRole('radio', { name: /^Remix(?:\s|$)/ }).check();
    await expect(page.locator('.dispatch-availability')).toContainText('Dispatch ready');
    await page.getByLabel('Optional assignment', { exact: true }).selectOption('service_restoration');
    await beat('new-dispatch', 3, 'New dispatch considers recent local journeys. An assignment is optional; rescue remains possible.', page.getByTestId('switchyard-dispatch-setup'), true);
    await page.getByRole('radio', { name: 'Daily dispatch', exact: true }).check();
    await expect(page.locator('.dispatch-daily')).toContainText(/UTC daily dispatch · \d{4}-\d{2}-\d{2}/);
    await beat('daily-dispatch', 3, 'Daily uses the server’s UTC date. Reading this card does not start a mission.', page.locator('.dispatch-daily'), true);
    await page.getByRole('radio', { name: 'Replay a code', exact: true }).check();
    await page.getByRole('textbox', { name: 'Replay mission code', exact: true }).fill(code);
    await beat('replay-code', 4, 'A public code recreates initial conditions and its assignment. Progress and notes start fresh.', page.getByTestId('switchyard-dispatch-setup'), true);
    expect(posts).toEqual([]);
    report.setupNoMutation = true;
    await startRemix(page, { code }, false);
    const dispatch = page.getByTestId('switchyard-dispatch-card');
    await dispatch.locator('summary').click();
    await expect(dispatch.getByRole('textbox', { name: 'Mission code', exact: true })).toHaveValue(code);
    await dispatch.locator('summary').click();
    await page.getByRole('group', { name: 'My intended approach' }).getByRole('radio', { name: 'Maintenance bypass', exact: true }).check();
    const player = new RemixUiPlayer(page);
    const ordinaryAsk = player.ask.bind(player);
    player.ask = async (label, expected, physical = false, confirm = true) => {
      if (!physical) {
        const reportText = await ordinaryAsk(label, expected, false, confirm);
        await beat('report-' + player.trace.length, 1.2, 'Pip reports only the equipment and passages actually checked here.', page.getByTestId('caption'));
        return reportText;
      }
      await ordinaryAsk(label, expected, true, false);
      if (!confirm) return undefined;
      await beat('pending-' + player.trace.length, label === 'Depart for home' ? 3 : 2,
        label === 'Depart for home' ? 'Reaching the platform is not home. Departure still needs this exact confirmation.' : `Read the proposal: ${label}. This physical step remains unexecuted until confirmed.`, page.getByTestId('action-proposal'));
      await expect(page.getByTestId('proposal-label')).toHaveText(label);
      await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
      const response = page.waitForResponse(item => item.url().endsWith('/proposal-decision') && item.request().method() === 'POST');
      await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
      const result = await (await response).json();
      if (!result.ok || result.proposal?.status !== 'committed' || result.proposal?.label !== label) throw Error('The intended exact decision was not authoritatively committed.');
      player.trace.push({ kind: 'confirmed', label });
      if (label === 'Depart for home') { await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible(); return undefined; }
      await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
      const text = await player.readReport(expected); player.trace.push({ kind: 'result', label, report: text }); return text;
    };
    let firstSupply = true; let firstDraft = true;
    const ordinaryDraft = player.draft.bind(player); const ordinarySupply = player.supply.bind(player);
    player.draft = async (...arguments_) => {
      await ordinaryDraft(...arguments_);
      if (firstDraft) {
        firstDraft = false;
        await beat('public-panel-draft', 4, 'This round has its own public contacts and terminal attachments. Draft turns do not change applied power.', page.getByTestId('switchyard-panel'), true);
      }
    };
    player.supply = async requested => {
      if (firstSupply) {
        firstSupply = false;
        await expect(page.locator('.dispatch-procedures')).toContainText('Alignment-first service module');
        await beat('reported-manual', 4, 'Compare Pip’s fitted-module report with the full manual. Both possible procedures stay visible.', page.locator('.switchyard-reference-comparison'), true);
      }
      await ordinarySupply(requested);
      await beat('acknowledged-power-' + player.trace.length, 2, 'Apply acknowledges only electrical routing. Local machinery still needs its separately confirmed work.', page.getByTestId('switchyard-panel'));
    };
    await player.begin();
    const crossing = await player.prepareService();
    await player.navigate('Service Gallery');
    await player.ask('Inspect Bridge winch', /Bridge winch plate reads [^.]+\./);
    await player.supply(crossing);
    await player.ask('Cross the maintenance bridge', /(?:I am|You are) at Return Platform\./, true);
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toHaveCount(0);
    await player.ask('Inspect Departure console', /Departure console confirms arrival/);
    await player.ask('Depart for home', /arrived safely home/i, true);
    await expect(page.getByTestId('switchyard-departure')).toHaveAttribute('data-approach', 'bypass');
    await expect(page.getByTestId('switchyard-journey')).toContainText('Service restoration · completed');
    await expect(page.getByTestId('switchyard-journey')).toContainText('Local/scripted Practice');
    await beat('confirmed-home', 7, 'Home is server-confirmed. The journey records the actual bypass and completed optional assignment.', page.getByTestId('switchyard-journey'), true);
    const beforeReplay = posts.length;
    await page.getByRole('button', { name: 'Other approach', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Replay mission code', exact: true })).toHaveValue(code);
    await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeEnabled();
    expect(posts.slice(beforeReplay).every(endpoint => endpoint === 'stop')).toBe(true);
    await beat('explicit-replay-setup', 5, 'Other approach prepares the same code and a private intention. A fresh attempt still requires Start.', page.getByTestId('switchyard-dispatch-setup'), true);
    report.replayReturnedToSetupWithoutStart = true;
    report.trace = player.trace;
    report.status = 'CAPTURED_CONFIRMED_HOME';
  } catch (cause) { failure = cause; report.status = 'CAPTURE_FAILED'; report.error = safeError(cause); }
  finally {
    if (watchdog) clearTimeout(watchdog);
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await Promise.allSettled([...pending]);
    if (video) try { report.rawVideo = publicPath(await video.path()); report.rawVideoSha256 = await fileHash(resolve(root, report.rawVideo)); }
    catch { report.violations.push('Raw browser video could not be finalized.'); }
    await writeFile(journal, JSON.stringify(report, null, 2) + '\n');
  }
  if (!failure && report.violations.length) failure = Error('A capture guard, receipt or cleanup check failed.');
  if (!failure && report.rawVideo) try {
    const final = resolve(output, 'Talk-Me-Home-Goal-010-Switchyard-Remix-Local-Preview.mp4');
    await runFile('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-i', resolve(root, report.rawVideo), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', final], { timeout: remaining(120_000) });
    await runFile('ffmpeg', ['-v', 'error', '-nostdin', '-i', final, '-f', 'null', '-'], { timeout: remaining(30_000) });
    const { stdout } = await runFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate', '-of', 'json', final], { timeout: remaining(10_000) });
    const probe = JSON.parse(stdout); const duration = Number(probe.format.duration);
    if (duration < 60 || duration > 100 || probe.streams.length !== 1 || probe.streams[0].codec_type !== 'video'
      || probe.streams[0].codec_name !== 'h264' || probe.streams[0].width !== 1920 || probe.streams[0].height !== 1080
      || probe.streams[0].pix_fmt !== 'yuv420p') throw Error('The preview failed its silent H264 full-HD 60–100 second bounds.');
    report.finalVideo = publicPath(final); report.finalVideoSha256 = await fileHash(final); report.probe = probe;
    report.status = 'LOCAL_CAPTURE_AND_DECODE_PASS_PENDING_VISUAL_REVIEW';
  } catch (cause) { failure = cause; report.status = 'ENCODING_OR_VALIDATION_FAILED'; report.error = safeError(cause); }
  if (failure && !report.error) { report.error = safeError(failure); report.status = 'CAPTURE_FAILED'; }
  report.finishedAt = new Date().toISOString();
  await writeFile(journal, JSON.stringify(report, null, 2) + '\n');
  const { operations, trace, captureStartedAtMs, ...manifest } = report;
  manifest.counts = { selectedRequests: operations.filter(item => item.endpoint === 'messages' && item.role === 'human' && item.inputMethod === 'quick_request').length,
    committedDecisions: operations.filter(item => item.endpoint === 'proposal-decision' && item.outcome === 'committed').length,
    routingApplies: operations.filter(item => item.endpoint === 'routing-panel' && item.status === 200).length,
    externalRequests: 0, tokenRequests: 0, websocketConnections: 0 };
  // Zero counts above describe successful guarded capture only; any blocked attempt remains an explicit failure.
  if (report.violations.length) delete manifest.counts;
  const manifestPath = resolve(stills, 'capture.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, manifest: publicPath(manifestPath), video: report.finalVideo }));
  if (failure) process.exitCode = 1;
}
