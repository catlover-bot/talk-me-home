import { test as base, expect } from '@playwright/test';
import { createGameServer } from '../../game/server/http';
import { SessionStore } from '../../game/server/sessions';
import type { GalleryConfiguration } from '../../game/server/gallery';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** A private per-test server chooses the authored fixture; production routes cannot. */
export const test = base.extend<{
  galleryConfiguration: GalleryConfiguration;
  compiledProduction: boolean;
  rescueServer: { store: SessionStore; origin: string; compiledProduction: boolean; commits: Array<{ proposalId: string; revisionBefore: number; revisionAfter: number }> };
}>({
  galleryConfiguration: ['a', { option: true }],
  compiledProduction: [false, { option: true }],
  rescueServer: [async ({ page, galleryConfiguration, compiledProduction, baseURL }, use) => {
    if (!baseURL) throw new Error('The offline fixture requires an explicit browser base URL.');
    const browserOrigin = new URL(baseURL).origin;
    // Evaluator-only physical commit journal. It is never passed to the player.
    const commits: Array<{ proposalId: string; revisionBefore: number; revisionAfter: number }> = [];
    const Store: typeof SessionStore = compiledProduction ? (await import(pathToFileURL(resolve('dist/server/server/sessions.js')).href)).SessionStore : SessionStore;
    const createServer: typeof createGameServer = compiledProduction ? (await import(pathToFileURL(resolve('dist/server/server/http.js')).href)).createGameServer : createGameServer;
    const store = new Store({ galleryConfiguration, onRobotCommit: event => commits.push(event) });
    // These are the production entry point's HTTP/static/cookie settings. Only
    // this isolated offline fixture injects the authored profile and commit oracle.
    // Both fixture modes accept only the configured browser origin, including
    // isolated QA ports; they must not fall back to the development port.
    const server = createServer({ store, apiKey: '', allowedOrigins: [browserOrigin], ...(compiledProduction ? { production: true, staticDirectory: resolve('dist/client'), secureCookies: false } : {}) });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The offline fixture server did not obtain a port.');
    const origin = `http://127.0.0.1:${address.port}`;
    await page.route('**/api/**', async route => {
      const source = new URL(route.request().url());
      // Keep the browser's actual origin/Host pair through this loopback proxy,
      // so the production Host/Origin checks run unchanged on the isolated port.
      const response = await route.fetch({ url: origin + source.pathname + source.search,
        ...(compiledProduction ? { headers: { ...route.request().headers(), host: source.host } } : {}) });
      await route.fulfill({ response });
    });
    try { await use({ store, origin, compiledProduction, commits }); }
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
