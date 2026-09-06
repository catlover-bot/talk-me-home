import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com/.test(request.url())) throw new Error('Practice must never contact the provider');
  });
});
async function start(page: Page, maintenance = false) {
  await page.goto('/');
  if (maintenance) await page.getByRole('radio', { name: /Maintenance/ }).check();
  await page.getByRole('button', { name: 'Start Practice' }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
}
async function say(page: Page, message: string, tool = true) {
  await page.getByLabel('Type a message').fill(message);
  const response = tool ? page.waitForResponse(response => response.url().endsWith('/tools')) : undefined;
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  if (response) expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('caption')).not.toHaveText(message);
}
async function power(page: Page, value: 'ON' | 'OFF') {
  await page.getByRole('button', { name: 'Power ' + value, exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText(value);
}
async function restart(page: Page) {
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Practice' })).toBeVisible();
}
test('briefing is English, keyboard accessible, and hides local discoveries', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(/Simulation.*type to play/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await expect(page.getByRole('button', { name: 'Start Practice' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/g2-briefing-' + info.project.name + '.png', fullPage: true });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test('Classic cooperation reaches only a validated arrival and debrief', async ({ page }, info) => {
  await start(page);
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await say(page, 'What can you see?');
  await expect(page.getByTestId('caption')).toContainText(/latch/i);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByLabel('Type a message')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Pause mission' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/g2-classic-' + info.project.name + '.png', fullPage: true });
  await say(page, 'Inspect the latch');
  await say(page, 'Keep the door open');
  await power(page, 'OFF');
  await say(page, 'Walk through the door');
  await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toBeVisible();
  await expect(page.locator('.arrival-stamp')).toContainText('Arrival confirmed');
  await expect(page.getByText('Practice complete · no provider connection')).toBeVisible();
  await page.screenshot({ path: 'test-results/g2-debrief-' + info.project.name + '.png', fullPage: true });
});
test('early Power loss recovers and Restart clears observations without opening another connection', async ({ page }) => {
  await start(page); await power(page, 'OFF');
  await say(page, 'What can you see?'); await say(page, 'Latch the door open');
  await expect(page.getByTestId('caption')).toContainText(/closed/i);
  await power(page, 'ON'); await say(page, 'Latch the door open'); await power(page, 'OFF');
  await say(page, 'Cross to the far side');
  await expect(page.locator('.arrival-stamp')).toContainText('Arrival confirmed');
  await restart(page);
  await expect(page.locator('body')).not.toContainText(/Latch|latched|Arrival confirmed/);
  await expect(page.getByRole('button', { name: 'Start Practice' })).toBeEnabled();
});
test('faithful raw captions, source history and keyboard entry remain available', async ({ page }) => {
  await start(page);
  const message = 'Could you take a look around?';
  await page.getByLabel('Type a message').fill(message);
  await page.getByLabel('Type a message').press('Enter');
  await expect(page.getByTestId('caption')).toContainText(/latch/i);
  await page.getByRole('button', { name: 'Open transcript history' }).click();
  await expect(page.getByRole('dialog')).toContainText(message);
  await expect(page.getByRole('dialog')).toContainText('Practice · Typed');
});
test('missing Live token stays Live and never silently becomes simulation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Type a message')).toBeDisabled();
  await page.getByText('Connection & sound', { exact: true }).click();
  await expect(page.getByLabel('Next connection')).toHaveValue('live_text');
  await expect(page.getByTestId('caption')).not.toContainText('can you hear me');
});
test('Pause preserves Power and explicit keyboard resume marks earlier knowledge historical', async ({ page }, info) => {
  await start(page); await say(page, 'Look around');
  await page.getByRole('button', { name: 'Pin report', exact: true }).click();
  await expect(page.locator('.notebook-list')).toContainText('Robot report');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await page.getByRole('button', { name: 'Pause mission' }).click();
  await expect(page.getByLabel('Type a message')).toBeDisabled();
  await page.screenshot({ path: 'test-results/g2-paused-' + info.project.name + '.png', fullPage: true });
  await page.getByRole('button', { name: 'Resume Practice' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await expect(page.locator('.notebook-list')).toContainText('Earlier report — recheck if needed');
  await expect(page.locator('.recap-notice')).toContainText('historical');
  await page.screenshot({ path: 'test-results/g2-resumed-' + info.project.name + '.png', fullPage: true });
});
test('delayed old-round robot response cannot disclose into a restarted briefing', async ({ page }) => {
  await start(page);
  let release!: () => void, received!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const replied = new Promise<void>(resolve => { received = resolve; });
  await page.route('**/tools', async route => {
    const response = await route.fetch(); received(); await held;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.getByLabel('Type a message').fill('What can you see?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await replied; await restart(page); release();
    await expect(page.locator('body')).not.toContainText(/Latch|latched/);
    await page.getByRole('button', { name: 'Start Practice' }).click();
    await expect(page.getByTestId('caption')).toContainText('Mission Control, can you hear me?');
    await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  } finally { release(); }
});
test('Maintenance exchanges a real report and manual setting; wrong selector is recoverable', async ({ page }, info) => {
  await start(page, true);
  await page.getByRole('tab', { name: /Equipment manual/ }).click();
  await expect(page.locator('.mission-desk')).toContainText('Crescent');
  await expect(page.locator('.mission-desk')).toContainText('Kite');
  await expect(page.locator('.notebook-list')).toBeEmpty();
  await say(page, 'Inspect the module plate');
  const quote = await page.getByTestId('caption').innerText();
  const setting = quote.includes('Crescent') ? 'Anchor' : 'Bridge';
  const wrong = setting === 'Anchor' ? 'Bridge' : 'Anchor';
  expect(quote).toMatch(/Crescent|Kite/);
  await page.getByRole('button', { name: 'Pin report', exact: true }).click();
  await expect(page.locator('.notebook-list')).toContainText(quote);
  await page.getByLabel('My note', { exact: true }).fill('My private plan stays here.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('.notebook-list')).toContainText('Private. Not sent to Pip.');
  await page.screenshot({ path: 'test-results/g2-maintenance-' + info.project.name + '.png', fullPage: true });
  await say(page, 'Set the selector to ' + wrong);
  await say(page, 'Latch the door open');
  await expect(page.getByTestId('caption')).toContainText(/does not seat|did not seat/);
  await say(page, 'Set the selector to ' + setting);
  await say(page, 'Latch the door open'); await power(page, 'OFF');
  await say(page, 'Cross to the far side');
  await expect(page.locator('.arrival-stamp')).toContainText('Arrival confirmed');
});
test('hints and notes are API-free and never auto-discover a local plate', async ({ page }) => {
  await start(page, true);
  let toolCount = 0; page.on('request', request => { if (request.url().endsWith('/tools')) toolCount++; });
  await page.getByText('Need a nudge?', { exact: true }).click();
  await page.getByRole('button', { name: 'Hint 1', exact: true }).click();
  await expect(page.locator('.hint-copy')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Hint 2', exact: true }).click();
  await expect(page.locator('.hint-copy')).not.toBeEmpty();
  await page.getByLabel('My note', { exact: true }).fill('The plate is a private guess.');
  await page.getByRole('button', { name: 'Add note' }).click();
  expect(toolCount).toBe(0);
  await expect(page.getByTestId('caption')).not.toContainText(/Crescent|Kite/);
});
test('pending and rejected Power commands never masquerade as acknowledged changes', async ({ page }) => {
  await start(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/power', async route => { await held; await route.fulfill({ status: 503, json: { error: 'Power command was not accepted. Try again.' } }); });
  try {
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('ON');
    await expect(page.getByText('Waiting for the server to acknowledge your command.')).toBeVisible();
    release();
    await expect(page.getByRole('alert')).toContainText('not accepted');
    await expect(page.getByTestId('acknowledged-power')).toHaveText('ON');
  } finally { release(); }
});
test('390px reflow, reduced motion, long captions, and 200 percent zoom retain controls', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page); await say(page, 'What can you see?');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByRole('button', { name: 'Pause mission' })).toBeVisible();
  await page.screenshot({ path: 'test-results/g2-narrow-' + info.project.name + '.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  const documents = await page.locator('.mission-documents').boundingBox();
  const consoleBox = await page.locator('.companion-console').boundingBox();
  expect(consoleBox!.y).toBeGreaterThan(documents!.y + documents!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByLabel('Type a message').focus();
  await expect(page.getByLabel('Type a message')).toBeFocused();
  await page.screenshot({ path: 'test-results/g2-zoom-' + info.project.name + '.png', fullPage: true });
});
