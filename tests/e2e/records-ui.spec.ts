import { test, expect, type Page } from '@playwright/test';
import type { HumanView } from '../../game/shared/contracts';

const providerRequests = new WeakMap<Page, string[]>();

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test.beforeEach(async ({ page }) => {
  const forbidden: string[] = [];
  providerRequests.set(page, forbidden);
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) forbidden.push('Unexpected provider or token request');
  });
  page.on('websocket', socket => {
    if (/assemblyai\.com/.test(socket.url())) forbidden.push('Unexpected provider socket');
  });
  await page.route('**/api/sessions/*/voice-token', route => route.fulfill({ status: 503, json: { error: 'Practice tests do not open Live connections.' } }));
  test.info().annotations.push({ type: 'provider', description: 'Practice-only. No microphone or real AssemblyAI connection.' });
});

test.afterEach(async ({ page }) => {
  expect(providerRequests.get(page), 'Practice must make zero token or provider requests').toEqual([]);
});

async function start(page: Page, maintenance = false): Promise<HumanView> {
  await page.goto('/');
  await page.getByRole('radio', { name: /Training/ }).check();
  if (maintenance) await page.getByLabel('Training exercise').selectOption('maintenance');
  const created = page.waitForResponse(response => /\/api\/sessions$/.test(response.url()) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start Practice' }).click();
  const view = await (await created).json() as HumanView;
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  return view;
}

async function say(page: Page, text: string) {
  await page.getByLabel('Type a message').fill(text);
  const response = page.waitForResponse(response => response.url().endsWith('/tools'));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('caption')).not.toHaveText(text);
}

async function restart(page: Page) {
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Practice' })).toBeEnabled();
}

async function addNote(page: Page, text: string) {
  if (!await page.getByLabel('My note', { exact: true }).isVisible()) await page.locator('.desk-extras > summary').click();
  await page.getByLabel('My note', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
}

test('a delayed old-round note acknowledgement cannot suppress a newer round notebook response', async ({ page }) => {
  const initial = await start(page);
  const oldAcknowledgement = gate();
  const newRecord = gate();
  let noteCommitted = false;
  let currentRecordHeld = false;
  let completedOldRefresh = false;
  let oldReleased = false;
  let oldRecordRequestsAfterRelease = 0;
  await page.route('**/api/sessions/*/notebook', async route => {
    const body = route.request().postDataJSON();
    const response = await route.fetch();
    if (body.roundId === initial.roundId) { noteCommitted = true; await oldAcknowledgement.promise; }
    await route.fulfill({ response });
  });
  await page.route('**/api/sessions/*/record?*', async route => {
    const roundId = new URL(route.request().url()).searchParams.get('roundId');
    if (oldReleased && roundId === initial.roundId) oldRecordRequestsAfterRelease += 1;
    const response = await route.fetch();
    if (roundId !== initial.roundId && (await response.json()).notebook.some((entry: { text: string }) => entry.text === 'Fresh round note')) {
      currentRecordHeld = true; await newRecord.promise;
    }
    await route.fulfill({ response });
    if (oldReleased && roundId === initial.roundId) completedOldRefresh = true;
  });
  try {
    await addNote(page, 'Old round note');
    await expect.poll(() => noteCommitted).toBe(true);
    await restart(page);
    await page.getByRole('button', { name: 'Start Practice' }).click();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    await addNote(page, 'Fresh round note');
    await expect.poll(() => currentRecordHeld).toBe(true);
    const acknowledged = page.waitForResponse(response => response.url().endsWith('/notebook') && response.request().postDataJSON().roundId === initial.roundId);
    oldReleased = true; oldAcknowledgement.release();
    // Drain the delivered acknowledgement through the browser task queue before the new read.
    await acknowledged;
    await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
    newRecord.release();
    await expect(page.locator('.notebook-list')).toContainText('Fresh round note');
    await expect(page.locator('.notebook-list')).not.toContainText('Old round note');
    expect(completedOldRefresh).toBe(false);
    expect(oldRecordRequestsAfterRelease).toBe(0);
  } finally { oldAcknowledgement.release(); newRecord.release(); }
});

test('a delayed record snapshot from a discarded round cannot restore its private notebook', async ({ page }) => {
  const initial = await start(page);
  const snapshot = gate();
  let held = false;
  await page.route('**/api/sessions/*/record?*', async route => {
    const response = await route.fetch();
    const record = await response.json();
    if (!held && record.roundId === initial.roundId && record.notebook.length) { held = true; await snapshot.promise; }
    await route.fulfill({ response });
  });
  try {
    await addNote(page, 'Discarded confidential note');
    await expect.poll(() => held).toBe(true);
    await restart(page);
    await page.getByRole('button', { name: 'Start Practice' }).click();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    snapshot.release();
    await expect(page.locator('.notebook-list')).toBeEmpty();
    await expect(page.locator('body')).not.toContainText('Discarded confidential note');
    await addNote(page, 'Only the current round');
    await expect(page.locator('.notebook-list')).toContainText('Only the current round');
  } finally { snapshot.release(); }
});

test('scenario choice creates a clean round and old hint callbacks cannot supply new context', async ({ page }) => {
  const initial = await start(page, true);
  await say(page, 'Inspect the module plate');
  const report = await page.getByTestId('caption').innerText();
  expect(report).toMatch(/Crescent|Kite/);
  await page.getByRole('button', { name: 'Pin report', exact: true }).click();
  await expect(page.locator('.notebook-list')).toContainText(report);
  const hint = gate();
  let held = false;
  await page.route('**/api/sessions/*/hint', async route => {
    const response = await route.fetch(); held = true; await hint.promise; await route.fulfill({ response });
  });
  try {
    await page.getByText('Need a nudge?', { exact: true }).click();
    await page.getByRole('button', { name: 'Hint 2', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    await restart(page);
    await page.getByLabel('Training exercise').selectOption('classic');
    const reset = page.waitForResponse(response => response.url().endsWith('/reset') && response.request().postDataJSON().scenario === 'classic');
    await page.getByRole('button', { name: 'Start Practice' }).click();
    const current = await (await reset).json() as HumanView;
    expect(current.roundId).not.toBe(initial.roundId);
    expect(current.scenario).toBe('classic');
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    hint.release();
    await expect(page.locator('.notebook-list')).toBeEmpty();
    await expect(page.locator('body')).not.toContainText(/Crescent|Kite|Match that mark/);
    const recap = await page.request.get(`/api/sessions/${current.sessionId}/recap?roundId=${current.roundId}`);
    expect((await recap.json()).entries).toEqual([]);
    await page.getByRole('button', { name: 'Open transcript history' }).click();
    await expect(page.getByRole('region', { name: 'Conversation history', exact: true })).not.toContainText(report);
  } finally { hint.release(); }
});

test('interruption after a server commit preserves the action while suppressing its delayed reply', async ({ page }) => {
  await start(page);
  const action = gate();
  let committed = false;
  await page.route('**/api/sessions/*/tools', async route => {
    const response = await route.fetch();
    if (route.request().postDataJSON().name === 'interact_object') {
      expect((await response.json()).ok).toBe(true); committed = true; await action.promise;
    }
    await route.fulfill({ response });
  });
  try {
    await page.getByLabel('Type a message').fill('Keep the door open');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    const canceled = page.waitForResponse(response => response.url().endsWith('/cancel'));
    await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
    expect((await canceled).ok()).toBe(true);
    action.release();
    await expect(page.locator('.notice')).toContainText('Completed actions remain completed.');
    await expect(page.getByTestId('caption')).not.toContainText('I engaged the Latch');
    await say(page, 'Inspect the latch');
    await expect(page.getByTestId('caption')).toContainText('Latch is engaged');
    await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
    await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
    await say(page, 'Cross to the far side');
    await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toBeVisible();
  } finally { action.release(); }
});

test('repeated Start produces one session, and changing paused modes preserves the same Maintenance checkpoint', async ({ page }) => {
  let created = 0;
  page.on('request', request => { if (/\/api\/sessions$/.test(request.url()) && request.method() === 'POST') created += 1; });
  await page.goto('/');
  await page.getByRole('radio', { name: /Training/ }).check();
  await page.getByLabel('Training exercise').selectOption('maintenance');
  await page.getByRole('button', { name: 'Start Practice' }).evaluate(button => {
    (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click();
  });
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(created).toBe(1);
  await say(page, 'Inspect the module plate');
  const initialReport = await page.getByTestId('caption').innerText();
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Practice' })).toBeEnabled();
  await page.getByText('Connection & sound', { exact: true }).click();
  await page.getByLabel('Next connection').selectOption('live_text');
  await expect(page.getByRole('button', { name: 'Resume Live Text' })).toBeEnabled();
  await expect(page.getByTestId('caption')).toContainText('Earlier conversations are in history.');
  await page.getByLabel('Next connection').selectOption('practice');
  const resumed = page.waitForResponse(response => response.url().endsWith('/resume'));
  await page.getByRole('button', { name: 'Resume Practice' }).click();
  expect((await (await resumed).json()).scenario).toBe('maintenance');
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say(page, 'Inspect the module plate');
  await expect(page.getByTestId('caption')).toHaveText(initialReport);
  expect(created).toBe(1);
});

test('lost server memory offers explicit restart and a fresh Practice mission without pretending recovery', async ({ page }) => {
  const initial = await start(page);
  await page.route(`**/api/sessions/${initial.sessionId}/**`, route => route.fulfill({ status: 404, json: { error: 'This mission session is unavailable. Start a new mission.' } }));
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('session is unavailable');
  await expect(page.getByTestId('acknowledged-power')).toHaveText('ON');
  await restart(page);
  const created = page.waitForResponse(response => /\/api\/sessions$/.test(response.url()) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start Practice' }).click();
  const current = await (await created).json() as HumanView;
  expect(current.sessionId).not.toBe(initial.sessionId);
  expect(current.roundId).not.toBe(initial.roundId);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.notebook-list')).toBeEmpty();
});
