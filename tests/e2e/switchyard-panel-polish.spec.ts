import type { Page } from '@playwright/test';
import { test, expect } from './switchyard-fixture';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Panel polish QA may not use a provider.');
  });
});

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByTestId('switchyard-panel')).toBeVisible();
}
async function turn(page: Page, piece: string, key: 'ArrowLeft' | 'ArrowRight') {
  await page.locator(`[data-piece="${piece}"]`).focus();
  await page.keyboard.press(key);
}
async function amberDraft(page: Page) {
  // P3's visible west-facing contact joins the two horizontal source-fed junctions.
  await turn(page, 'p3', 'ArrowLeft');
  await expect(page.getByTestId('switchyard-draft-prediction')).toHaveText('Draft connects Amber.');
}
async function apply(page: Page, revision: number) {
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveAttribute('data-revision', String(revision));
}

test('the dashed draft trace follows reciprocal contacts and breaks when the supply socket turns away', async ({ page }) => {
  await start(page);
  const reached = () => page.locator('[data-piece][data-connected="true"]').evaluateAll(pieces => pieces.map(piece => piece.getAttribute('data-piece')));
  expect(await reached()).toEqual(['p1', 'p2']);
  await expect(page.locator('.switchyard-piece .switchyard-draft-trace')).toHaveCount(2);
  await expect(page.locator('.switchyard-applied-layout .switchyard-draft-trace')).toHaveCount(0);
  await turn(page, 'p1', 'ArrowRight');
  await expect(page.locator('[data-piece="p1"]')).toHaveAttribute('aria-label', /Draft isolated from supply/);
  await expect(page.locator('.switchyard-draft-trace')).toHaveCount(0);
  expect(await reached()).toEqual([]);
  await expect(page.getByTestId('switchyard-draft-prediction')).toHaveText('Draft leaves all outputs isolated.');
  await turn(page, 'p1', 'ArrowLeft');
  await amberDraft(page);
  expect(await reached()).toEqual(['p1', 'p2', 'p3']);
  await expect(page.locator('.switchyard-piece .switchyard-draft-trace')).toHaveCount(3);
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await expect(page.locator('.switchyard-applied-layout li').nth(2)).toContainText('90°');
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveCount(0);
});

test('pending Apply has no success receipt or applied power until the actual acknowledgement arrives', async ({ page }) => {
  await start(page); await amberDraft(page);
  let release!: () => void; let entered!: () => void; let requests = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { entered = resolve; });
  await page.route('**/routing-panel', async route => { requests++; entered(); await held; await route.fallback(); });
  try {
    await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
    await requested;
    await expect(page.getByTestId('switchyard-panel-status')).toContainText('Waiting for the server');
    await expect(page.getByTestId('applied-amber')).toHaveText('Off');
    await expect(page.getByTestId('switchyard-apply-receipt')).toHaveCount(0);
    await expect(page.locator('[data-piece="p1"]')).toBeDisabled();
    expect(requests).toBe(1);
  } finally { release(); }
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveAttribute('data-revision', '1');
  await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('Amber switched on.');
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
  await expect(page.locator('.switchyard-applied-layout .switchyard-draft-trace')).toHaveCount(0);
  expect(requests).toBe(1);
});

test('acknowledged deltas stay historical during a new draft and distinguish power-off from a same-power reroute', async ({ page }) => {
  await start(page); await amberDraft(page); await apply(page, 1);
  await turn(page, 'p1', 'ArrowRight');
  await expect(page.getByTestId('switchyard-draft-prediction')).toHaveText('Draft leaves all outputs isolated.');
  await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('Last Apply · revision 1');
  await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('Amber switched on.');
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
  await apply(page, 2);
  await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('Amber switched off.');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await turn(page, 'p4', 'ArrowRight');
  await apply(page, 3);
  await expect(page.getByTestId('switchyard-apply-receipt')).toContainText('1 piece changed orientation; terminal power is unchanged.');
});

test('overload and rejected Apply explain the visible load rule and retain the draft without a false receipt', async ({ page }) => {
  await start(page);
  // This public six-piece example visibly reaches all three labelled terminals.
  for (const piece of ['p2', 'p2', 'p3', 'p3', 'p4', 'p6']) await turn(page, piece, 'ArrowRight');
  await expect(page.getByTestId('switchyard-draft-prediction')).toHaveText('Draft connects Amber + Blue + White.');
  await expect(page.locator('.switchyard-load')).toContainText('Amber + Blue + White use 3 loads; the supply supports 2');
  await expect(page.getByRole('button', { name: 'Apply routing', exact: true })).toBeDisabled();
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
  await amberDraft(page);
  let requests = 0;
  await page.route('**/routing-panel', async route => { requests++; await route.fulfill({ status: 409, json: { error: 'Fixture: routing was rejected without changing power.' } }); });
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.locator('.switchyard-panel-error')).toContainText('routing was rejected');
  await expect(page.getByTestId('switchyard-apply-receipt')).toHaveCount(0);
  await expect(page.getByTestId('draft-amber')).toHaveText('Connected');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await page.getByRole('button', { name: 'Undo turn', exact: true }).click();
  await expect(page.getByTestId('draft-amber')).toHaveText('Isolated');
  expect(requests).toBe(1);
});

test('OS and application reduced-motion choices retain static path feedback and keyboard operation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page); await amberDraft(page);
  for (const selector of ['.switchyard-draft-trace', '.switchyard-turn-feedback']) {
    expect(await page.locator(selector).first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  }
  await expect(page.locator('[data-piece="p3"]')).toBeFocused();
  expect(await page.locator('[data-piece="p3"]').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await apply(page, 1);
  expect(await page.getByTestId('switchyard-apply-receipt').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.settings-panel > summary').click();
  await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).check();
  await page.locator('.settings-panel > summary').click();
  await turn(page, 'p3', 'ArrowRight');
  expect(await page.locator('.switchyard-turn-feedback').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('.switchyard-draft-trace').first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.getByTestId('applied-amber')).toHaveText('Powered');
});
