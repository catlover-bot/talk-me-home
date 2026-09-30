#!/usr/bin/env node
/** Goal 009 offline first-play presentation. Historical capture scripts/media remain untouched. */
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
const usage = 'Offline only: node --import tsx scripts/capture-switchyard-first-play-preview.mjs --capture --origin http://127.0.0.1:PORT --source FULL_COMMIT_SHA [--output .validation/goal-009/unique-directory]';

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
  const allowed = resolve(root, '.validation/goal-009');
  const output = resolve(root, config.output ?? `.validation/goal-009/preview-${config.source.slice(0, 12)}-${stamp}`);
  if (!output.startsWith(allowed + sep)) throw new Error('Raw capture must stay in a new directory inside .validation/goal-009.');
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Exclusive: never overwrite a prior success or failure.
  const report = { schema: 1, status: 'STARTED', startedAt: new Date().toISOString(), source: config.source,
    evidence: 'Fresh local/scripted Practice, ordinary selected text requests and manual UI confirmations; no provider connection or human playtest.',
    output: publicPath(output), audio: 'Silent browser video; no microphone, provider speech or presentation narration.',
    route: 'Read optional opening/help, skip/replay without station changes, then compare the reported lift plate with the human manual, test and run the lift and confirm home.',
    presentation: 'Continuous normal-speed local UI recording with deliberate reading pauses and authored overlay captions; no spliced historical footage, narration, or time stretching.',
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
    if (version.commit !== config.source || version.version !== '0.9.0') throw new Error('The served source or version does not match the clean Goal 009 candidate.');
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
        const label = document.createElement('div'); label.textContent = `LOCAL / SCRIPTED PRACTICE · 0.9.0 · source ${source.slice(0, 12)} · selected text + manual confirmation`;
        const caption = document.createElement('div'); caption.id = 'capture-caption'; caption.style.cssText = 'font-size:18px;font-weight:600;margin-top:3px'; caption.textContent = 'The Switchyard — a local first-play preview';
        banner.append(label, caption); document.body.append(banner);
        document.body.style.paddingTop = '72px'; document.documentElement.style.scrollPaddingTop = '90px';
      });
    }, { source: config.source });
    page = await context.newPage(); video = page.video();
    const posts = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname.split('/').at(-1)); });
    page.on('pageerror', () => report.violations.push('A browser page error occurred.'));
    const captureResponse = async response => {
      const request = response.request(); const path = new URL(response.url()).pathname;
      if (request.method() !== 'POST' || !/^\/api\/sessions\/[^/]+\/(?:tools|messages|proposal-decision|routing-panel|hint|stop|resume)$/.test(path)) return;
      const body = request.postDataJSON(); const result = await response.json(); const endpoint = path.split('/').at(-1);
      // Never persist headers, cookies, authorization data, full views or arbitrary response extras.
      const item = { atMs: Date.now() - report.captureStartedAtMs, endpoint, status: response.status() };
      if (endpoint === 'messages') Object.assign(item, { role: body.role, inputMethod: body.inputMethod, text: body.text });
      if (endpoint === 'tools') Object.assign(item, { name: body.name, ok: result.ok, code: result.code, message: result.message });
      if (endpoint === 'proposal-decision') Object.assign(item, { decision: body.decision, proposalLabel: result.proposal?.label, outcome: result.proposal?.status, ok: result.ok, completed: result.view?.completed });
      if (endpoint === 'routing-panel') Object.assign(item, { rotations: body.rotations, acknowledgedPanelRevision: result.switchyardPanel?.panelRevision });
      if (endpoint === 'hint') Object.assign(item, { level: body.level, audience: 'human guide' });
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
    const guide = () => page.getByTestId('switchyard-guidance');
    const visibleState = async () => ({
      caption: await page.getByTestId('caption').innerText(),
      rotations: await page.locator('[data-piece]').evaluateAll(elements => elements.map(element => element.getAttribute('data-rotation'))),
      applied: await Promise.all(['amber', 'blue', 'white'].map(name => page.getByTestId(`applied-${name}`).innerText())),
      choices: await choices().getByRole('button').allTextContents(),
      decision: await page.getByTestId('action-proposal').count() ? await page.getByTestId('action-proposal').innerText() : null,
    });
    const unchangedReading = async (action, allowedPost) => {
      const before = await visibleState(), firstPost = posts.length;
      await action();
      await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
      expect(await visibleState()).toEqual(before);
      const observedPosts = posts.slice(firstPost);
      expect(observedPosts).toEqual(allowedPost ? [allowedPost] : []);
      report.operations.push({ atMs: Date.now() - report.captureStartedAtMs, endpoint: 'reading-check', observedPosts, visibleStationAndReportUnchanged: true });
    };
    const helpTier = async label => {
      await unchangedReading(async () => {
        const response = page.waitForResponse(item => item.url().endsWith('/hint') && item.request().method() === 'POST');
        await page.locator('.switchyard-help').getByRole('button', { name: label, exact: true }).click();
        const hint = await (await response).json();
        await expect(page.locator('.switchyard-help .hint-copy')).toHaveText(hint.text);
      }, 'hint');
    };
    const ask = async (label, physical = false, confirm = true) => {
      const response = page.waitForResponse(item => item.url().endsWith('/tools') && item.request().method() === 'POST');
      await choices().getByRole('button', { name: label, exact: true }).click();
      const result = await (await response).json();
      if (!result.ok) throw new Error('An ordinary local request failed during capture.');
      if (!physical) {
        // An HTTP receipt can precede React's displayed report and newly admitted
        // choices. Wait for its actual leading sentence, not a fixed delay.
        const lead = result.message.split(/(?<=[.!?])\s/)[0].replace(/^You are\b/, 'I am');
        const escaped = lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await expect(page.getByTestId('caption')).toHaveText(new RegExp('^' + escaped));
      }
      if (physical) {
        await expect(page.getByTestId('proposal-label')).toHaveText(label);
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
        if (confirm) await decide(label, 'confirm', label === 'Depart for home');
      }
    };
    const decide = async (expectedLabel, decision, home = false) => {
      // Every click checks the one planned proposal again. Never accept a generic pending action.
      await expect(page.getByTestId('proposal-label')).toHaveText(expectedLabel);
      await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
      const response = page.waitForResponse(item => item.url().endsWith('/proposal-decision'));
      await page.getByRole('button', { name: decision === 'confirm' ? 'Confirm this action' : 'Not yet', exact: true }).click();
      const result = await (await response).json();
      if (result.ok !== (decision === 'confirm') || result.proposal?.label !== expectedLabel || result.proposal?.status !== (decision === 'confirm' ? 'committed' : 'declined')) throw new Error('The exact expected proposal was not acknowledged.');
      if (!home) await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', decision === 'confirm' ? 'committed' : 'declined');
    };
    const plan = async name => {
      const group = page.getByRole('group', { name: 'My intended approach', exact: true });
      await group.getByRole('radio', { name, exact: true }).check();
      await expect(group.getByRole('radio', { name, exact: true })).toBeChecked();
      report.operations.push({ atMs: Date.now() - report.captureStartedAtMs, endpoint: 'private-plan-ui', label: name });
    };
    const discuss = async name => {
      await choices().getByRole('button', { name: `Discuss the ${name}`, exact: true }).click();
      await expect(page.getByTestId('caption')).toContainText(/investigate|change the plan/);
    };
    const supply = async (names, presentation = false) => {
      // Supplies come from a displayed manual row; isolation comes from Pip's
      // displayed brace instruction. The search reads only public panel geometry.
      const isolate = names === 'all outputs isolated';
      if (!isolate && !/^(?:Amber|Blue|White)(?: only| \+ (?:Amber|Blue|White))$/.test(names.trim())) throw new Error('The displayed instruction did not name an exact supported supply.');
      const wanted = ['amber', 'blue', 'white'].filter(name => names.toLowerCase().includes(name));
      if (!wanted.length && !isolate) throw new Error('The visible manual row did not name a supply.');
      let layout;
      for (let value = 0; value < 4096; value++) {
        const candidate = Array.from({ length: 6 }, (_, index) => Math.floor(value / 4 ** index) % 4);
        const preview = previewSwitchyardRouting(candidate);
        if (preview.valid && preview.poweredTerminals.length === wanted.length && wanted.every(name => preview.poweredTerminals.includes(name))) { layout = candidate; break; }
      }
      if (!layout) throw new Error('The requested public circuit could not be drawn.');
      if (presentation) await beat('prediction', 43, `The manual calls for ${names.toLowerCase()}. Predict that supply before editing the draft.`, page.getByTestId('switchyard-panel'));
      for (const [index, rotation] of layout.entries()) {
        const piece = page.locator(`[data-piece="p${index + 1}"]`);
        const current = Number(await piece.getAttribute('data-rotation'));
        for (let turn = 0; turn < (rotation - current + 4) % 4; turn++) await piece.click();
      }
      await page.getByTestId('switchyard-panel').scrollIntoViewIfNeeded();
      for (const terminal of ['amber', 'blue', 'white']) await expect(page.getByTestId(`draft-${terminal}`)).toHaveText(wanted.includes(terminal) ? 'Connected' : 'Isolated');
      await expect(page.getByTestId('switchyard-draft-prediction')).toContainText(isolate ? 'Draft leaves all outputs isolated.' : 'Draft connects');
      if (!isolate) await expect(page.locator('.switchyard-draft-trace').first()).toBeVisible();
      if (presentation) { await expect(guide()).toHaveAttribute('data-stage', 'apply'); await beat('draft-prediction', 49, 'A real turn changes only the draft. Applied power has not changed yet.', page.getByTestId('switchyard-panel')); }
      const apply = page.getByRole('button', { name: 'Apply routing', exact: true });
      if (await apply.isEnabled()) {
        await apply.click();
        await expect(page.getByTestId('switchyard-panel-status')).toContainText('Applied routing acknowledged');
      }
      for (const terminal of ['amber', 'blue', 'white']) await expect(page.getByTestId(`applied-${terminal}`)).toHaveText(wanted.includes(terminal) ? 'Powered' : 'Off');
      // Routing invalidates dynamic readings, but keeps admitted static local handles.
      if (presentation) {
        await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('switched on');
        await expect(page.getByTestId('switchyard-report-age')).toHaveText("Routing changed since this report. The plate label is retained; see Pip's latest report for readiness.");
        await expect(page.getByTestId('switchyard-caption-age')).toHaveText('Panel changed since this message. Readings may be out of date; stable labels are retained.');
        await expect(guide()).toHaveAttribute('data-stage', 'ready');
        await beat('applied-delta', 55, 'Apply acknowledges the circuit. Equipment still needs its own exact confirmed action.', page.getByTestId('switchyard-panel'));
      }
    };

    await beat('briefing', 3, 'Choose The Switchyard: a local scripted puzzle with two approaches.');
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await expect(page.getByTestId('switchyard-panel')).toBeVisible();
    await expect(guide()).toHaveAttribute('data-stage', 'observe');
    await beat('optional-opening', 7, 'Optional first steps explain your role beside the ordinary controls.', guide());
    await ask('Look around'); await expect(guide()).toHaveAttribute('data-stage', 'draft');
    await beat('first-useful-report', 11, 'Ask explicitly. Pip’s actual report supplies local information for your document.', page.getByTestId('caption'));
    await unchangedReading(() => page.locator('.switchyard-help').getByText('Need a nudge?', { exact: true }).click());
    await helpTier('Nudge');
    await beat('human-help', 15, 'Optional human guidance: reading it sends no instruction to Pip.', page.locator('.switchyard-help'));
    await helpTier('Explain the rule'); await helpTier('How to investigate');
    await beat('investigation-help', 19, 'Help points to an investigation; the player still chooses and performs it.', page.locator('.switchyard-help'));
    await unchangedReading(() => page.locator('.switchyard-help').getByText('Need a nudge?', { exact: true }).click());
    await unchangedReading(async () => { await page.getByRole('button', { name: 'Skip guidance', exact: true }).click(); await expect(guide()).toHaveAttribute('data-stage', 'skipped'); });
    await unchangedReading(async () => { await page.getByRole('button', { name: 'Replay guidance', exact: true }).click(); await expect(guide()).toHaveAttribute('data-stage', 'observe'); });
    await beat('replayed-guidance', 23, 'Skip or replay the cues. The report and station remain unchanged.', guide());
    await ask('Inspect Route directory'); await expect(guide()).toHaveAttribute('data-stage', 'draft');
    await plan('Direct lift'); await discuss('direct lift');
    await beat('approach-choice', 27, 'Choose an approach from its tradeoffs; the private plan is not a command.', page.locator('.switchyard-document'));
    await ask('Go to Transfer Table', true, false);
    await beat('pending-action', 31, 'A request prepares one exact proposal. Confirm it only when you intend the action.', page.getByTestId('action-proposal'));
    await decide('Go to Transfer Table', 'confirm');
    await ask('Go to Lift Station', true); await ask('Inspect Lift console');
    await expect(page.getByTestId('caption')).toContainText(/plate reads (Crescent|Kite)/);
    const liftReport = await page.getByTestId('caption').innerText();
    const liftPlate = liftReport.match(/plate reads (Crescent|Kite)/)?.[1];
    if (!liftPlate) throw new Error('The local lift report did not communicate its plate.');
    await page.getByRole('tab', { name: 'Lift plates', exact: true }).click();
    await expect(page.getByTestId('switchyard-reference-quote')).toContainText(`The Lift console plate reads ${liftPlate}.`);
    await beat('lift-investigation', 36, 'Pip’s fitted-plate report identifies a row in the human reference.', page.getByTestId('switchyard-reference-quote'));
    const liftCells = await page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: liftPlate, exact: true }) }).getByRole('cell').allTextContents();
    if (liftCells.length !== 3 || !['1', '2'].includes(liftCells[0])) throw new Error('The visible lift row was incomplete.');
    const [liftIndex, testSupply, runningSupply] = liftCells;
    await beat('human-manual', 40, 'Compare the exact quote and both manual rows. The table stays on your side.', page.getByRole('rowheader', { name: liftPlate, exact: true }));
    await ask(`Set index ${liftIndex === '1' ? 'one' : 'two'}`, true);
    await supply(testSupply, true);
    await ask('Test the lift', true);
    await expect(page.getByTestId('caption')).toContainText('The lift self-test passed.');
    await beat('communicated-outcome', 61, 'The separately confirmed lift test reports its actual result.', page.getByTestId('caption'));
    await supply(runningSupply);
    await beat('running-circuit', 67, 'The manual separates the test supply from the running circuit.', page.getByTestId('switchyard-panel'));
    await ask('Ride the direct lift', true);
    await expect(page.getByTestId('caption')).toContainText('departure is still a separate confirmed decision');
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toHaveCount(0);
    await ask('Inspect Departure console'); await ask('Depart for home', true, false);
    await beat('departure-pending', 75, 'The route is restored. Departure is still a separate confirmed choice.', page.getByTestId('action-proposal'));
    await decide('Depart for home', 'confirm', true);
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The direct lift restored', exact: true })).toBeVisible();
    await expect(page.getByTestId('switchyard-departure')).toHaveAttribute('data-approach', 'lift');
    await expect(page.getByRole('img', { name: 'Direct lift departure confirmed', exact: true })).toBeVisible();
    await expect(page.getByTestId('switchyard-replay-invitation')).toContainText('Try preparing the maintenance bypass next.');
    await beat('confirmed-home', 86, 'A complete lift rescue. Trying the other approach requires an explicit new mission.', page.getByTestId('switchyard-replay-invitation'));
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
      const final = resolve(output, 'Talk-Me-Home-Goal-009-Switchyard-First-Play-Local-Preview.mp4');
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
  const manifestDirectory = resolve(root, 'artifacts/goal-009/preview');
  await mkdir(manifestDirectory, { recursive: true });
  const { operations, captureStartedAtMs, ...manifest } = report;
  manifest.counts = {
    selectedRequests: operations.filter(item => item.endpoint === 'messages' && item.role === 'human' && item.inputMethod === 'quick_request').length,
    confirmations: operations.filter(item => item.endpoint === 'proposal-decision' && item.decision === 'confirm').length,
    declines: operations.filter(item => item.endpoint === 'proposal-decision' && item.decision === 'decline').length,
    committedDecisions: operations.filter(item => item.endpoint === 'proposal-decision' && item.outcome === 'committed').length,
    routingApplies: operations.filter(item => item.endpoint === 'routing-panel' && item.status === 200).length,
    privatePlanSelections: operations.filter(item => item.endpoint === 'private-plan-ui').length,
    hintReads: operations.filter(item => item.endpoint === 'hint').length,
    unchangedReadingChecks: operations.filter(item => item.endpoint === 'reading-check').length,
  };
  const manifestPath = resolve(manifestDirectory, `capture-${config.source.slice(0, 12)}-${stamp}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, manifest: publicPath(manifestPath), video: report.finalVideo, counts: manifest.counts }));
  if (failure) process.exitCode = 1;
}
