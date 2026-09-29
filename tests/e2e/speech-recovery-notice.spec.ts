import { test, expect } from '@playwright/test';
import { fakeProvider, confirmLocalReadiness } from './fake-provider';

test('split speech cancels an old request with a recoverable notice and leaves fresh checks usable', async ({ page }) => {
  const provider = await fakeProvider(page);
  let toolRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/tools')) toolRequests++; });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice' }).click();
  await confirmLocalReadiness(page, 'Voice');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  // Constructed ordering from the recorded multi-segment Return request.
  // The original error body was not retained; this tests the safe local path.
  provider.emit({ type: 'input.speech.started' });
  provider.emit({ type: 'input.speech.stopped' });
  provider.emit({ type: 'reply.started', reply_id: 'first-segment-reply' });
  provider.emit({ type: 'input.speech.started' });
  provider.emit({ type: 'input.speech.stopped' });
  provider.emit({ type: 'tool.call', call_id: 'late-old-proposal', name: 'propose_interaction', arguments: { object: 'latch', action: 'latch_open' } });
  provider.emit({ type: 'reply.done', reply_id: 'first-segment-reply', status: 'completed' });
  await expect.poll(() => provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'late-old-proposal').length).toBe(1);
  const rejection = provider.sent.find(event => event.type === 'tool.result' && event.call_id === 'late-old-proposal')!;
  expect(JSON.parse(String(rejection.result)).code).toBe('cancelled_before_execution');
  expect(toolRequests).toBe(0);
  await expect(page.locator('.warning-banner')).toContainText('canceled before it executed');
  await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Power OFF', exact: true })).toBeEnabled();
  expect((await provider.audioState()).activeTracks).toBe(1);
  const checked = await provider.tool('observe_room', {}, 'fresh-check');
  expect(checked.ok).toBe(true);
  expect(toolRequests).toBe(1);
  await expect(page.locator('.warning-banner')).toHaveCount(0);
  await expect(page.getByTestId('action-proposal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(() => provider.activeSockets).toBe(0);
});
