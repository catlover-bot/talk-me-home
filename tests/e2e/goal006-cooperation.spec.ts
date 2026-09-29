import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { ToolResponse } from '../../game/shared/contracts';
import { test, expect } from './rescue-fixture';
import { confirmProposalForRequest } from '../../scripts/qa-mission-player.mjs';

test.use({ compiledProduction: true });
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('The cooperation check must remain offline.');
  });
});

async function say(page: Page, text: string) {
  await page.getByLabel('Type a message').fill(text);
  const response = page.waitForResponse(response => response.url().endsWith('/tools'));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const result = await (await response).json() as ToolResponse;
  expect(result.ok).toBe(true);
  if (result.code === 'awaiting_confirmation') await confirmProposalForRequest(page, text);
  await expect(page.getByTestId('caption')).not.toHaveText(text);
}

async function gallery(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.locator('.shared-supply-note').first()).toBeVisible();
  const supply = await page.locator('.shared-supply-note').first().boundingBox();
  const drawing = await page.locator('.cargo-map').boundingBox();
  expect(supply!.y + supply!.height).toBeLessThanOrEqual(drawing!.y + 1);
  await say(page, 'Look around');
  await say(page, 'Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say(page, 'Cross to the far side');
  await say(page, 'Where are you?');
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
}

test('private route revision has one-gesture ink, undo including erase, and exact contextual reports without moving Pip', async ({ page, rescueServer }) => {
  await gallery(page);
  const before = rescueServer.commits.length;
  await expect(page.getByRole('button', { name: 'Plan route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mark planned route on Ring – Fork', exact: true }).click();
  await page.getByRole('button', { name: 'Mark planned route on Fork – Sail', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(2);
  await page.getByRole('button', { name: 'Erase plan', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo mark', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cross out', exact: true }).click();
  await page.getByRole('button', { name: 'Mark suspected obstruction on Sail – Dock', exact: true }).click();
  await expect(page.locator('.private-path-mark')).toHaveCount(1);
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo mark', exact: true }).click();
  await expect(page.locator('.private-path-mark')).toHaveCount(0);
  await page.route('**/annotations', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Constructed private mark failure.' }) }), { times: 1 });
  await page.getByRole('button', { name: 'Mark suspected obstruction on Sail – Dock', exact: true }).click();
  await expect(page.locator('.atlas-save-error')).toContainText('could not be saved');
  await expect(page.locator('.private-path-mark')).toHaveCount(0);
  // A failed mark must not consume the last successful undo entry (the second planned corridor).
  await page.getByRole('button', { name: 'Undo mark', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(1);
  await page.getByRole('button', { name: 'Plan route', exact: true }).click();
  await page.getByRole('button', { name: 'Mark planned route on Fork – Sail', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(2);
  const exact = await page.getByTestId('gallery-report-excerpt').textContent();
  await page.locator('.report-association > summary').click();
  await page.getByLabel('Attach report to', { exact: true }).selectOption('ring');
  await page.getByRole('button', { name: 'Attach exact quote', exact: true }).click();
  const attached = page.getByRole('region', { name: 'Attached reports for Ring', exact: true });
  await expect(attached.locator('blockquote')).toHaveText(exact!);
  await expect(attached).toContainText('Practice');
  await expect(attached.locator('time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);
  await page.getByRole('button', { name: 'Relay Harbor', exact: true }).click();
  await expect(attached).toContainText('Earlier gate conditions');
  await expect(attached.locator('blockquote')).toHaveText(exact!);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await page.getByRole('button', { name: 'Plan route', exact: true }).click();
  await page.getByRole('button', { name: 'Mark planned route on Fork – Leaf', exact: true }).click();
  await expect(page.locator('.atlas-plan-mark')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
  expect(rescueServer.commits.length).toBe(before);
  await expect(page.locator('.private-location-mark')).toHaveCount(0);
});

test('Dock diagram follows acknowledged energy and grant while home foregrounds arrival without an automatic replay', async ({ page, rescueServer }, info) => {
  await gallery(page);
  const beacon = page.getByRole('button', { name: 'Relay Beacon', exact: true });
  if (await beacon.getAttribute('aria-pressed') !== 'true') await beacon.click();
  await expect(page.getByTestId('acknowledged-relay')).toHaveText('Beacon');
  await say(page, 'Go through the east gate');
  await say(page, 'Go through the southeast gate');
  await page.getByRole('button', { name: 'Relay Harbor', exact: true }).click();
  await expect(page.getByTestId('acknowledged-relay')).toHaveText('Harbor');
  await say(page, 'Go through the northeast gate');
  const sequence = page.getByLabel('Return sequence and acknowledged state', { exact: true });
  const charge = sequence.locator('.return-state').filter({ has: page.getByText('Charge', { exact: true }) });
  const stored = sequence.locator('.return-state').filter({ has: page.getByText('Store', { exact: true }) });
  const grant = sequence.locator('.return-state').filter({ has: page.getByText('Return grant', { exact: true }) });
  await page.evaluate(() => scrollTo(0, 0));
  await expect(sequence).toBeInViewport({ ratio: 1 });
  await expect(sequence).toContainText('Pip checks locally');
  await say(page, 'Look around'); await say(page, 'Hold the contact');
  await page.getByRole('button', { name: 'Charge', exact: true }).click();
  await expect(charge).toHaveAttribute('data-active', 'true');
  await expect(charge).toContainText('temporary');
  await expect(stored).toHaveAttribute('data-active', 'false');
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(stored).toHaveAttribute('data-active', 'true');
  await expect(charge).toHaveAttribute('data-active', 'false');
  if (process.env.GAME_QA_CAPTURE_CORE === '1') {
    mkdirSync('artifacts/goal-006/ui/accessibility', { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/goal-006/ui/accessibility/dock-stored-${info.project.name}.png`, animations: 'disabled' });
  }
  await say(page, 'Release the contact'); await say(page, 'Board the capsule');
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(grant).toHaveAttribute('data-active', 'true');
  await say(page, 'Confirm return');
  await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
  await expect(page.getByTestId('home-story')).toContainText('A safe arrival. That was always enough.');
  await expect(page.locator('.homecoming-recorder')).toHaveCount(0);
  await expect(page.locator('.debrief-record')).not.toHaveAttribute('open', '');
  await expect(page.locator('.contribution-strip')).toBeHidden();
  await page.getByText('Remember the journey', { exact: true }).click();
  await expect(page.locator('.contribution-strip')).toBeVisible();
  const commits = rescueServer.commits.length;
  await expect(page.getByRole('button', { name: 'Start another rescue', exact: true })).toBeEnabled();
  expect(rescueServer.commits.length).toBe(commits);
  await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toHaveCount(0);
});

test('core documents keep keyboard route revision and Pause accessible at narrow width and 200 percent zoom', async ({ page }, info) => {
  await gallery(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const capture = async (name: string) => {
    if (process.env.GAME_QA_CAPTURE_CORE !== '1') return;
    mkdirSync('artifacts/goal-006/ui/accessibility', { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/goal-006/ui/accessibility/${name}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  };
  for (const enlarged of [false, true]) {
    await page.setViewportSize(enlarged ? { width: 1280, height: 720 } : { width: 390, height: 844 });
    await page.evaluate(value => { document.documentElement.style.zoom = value; }, enlarged ? '2' : '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Plan route', exact: true }).focus();
    await page.keyboard.press('Enter');
    const route = page.getByRole('button', { name: /planned route on Fork – Leaf/, exact: true });
    await route.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.atlas-plan-mark')).toHaveCount(enlarged ? 0 : 1);
    await page.getByRole('button', { name: 'Read attached reports for Ring', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Attached reports for Ring', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pause mission', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeInViewport({ ratio: 1 });
    await capture(enlarged ? 'gallery-zoom-200' : 'gallery-390');
  }
});
