import type { Page, TestInfo } from '@playwright/test';
import { encodeRemixCode } from '../../game/server/remix';
import { test, expect } from './switchyard-fixture';
import { RemixUiPlayer, startRemix } from './remix-player';

const guards = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const failures: string[] = []; guards.set(page, failures);
  page.on('pageerror', () => failures.push('Page error'));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL!).origin || /\/voice-token(?:\/|$)/.test(url.pathname)) {
      failures.push('External or token request'); await route.abort(); return;
    }
    await route.fallback();
  });
  await page.routeWebSocket('**/*', socket => { failures.push('WebSocket request'); socket.close(); });
});
test.afterEach(async ({ page }) => { expect(guards.get(page)).toEqual([]); });

const reference = (page: Page) => page.getByTestId('switchyard-report-reference');
const procedure = (page: Page) => page.getByTestId('switchyard-procedure-quote');
const actions = (writes: string[]) => writes.filter(path => /\/(tools|routing-panel|proposal-decision|voice-token)$/.test(path));
const paint = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function capture(page: Page, info: TestInfo, name: string) {
  if (process.env.GAME_REMIX_CAPTURE === '1') await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
}
async function inspectService(page: Page, profile: number) {
  // The code selects coverage only. Navigation and inspection use the displayed plan and local requests.
  await startRemix(page, { code: encodeRemixCode(profile, 0, 'rescue', 1010 + profile) });
  const player = new RemixUiPlayer(page); await player.begin(); await player.navigate('Transfer Table');
  const report = await player.ask('Inspect Transfer turntable', /Transfer turntable service plate reads [^.]+\./);
  const reported = report!.match(/This is (?:a|an) ([^.]+ service module)/)?.[1];
  expect(reported).toBeTruthy();
  await page.getByRole('tab', { name: 'Service modules', exact: true }).click();
  await expect(procedure(page)).toHaveText(reported!);
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  return { player, reported: reported! };
}
async function expectCompleteManual(page: Page) {
  await expect(page.locator('.switchyard-manual-table').getByRole('rowheader')).toHaveText(['Rivet', 'Slot']);
  await expect(page.locator('.dispatch-procedures dt')).toHaveText(['Detent-first service module', 'Alignment-first service module']);
  await expect(page.locator('.switchyard-manual-table [aria-selected], .switchyard-manual-table [aria-current], .dispatch-procedures [aria-selected], .dispatch-procedures [aria-current]')).toHaveCount(0);
}

for (const [profile, expected] of [[0, 'Detent-first service module'], [8, 'Alignment-first service module']] as const) {
  test(`Remix keeps the exact ${expected} quotation through routing, replies and Pause`, async ({ page }, info) => {
    const writes: string[] = [];
    page.on('request', request => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
    const { player, reported } = await inspectService(page, profile);
    expect(reported).toBe(expected);
    const plate = page.getByTestId('switchyard-reference-quote');
    const sourceId = await plate.getAttribute('data-message-id');
    const attribution = (await reference(page).locator('.switchyard-quote-source').textContent())!;
    await expect(procedure(page)).toHaveAttribute('data-message-id', sourceId!);
    await expect(reference(page)).toHaveAttribute('data-reading-status', 'current');
    await expectCompleteManual(page);
    const beforeReading = actions(writes).length;
    const fullSource = reference(page).locator('details');
    await fullSource.locator('summary').click(); await expect(fullSource).toHaveAttribute('open', '');
    await fullSource.locator('summary').click(); await paint(page);
    expect(actions(writes)).toHaveLength(beforeReading);
    await player.supply(['amber']);
    await expect(procedure(page)).toHaveText(reported);
    await expect(procedure(page)).toHaveAttribute('data-message-id', sourceId!);
    await expect(plate).toHaveAttribute('data-message-id', sourceId!);
    await expect(reference(page).locator('.switchyard-quote-source')).toHaveText(attribution);
    await expect(reference(page)).toHaveAttribute('data-reading-status', 'historical');
    await player.ask('Look around', /(?:I am|You are) at Transfer Table\./);
    await expect(page.getByTestId('caption')).not.toContainText(reported);
    await expect(procedure(page)).toHaveText(reported);
    await expect(procedure(page)).toHaveAttribute('data-message-id', sourceId!);
    await expect(plate).toHaveAttribute('data-message-id', sourceId!);
    const committed = page.getByTestId('action-proposal');
    await expect(committed).toHaveAttribute('data-status', 'committed');
    const committedId = await committed.getAttribute('data-proposal-id');
    await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
    await expect(reference(page)).toHaveAttribute('data-visit-status', 'earlier');
    await expect(procedure(page)).toHaveText(reported);
    await expect(procedure(page)).toHaveAttribute('data-message-id', sourceId!);
    await expect(reference(page).locator('.switchyard-quote-source')).toHaveText(attribution);
    await expect(page.getByRole('tab', { name: 'Service modules', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectCompleteManual(page);
    await reference(page).scrollIntoViewIfNeeded(); await capture(page, info, `procedure-${profile}-historical`);
    await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Local companion requests' }).getByRole('button')).toHaveText(['Look around', 'Discuss the direct lift', 'Discuss the maintenance bypass']);
    await expect(procedure(page)).toHaveText(reported);
    await expect(committed).toHaveAttribute('data-status', 'committed');
    await expect(committed).toHaveAttribute('data-proposal-id', committedId!);
    await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  });
}

test('Remix reference reading preserves private work and reflows with keyboard and reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const writes: Array<{ path: string; body: string }> = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push({ path: new URL(request.url()).pathname, body: request.postData() ?? '' }); });
  const { reported } = await inspectService(page, 8);
  const note = 'Private comparison: retain both possible procedures.';
  if (!await page.getByLabel('My note', { exact: true }).isVisible()) await page.locator('.desk-extras > summary').click();
  await page.getByLabel('My note', { exact: true }).fill(note);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.locator('.notebook-entry.private-note')).toContainText(note);
  const intended = page.getByRole('group', { name: 'My intended approach' }).getByRole('radio', { name: 'Maintenance bypass', exact: true });
  await intended.check();
  const plateId = await page.getByTestId('switchyard-reference-quote').getAttribute('data-message-id');
  const before = actions(writes.map(write => write.path)).length;
  for (const enlarged of [false, true]) {
    await page.setViewportSize(enlarged ? { width: 1280, height: 900 } : { width: 390, height: 844 });
    await page.evaluate(zoom => { document.body.style.zoom = zoom; }, enlarged ? '2' : '1');
    const skip = page.getByRole('button', { name: 'Skip guidance', exact: true });
    await skip.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Replay guidance', exact: true })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(skip).toBeFocused();
    const fullSource = reference(page).locator('details');
    await fullSource.locator('summary').focus(); await page.keyboard.press('Enter');
    await expect(fullSource).toHaveAttribute('open', '');
    await page.keyboard.press('Enter'); await expect(fullSource).not.toHaveAttribute('open', '');
    await expect(fullSource.locator('summary')).toBeFocused();
    await expect(procedure(page)).toHaveText(reported);
    await expect(procedure(page)).toHaveAttribute('data-message-id', plateId!);
    await expect(page.getByRole('tab', { name: 'Service modules', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(intended).toBeChecked();
    await expect(page.locator('.notebook-entry.private-note')).toContainText(note);
    await expectCompleteManual(page);
    await procedure(page).scrollIntoViewIfNeeded();
    const quoteBox = await procedure(page).boundingBox(), referenceBox = await reference(page).boundingBox();
    expect(quoteBox && referenceBox && quoteBox.width <= referenceBox.width + 1).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.getByTestId('switchyard-guidance').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    await capture(page, info, enlarged ? 'reference-enlarged' : 'reference-narrow');
  }
  await paint(page); expect(actions(writes.map(write => write.path))).toHaveLength(before);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local companion requests' }).getByRole('button', { name: 'Look around', exact: true })).toBeEnabled();
  await expect(intended).toBeChecked();
  await expect(page.locator('.notebook-entry.private-note')).toContainText(note);
  await expect(page.getByRole('tab', { name: 'Service modules', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(procedure(page)).toHaveAttribute('data-message-id', plateId!);
  expect(writes.filter(write => /\/(tools|messages)$/.test(write.path)).some(write => write.body.includes(note))).toBe(false);
});
