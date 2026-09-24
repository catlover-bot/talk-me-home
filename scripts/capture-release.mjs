// Curated actual production UI captures. Practice only; never obtains a provider token.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const baseURL = process.env.CAPTURE_ORIGIN ?? 'http://127.0.0.1:4180';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) throw new Error('Capture requires a local production service.');
const directory = 'submission/assets';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const measurements = [];
try {
  for (const [width, height] of [[1280, 720], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    await page.route(/assemblyai\.com|\/voice-token(?:\?|$)/, route => { throw new Error('Provider access forbidden in release capture: ' + new URL(route.request().url()).pathname); });
    const capture = async name => {
      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.locator('body')).toBeVisible();
      await page.screenshot({ path: `${directory}/${name}-${width}.png`, animations: 'disabled' });
      measurements.push({ name, width, height, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    };
    const say = async text => {
      await page.getByLabel('Type a message').fill(text);
      const response = page.waitForResponse(response => response.url().endsWith('/tools'));
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      const result = await (await response).json();
      await expect(page.getByTestId('caption')).not.toHaveText(text);
      return result;
    };
    const relay = async name => {
      const button = page.getByRole('button', { name: 'Relay ' + name, exact: true });
      if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
      await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);
    };
    await page.goto(baseURL);
    await capture('title');
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await say('Look around');
    await capture('cargo-practice');
    await say('Inspect the latch'); await say('Keep the door open');
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
    await say('Cross to the far side'); await say('Where are you?');
    await relay('Beacon'); await say('Go through the east gate'); await say('Where are you?');
    await capture('gallery-practice');
    if (width === 1280) {
      await page.getByRole('button', { name: 'Open transcript history' }).click();
      await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
      await capture('history-paused-practice');
      await page.getByRole('button', { name: 'Close history' }).click();
      await page.getByRole('button', { name: 'Resume Practice', exact: true }).click();
      await expect(page.getByLabel('Type a message')).toBeEnabled();
    }
    await say('Go through the southeast gate');
    const inspection = await say('Inspect the northeast gate');
    // Follow the actual communicated observation for either fixed authored configuration.
    if (/Cargo blocks/i.test(inspection.message)) {
      await relay('Beacon'); await say('Go through the northwest gate');
      await relay('Harbor'); await say('Go through the northeast gate');
      await say('Inspect the southeast gate'); await relay('Beacon'); await say('Go through the southeast gate');
    } else { await relay('Harbor'); await say('Go through the northeast gate'); }
    await say('Look around'); await say('Inspect the contact'); await say('Hold the contact');
    await page.getByRole('button', { name: 'Charge', exact: true }).click();
    await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
    await say('Release the contact'); await say('Board the capsule');
    await capture('dock-practice');
    await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
    await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
    await say('Confirm return');
    await expect(page.getByRole('heading', { name: 'You brought Pip home.' })).toBeVisible();
    await capture('homecoming-practice');
    await page.close();
  }
  writeFileSync('.validation/release-captures.json', JSON.stringify({ environment: 'WSL Ubuntu 24.04, headless Chromium, local production Node service, typed deterministic Practice, reduced motion', captures: measurements }, null, 2));
} finally { await browser.close(); }
