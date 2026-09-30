import { test as base, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SessionStore } from '../../game/server/sessions';
import type { createGameServer } from '../../game/server/http';

/** Compiled production routes; only this private constructor selects a fixture. */
export const test = base.extend<{
  switchyardConfiguration: 'a' | 'b';
  switchyardServer: { commits: Array<{ proposalId: string; revisionBefore: number; revisionAfter: number }> };
}>({
  switchyardConfiguration: ['a', { option: true }],
  switchyardServer: [async ({ page, switchyardConfiguration, baseURL }, use) => {
    if (!baseURL) throw new Error('Switchyard QA requires a loopback browser origin.');
    const browserOrigin = new URL(baseURL).origin;
    const Store: typeof SessionStore = (await import(pathToFileURL(resolve('dist/server/server/sessions.js')).href)).SessionStore;
    const createServer: typeof createGameServer = (await import(pathToFileURL(resolve('dist/server/server/http.js')).href)).createGameServer;
    // Evaluator only: never given to a route/navigation helper or companion.
    const commits: Array<{ proposalId: string; revisionBefore: number; revisionAfter: number }> = [];
    const store = new Store({ switchyardConfiguration, onRobotCommit: event => commits.push(event) });
    const server = createServer({ store, apiKey: '', allowedOrigins: [browserOrigin], production: true,
      staticDirectory: resolve('dist/client'), secureCookies: false });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The private Switchyard fixture did not obtain a port.');
    const origin = `http://127.0.0.1:${address.port}`;
    await page.route('**/api/**', async route => {
      const source = new URL(route.request().url());
      const response = await route.fetch({ url: origin + source.pathname + source.search,
        headers: { ...route.request().headers(), host: source.host } });
      await route.fulfill({ response });
    });
    try { await use({ commits }); }
    finally {
      try { await page.unrouteAll({ behavior: 'wait' }); }
      finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          const limit = setTimeout(() => reject(new Error('The Switchyard fixture did not close.')), 5000);
          server.close(error => { clearTimeout(limit); error ? reject(error) : resolve(); });
        });
      }
    }
  }, { auto: true }],
});
export { expect };
