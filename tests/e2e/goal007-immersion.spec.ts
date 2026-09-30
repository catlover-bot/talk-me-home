import { test, expect } from './rescue-fixture';

test.use({ compiledProduction: true });
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => { if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Immersion checks stay offline.'); });
});

test('selected launch is primary and the first question records selected text without a physical action', async ({ page, rescueServer }) => {
  await page.goto('/');
  await expect(page.locator('.briefing-action .primary-button')).toHaveText('Start Practice');
  await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('first-question')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask about this room', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Ask about this room', exact: true }).click();
  await expect(page.getByTestId('first-question')).toHaveCount(0);
  await expect(page.getByTestId('caption')).toContainText('Door');
  expect(rescueServer.commits.length).toBe(0);
  await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  const request = page.locator('.history-message').filter({ hasText: 'Please look around and report what you can see within reach.' });
  await expect(request).toContainText('Selected request');
  await expect(request).not.toContainText('Speech');
});

test('radio recovery stays read-only, pending intent remains exact, and declined action needs a fresh proposal', async ({ page, rescueServer }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await page.getByText('Find our place in the conversation', { exact: true }).click();
  await page.getByRole('button', { name: 'Request a fresh look', exact: true }).click();
  await expect(page.getByTestId('caption')).toContainText('Door');
  expect(rescueServer.commits.length).toBe(0);
  await page.getByLabel('Type a message').fill('Keep the door open');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('radio-phase')).toContainText('Your decision');
  await expect(page.getByTestId('proposal-label')).toHaveText('Engage the Latch');
  await expect(page.getByTestId('caption')).toHaveText('I propose: Engage the Latch.');
  await page.getByRole('button', { name: 'Not yet', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
  expect(rescueServer.commits.length).toBe(0);
  await page.getByLabel('Type a message').fill('Keep the door open');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  await expect(page.getByTestId('action-proposal')).not.toHaveAttribute('open', '');
  expect(rescueServer.commits.length).toBe(1);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByTestId('radio-phase')).toContainText('Connection ended');
  await expect(page.locator('.resume-retention')).toContainText('server restart loses the mission');
  await expect(page.getByRole('button', { name: 'Request a fresh look', exact: true })).toBeDisabled();
});

test('narrow and enlarged consoles navigate between documents and radio without page overflow', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss first question', exact: true }).click();
  for (const zoom of [false, true]) {
    await page.setViewportSize(zoom ? { width: 1280, height: 720 } : { width: 390, height: 844 });
    await page.evaluate(value => { document.documentElement.style.zoom = value; }, zoom ? '2' : '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const nav = page.getByRole('navigation', { name: 'Mission console navigation', exact: true });
    await nav.getByRole('link', { name: 'Documents & controls', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Power OFF', exact: true })).toBeInViewport();
    await nav.getByRole('link', { name: 'Radio & action', exact: true }).click();
    await expect(page.getByTestId('caption')).toBeInViewport();
    await page.getByRole('button', { name: 'Pause mission', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeInViewport({ ratio: 1 });
  }
});