import { defineConfig } from '@playwright/test';

const browserChannel = process.env.GAME_QA_BROWSER_CHANNEL;
if (browserChannel && browserChannel !== 'chrome') throw new Error('The optional QA browser channel must be chrome.');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  timeout: 20_000,
  globalTimeout: 180_000,
  workers: process.env.CI ? 2 : 4,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', channel: browserChannel, trace: 'off', screenshot: 'only-on-failure', launchOptions: { chromiumSandbox: true } },
  projects: [
    { name: 'chromium-1280', use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } } },
    { name: 'chromium-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build:game && npm run start:game',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { PORT: '5173', GAME_ORIGIN: 'http://127.0.0.1:5173', GAME_BIND_ADDRESS: '127.0.0.1', GAME_DISABLE_LIVE: '1', ASSEMBLYAI_API_KEY: '' },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
