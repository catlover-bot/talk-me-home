import { test, expect } from '@playwright/test';
import { fakeProvider } from './fake-provider';
import { sessionConfig } from '../../game/agent/config';

for (const beforeReady of [false, true]) for (const reportAccepted of [true, false]) test(`compiled protected release stops a refusal ${beforeReady ? 'before readiness' : 'after readiness'} and ${reportAccepted ? 'records a safe report' : 'explains an unrecorded stop'}`, async ({ page }, info) => {
  const provider = await fakeProvider(page, { readyOnUpdate: !beforeReady });
  let tokens = 0;
  const reports: unknown[] = [];
  await page.route('**/api/sessions/*/voice-token', async route => {
    tokens++;
    await route.fulfill({ json: { token: 'offline-fixture-only', sessionConfig, maxSessionSeconds: 900,
      allocation: { grantId: 'goal-007-release-2026-09-30' } } });
  });
  await page.route('**/api/sessions/*/live-refusal', async route => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({ status: reportAccepted ? 200 : 503, json: reportAccepted ? { stopped: true, source: 'client_report' } : { error: 'Constructed offline report failure.' } });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await page.getByLabel('I will follow captions if sound is unavailable').check();
  await page.getByRole('button', { name: 'Connect Live Voice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeVisible();
  await expect.poll(() => provider.connections).toBe(1);
  await expect.poll(() => provider.sent.some(event => event.type === 'session.update')).toBe(true);
  if (beforeReady) expect(provider.sent.some(event => event.type === 'input.audio')).toBe(false);
  else await expect(page.getByLabel('Type a message')).toBeEnabled();
  provider.emit({ type: 'session.error', code: 'account_mismatch', message: 'private-provider-test-detail' });
  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0]).toEqual({ roundId: expect.any(String), reason: 'provider_credential_or_account_refused' });
  // Enabled resume means the rejected startup promise and its finally handler settled.
  await expect(page.getByRole('button', { name: 'Resume Live Voice', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText('Contact the owner');
  if (!reportAccepted) await expect(page.getByText('The Live stop could not be recorded. Do not reconnect; contact the owner.')).toBeVisible();
  await expect.poll(() => provider.activeSockets).toBe(0);
  expect((await provider.audioState()).activeTracks).toBe(0);
  expect(provider.connections).toBe(1); expect(tokens).toBe(1);
  await expect(page.locator('body')).not.toContainText('private-provider-test-detail');
  await page.screenshot({ path: info.outputPath('protected-refusal.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Resume Live Voice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Check your connection' })).not.toBeVisible();
  expect(tokens).toBe(1);
  await page.reload();
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Live remains stopped');
  await expect(page.getByRole('dialog', { name: 'Check your connection' })).not.toBeVisible();
  expect(tokens).toBe(1);
  await page.getByRole('radio', { name: /Practice/ }).check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  expect(tokens).toBe(1);
});
