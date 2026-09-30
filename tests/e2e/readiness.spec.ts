import { test, expect } from '@playwright/test';
import { fakeProvider } from './fake-provider';

test('local microphone check requires activation, closes its meter, and never requests a paid token', async ({ page }) => {
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
  expect((await provider.audioState()).captures).toBe(0);
  expect(provider.tokenRequests).toBe(0);
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await expect(page.getByRole('meter', { name: 'Local microphone level' })).toHaveAttribute('aria-valuenow', '20');
  expect((await provider.audioState()).activeTracks).toBe(1);
  expect(provider.tokenRequests).toBe(0);
  await page.getByRole('button', { name: 'Close connection check', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Check your connection' })).not.toBeVisible();
  const audio = await provider.audioState();
  expect(audio.activeTracks).toBe(0);
  expect(audio.closedContexts).toBe(audio.contexts);
  expect(provider.connections).toBe(0);
});

test('denied microphone gives a deliberate Text path and availability errors offer Practice', async ({ page }) => {
  const provider = await fakeProvider(page, { permissionDenied: true });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice', exact: true }).click();
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied');
  await expect(page.getByRole('button', { name: 'Retry microphone' })).toBeEnabled();
  await page.getByRole('button', { name: 'Use Live Text', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local microphone check' })).toHaveCount(0);
  await page.getByLabel('I will follow captions if sound is unavailable').check();
  expect(provider.connections).toBe(0);
  await page.getByRole('button', { name: 'Connect Live Text', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(1);
  expect((await provider.audioState()).activeTracks).toBe(0);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: false, message: 'The Live demo is busy. Try again later or choose Practice.' } }));
  await page.getByRole('button', { name: 'Resume Live Text' }).click();
  await expect(page.getByRole('dialog')).toContainText('The Live demo is busy');
  await expect(page.getByRole('button', { name: 'Connect Live Text', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Choose Practice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(1);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
});

test('demo code is exchanged outside the URL before an explicit Live connection', async ({ page }) => {
  const provider = await fakeProvider(page);
  let submitted = false;
  await page.route('**/api/access', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ code: 'offline-test-code' });
      expect(route.request().url()).not.toContain('offline-test-code');
      submitted = true;
    }
    await route.fulfill({ json: { liveEnabled: true, authorized: submitted, available: true, message: submitted ? 'Access granted.' : 'Enter the host’s demo code.' } });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
  await page.getByLabel('I will follow captions if sound is unavailable').check();
  await expect(page.getByRole('button', { name: 'Connect Live Text', exact: true })).toBeDisabled();
  await page.getByLabel('Demo access code').fill('offline-test-code');
  await page.getByRole('button', { name: 'Unlock Live', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect Live Text', exact: true })).toBeEnabled();
  expect(provider.tokenRequests).toBe(0);
  await page.getByRole('button', { name: 'Connect Live Text', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.tokenRequests).toBe(1);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
});

for (const selected of ['Voice', 'Text'] as const) {
  test(`a protected code for the other transport cannot connect Live ${selected}`, async ({ page }) => {
    const provider = await fakeProvider(page);
    const requestedMode = selected === 'Voice' ? 'voice' : 'text';
    const otherMode = selected === 'Voice' ? 'text' : 'voice';
    let corrected = false;
    await page.route('**/api/access', async route => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ code: 'offline-matching-code' });
        corrected = true;
      }
      await route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, maxSessionSeconds: 900,
        allowedMode: corrected ? requestedMode : otherMode, message: 'Access granted.' } });
    });
    let issuedMode: unknown;
    page.on('request', request => { if (request.url().endsWith('/voice-token')) issuedMode = request.postDataJSON().mode; });
    await page.goto('/');
    await page.getByRole('radio', { name: new RegExp(`Live ${selected}`) }).check();
    await page.getByRole('button', { name: `Start with ${selected}`, exact: true }).click();
    if (selected === 'Voice') await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
    await page.getByLabel('I will follow captions if sound is unavailable').check();
    await expect(page.getByRole('alert')).toContainText(`This access code allows Live ${selected === 'Voice' ? 'Text' : 'Voice'}`);
    await expect(page.getByRole('button', { name: `Connect Live ${selected}`, exact: true })).toBeDisabled();
    expect(provider.tokenRequests).toBe(0);
    expect(provider.connections).toBe(0);
    await page.getByLabel('Demo access code').fill('offline-matching-code');
    await page.getByRole('button', { name: 'Unlock Live', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: `Connect Live ${selected}`, exact: true }).click();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    expect(provider.tokenRequests).toBe(1);
    expect(issuedMode).toBe(requestedMode);
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  });
}

test('settings, privacy, and nonmodal history keep the call intentional and mission controls reachable', async ({ page }) => {
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.locator('.settings-panel > summary').click();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByRole('button', { name: 'Mute output', exact: true }).click();
  await page.locator('.settings-panel > summary').click();
  await page.locator('.about-panel > summary').click();
  await expect(page.locator('.about-panel')).toContainText('There is no durable autosave.');
  await expect(page.locator('.about-panel')).toContainText('does not save audio recordings');
  await page.locator('.about-panel > summary').click();
  expect(provider.tokenRequests).toBe(0);
  expect((await provider.audioState()).contexts).toBe(0);
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Conversation history', exact: true })).toBeVisible();
  await expect(page.locator('.history-message > p').first()).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.pip-portrait')).toBeInViewport();
  await expect(page.getByTestId('caption')).toBeInViewport();
  await expect(page.getByRole('tab', { name: /Route map/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeEnabled();
  await expect(page.locator('.history-message > p').first()).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('caption')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Resume Practice', exact: true })).toBeInViewport({ ratio: 1 });
  expect(provider.connections).toBe(0);
});

test('Gallery history has readable entries beside the map, current caption, portrait, and paused controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  const say = async (text: string) => {
    await page.getByLabel('Type a message').fill(text);
    const response = page.waitForResponse(value => value.url().endsWith('/tools'));
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    expect((await response).ok()).toBe(true);
    await expect(page.getByTestId('caption')).not.toHaveText(text);
    await confirmProposalForRequest(page, text);
  };
  await say('Inspect the latch');
  await say('Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say('Cross to the far side');
  await say('Where are you?');
  await expect(page.locator('.recap-notice')).toContainText('Checkpoint confirmed');
  await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  const visibleTogether = async (action: string) => {
    await expect(page.locator('.history-message > p').first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('caption')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.pip-portrait')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.connection-readout')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.gallery-map')).toBeInViewport();
    await expect(page.getByRole('button', { name: action, exact: true })).toBeInViewport({ ratio: 1 });
  };
  await visibleTogether('Pause mission');
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await visibleTogether('Resume Practice');
  if (test.info().project.name === 'chromium-1280') await page.screenshot({ path: 'test-results/goal-004-history-paused-practice-1280.png', animations: 'disabled' });
});
import { confirmProposalForRequest } from '../../scripts/qa-mission-player.mjs';
