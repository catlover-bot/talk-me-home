import { test, expect } from '@playwright/test';
import { fakeProvider, confirmLocalReadiness } from './fake-provider';

for (const kind of ['Text', 'Voice'] as const) {
  test(`offline readiness helper waits for the actual ${kind} connection after local checks`, async ({ page }) => {
    const provider = await fakeProvider(page, { readyOnUpdate: false });
    await page.goto('/');
    await page.getByRole('radio', { name: new RegExp(`Live ${kind}`) }).check();
    await page.getByRole('button', { name: `Start with ${kind}`, exact: true }).click();
    let completed = false; let released = false;
    const connecting = confirmLocalReadiness(page, kind).then(() => { completed = true; });
    void connecting.catch(() => {}); // Cleanup below always observes a rejected startup.
    try {
      await provider.waitForSent(event => event.type === 'session.update');
      await expect(page.getByLabel('Type a message', { exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeEnabled();
      expect(completed, 'Local checks and Connect do not establish session readiness.').toBe(false);
      expect(provider.connections).toBe(1);
      provider.emit({ type: 'session.ready' }); released = true;
      await connecting;
      expect(completed).toBe(true);
      await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
      expect(provider.tokenRequests).toBe(1);
    } finally {
      if (!released && provider.connections) provider.emit({ type: 'session.ready' });
      await connecting.catch(() => {});
      if (await page.getByRole('button', { name: 'Pause / End call', exact: true }).count()) {
        await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
      }
      await expect.poll(() => provider.activeSockets).toBe(0);
    }
  });
}
