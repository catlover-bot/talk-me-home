import type { Page } from '@playwright/test';
import { previewSwitchyardRouting, type SwitchyardTerminal } from '../../game/shared/switchyard';
import { test, expect } from './switchyard-fixture';

// These cases use the compiled production client and the existing constructor-only installation fixture.
test.use({ switchyardConfiguration: 'a' });

const intents = (page: Page) => page.getByRole('region', { name: 'Local companion requests' });
async function ask(page: Page, label: string, physical = false) {
  const received = page.waitForResponse(response => response.url().endsWith('/tools') && response.request().method() === 'POST');
  await intents(page).getByRole('button', { name: label, exact: true }).click();
  const result = await (await received).json();
  expect(result.ok).toBe(true);
  if (physical) {
    await expect(page.getByTestId('proposal-label')).toHaveText(label);
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
  } else {
    const lead = result.message.split('. ')[0].replace(/^You are\b/, 'I am');
    await expect(page.getByTestId('caption')).toContainText(lead);
  }
  return result;
}
async function confirm(page: Page) {
  const received = page.waitForResponse(response => response.url().endsWith('/proposal-decision'));
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  const result = await (await received).json();
  expect(result.ok).toBe(true);
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  return result;
}
async function move(page: Page, label: string) { await ask(page, label, true); return confirm(page); }
async function lift(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await ask(page, 'Look around');
  await move(page, 'Go to Transfer Table'); await move(page, 'Go to Lift Station');
  await ask(page, 'Inspect Lift console');
  await expect(page.getByTestId('caption')).toContainText('plate reads Crescent');
  await page.getByRole('tab', { name: 'Lift plates', exact: true }).click();
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-visit-status', 'current');
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-reading-status', 'current');
  await expect(page.getByTestId('switchyard-reference-quote')).toContainText('Crescent');
}
async function draft(page: Page, terminals: SwitchyardTerminal[]) {
  // The fixture searches only the public panel geometry. No robot policy or hidden installation is an input.
  let rotations: number[] | undefined;
  for (let value = 0; value < 4096; value++) {
    const candidate = Array.from({ length: 6 }, (_, index) => (value >> index * 2) & 3);
    const preview = previewSwitchyardRouting(candidate);
    if (preview.valid && preview.poweredTerminals.length === terminals.length && terminals.every(terminal => preview.poweredTerminals.includes(terminal))) { rotations = candidate; break; }
  }
  if (!rotations) throw new Error('The public target layout is unavailable.');
  for (const [index, rotation] of rotations.entries()) {
    const piece = page.locator(`[data-piece="p${index + 1}"]`);
    const current = Number(await piece.getAttribute('data-rotation'));
    for (let turn = 0; turn < (rotation - current + 4) % 4; turn++) await piece.click();
  }
}
async function apply(page: Page) {
  const received = page.waitForResponse(response => response.url().endsWith('/routing-panel'));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  expect((await received).status()).toBe(200);
  await expect(page.getByTestId('applied-blue')).toHaveText('Powered');
}

test('acknowledged routing retains inspected intents while invalidating only the old exact proposal', async ({ page, switchyardServer }) => {
  const calls: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/tools')) calls.push(request.postDataJSON().name); });
  await lift(page);
  const quoteId = await page.getByTestId('switchyard-reference-quote').getAttribute('data-message-id');
  await ask(page, 'Set index one', true); await confirm(page);
  const pending = await ask(page, 'Test the lift', true);
  const before = switchyardServer.commits.length;
  const observations = calls.filter(name => name === 'observe_room').length;
  await draft(page, ['blue']); await apply(page);
  await expect(page.getByTestId('switchyard-reference-quote')).toHaveAttribute('data-message-id', quoteId!);
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-visit-status', 'current');
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-reading-status', 'historical');
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'invalidated');
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toBeVisible();
  const replacement = await ask(page, 'Test the lift', true);
  expect(replacement.proposal.id).not.toBe(pending.proposal.id);
  expect(switchyardServer.commits.length).toBe(before);
  await confirm(page);
  expect(switchyardServer.commits.length).toBe(before + 1);
  expect(calls.filter(name => name === 'observe_room').length).toBe(observations);
  await expect(page.getByTestId('caption')).toContainText('lift self-test passed');
});

test('a rejected Apply preserves current visit choices and a later acknowledged Apply requires no re-survey', async ({ page }) => {
  await lift(page);
  const quoteId = await page.getByTestId('switchyard-reference-quote').getAttribute('data-message-id');
  await draft(page, ['blue']);
  // Explicit transport rejection: it changes no server state and is not claimed as a natural puzzle event.
  await page.route('**/routing-panel', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Controlled routing rejection for retained-knowledge verification.' }) }));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Controlled routing rejection');
  await expect(page.getByTestId('applied-blue')).toHaveText('Off');
  await expect(page.getByTestId('switchyard-reference-quote')).toHaveAttribute('data-message-id', quoteId!);
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-reading-status', 'current');
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toBeVisible();
  await page.unroute('**/routing-panel');
  await apply(page);
  await expect(intents(page).getByRole('button', { name: 'Inspect Lift console', exact: true })).toBeVisible();
  await ask(page, 'Test the lift', true);
  // A known control is not a readiness promise: its wrong/unset index still fails safely at exact confirmation.
  const received = page.waitForResponse(response => response.url().endsWith('/proposal-decision'));
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  expect((await (await received).json()).code).toBe('precondition_failed');
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'failed');
});

test('Pause and a changed visit still revoke current intent admission without losing historical reports', async ({ page }) => {
  await lift(page);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
  await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-visit-status', 'earlier');
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
  await expect(intents(page).getByRole('button', { name: 'Look around', exact: true })).toBeEnabled();
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toHaveCount(0);
  await ask(page, 'Look around');
  await move(page, 'Return to Transfer Table');
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toHaveCount(0);
  await move(page, 'Go to Lift Station');
  await expect(intents(page).getByRole('button', { name: 'Inspect Lift console', exact: true })).toBeVisible();
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toHaveCount(0);
  await ask(page, 'Inspect Lift console');
  await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toBeVisible();
});

test('a delayed pre-Apply report remains historical and cannot overwrite newer report context', async ({ page }) => {
  let release!: () => void; let reportReceived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { reportReceived = resolve; });
  await page.exposeFunction('holdSwitchyardReportForTest', async () => { reportReceived(); await held; });
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const host = window as typeof window & { holdNextSwitchyardReport?: boolean; holdSwitchyardReportForTest(): Promise<void> };
    window.fetch = async (...args) => {
      const response = await original(...args);
      const path = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (host.holdNextSwitchyardReport && path.endsWith('/tools')) {
        host.holdNextSwitchyardReport = false;
        await host.holdSwitchyardReportForTest();
      }
      return response;
    };
  });
  try {
    await lift(page);
    const quoteId = await page.getByTestId('switchyard-reference-quote').getAttribute('data-message-id');
    await page.evaluate(() => { (window as typeof window & { holdNextSwitchyardReport: boolean }).holdNextSwitchyardReport = true; });
    await intents(page).getByRole('button', { name: 'Inspect Lift console', exact: true }).click();
    await received;
    await draft(page, ['blue']); await apply(page);
    release();
    await expect(page.getByTestId('caption')).toContainText('Historical local report, not a current reading.');
    await expect(page.getByTestId('switchyard-reference-quote')).toHaveAttribute('data-message-id', quoteId!);
    await expect(page.getByTestId('switchyard-report-reference')).toHaveAttribute('data-reading-status', 'historical');
    await expect(page.getByTestId('applied-blue')).toHaveText('Powered');
    await expect(intents(page).getByRole('button', { name: 'Test the lift', exact: true })).toBeVisible();
  } finally { release(); }
});

test('successful and failed local captions retain their words and age after Apply without another survey', async ({ page }) => {
  const calls: string[] = []; const savedMessages: Record<string, unknown>[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/tools')) calls.push(request.postDataJSON().name);
    if (request.url().endsWith('/messages')) savedMessages.push(request.postDataJSON());
  });
  await lift(page);
  // The successful inspection is saved before Apply; its provenance must survive that save too.
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  const original = await page.getByTestId('caption').innerText();
  const observations = calls.filter(name => name === 'observe_room').length;
  await expect(page.getByTestId('switchyard-caption-age')).toHaveCount(0);
  await draft(page, ['blue']); await apply(page);
  await expect(page.getByTestId('caption')).toHaveText(original);
  await expect(page.getByTestId('switchyard-caption-age')).toHaveText('Panel changed since this message. Readings may be out of date; stable labels are retained.');
  await expect(page.locator('.caption-speaker')).toContainText('Pip');
  await expect(page.locator('.caption-speaker')).toContainText('Practice');
  await ask(page, 'Test the lift', true);
  const decision = page.waitForResponse(response => response.url().endsWith('/proposal-decision'));
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  expect((await (await decision).json()).code).toBe('precondition_failed');
  await expect(page.getByTestId('caption')).toContainText('test gauge did not align');
  await expect(page.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  const failed = await page.getByTestId('caption').innerText();
  await expect(page.getByTestId('switchyard-caption-age')).toHaveCount(0);
  await draft(page, []);
  const applied = page.waitForResponse(response => response.url().endsWith('/routing-panel'));
  await page.getByRole('button', { name: 'Apply routing', exact: true }).click();
  expect((await applied).status()).toBe(200);
  await expect(page.getByTestId('applied-blue')).toHaveText('Off');
  await expect(page.getByTestId('caption')).toHaveText(failed);
  await expect(page.getByTestId('switchyard-caption-age')).toContainText('Readings may be out of date');
  await expect(intents(page).getByRole('button', { name: 'Set index one', exact: true })).toBeVisible();
  expect(calls.filter(name => name === 'observe_room').length).toBe(observations);
  expect(savedMessages.length).toBeGreaterThan(0);
  for (const message of savedMessages) {
    expect(message).not.toHaveProperty('switchyardContext');
    expect(message).not.toHaveProperty('switchyardPanelRevisionAtDisplay');
  }
});
