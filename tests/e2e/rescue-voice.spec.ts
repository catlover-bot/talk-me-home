import type { Page } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { fakeProvider, fixtureScreenshot, confirmLocalReadiness, confirmFixtureProposal } from './fake-provider';

type Provider = Awaited<ReturnType<typeof fakeProvider>>;

async function startRescue(page: Page, provider: Provider) {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /Rescue Mission/ })).toBeChecked();
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text' }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(1);
}

async function relay(page: Page, circuit: 'Beacon' | 'Harbor') {
  const button = page.getByRole('button', { name: `Relay ${circuit}`, exact: true });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  await expect(page.getByTestId('acknowledged-relay')).toHaveText(circuit);
}

async function cargo(page: Page, provider: Provider, batchOldWork = false) {
  expect((await provider.tool('observe_room', {}, 'cargo-survey')).message).toContain('Latch');
  expect((await provider.tool('inspect_object', { object: 'latch' }, 'cargo-inspect')).ok).toBe(true);
  expect((await provider.confirmTool('propose_interaction', { object: 'latch', action: 'latch_open' }, 'Engage the Latch', 'cargo-latch')).ok).toBe(true);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  if (batchOldWork) {
    // Both requests finish in Cargo before the independent UI decision advances it.
    provider.emit({ type: 'reply.started', reply_id: 'ordinary-crossing' });
    provider.emit({ type: 'tool.call', call_id: 'crossing', name: 'move_to', arguments: { target: 'far_side' } });
    provider.emit({ type: 'tool.call', call_id: 'old-cargo-survey', name: 'observe_room', arguments: {} });
    provider.emit({ type: 'reply.done', reply_id: 'ordinary-crossing', status: 'completed' });
    await expect.poll(() => provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'old-cargo-survey').length).toBe(1);
    const crossing = provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'crossing');
    expect(crossing).toHaveLength(1);
    expect(JSON.parse(String(crossing[0]?.result)).ok).toBe(true);
    const old = provider.sent.find(event => event.type === 'tool.result' && event.call_id === 'old-cargo-survey');
    expect(old?.is_error).toBe(false);
    expect(String(old?.result)).not.toMatch(/Ring emblem|gallery\.g/);
    expect(JSON.parse(String(crossing[0]?.result)).code).toBe('awaiting_confirmation');
    await confirmFixtureProposal(page, 'Move to the far-side platform');
    provider.emit({ type: 'tool.call', call_id: 'crossing', name: 'move_to', arguments: { target: 'far_side' } });
    provider.emit({ type: 'reply.done', reply_id: 'ordinary-crossing', status: 'completed' });
  } else expect((await provider.confirmTool('propose_move', { target: 'far_side' }, 'Move to the far-side platform', 'cargo-cross')).ok).toBe(true);
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You got Pip through.' })).toHaveCount(0);
  expect(provider.ended).toBe(0);
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
}

async function gallery(page: Page, provider: Provider) {
  const entry = await provider.tool('observe_room', {}, 'gallery-entry');
  expect(entry.message).toContain('Ring emblem');
  expect(entry.message).toContain('East gate (gallery.g1)');
  await relay(page, 'Beacon');
  expect((await provider.confirmTool('propose_move', { target: 'gallery.g1' }, 'Move through the east gate')).message).toContain('Fork emblem');
  await relay(page, 'Harbor');
  expect((await provider.confirmTool('propose_move', { target: 'gallery.g2' }, 'Move through the northeast gate')).message).toContain('Sail emblem');
  const exit = await provider.tool('inspect_object', { object: 'gallery.g3' });
  if (/Cargo blocks/.test(exit.message)) {
    // This branch follows an actual local observation, not the hidden configuration.
    expect((await provider.confirmTool('propose_move', { target: 'gallery.g3' }, 'Move through the southeast gate')).ok).toBe(false);
    expect((await provider.confirmTool('propose_move', { target: 'gallery.g2' }, 'Move through the southwest gate')).message).toContain('Fork emblem');
    await relay(page, 'Beacon');
    expect((await provider.confirmTool('propose_move', { target: 'gallery.g4' }, 'Move through the southeast gate')).message).toContain('Leaf emblem');
    expect((await provider.tool('inspect_object', { object: 'gallery.g5' })).message).toContain('clear of cargo');
    await relay(page, 'Harbor');
    expect((await provider.confirmTool('propose_move', { target: 'gallery.g5' }, 'Move through the northeast gate')).ok).toBe(true);
  } else {
    expect(exit.message).toContain('clear of cargo');
    await relay(page, 'Beacon');
    expect((await provider.confirmTool('propose_move', { target: 'gallery.g3' }, 'Move through the southeast gate')).ok).toBe(true);
  }
  await expect(page.getByRole('heading', { name: 'Return Dock', exact: true })).toBeVisible();
  expect(provider.ended).toBe(0);
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
}

async function board(page: Page, provider: Provider) {
  expect((await provider.tool('observe_room', {})).message).toContain('return.contact');
  expect((await provider.tool('inspect_object', { object: 'return.contact' })).message).toContain('hold_contact');
  expect((await provider.confirmTool('propose_interaction', { object: 'return.contact', action: 'hold_contact' }, 'Hold the charging contact')).ok).toBe(true);
  await page.getByRole('button', { name: 'Charge', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Primed');
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
  expect((await provider.confirmTool('propose_interaction', { object: 'return.contact', action: 'release_contact' }, 'Release the charging contact')).ok).toBe(true);
  expect((await provider.confirmTool('propose_move', { target: 'return.aboard' }, 'Board the recovery capsule')).ok).toBe(true);
  await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
  expect((await provider.tool('inspect_object', { object: 'return.capsule' })).message).toContain('confirm_return');
}

test('simulated Gallery movement: queued same-gate retries cannot walk back from a newly reached room', async ({ page }) => {
  const provider = await fakeProvider(page);
  await startRescue(page, provider);
  await cargo(page, provider);
  const entry = await provider.tool('observe_room', {}, 'same-gate-entry');
  expect(entry.message).toContain('Ring emblem');
  expect(entry.message).toContain('gallery.g1');
  await relay(page, 'Beacon');

  // Both identical proposals originate at Ring; a single confirmation must not
  // reinterpret a queued duplicate as a backtrack after arriving at Fork.
  provider.emit({ type: 'reply.started', reply_id: 'ordinary-same-gate' });
  provider.emit({ type: 'tool.call', call_id: 'same-gate-first', name: 'move_to', arguments: { target: 'gallery.g1' } });
  provider.emit({ type: 'tool.call', call_id: 'same-gate-queued', name: 'move_to', arguments: { target: 'gallery.g1' } });
  // This later frame renders only after both ordered tool frames were handled.
  // With reply.done withheld, neither request can commit before the barrier.
  provider.emit({ type: 'transcript.agent', reply_id: 'ordinary-same-gate', text: 'I will try this gate.' });
  await expect(page.getByTestId('caption')).toHaveText('I will try this gate.');
  provider.emit({ type: 'reply.done', reply_id: 'ordinary-same-gate', status: 'completed' });
  await expect.poll(() => provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'same-gate-queued').length).toBe(1);
  const first = provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'same-gate-first');
  const queued = provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'same-gate-queued');
  expect(first).toHaveLength(1);
  expect(queued).toHaveLength(1);
  expect(JSON.parse(String(first[0]?.result))).toMatchObject({ ok: true });
  expect(JSON.parse(String(first[0]?.result))).toMatchObject({ code: 'awaiting_confirmation' });
  expect(queued[0]?.is_error).toBe(false);
  expect(JSON.parse(String(queued[0]?.result)).proposal.id).toBe(JSON.parse(String(first[0]?.result)).proposal.id);
  await confirmFixtureProposal(page, 'Move through the east gate');

  const afterBatch = await provider.tool('observe_room', {}, 'same-gate-after-batch');
  expect(afterBatch.message).toContain('Fork emblem');
  expect(afterBatch.message).not.toContain('Ring emblem');
  expect(afterBatch.message).toContain('West gate (gallery.g1)');
  // Freshly requested backtracking has the new location context and is still recoverable.
  const backtrack = await provider.confirmTool('propose_move', { target: 'gallery.g1' }, 'Move through the west gate', 'same-gate-deliberate-return');
  expect(backtrack.ok).toBe(true);
  expect(backtrack.message).toContain('Ring emblem');
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
  expect(provider.ended).toBe(0);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Live Text', exact: true })).toBeEnabled();
  await expect.poll(() => provider.ended).toBe(1);
  expect(provider.activeSockets).toBe(0);
});

test('simulated Rescue: one connection, single pending result, separately confirmed checkpoint and typed authorized return', async ({ page }, info) => {
  const provider = await fakeProvider(page);
  await startRescue(page, provider);
  await cargo(page, provider, true);
  // This final-only caption arrives after chapter advancement, from the old reply.
  provider.emit({ type: 'transcript.agent', reply_id: 'ordinary-crossing', text: 'I crossed the first Door safely.' });
  await expect(page.getByTestId('caption')).toHaveText('I crossed the first Door safely.');
  await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
  const lateReport = page.getByRole('region', { name: 'Conversation history', exact: true }).locator('.history-message').filter({ hasText: 'I crossed the first Door safely.' });
  await expect(lateReport.locator('.chapter-source')).toHaveText('Cargo Bay');
  await expect(lateReport.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close history', exact: true }).click();
  await fixtureScreenshot(page, `test-results/goal-003-simulated-gallery-${info.project.name}.png`);
  await gallery(page, provider);
  await board(page, provider);
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  const cancellation = page.waitForRequest(request => request.url().endsWith('/cancel'));
  await page.getByLabel('Type a message').fill('Please confirm the return.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  expect((await cancellation).postDataJSON().reason).toBe('supersede');
  await expect.poll(() => provider.sent.some(event => event.type === 'conversation.message' && event.content === 'Please confirm the return.')).toBe(true);
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await fixtureScreenshot(page, `test-results/goal-003-simulated-return-ready-${info.project.name}.png`);
  expect((await provider.confirmTool('propose_interaction', { object: 'return.capsule', action: 'confirm_return' }, 'Confirm the authorized return', 'final-return')).ok).toBe(true);
  provider.emit({ type: 'reply.started', reply_id: 'home-response' });
  provider.emit({ type: 'transcript.agent', reply_id: 'home-response', text: 'I am home. Thank you for guiding me.' });
  provider.emit({ type: 'reply.done', reply_id: 'home-response', status: 'completed' });
  await expect.poll(() => provider.ended).toBe(1);
  await expect(page.getByTestId('caption')).toHaveText('I am home. Thank you for guiding me.');
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
  expect(provider.activeSockets).toBe(0);
  expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'crossing')).toHaveLength(1);
  expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'final-return')).toHaveLength(1);
  const audio = await provider.audioState();
  expect(audio.closedContexts).toBe(audio.contexts);
  await fixtureScreenshot(page, `test-results/goal-003-simulated-home-${info.project.name}.png`);
});

test.describe('Gallery configuration B', () => {
  test.use({ galleryConfiguration: 'b' });
test('simulated Rescue continuity: pause after boarding revokes grant, fresh context preserves chapter and requires reauthorization', async ({ page }) => {
  const provider = await fakeProvider(page);
  await startRescue(page, provider); await cargo(page, provider); await gallery(page, provider); await board(page, provider);
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume Live Text', exact: true })).toBeEnabled();
  expect(provider.ended).toBe(1);
  expect(provider.activeSockets).toBe(0);
  await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
  await expect(page.getByTestId('dock-readiness')).toHaveText('Ready');
  await expect(page.getByTestId('dock-authorization')).toHaveText('Not granted');
  await page.getByRole('button', { name: 'Resume Live Text', exact: true }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(2);
  const recap = provider.sent.filter(event => event.type === 'conversation.message' && String(event.content).startsWith('Historical mission record')).at(-1);
  expect(recap?.role).toBe('user');
  expect(String(recap?.content)).toContain('return_dock');
  expect(String(recap?.content)).toContain('boarded');
  expect(String(recap?.content)).not.toMatch(/galleryConfiguration|configuration.*[ab]|readinessVersion/);
  expect((await provider.confirmTool('propose_interaction', { object: 'return.capsule', action: 'confirm_return' }, 'Confirm the authorized return', 'stale-grant')).ok).toBe(false);
  await expect(page.getByTestId('dock-energy')).toHaveText('Stored');
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  expect((await provider.confirmTool('propose_interaction', { object: 'return.capsule', action: 'confirm_return' }, 'Confirm the authorized return', 'fresh-grant')).ok).toBe(true);
  provider.emit({ type: 'reply.started', reply_id: 'resumed-home' });
  provider.emit({ type: 'transcript.agent', reply_id: 'resumed-home', text: 'The return is complete.' });
  provider.emit({ type: 'reply.done', reply_id: 'resumed-home', status: 'completed' });
  await expect.poll(() => provider.ended).toBe(2);
  expect(provider.activeSockets).toBe(0);
});
});

test('simulated Rescue connection limit: visible warning, clean cap stop, checkpoint retained without automatic reconnect', async ({ page }) => {
  await page.clock.install();
  const provider = await fakeProvider(page);
  await startRescue(page, provider); await cargo(page, provider);
  await page.clock.fastForward(540_000);
  await expect(page.locator('body')).toContainText('This Live connection will end in 60 seconds.');
  expect(provider.ended).toBe(0);
  await page.clock.fastForward(60_000);
  await expect.poll(() => provider.ended).toBe(1);
  await expect(page.getByRole('button', { name: 'Resume Live Text', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
  expect(provider.activeSockets).toBe(0);
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
});

test('simulated Rescue pagehide: current chapter stop revokes an authorized return and ends the provider connection', async ({ page, rescueServer }) => {
  const provider = await fakeProvider(page);
  await startRescue(page, provider); await cargo(page, provider); await gallery(page, provider); await board(page, provider);
  const authorizationResponse = page.waitForResponse(response => response.url().endsWith('/dock-control')
    && response.request().postDataJSON().action === 'authorize_return');
  await page.getByRole('button', { name: 'Authorize return', exact: true }).click();
  const authorized = await (await authorizationResponse).json();
  await expect(page.getByTestId('dock-authorization')).toHaveText('Granted');
  expect(authorized.chapter).toBe('return_dock');
  expect(authorized.chapterEpoch).toBeGreaterThan(0);
  expect(authorized.returnDock.returnAuthorized).toBe(true);

  const stopResponse = page.waitForResponse(response => response.url().endsWith('/stop'));
  // Dispatch the actual lifecycle event while retaining the test page to inspect cleanup.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  const response = await stopResponse;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ roundId: authorized.roundId, chapterEpoch: authorized.chapterEpoch });
  // Chromium may not expose the detached keepalive response body after pagehide.
  // The acknowledged HTTP status plus authoritative store prove its committed effect.
  const stopped = rescueServer.store.get(authorized.sessionId);
  expect(stopped).toMatchObject({ chapter: 'return_dock', chapterEpoch: authorized.chapterEpoch, status: 'stopped', completed: false });
  expect(stopped.returnDock).toEqual({ energy: 'stored', readyForReturn: true, returnAuthorized: false });
  await expect.poll(() => provider.ended).toBe(1);
  expect(provider.activeSockets).toBe(0);
  expect(provider.connections).toBe(1);
  expect(provider.tokenRequests).toBe(1);
  const audio = await provider.audioState();
  expect(audio.activeTracks).toBe(0);
  expect(audio.closedContexts).toBe(audio.contexts);
});
