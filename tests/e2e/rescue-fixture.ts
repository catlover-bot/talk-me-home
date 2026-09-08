import { test as base, expect } from '@playwright/test';
import { createGameServer } from '../../game/server/http';
import { SessionStore } from '../../game/server/sessions';
import type { GalleryConfiguration } from '../../game/server/gallery';

/** A private per-test server chooses the authored fixture; production routes cannot. */
export const test = base.extend<{
  galleryConfiguration: GalleryConfiguration;
  rescueServer: { store: SessionStore; origin: string };
}>({
  galleryConfiguration: ['a', { option: true }],
  rescueServer: [async ({ page, galleryConfiguration }, use) => {
    const store = new SessionStore({ galleryConfiguration });
    const server = createGameServer({ store, apiKey: '' });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The offline fixture server did not obtain a port.');
    const origin = `http://127.0.0.1:${address.port}`;
    await page.route('**/api/**', async route => {
      const source = new URL(route.request().url());
      const response = await route.fetch({ url: origin + source.pathname + source.search });
      await route.fulfill({ response });
    });
    try { await use({ store, origin }); }
    finally {
      try {
        // Drain callbacks before Playwright disposes their fetched responses and context.
        await page.unrouteAll({ behavior: 'wait' });
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          const limit = setTimeout(() => reject(new Error('The offline fixture server did not close.')), 5000);
          server.close(error => { clearTimeout(limit); error ? reject(error) : resolve(); });
        });
      }
    }
  }, { auto: true }],
});
export { expect };
