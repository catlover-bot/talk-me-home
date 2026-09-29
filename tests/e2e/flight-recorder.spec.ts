import type { Page } from '@playwright/test';
import type { ToolResponse } from '../../game/shared/contracts';
import { test, expect } from './rescue-fixture';
import { confirmProposalForRequest, confirmVisibleProposal } from '../../scripts/qa-mission-player.mjs';

test.use({ compiledProduction: true });
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Recorder Practice may not contact a provider.');
  });
});
async function say(page: Page, text: string, confirm = true) {
  await page.getByLabel('Type a message').fill(text);
  const response = page.waitForResponse(r => r.url().endsWith('/tools'));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  let result = await (await response).json() as ToolResponse;
  if (result.code === 'awaiting_confirmation' && confirm) {
    const decision = page.waitForResponse(r => r.url().endsWith('/proposal-decision'));
    if (text === 'Pick up the flight recorder') await confirmVisibleProposal(page, 'Secure the flight recorder', text);
    else await confirmProposalForRequest(page, text);
    result = await (await decision).json() as ToolResponse;
  }
  expect(result.ok).toBe(true);
  await expect(page.getByTestId('caption')).not.toHaveText(text);
  return result;
}
async function relay(page: Page, name: string) {
  const button = page.getByRole('button', { name: `Relay ${name}`, exact: true });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);
}
async function start(page: Page) {
  await page.goto('/');
  const choice = page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true });
  await expect(choice).not.toBeChecked(); await choice.check();
  await page.getByRole('radio', { name: /Training/ }).check();
  await expect(choice).toHaveCount(0);
  await page.getByRole('radio', { name: /Rescue Mission/ }).check();
  await expect(choice).not.toBeChecked(); await choice.check();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await say(page, 'Look around'); await say(page, 'Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say(page, 'Cross to the far side'); await relay(page, 'Beacon'); await say(page, 'Go through the east gate');
  await expect(page.getByText('Archive', { exact: true })).toBeVisible();
}
async function finish(page: Page) {
  await say(page, 'Look around'); await say(page, 'Hold the contact');
  await page.getByRole('button', { name: 'Charge', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
  await say(page, 'Release the contact'); await say(page, 'Board the capsule');
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await say(page, 'Confirm return');
  await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
}

for (const configuration of ['a','b'] as const) test.describe(`recorder layout ${configuration}`, () => {
  test.use({ galleryConfiguration: configuration });
  test('an optional observed pickup survives decline, exact confirmation and route recovery, then resets off', async ({ page, rescueServer }) => {
    await start(page); await say(page, 'Go through the southeast gate');
    await say(page, 'Inspect the flight recorder');
    await expect(page.getByTestId('caption')).toContainText('Pip / flight notes');
    const before = rescueServer.commits.length;
    const proposal = await say(page, 'Pick up the flight recorder', false);
    expect(proposal.view.recoveredFlightRecorder).toBeUndefined();
    expect(rescueServer.commits.length).toBe(before);
    await page.getByRole('button', { name: 'Not yet', exact: true }).click();
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
    expect(rescueServer.commits.length).toBe(before);
    const pickup = await say(page, 'Pick up the flight recorder');
    expect(rescueServer.commits.length).toBe(before+1);
    expect(pickup.view.recoveredFlightRecorder).toBeUndefined();
    await expect(page.locator('.homecoming-recorder')).toHaveCount(0);
    await say(page, 'Inspect the northeast gate');
    const report = await page.getByTestId('caption').innerText();
    if (/blocked|cargo blocks/i.test(report)) {
      await relay(page, 'Beacon'); await say(page, 'Go through the northwest gate');
      await relay(page, 'Harbor'); await say(page, 'Go through the northeast gate');
      await say(page, 'Inspect the southeast gate'); await relay(page, 'Beacon'); await say(page, 'Go through the southeast gate');
    } else { await relay(page, 'Harbor'); await say(page, 'Go through the northeast gate'); }
    const committedBeforeQuestion = rescueServer.commits.length;
    await page.getByLabel('Type a message').fill('Do you still have the flight recorder?');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByTestId('caption')).toContainText('have the flight recorder secured');
    expect(rescueServer.commits.length).toBe(committedBeforeQuestion);
    await finish(page);
    await expect(page.locator('.homecoming-recorder')).toHaveCount(1);
    await expect(page.getByTestId('home-story')).toContainText('flight recorder you chose');
    await page.getByRole('button', { name: 'Start another rescue', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Bring back the flight recorder', exact: true })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeVisible();
  });
  test('selected objective may be left behind and home remains a full success', async ({ page }) => {
    await start(page);
    // A player may choose the upper route from the atlas; follow the communicated passage report.
    await relay(page, 'Harbor'); await say(page, 'Go through the northeast gate');
    await say(page, 'Inspect the southeast gate');
    const report = await page.getByTestId('caption').innerText();
    if (/blocked|cargo blocks/i.test(report)) {
      await relay(page, 'Harbor'); await say(page, 'Go through the southwest gate');
      await relay(page, 'Beacon'); await say(page, 'Go through the southeast gate');
      await say(page, 'Inspect the northeast gate'); await relay(page, 'Harbor'); await say(page, 'Go through the northeast gate');
    } else { await relay(page, 'Beacon'); await say(page, 'Go through the southeast gate'); }
    await finish(page);
    await expect(page.locator('.homecoming-recorder')).toHaveCount(0);
    await expect(page.getByTestId('home-story')).toContainText('A safe arrival. That was always enough.');
    await expect(page.getByTestId('home-story')).not.toContainText('failed');
  });
});
