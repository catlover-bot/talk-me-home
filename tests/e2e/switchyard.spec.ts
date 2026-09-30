import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { previewSwitchyardRouting, type SwitchyardRotations, type SwitchyardTerminal } from '../../game/shared/switchyard';
import type { HumanView } from '../../game/shared/contracts';
import { test, expect } from './switchyard-fixture';

const capture = process.env.GAME_SWITCHYARD_CAPTURE === '1';
test.use({ video: capture ? 'on' : 'off', trace: capture ? 'on' : 'off' });
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Switchyard local QA must not contact a provider.');
  });
  if (capture) {
    const source = process.env.GAME_SWITCHYARD_CAPTURE_SOURCE;
    if (source && !/^[a-f0-9]{7,40}$/.test(source)) throw new Error('Capture source must be an explicit commit hash.');
    await page.addInitScript(label => {
      document.addEventListener('DOMContentLoaded', () => {
        const stamp = document.createElement('div'); stamp.textContent = label;
        stamp.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:5px 10px;background:#172a20;color:#fff2d3;font:11px/1.3 monospace;text-align:center;pointer-events:none';
        document.body.append(stamp);
      });
    }, `0.8.0 / LOCAL SCRIPTED PRACTICE / ${source ? `source ${source}` : 'working candidate based on 06dd6b7 (uncommitted changes)'}`);
  }
});

async function start(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /^Rescue Mission/ })).toBeChecked();
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await expect(page.getByRole('checkbox', { name: 'Bring back the flight recorder' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel')).toBeVisible();
  await expect(page.locator('.switchyard-intents')).toContainText('Local/scripted');
  await ask(page, 'Look around');
}

/** Every robot request is an ordinary visible intent, never a tool/API invocation. */
async function ask(page: Page, label: string, physical = false, confirm = true) {
  const response = page.waitForResponse(r => r.url().endsWith('/tools') && r.request().method() === 'POST');
  await page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: label, exact: true }).click();
  await response;
  if (physical) {
    await expect(page.getByTestId('proposal-label')).toHaveText(label);
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
    if (confirm) {
      const decision = page.waitForResponse(r => r.url().endsWith('/proposal-decision'));
      await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
      await decision;
      if (label !== 'Depart for home') await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    }
  }
}

/** Test-only wiring search uses the same public six-piece drawing as the operator.
 * Its input is terminal names from a visible manual row, never a hidden variant or route state.
 * Neither this helper nor any layouts are shipped to the game or local companion. */
function publicLayout(terminals: readonly SwitchyardTerminal[]): SwitchyardRotations {
  for (let value = 0; value < 4096; value++) {
    const layout = Array.from({ length: 6 }, (_, i) => Math.floor(value / 4 ** i) % 4) as SwitchyardRotations;
    const preview = previewSwitchyardRouting(layout);
    if (preview.poweredTerminals.length === terminals.length && terminals.every(terminal => preview.poweredTerminals.includes(terminal))) return layout;
  }
  throw new Error('The requested public terminal combination is unreachable.');
}
async function draftLayout(page: Page, layout: SwitchyardRotations) {
  for (const [index, rotation] of layout.entries()) {
    const piece = page.locator(`[data-piece="p${index + 1}"]`);
    const current = Number(await piece.getAttribute('data-rotation'));
    for (let turn = 0; turn < (rotation - current + 4) % 4; turn++) await piece.click();
    await expect(piece).toHaveAttribute('data-rotation', String(rotation));
  }
}
async function supply(page: Page, terminals: readonly SwitchyardTerminal[]) {
  await draftLayout(page, publicLayout(terminals));
  const apply = page.getByRole('button', { name: 'Apply routing', exact: true });
  if (await apply.isEnabled()) {
    await apply.click();
    await expect(page.getByTestId('switchyard-panel-status')).toContainText('Applied routing acknowledged');
  }
  for (const terminal of ['amber', 'blue', 'white'] as const) await expect(page.getByTestId(`applied-${terminal}`)).toHaveText(terminals.includes(terminal) ? 'Powered' : 'Off');
  // Routing cancels target memory; a new report is required before local action choices.
  await ask(page, 'Look around');
}
const terminalsFromCell = (cell: string) => (['amber', 'blue', 'white'] as const).filter(terminal => cell.toLowerCase().includes(terminal));
async function readManual(page: Page, tab: 'Lift plates' | 'Service modules', plate: string) {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  const cells = await page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: plate, exact: true }) }).getByRole('cell').allTextContents();
  expect(cells.length).toBe(3);
  return cells;
}
async function shot(page: Page, info: TestInfo, name: string) {
  if (!capture) return;
  const directory = 'artifacts/goal-008/ui/after'; mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
}
async function discuss(page: Page, approach: 'direct lift' | 'maintenance bypass') {
  await page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: `Discuss the ${approach}`, exact: true }).click();
  await expect(page.getByTestId('caption')).toContainText(/investigate|change the plan/);
}

for (const configuration of ['a', 'b'] as const) test.describe(`Switchyard installation ${configuration}`, () => {
  test.use({ switchyardConfiguration: configuration });
  for (const approach of ['lift', 'bypass'] as const) test(`ordinary UI brings Pip home by ${approach}`, async ({ page, switchyardServer }, info) => {
    test.setTimeout(60_000);
    await start(page);
    await ask(page, 'Inspect Route directory');
    await discuss(page, 'direct lift');
    await shot(page, info, `panel-${configuration}-${approach}`);
    const before = switchyardServer.commits.length;
    await ask(page, 'Go to Transfer Table', true, false);
    expect(switchyardServer.commits.length).toBe(before);
    await page.getByRole('button', { name: 'Not yet', exact: true }).click();
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
    expect(switchyardServer.commits.length).toBe(before);
    await ask(page, 'Go to Transfer Table', true);
    if (approach === 'lift') {
      await ask(page, 'Go to Lift Station', true);
      await ask(page, 'Inspect Lift console');
      const report = await page.getByTestId('caption').innerText();
      const plate = report.match(/plate reads (Crescent|Kite)/)?.[1]; expect(plate).toBeTruthy();
      const [index, testSupply, runningSupply] = await readManual(page, 'Lift plates', plate!);
      await ask(page, index === '1' ? 'Set index one' : 'Set index two', true);
      await supply(page, terminalsFromCell(testSupply!));
      await ask(page, 'Test the lift', true);
      await shot(page, info, `lift-test-${configuration}`);
      await supply(page, terminalsFromCell(runningSupply!));
      await ask(page, 'Ride the direct lift', true);
    } else {
      await ask(page, 'Go to Lift Station', true);
      await ask(page, 'Inspect Lift console');
      // A deliberate plan revision after local investigation retains physical progress.
      await discuss(page, 'maintenance bypass');
      await expect(page.getByTestId('caption')).toContainText('Completed work stays completed');
      await shot(page, info, `plan-change-${configuration}`);
      await ask(page, 'Return to Transfer Table', true);
      await ask(page, 'Go to Service Gallery', true);
      await ask(page, 'Inspect Bridge winch');
      const report = await page.getByTestId('caption').innerText();
      const plate = report.match(/plate reads (Rivet|Slot)/)?.[1]; expect(plate).toBeTruthy();
      const [winchSupply, alignmentSupply, crossingSupply] = await readManual(page, 'Service modules', plate!);
      await ask(page, 'Seat the bridge brace', true);
      await supply(page, terminalsFromCell(winchSupply!));
      await ask(page, 'Deploy the bridge', true);
      const committed = switchyardServer.commits.length;
      await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
      await ask(page, 'Look around');
      await ask(page, 'Inspect Bridge winch');
      await expect(page.getByTestId('caption')).toContainText('deployed into its retaining detent');
      expect(switchyardServer.commits.length).toBe(committed);
      await ask(page, 'Return to Transfer Table', true);
      await ask(page, 'Inspect Transfer turntable');
      await supply(page, terminalsFromCell(alignmentSupply!));
      await ask(page, 'Align the turntable', true);
      await ask(page, 'Go to Service Gallery', true);
      await ask(page, 'Inspect Bridge winch');
      await supply(page, terminalsFromCell(crossingSupply!));
      await shot(page, info, `bypass-ready-${configuration}`);
      await ask(page, 'Cross the maintenance bridge', true);
    }
    await expect(page.getByTestId('caption')).toContainText('departure is still a separate confirmed decision');
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toHaveCount(0);
    await ask(page, 'Inspect Departure console');
    await ask(page, 'Depart for home', true, false);
    await shot(page, info, `departure-${configuration}-${approach}`);
    const count = switchyardServer.commits.length;
    await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pip is home.', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: approach === 'lift' ? 'The direct lift restored' : 'The maintenance bypass restored' })).toBeVisible();
    expect(switchyardServer.commits.length).toBe(count + 1);
    expect(new Set(switchyardServer.commits.map(event => event.proposalId)).size).toBe(switchyardServer.commits.length);
    await shot(page, info, `home-${configuration}-${approach}`);
    await page.getByRole('button', { name: 'Try the other approach', exact: true }).click();
    await expect(page.getByRole('radio', { name: /^The Switchyard/ })).toBeChecked();
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 0');
    for (const terminal of ['amber', 'blue', 'white']) await expect(page.getByTestId(`applied-${terminal}`)).toHaveText('Off');
  });
});

test('draft keyboard, undo, overload and rejected Apply retain the acknowledged panel', async ({ page, switchyardServer }) => {
  test.setTimeout(45_000);
  await start(page);
  const piece = page.locator('[data-piece="p1"]');
  await piece.focus(); await page.keyboard.press('ArrowLeft');
  await expect(piece).toHaveAttribute('data-rotation', '3');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await page.getByRole('button', { name: 'Undo turn', exact: true }).click();
  await expect(piece).toHaveAttribute('data-rotation', '0');
  await draftLayout(page, publicLayout(['amber', 'blue', 'white']));
  await expect(page.locator('.switchyard-load')).toContainText('Over capacity');
  await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 0');
  await draftLayout(page, publicLayout(['amber']));
  let attempts = 0;
  const reject = async (route: import('@playwright/test').Route) => { attempts++; await route.fulfill({ status: 409, json: { error: 'Fixture refusal: routing changed. Your draft was not applied.' } }); };
  await page.route('**/routing-panel', reject);
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.locator('.switchyard-panel-error')).toContainText('Fixture refusal');
  await expect(page.getByTestId('draft-amber')).toHaveText('Connected');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  expect(attempts).toBe(1); expect(switchyardServer.commits).toHaveLength(0);
  await page.unroute('**/routing-panel', reject);
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
});

test('manual tabs and panel remain operable at narrow width and 200 percent zoom', async ({ page }, info) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const tab = page.getByRole('tab', { name: 'Site plan', exact: true });
  await tab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Lift plates', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Lift plates', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('rowheader', { name: 'Crescent', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await shot(page, info, 'narrow-panel');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await page.locator('[data-piece="p1"]').click();
  await expect(page.locator('[data-piece="p1"]')).toHaveAttribute('data-rotation', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await shot(page, info, 'zoom-panel');
});

test('atomic routing cancels the old physical proposal and requires a new exact decision', async ({ page, switchyardServer }) => {
  await start(page);
  await ask(page, 'Go to Transfer Table', true, false);
  const previous = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  await draftLayout(page, publicLayout(['blue']));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'invalidated');
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  expect(switchyardServer.commits).toHaveLength(0);
  await ask(page, 'Look around');
  await ask(page, 'Go to Transfer Table', true, false);
  await expect(page.getByTestId('action-proposal')).not.toHaveAttribute('data-proposal-id', previous!);
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  expect(switchyardServer.commits).toHaveLength(1);
});

test('a changed acknowledgement preserves a dirty draft until explicit reset', async ({ page }) => {
  // Presentation fault injection: this acknowledged view is deliberately synthetic.
  // Actual stale-request server enforcement is covered by authority tests separately.
  const created = page.waitForResponse(r => r.url().endsWith('/api/sessions') && r.request().method() === 'POST');
  await start(page);
  const initial = await (await created).json() as HumanView;
  await draftLayout(page, publicLayout(['amber']));
  const incoming: HumanView = { ...initial, revision: initial.revision + 1,
    switchyardPanel: { appliedRotations: publicLayout(['blue']), panelRevision: 1, poweredTerminals: ['blue'] } };
  await page.route(/\/api\/sessions\/[^/]+$/, route => route.fulfill({ json: incoming }));
  await page.route('**/routing-panel', route => route.fulfill({ status: 409, json: { error: 'Fixture: another acknowledgement arrived.' } }));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel-status')).toContainText('Your draft is kept. Reset draft');
  await expect(page.getByTestId('draft-amber')).toHaveText('Connected');
  await expect(page.getByTestId('applied-blue')).toHaveText('Powered');
  await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
  await expect(page.getByTestId('draft-blue')).toHaveText('Connected');
  await expect(page.getByTestId('draft-amber')).toHaveText('Isolated');
  await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 1');
});
