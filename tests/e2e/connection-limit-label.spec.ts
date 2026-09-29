import { test, expect } from '@playwright/test';
import { sessionConfig } from '../../game/agent/config';
import { fakeProvider, confirmLocalReadiness } from './fake-provider';

test('simulated connection label follows the current token limit and restores the public default on reconnect', async ({ page }) => {
  const provider = await fakeProvider(page);
  let maxSessionSeconds: number | undefined = 900;
  await page.route('**/api/sessions/*/voice-token', route => route.fulfill({ json: {
    token: 'offline-fixture-only', sessionConfig, ...(maxSessionSeconds === undefined ? {} : { maxSessionSeconds }),
  } }));
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text' }).click();
  await expect(page.locator('.readiness-footnote')).toContainText('a time limit shown during the call');
  await expect(page.locator('.readiness-footnote')).not.toContainText('10-minute');
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.locator('.call-time')).toContainText('15-minute limit');
  for (const next of [600, undefined]) {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume Live Text', exact: true })).toBeEnabled();
    maxSessionSeconds = next;
    await page.getByRole('button', { name: 'Resume Live Text', exact: true }).click();
    await confirmLocalReadiness(page);
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    await expect(page.locator('.call-time')).toContainText('10-minute limit');
    await expect(page.locator('.call-time')).not.toContainText('15-minute');
  }
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(() => provider.ended).toBe(3);
  expect(provider.activeSockets).toBe(0);
  expect(provider.connections).toBe(3);
});
