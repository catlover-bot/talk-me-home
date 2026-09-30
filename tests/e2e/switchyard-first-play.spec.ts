import type { Page, Request } from '@playwright/test';
import { test, expect } from './switchyard-fixture';

const forbidden = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const attempts: string[] = []; forbidden.set(page, attempts);
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', error => { throw error; });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || /\/voice-token(?:\?|$)/.test(url.href)) {
      attempts.push(`${url.origin}${url.pathname}`); await route.abort(); return;
    }
    await route.fallback();
  });
  await page.routeWebSocket('**', socket => { attempts.push('WebSocket attempted'); socket.close(); });
});
test.afterEach(async ({ page }) => { expect(forbidden.get(page)).toEqual([]); });

type Write = { path: string; body: unknown };
function writesFrom(page: Page) {
  const writes: Write[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') writes.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
  });
  return writes;
}
const actions = (writes: Write[]) => writes.filter(write => /\/(tools|routing-panel|proposal-decision|voice-token)$/.test(write.path));
const choices = (page: Page) => page.getByRole('region', { name: 'Local companion requests' });
const guide = (page: Page) => page.getByTestId('switchyard-guidance');
const help = (page: Page) => page.locator('.switchyard-help');
const stage = (page: Page, value: string) => expect(guide(page)).toHaveAttribute('data-stage', value);
const hintRequest = (request: Request, level: number) => request.url().endsWith('/hint') && request.postDataJSON().level === level;

async function start(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /^Rescue Mission/ })).toBeChecked();
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  await stage(page, 'observe');
}
async function ask(page: Page, label: string, physical = false, confirm = false) {
  const response = page.waitForResponse(value => value.url().endsWith('/tools') && value.request().method() === 'POST');
  await choices(page).getByRole('button', { name: label, exact: true }).click();
  await response;
  if (physical) {
    await expect(page.getByTestId('proposal-label')).toHaveText(label);
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
    if (confirm) {
      await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
      await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    }
  }
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
}
async function turnAmber(page: Page) {
  // One visible public contact turn, independent of either hidden installation.
  await page.locator('[data-piece="p3"]').press('ArrowLeft');
  await expect(page.getByTestId('draft-amber')).toHaveText('Connected');
}
async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('reading, skipping, replaying and private planning do not operate the station or reveal an unreported installation', async ({ page, switchyardServer }) => {
  const writes = writesFrom(page);
  await start(page);
  await expect(choices(page).getByRole('button')).toHaveText(['Look around']);
  const caption = await page.getByTestId('caption').textContent();
  const before = writes.length;
  await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
  await stage(page, 'skipped');
  await expect(page.getByTestId('switchyard-guide-radio')).toHaveCount(0);
  await expect(page.locator('[data-piece="p1"]')).toBeEnabled();
  await page.getByRole('button', { name: 'Replay guidance', exact: true }).click();
  await stage(page, 'observe');
  await help(page).locator('summary').click();
  await page.getByRole('group', { name: 'My intended approach' }).getByRole('radio', { name: 'Maintenance bypass', exact: true }).check();
  await paint(page);
  expect(writes).toHaveLength(before);
  await expect(page.getByTestId('caption')).toHaveText(caption!);
  await expect(page.getByTestId('switchyard-panel-status')).toContainText('revision 0');
  await expect(page.getByTestId('action-proposal')).toHaveCount(0);
  const beforeHelp = actions(writes).length;
  for (const [level, label] of [[1, 'Nudge'], [2, 'Explain the rule'], [3, 'How to investigate']] as const) {
    const response = page.waitForResponse(value => hintRequest(value.request(), level));
    await help(page).getByRole('button', { name: label, exact: true }).click();
    await response;
    await expect(help(page).locator('.hint-copy')).not.toBeEmpty();
    await expect(help(page)).toContainText('Mission guide · The Switchyard · Private');
    // Public manuals may contain all rows; new instructional copy cannot pick an installation or unseen item.
    await expect(help(page)).not.toContainText(/Crescent|Kite|Rivet|Slot|Lift console|Bridge winch|Departure console|Set index (one|two)|P[1-6]\s*(?:to|=)\s*\d/);
    await stage(page, 'observe');
  }
  expect(actions(writes)).toHaveLength(beforeHelp);
  expect(writes.slice(before).filter(write => !write.path.endsWith('/hint'))).toEqual([]);
  expect(writes.filter(write => write.path.endsWith('/hint')).map(write => (write.body as { level: number }).level)).toEqual([1, 2, 3]);
  await expect(choices(page).getByRole('button')).toHaveText(['Look around']);
  await expect(page.getByTestId('caption')).toHaveText(caption!);
  await expect(guide(page)).not.toContainText(/Crescent|Kite|Rivet|Slot/);
  expect(switchyardServer.commits).toHaveLength(0);
});

test('only a real report, real turn and matching Apply acknowledgement advance the opening', async ({ page, switchyardServer }) => {
  await start(page);
  // Equipment remains usable before the guide's observation beat.
  await turnAmber(page);
  await stage(page, 'observe');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await ask(page, 'Look around');
  await stage(page, 'apply');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let attempt = 0;
  await page.route('**/routing-panel', async route => {
    attempt++;
    if (attempt === 1) {
      await held;
      await route.fulfill({ status: 409, json: { error: 'Fixture: the complete draft was rejected.' } });
    } else await route.fallback();
  });
  try {
    await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
    await expect(page.getByTestId('switchyard-panel-status')).toContainText('Waiting for the server');
    await stage(page, 'apply');
    await expect(page.getByTestId('applied-amber')).toHaveText('Off');
    await expect(page.getByTestId('switchyard-apply-receipt')).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator('.switchyard-panel-error')).toContainText('draft was rejected');
  await stage(page, 'apply');
  await expect(page.getByTestId('draft-amber')).toHaveText('Connected');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveAttribute('data-revision', '1');
  await stage(page, 'ready');
  expect(attempt).toBe(2); expect(switchyardServer.commits).toHaveLength(0);
});

test('replayed guidance preserves applied work and requires fresh interactions without locking the controls', async ({ page, switchyardServer }) => {
  const writes = writesFrom(page);
  await start(page); await ask(page, 'Look around'); await stage(page, 'draft');
  await turnAmber(page); await stage(page, 'apply');
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await stage(page, 'ready');
  await ask(page, 'Go to Transfer Table', true);
  const proposal = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
  const before = writes.length;
  await page.getByRole('button', { name: 'Replay guidance', exact: true }).click();
  await stage(page, 'observe');
  await paint(page);
  expect(writes).toHaveLength(before);
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', proposal!);
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toBeEnabled();
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
  await expect(page.locator('[data-piece="p3"]')).toHaveAttribute('data-rotation', '0');
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveAttribute('data-revision', '1');
  await page.getByRole('button', { name: 'Not yet', exact: true }).click();
  await ask(page, 'Look around'); await stage(page, 'draft');
  await page.locator('[data-piece="p1"]').press('ArrowRight');
  await stage(page, 'apply');
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveAttribute('data-revision', '2');
  await stage(page, 'ready');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  expect(switchyardServer.commits).toHaveLength(0);
});

test('guidance and help preserve declined and stale proposals until a fresh exact confirmation', async ({ page, switchyardServer }) => {
  await start(page); await ask(page, 'Look around');
  await ask(page, 'Go to Transfer Table', true);
  const first = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  await help(page).locator('summary').click();
  await help(page).getByRole('button', { name: 'Explain the rule', exact: true }).click();
  await expect(help(page).locator('.hint-copy')).not.toBeEmpty();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', first!);
  expect(switchyardServer.commits).toHaveLength(0);
  await page.getByRole('button', { name: 'Not yet', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  await ask(page, 'Go to Transfer Table', true);
  const second = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  expect(second).not.toBe(first);
  await turnAmber(page);
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'invalidated');
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  expect(switchyardServer.commits).toHaveLength(0);
  await ask(page, 'Go to Transfer Table', true);
  await expect(page.getByTestId('action-proposal')).not.toHaveAttribute('data-proposal-id', second!);
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  expect(switchyardServer.commits).toHaveLength(1);
});

test('the latest selected help tier wins without replacing the actual report or its manual quote', async ({ page, switchyardServer }) => {
  const writes = writesFrom(page);
  await start(page); await ask(page, 'Look around');
  await ask(page, 'Go to Transfer Table', true, true);
  await ask(page, 'Go to Lift Station', true, true);
  await ask(page, 'Inspect Lift console');
  await page.getByRole('tab', { name: 'Lift plates', exact: true }).click();
  const report = await page.getByTestId('caption').textContent();
  const quote = await page.getByTestId('switchyard-report-reference').textContent();
  await help(page).locator('summary').click();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/hint', async route => { if (hintRequest(route.request(), 1)) await held; await route.fallback(); });
  const oldResponse = page.waitForResponse(value => hintRequest(value.request(), 1));
  const before = actions(writes).length;
  try {
    await help(page).getByRole('button', { name: 'Nudge', exact: true }).click();
    await help(page).getByRole('button', { name: 'Explain the rule', exact: true }).click();
    await expect(help(page).locator('.hint-copy')).toContainText('two terminal loads');
    await expect(help(page).getByRole('button', { name: 'Explain the rule', exact: true })).toBeFocused();
  } finally { release(); }
  await oldResponse;
  await paint(page);
  await expect(help(page).locator('.hint-copy')).toContainText('two terminal loads');
  await expect(page.getByTestId('caption')).toHaveText(report!);
  await expect(page.getByTestId('switchyard-report-reference')).toHaveText(quote!);
  expect(actions(writes)).toHaveLength(before);
  expect(switchyardServer.commits).toHaveLength(2);
});

test('keyboard guidance and help preserve focus and reflow at 390px and 200 percent with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  for (const enlarged of [false, true]) {
    await page.setViewportSize(enlarged ? { width: 1280, height: 900 } : { width: 390, height: 844 });
    await page.evaluate(zoom => { document.body.style.zoom = zoom; }, enlarged ? '2' : '1');
    const skip = page.getByRole('button', { name: 'Skip guidance', exact: true });
    await skip.focus(); await page.keyboard.press('Enter');
    await stage(page, 'skipped');
    const replay = page.getByRole('button', { name: 'Replay guidance', exact: true });
    await expect(replay).toBeFocused();
    expect(await replay.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter'); await stage(page, 'observe');
    await expect(skip).toBeFocused();
    const summary = help(page).locator('summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(help(page)).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(help(page).getByRole('button', { name: 'Nudge', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(help(page).locator('.hint-copy')).not.toBeEmpty();
    await expect(help(page).getByRole('button', { name: 'Nudge', exact: true })).toBeFocused();
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(help(page)).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await page.locator('[data-piece="p1"]').press('ArrowRight');
    await expect(page.locator('[data-piece="p1"]')).toBeFocused();
    expect(await page.locator('.switchyard-turn-feedback').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    expect(await guide(page).evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeEnabled();
  }
});
