import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Mission', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
}
async function say(page: Page, message: string) {
  await page.getByLabel('Type a message').fill(message);
  const response = page.waitForResponse(response => response.url().endsWith('/tools'));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('caption')).not.toHaveText(message);
}

test('initial map is static, English, keyboard accessible, and hides local discoveries', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(/Mock.*Simulation/).first()).toBeAttached();
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await expect(page.getByRole('button', { name: 'Start Mission', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Mission', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `test-results/initial-${info.project.name}.png`, fullPage: true });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test('cooperative simulation reaches only a validated arrival', async ({ page }, info) => {
  await start(page);
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await say(page, 'What can you see?');
  await expect(page.locator('body')).toContainText(/latch/i);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByLabel('Type a message')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `test-results/observed-${info.project.name}.png`, fullPage: true });
  await say(page, 'Inspect the latch');
  await say(page, 'Latch the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await say(page, 'Cross to the far side');
  await expect(page.locator('body')).toContainText(/arrival confirmed|mission complete|arrived safely/i);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `test-results/complete-${info.project.name}.png`, fullPage: true });
});

test('early power loss is recoverable and Restart removes old observations', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await say(page, 'What can you see?');
  await say(page, 'Latch the door open');
  await expect(page.locator('body')).toContainText(/closed/i);
  await page.getByRole('button', { name: 'Power ON', exact: true }).click();
  await say(page, 'Latch the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await say(page, 'Cross to the far side');
  await expect(page.locator('body')).toContainText(/arrival confirmed|mission complete|arrived safely/i);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
  await expect(page.locator('body')).not.toContainText(/arrival confirmed|mission complete|arrived safely/i);
});

test('captions preserve player text and keyboard entry works', async ({ page }) => {
  await start(page);
  const message = 'Could you take a look around?';
  await page.getByLabel('Type a message').fill(message);
  await page.getByLabel('Type a message').press('Enter');
  await expect(page.locator('body')).toContainText(/latch/i);
  await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  await expect(page.locator('body')).toContainText(message);
});

test('Live token failure remains Live and never silently starts simulation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Connection mode').selectOption('live');
  await page.getByRole('button', { name: 'Start Mission', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Text', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Connection mode')).toHaveValue('live');
  await expect(page.getByLabel('Type a message')).toBeDisabled();
});

test('Stop Mission preserves progress and keyboard resume restores communication', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Power OFF', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Stop Mission', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeDisabled();
  await page.getByRole('button', { name: 'Resume Mission', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Power OFF', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a delayed robot response after Restart cannot reveal the previous round', async ({ page }) => {
  await start(page);
  let release!: () => void;
  let received!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const serverReplied = new Promise<void>(resolve => { received = resolve; });
  await page.route('**/tools', async route => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByLabel('Type a message').fill('What can you see?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await serverReplied;
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await expect(page.getByTestId('caption')).toContainText('Mission Control, can you hear me?');
  release();
  await page.unroute('**/tools');
  await expect(page.locator('body')).not.toContainText(/Latch|latched/);
});
