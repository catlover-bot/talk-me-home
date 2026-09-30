import { test, expect } from './switchyard-fixture';

test('private route revision preserves draft, acknowledged power and exact pending action without communicating the plan', async ({ page, switchyardServer }) => {
  const writes: string[] = [];
  page.on('request', request => {
    if (/assemblyai\.com|voice-token/.test(request.url())) throw new Error('Practice cannot request a provider.');
    if (request.method() === 'POST') writes.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /^The Switchyard/ }).check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  const choices = page.getByRole('region', { name: 'Local companion requests' });
  await choices.getByRole('button', { name: 'Look around', exact: true }).click();
  await choices.getByRole('button', { name: 'Go to Transfer Table', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toBeEnabled();
  const proposal = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
  const plan = page.getByRole('group', { name: 'My intended approach' });
  await plan.getByRole('radio', { name: 'Direct lift', exact: true }).check();
  await page.locator('[data-piece=p1]').press('ArrowRight');
  const before = writes.length;
  await plan.getByRole('radio', { name: 'Maintenance bypass', exact: true }).check();
  await expect(page.locator('.switchyard-plan-revision')).toContainText('Your draft is kept for review');
  await expect(page.locator('[data-piece=p1]')).toHaveAttribute('data-rotation', '1');
  await expect(page.getByTestId('applied-amber')).toHaveText('Off');
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', proposal!);
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
  expect(writes.length).toBe(before);
  expect(switchyardServer.commits).toHaveLength(0);
  await page.getByRole('button', { name: 'Undo turn', exact: true }).click();
  await expect(page.locator('[data-piece=p1]')).toHaveAttribute('data-rotation', '0');
  await page.getByRole('button', { name: 'Not yet', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
  await choices.getByRole('button', { name: 'Go to Transfer Table', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).not.toHaveAttribute('data-proposal-id', proposal!);
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
  expect(switchyardServer.commits).toHaveLength(1);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(plan.getByRole('radio', { name: 'Maintenance bypass', exact: true })).toBeChecked();
});

test('route overview keeps uncertainty and both manual rows, with usable keyboard planning at narrow width and enlarged layout', async ({ page }) => {
  await page.goto('/');await page.getByRole('radio', { name: /^The Switchyard/ }).check();await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.locator('.switchyard-route-choices')).toContainText('Less travel');
  await expect(page.locator('.switchyard-route-choices')).toContainText('More travel');
  await expect(page.locator('.switchyard-uncertainty')).toContainText('unknown until Pip reports');
  for (const enlarged of [false, true]) {
    await page.setViewportSize(enlarged ? { width: 1280, height: 900 } : { width: 390, height: 844 });
    await page.evaluate(zoom => { document.body.style.zoom = zoom; }, enlarged ? '2' : '1');
    const plan = page.getByRole('group', { name: 'My intended approach' });
    const undecided = plan.getByRole('radio', { name: 'Undecided', exact: true });await undecided.check();await undecided.focus();await page.keyboard.press('ArrowRight');
    await expect(plan.getByRole('radio', { name: 'Direct lift', exact: true })).toBeChecked();
    const tab = page.getByRole('tab', { name: 'Site plan', exact: true });await tab.click();await tab.focus();await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Lift plates', exact: true })).toBeFocused();
    await expect(page.getByTestId('switchyard-report-reference')).toContainText('No plate report yet');
    await expect(page.getByRole('rowheader', { name: 'Crescent', exact: true })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'Kite', exact: true })).toBeVisible();
    await page.locator('[data-piece=p1]').press('ArrowRight');await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
    await expect(page.locator('[data-piece=p1]')).toHaveAttribute('data-rotation', '0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
