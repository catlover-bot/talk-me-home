import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { encodeRemixCode } from '../../game/server/remix';
import type { SwitchyardAssignment, SwitchyardRotations } from '../../game/shared/switchyard';
import { test, expect } from './switchyard-fixture';
import { layoutForPublicSupply, readVisiblePanel, RemixUiPlayer, startRemix } from './remix-player';

const capture = process.env.GAME_REMIX_CAPTURE === '1';
const guards = new WeakMap<Page, { forbidden: string[]; errors: string[] }>();
test.beforeEach(async ({ page }) => {
  const evidence = { forbidden: [] as string[], errors: [] as string[] }; guards.set(page, evidence);
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || /\/voice-token(?:\?|$)/.test(url.pathname)) {
      evidence.forbidden.push(`${route.request().method()} forbidden origin or token endpoint`); await route.abort(); return;
    }
    await route.fallback();
  });
  await page.routeWebSocket('**/*', socket => { evidence.forbidden.push('WebSocket attempted'); socket.close(); });
});
test.afterEach(async ({ page }, info) => {
  const evidence = guards.get(page);
  const receipt = info.outputPath('network-guard-receipt.json');
  mkdirSync(dirname(receipt), { recursive: true });
  writeFileSync(receipt, `${JSON.stringify({ scope: 'LOCAL_DETERMINISTIC_PRACTICE', test: info.title, project: info.project.name,
    statusAtCleanup: info.status, forbidden: evidence?.forbidden ?? ['Guard was not initialized'], pageErrors: evidence?.errors ?? [] }, null, 2)}\n`);
  await info.attach('network-guard-receipt', { path: receipt, contentType: 'application/json' });
  expect(evidence?.forbidden).toEqual([]);
  expect(evidence?.errors).toEqual([]);
});

async function dispatchCode(page: Page) {
  const card = page.getByTestId('switchyard-dispatch-card');
  if (await card.getAttribute('open') === null) await card.locator('summary').click();
  return card.getByRole('textbox', { name: 'Mission code', exact: true }).inputValue();
}
async function publicInitial(page: Page) {
  return { panel: await readVisiblePanel(page), rotations: await page.locator('.switchyard-piece').evaluateAll(pieces => pieces.map(piece => Number(piece.getAttribute('data-rotation')))) };
}
async function pauseAndResume(page: Page, player: RemixUiPlayer) {
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
  await player.ask('Look around', /(?:I am|You are) at Control Bay\./);
}
async function saveTrace(page: Page, info: TestInfo, player: RemixUiPlayer, code: string) {
  const trace = info.outputPath('ordinary-ui-trace.json');
  mkdirSync(dirname(trace), { recursive: true });
  writeFileSync(trace, `${JSON.stringify({ scope: 'LOCAL_DETERMINISTIC_PRACTICE', code, trace: player.trace }, null, 2)}\n`);
  await info.attach('ordinary-ui-trace', { path: trace, contentType: 'application/json' });
  if (capture) {
    await page.screenshot({ path: info.outputPath('remix-confirmed-home.png'), fullPage: true, animations: 'disabled' });
    await info.attach('confirmed-home', { path: info.outputPath('remix-confirmed-home.png'), contentType: 'image/png' });
  }
}

// Codes select known coverage families. The operator receives only the code, requested approach and assignment;
// its moves, supplies and sequencing are derived from the rendered plan/manual and Pip's actual reports.
for (let panel = 0; panel < 3; panel++) for (let procedure = 0; procedure < 2; procedure++) for (const approach of ['lift', 'bypass'] as const) {
  const bypass = Number(approach === 'bypass');
  const layout = (panel + procedure + bypass) % 2;
  const liftRow = (panel + procedure) % 2;
  const serviceRow = (panel + bypass) % 2;
  const profile = panel * 16 + procedure * 8 + layout * 4 + liftRow * 2 + serviceRow;
  // Pairwise assignment coverage uses the same twelve route cases; profile 32 deliberately skips its optional work.
  const assignmentByProfile: Partial<Record<number, SwitchyardAssignment>> = {
    5: 'lift_survey', 14: 'service_restoration', 11: 'service_restoration', 18: 'lift_survey',
    25: 'service_restoration', 32: 'service_restoration', 46: 'lift_survey',
  };
  const assignment: SwitchyardAssignment = assignmentByProfile[profile] ?? 'rescue';
  const skipAssignment = panel === 2 && procedure === 0 && approach === 'lift';
  test(`Remix panel ${panel + 1} procedure ${procedure + 1} reaches home by ${approach}`, async ({ page, switchyardServer }, info) => {
    test.setTimeout(60_000);
    const code = encodeRemixCode(profile, (panel + procedure) % 16, assignment, 100 + profile);
    await startRemix(page, { code });
    expect(await dispatchCode(page)).toBe(code);
    const initial = await publicInitial(page);
    const player = new RemixUiPlayer(page); await player.begin();
    // The first physical request is deliberately declined; a fresh exact proposal is required.
    const next = page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: /^Go to / }).first();
    const label = await next.innerText();
    await player.ask(label, /Arrival is confirmed/, true, false);
    const declinedId = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
    expect(switchyardServer.commits).toHaveLength(0);
    await page.getByRole('button', { name: 'Not yet', exact: true }).click();
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
    await expect(page.getByTestId('caption')).toContainText('was not executed');
    expect(switchyardServer.commits).toHaveLength(0);
    if (panel === 0 && procedure === 0) await pauseAndResume(page, player);
    await player.home(approach, assignment, !skipAssignment);
    const journey = page.getByTestId('switchyard-journey');
    await expect(journey).toContainText(skipAssignment ? 'skipped; rescue complete' : 'completed');
    if (assignment === 'lift_survey') await expect(journey).toContainText('Lift diagnostic passed');
    if (assignment === 'service_restoration' && !skipAssignment) await expect(journey).toContainText('Service bridge and turntable prepared');
    expect(switchyardServer.commits.every(event => event.proposalId !== declinedId)).toBe(true);
    expect(new Set(switchyardServer.commits.map(event => event.proposalId)).size).toBe(switchyardServer.commits.length);
    await saveTrace(page, info, player, code);
    const endingChoice = ['Same conditions', 'Other approach', 'New dispatch'][panel]!;
    const commits = switchyardServer.commits.length;
    await page.getByRole('button', { name: endingChoice, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeVisible();
    expect(switchyardServer.commits).toHaveLength(commits);
    if (panel < 2) await expect(page.getByRole('textbox', { name: 'Replay mission code', exact: true })).toHaveValue(code);
    else await expect(page.getByRole('radio', { name: 'New dispatch', exact: true })).toBeChecked();
    if (procedure === 0 && approach === 'lift') {
      await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
      await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 0');
      for (const terminal of ['amber', 'blue', 'white']) await expect(page.getByTestId(`applied-${terminal}`)).toHaveText('Off');
      if (panel < 2) { expect(await dispatchCode(page)).toBe(code); expect(await publicInitial(page)).toEqual(initial); }
      else expect(await dispatchCode(page)).not.toBe(code);
      if (panel === 1) await expect(page.getByRole('group', { name: 'My intended approach' }).getByRole('radio', { name: 'Maintenance bypass', exact: true })).toBeChecked();
      await expect(page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: 'Inspect Lift console', exact: true })).toHaveCount(0);
    }
  });
}

test('Remix draft overload, rejected Apply and changed routing preserve exact decision boundaries', async ({ page, switchyardServer }) => {
  test.setTimeout(45_000);
  await startRemix(page, { code: encodeRemixCode(40, 3, 'rescue', 991) });
  const player = new RemixUiPlayer(page); await player.begin();
  const spec = await readVisiblePanel(page);
  await player.draft(layoutForPublicSupply(spec, ['amber', 'blue', 'white']), true);
  await expect(page.locator('.switchyard-load')).toContainText('Over capacity');
  await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
  const label = await page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: /^Go to / }).first().innerText();
  await player.ask(label, /Arrival is confirmed/, true, false);
  const old = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  const refused = async (route: import('@playwright/test').Route) => route.fulfill({ status: 409, json: { error: 'Fixture: routing was not accepted.' } });
  await page.route('**/routing-panel', refused);
  await player.draft(layoutForPublicSupply(spec, ['amber']));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.locator('.switchyard-panel-error')).toContainText('Fixture: routing was not accepted');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  expect(switchyardServer.commits).toHaveLength(0);
  await page.unroute('**/routing-panel', refused);
  await player.supply(['amber']);
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'invalidated');
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  await player.ask(label, /Arrival is confirmed/, true, false);
  await expect(page.getByTestId('action-proposal')).not.toHaveAttribute('data-proposal-id', old!);
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  expect(switchyardServer.commits).toHaveLength(1);
});

test('New and Daily dispatch setup stays private and works with unavailable local storage', async ({ page }) => {
  const forbidden: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/(?:tools|routing-panel|proposal-decision|voice-token)$/.test(new URL(request.url()).pathname)) forbidden.push(new URL(request.url()).pathname); });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage is unavailable', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /^Rescue Mission/ })).toBeChecked();
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('radio', { name: /^Remix(?:\s|$)/ }).check();
  await page.getByLabel('Optional assignment', { exact: true }).selectOption('lift_survey');
  await page.getByRole('radio', { name: 'Daily dispatch', exact: true }).check();
  await expect(page.locator('.dispatch-daily')).toContainText(/UTC daily dispatch · \d{4}-\d{2}-\d{2}/);
  const code = await page.getByRole('textbox', { name: 'Mission code', exact: true }).inputValue();
  await page.locator('.dispatch-history > summary').click();
  await expect(page.locator('.dispatch-history')).toContainText('No journeys saved');
  expect(forbidden).toEqual([]);
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel')).toBeVisible();
  expect(await dispatchCode(page)).toBe(code);
  expect(forbidden).toEqual([]);
  await page.reload();
  await startRemix(page, { code }, false);
  expect(await dispatchCode(page)).toBe(code);
  await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 0');
  expect(forbidden).toEqual([]);
});

test('Remix public manual and panel support keyboard, 390px reflow and 200 percent enlargement', async ({ page }, info) => {
  await startRemix(page, { code: encodeRemixCode(28, 7, 'rescue', 992) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Site plan', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Lift plates', exact: true })).toBeFocused();
  await expect(page.getByRole('rowheader', { name: 'Crescent', exact: true })).toBeVisible();
  const piece = page.locator('[data-piece="p1"]'); const rotation = Number(await piece.getAttribute('data-rotation'));
  await piece.focus(); await page.keyboard.press('ArrowRight');
  await expect(piece).toHaveAttribute('data-rotation', String((rotation + 1) % 4));
  await page.getByRole('button', { name: 'Undo turn', exact: true }).click();
  await expect(piece).toHaveAttribute('data-rotation', String(rotation));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (capture) await page.screenshot({ path: info.outputPath('remix-narrow.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await page.getByRole('tab', { name: 'Service modules', exact: true }).click();
  await expect(page.locator('.dispatch-procedures')).toContainText('Alignment-first service module');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (capture) await page.screenshot({ path: info.outputPath('remix-enlarged.png'), fullPage: true, animations: 'disabled' });
});
