import type { Page, Route } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { confirmLocalReadiness, fakeProvider } from './fake-provider';
import { confirmVisibleProposal } from '../../scripts/qa-mission-player.mjs';

test.use({ compiledProduction: true });

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

// Preserve the fixture's production Host/Origin checks for delayed real responses.
function fetchFixture(route: Route, origin: string) {
  const source = new URL(route.request().url());
  return route.fetch({ url: origin + source.pathname + source.search,
    headers: { ...route.request().headers(), host: source.host } });
}

async function practiceLatch(page: Page) {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  const savedProposal = page.waitForResponse(async response => response.url().includes('/record?')
    && (await response.json()).messages.some((message: { text: string }) => message.text === 'I propose: Engage the Latch.'));
  for (const message of ['Look around', 'Keep the door open']) {
    const response = page.waitForResponse(value => value.url().endsWith('/tools'));
    await page.getByLabel('Type a message').fill(message);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await response;
  }
  await expect(page.getByTestId('caption')).toHaveText('I propose: Engage the Latch.');
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
  // Finish the proposal transcript's own persistence read before faulting the decision's read.
  await savedProposal;
}

test('authoritative confirmation settles the shared player while auxiliary history is still held', async ({ page, rescueServer }) => {
  await practiceLatch(page);
  const history = gate(); let held = false; let decisions = 0;
  page.on('request', request => { if (request.url().endsWith('/proposal-decision')) decisions++; });
  await page.route('**/api/sessions/*/record?roundId=*', async route => {
    const response = await fetchFixture(route, rescueServer.origin);
    held = true; await history.promise; await route.fulfill({ response });
  });
  try {
    const receipt = await confirmVisibleProposal(page, 'Engage the Latch', 'Please engage the Latch.');
    await expect.poll(() => held).toBe(true);
    expect(receipt.status).toBe('committed');
    await expect(page.getByTestId('caption')).toHaveText('Engage the Latch: completed after your confirmation.');
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', receipt.proposalId);
    expect(rescueServer.commits.map(commit => commit.proposalId)).toEqual([receipt.proposalId]);
    expect(decisions).toBe(1);
    history.release();
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).toHaveCount(0);
  } finally { history.release(); }
});

for (const restart of [false, true]) {
  test(`failed auxiliary history ${restart ? 'cannot report an old error after Restart' : 'does not make a committed decision uncertain or trigger decision recovery'}`, async ({ page, rescueServer }) => {
    await practiceLatch(page);
    const history = gate(); let held = false; let sessionReads = 0; let decisions = 0;
    page.on('request', request => {
      if (/\/api\/sessions\/[^/?]+$/.test(request.url()) && request.method() === 'GET') sessionReads++;
      if (request.url().endsWith('/proposal-decision')) decisions++;
    });
    await page.route('**/api/sessions/*/record?roundId=*', async route => {
      if (held) return route.fallback();
      held = true; await history.promise;
      await route.fulfill({ status: 503, json: { error: 'Conversation history is temporarily unavailable.' } });
    });
    try {
      const receipt = await confirmVisibleProposal(page, 'Engage the Latch', 'Please engage the Latch.');
      await expect.poll(() => held).toBe(true);
      const response = page.waitForResponse(value => value.url().includes('/record?') && value.status() === 503);
      if (restart) {
        await page.getByRole('button', { name: 'Restart', exact: true }).click();
        await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Start Practice', exact: true })).toBeEnabled();
      }
      history.release(); await response;
      if (restart) {
        await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
        await expect(page.getByLabel('Type a message')).toBeEnabled();
        await expect(page.getByTestId('action-proposal')).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);
      } else {
        await expect(page.getByRole('alert')).toContainText('Conversation history is temporarily unavailable.');
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', receipt.proposalId);
        await expect(page.getByTestId('caption')).toHaveText('Engage the Latch: completed after your confirmation.');
      }
      expect(sessionReads).toBe(0); expect(decisions).toBe(1);
      expect(rescueServer.commits.map(commit => commit.proposalId)).toEqual([receipt.proposalId]);
    } finally { history.release(); }
  });
}

test('injected Text input is released after its exact decision receipt without waiting for history', async ({ page, rescueServer }) => {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
  await confirmLocalReadiness(page, 'Text');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  const result = await provider.tool('propose_interaction', { object: 'latch', action: 'latch_open' }, 'history-latch');
  expect(result.code).toBe('awaiting_confirmation');
  await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const decision = gate(); const history = gate(); let committed = false; let historyHeld = false;
  await page.route('**/api/sessions/*/proposal-decision', async route => {
    const response = await fetchFixture(route, rescueServer.origin);
    expect((await response.json()).proposal.status).toBe('committed');
    committed = true; await decision.promise; await route.fulfill({ response });
  });
  await page.route('**/api/sessions/*/record?roundId=*', async route => {
    const response = await fetchFixture(route, rescueServer.origin);
    historyHeld = true; await history.promise; await route.fulfill({ response });
  });
  const input = 'Please check the confirmed result.';
  const userInput = () => provider.sent.filter(event => event.role === 'user' && event.content === input);
  try {
    await page.getByRole('button', { name: 'Confirm this action', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    await page.getByLabel('Type a message').fill(input);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    expect(userInput()).toHaveLength(0);
    decision.release();
    await expect.poll(() => userInput().length).toBe(1);
    await expect.poll(() => historyHeld).toBe(true);
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'committed');
    const receiptIndex = provider.sent.findIndex(event => event.type === 'conversation.message' && event.role === 'system'
      && String(event.content).startsWith('Verified game decision receipt.'));
    expect(receiptIndex).toBeGreaterThan(-1);
    expect(receiptIndex).toBeLessThan(provider.sent.indexOf(userInput()[0]!));
    expect(rescueServer.commits.map(commit => commit.proposalId)).toEqual([result.proposal!.id]);
    expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'history-latch')).toHaveLength(1);
  } finally {
    decision.release(); history.release();
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});
