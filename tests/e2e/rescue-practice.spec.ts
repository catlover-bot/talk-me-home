import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import type { HumanView, ToolResponse } from '../../game/shared/contracts';
import { test, expect } from './rescue-fixture';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Practice must not request a provider token or connection.');
  });
});
async function start(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /Rescue Mission/ })).toBeChecked();
  const response = page.waitForResponse(response => /\/api\/sessions$/.test(response.url()));
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  const initial = await (await response).json() as HumanView;
  expect(initial.missionKind).toBe('rescue');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  return initial;
}
async function say(page: Page, text: string, ok = true) {
  await page.getByLabel('Type a message').fill(text);
  const response = page.waitForResponse(response => response.url().endsWith('/tools'), { timeout: 5000 });
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const result = await (await response).json() as ToolResponse;
  expect(result.ok, `The validated result for ${text}`).toBe(ok);
  await expect(page.getByTestId('caption')).not.toHaveText(text);
  return result;
}
async function relay(page: Page, name: 'Beacon' | 'Harbor' | 'Off') {
  const button = page.getByRole('button', { name: 'Relay ' + name, exact: true });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);
}
async function control(page: Page, name: string, expectedEnergy?: string) {
  const acknowledged = page.waitForResponse(response => response.url().endsWith('/dock-control'));
  await page.getByRole('button', { name, exact: true }).click();
  expect((await acknowledged).ok()).toBe(true);
  if (expectedEnergy) await expect(page.getByTestId('dock-energy')).toHaveText(expectedEnergy);
}
async function cargo(page: Page, recover = false) {
  await say(page, 'Could you look around and tell me what might help?');
  if (recover) {
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
    await say(page, 'Keep the door open', false);
    await expect(page.getByTestId('caption')).toContainText('closed');
    await page.getByRole('button', { name: 'Power ON', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('ON');
  }
  await say(page, 'Inspect the latch'); await say(page, 'Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  const crossing = await say(page, 'Cross to the far side');
  expect(crossing.view.completed).toBe(false);
  expect(crossing.view.chapter).toBe('gallery');
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toHaveCount(0);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await say(page, 'Where are you?');
  await relay(page, 'Beacon'); await say(page, 'Go through the east gate');
}
async function screenshot(page: Page, name: string, info: TestInfo) {
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect.poll(() => page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).not.toMatch(/^"?(Times New Roman|serif)"?$/);
  await page.screenshot({ path: `test-results/goal-003-${name}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
}
async function dock(page: Page, recovery = false) {
  await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible();
  await expect(page.getByTestId('dock-energy')).toHaveText('Empty');
  await say(page, 'Look around');
  await say(page, 'Inspect the contact');
  await say(page, 'Hold the contact while I store the charge');
  await control(page, 'Charge', 'Primed');
  if (recovery) {
    await say(page, 'Release the contact');
    await expect(page.getByTestId('dock-energy')).toHaveText('Empty');
    await say(page, 'Hold the contact'); await control(page, 'Charge', 'Primed');
  }
  await control(page, 'Store', 'Stored');
  await say(page, 'Board the capsule', false);
  await say(page, 'Release the contact'); await say(page, 'Board the capsule');
  await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
}

test('Practice Rescue A: cooperative full mission, private references, recoverable Cargo and Dock mistakes, earned homecoming', async ({ page, rescueServer }, info) => {
  const initial = await start(page);
  if (info.project.name === 'chromium-1280') await screenshot(page, 'cargo-initial', info);
  await cargo(page, true);
  await expect(page.locator('.private-location-mark')).toHaveCount(0);
  await page.getByText('Mark your map', { exact: false }).click();
  await page.getByLabel('Where I think Pip is').selectOption('sail');
  await expect(page.locator('.private-location-mark')).toHaveCount(1);
  await say(page, 'Where are you?');
  await expect(page.getByTestId('caption')).toContainText('Fork emblem');
  await expect(page.getByLabel('Where I think Pip is')).toHaveValue('sail');
  await page.getByRole('button', { name: 'Pin report', exact: true }).click();
  await page.getByLabel('My note', { exact: true }).fill('Private route guess stays at this desk.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.locator('.notebook-list')).toContainText('Private route guess');
  const recap = rescueServer.store.recap(initial.sessionId, initial.roundId);
  expect(JSON.stringify(recap)).not.toMatch(/Private route guess|blockedGates|"location":"sail"/);
  await page.getByRole('button', { name: 'Open transcript history' }).click();
  const history = page.getByRole('region', { name: 'Conversation history', exact: true });
  await expect(history).toBeVisible();
  await expect(page.getByTestId('caption')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interrupt', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (info.project.name === 'chromium-1280') await screenshot(page, 'history-during-gallery', info);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open transcript history' })).toBeFocused();
  await expect(history).toHaveCount(0);
  await page.getByText('Mark your map', { exact: false }).click();
  await screenshot(page, 'gallery', info);
  await page.getByRole('button', { name: 'Presentation layout', exact: true }).click();
  await screenshot(page, 'presentation-gallery', info);
  for (const control of [page.getByTestId('caption'), page.getByRole('button', { name: 'Pause mission', exact: true }), page.getByRole('button', { name: 'Relay Harbor', exact: true })]) await expect(control).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Standard layout', exact: true }).click();
  await say(page, 'Move through the southeast gate');
  await relay(page, 'Harbor');
  const arrival = await say(page, 'Move through the northeast gate');
  expect(arrival.view.chapter).toBe('return_dock'); expect(arrival.view.completed).toBe(false);
  await screenshot(page, 'return-dock', info);
  await dock(page, true);
  await control(page, 'Authorize return');
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Not granted');
  await say(page, 'Confirm return', false);
  await control(page, 'Authorize return');
  await say(page, 'Confirm return');
  await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
  expect(rescueServer.store.get(initial.sessionId).completed).toBe(true);
  expect(rescueServer.store.record(initial.sessionId, initial.roundId).debrief?.timeline.filter(entry => entry.kind === 'checkpoint')).toHaveLength(2);
  await screenshot(page, 'homecoming', info);
});

test.describe('Authored Gallery B', () => {
  test.use({ galleryConfiguration: 'b' });
  test('Practice Rescue B: blocked lower route, backtracking, Off recovery, pause and successful alternate route', async ({ page }, info) => {
    await start(page); await cargo(page);
    await say(page, 'Go through the southeast gate');
    await say(page, 'Inspect the northeast gate');
    await expect(page.getByTestId('caption')).toContainText('Cargo blocks');
    await say(page, 'Go through the northeast gate', false);
    await expect(page.getByTestId('caption')).toContainText('Cargo blocks');
    await screenshot(page, 'blocked-route', info);
    await relay(page, 'Off'); await say(page, 'Go through the northwest gate', false);
    await relay(page, 'Beacon'); await say(page, 'Go through the northwest gate');
    await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    await say(page, 'Where are you?'); await expect(page.getByTestId('caption')).toContainText('Fork emblem');
    await relay(page, 'Harbor'); await say(page, 'Go through the northeast gate');
    await say(page, 'Inspect the southeast gate'); await relay(page, 'Beacon'); await say(page, 'Go through the southeast gate');
    await dock(page); await control(page, 'Authorize return'); await say(page, 'Confirm return');
    await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
  });
});

test('Rescue layout and local rendering: 1920, narrow, enlarged, reduced motion, keyboard controls, honest Presentation', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page); await cargo(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (info.project.name === 'chromium-1280') await screenshot(page, 'gallery-1920', info);
  const rendering = await page.evaluate(async () => {
    const deltas: number[] = []; let previous = performance.now();
    await new Promise<void>(resolve => {
      const step = (now: number) => { deltas.push(now - previous); previous = now; if (deltas.length >= 90) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const sorted = deltas.slice(1).sort((a, b) => a - b);
    return { userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, domElements: document.querySelectorAll('*').length, domContentLoadedMs: navigation.domContentLoadedEventEnd, sampledFrames: sorted.length, medianFrameIntervalMs: sorted[Math.floor(sorted.length / 2)], p95FrameIntervalMs: sorted[Math.floor(sorted.length * .95)], largestFrameIntervalMs: sorted.at(-1), bundleContext: 'Frozen production preview, reduced motion, headless Linux Chromium; not a Windows FPS certification.' };
  });
  mkdirSync('.validation', { recursive: true });
  writeFileSync(`.validation/goal003-render-${info.project.name}.json`, JSON.stringify(rendering, null, 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Relay Harbor', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeVisible();
  if (info.project.name === 'chromium-1280') await screenshot(page, 'gallery-narrow', info);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.getByRole('button', { name: 'Relay Harbor', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('acknowledged-relay')).toHaveText('Harbor');
  const documentBox = await page.locator('.mission-documents').boundingBox(); const consoleBox = await page.locator('.companion-console').boundingBox();
  expect(consoleBox!.y).toBeGreaterThan(documentBox!.y + documentBox!.height);
  if (info.project.name === 'chromium-1280') await screenshot(page, 'gallery-enlarged', info);
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await page.getByRole('button', { name: 'Presentation layout', exact: true }).click();
  await expect(page.locator('.connection-readout')).toContainText('Practice');
  await expect(page.getByTestId('caption')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeInViewport({ ratio: 1 });
});
