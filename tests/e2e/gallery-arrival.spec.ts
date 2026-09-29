import type { Page } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { fakeProvider, confirmLocalReadiness, confirmFixtureProposal, fixtureScreenshot } from './fake-provider';
import type { ActionProposal, RobotLocalPerception, ToolResponse } from '../../game/shared/contracts';
import { runRescuePlayer } from '../../scripts/qa-mission-player.mjs';

test.use({ compiledProduction: true });
type Provider = Awaited<ReturnType<typeof fakeProvider>>;
type DecisionContext = { proposal: ActionProposal; result: { ok: boolean; message: string }; perception?: RobotLocalPerception };
const acknowledgements = (provider: Provider) => provider.sent.filter(event => event.type === 'reply.create' && typeof event.instructions === 'string');
const contexts = (provider: Provider): DecisionContext[] => provider.sent.filter(event => event.type === 'conversation.message' && event.role === 'system' && String(event.content).startsWith('Verified game decision receipt.'))
  .map(event => JSON.parse(String(event.content).split('\n').slice(1).join('\n')) as DecisionContext);

async function start(page: Page) {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  const provider = await fakeProvider(page);
  await page.goto('/'); await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text', exact: true }).click(); await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  return provider;
}

async function replyToDecision(page: Page, provider: Provider, result: ToolResponse, renderAudio = false) {
  const id = result.proposal!.id;
  await expect.poll(() => contexts(provider).some(context => context.proposal.id === id)).toBe(true);
  await expect.poll(() => acknowledgements(provider).filter(event => String(event.instructions).includes(id)).length).toBe(1);
  const context = contexts(provider).find(context => context.proposal.id === id)!;
  const instruction = String(acknowledgements(provider).find(event => String(event.instructions).includes(id))!.instructions);
  const observation = context.perception;
  const text = observation
    ? `I arrived at the ${observation.emblem} emblem. I see gates to the ${observation.gates.map(gate => gate.direction.toLowerCase()).join(', ')}.`
    : `The game confirmed: ${context.proposal.label}.`;
  const reply_id = `constructed-arrival-${id}`;
  provider.emit({ type: 'reply.started', reply_id });
  provider.emit({ type: 'transcript.agent', reply_id, text });
  if (renderAudio) {
    const before = (await provider.audioState()).queuedChunks;
    provider.emit({ type: 'reply.audio', reply_id, data: Buffer.from([0, 64, 0, 64, 0, 64, 0, 64]).toString('base64') });
    await expect.poll(async () => (await provider.audioState()).queuedChunks).toBeGreaterThan(before);
    await provider.render(); await expect(page.locator('.pip-portrait')).toHaveAttribute('data-state', 'speaking');
  }
  provider.emit({ type: 'reply.done', reply_id, status: 'completed' });
  await expect(page.getByTestId('caption')).toHaveText(text);
  if (renderAudio) { await provider.drain(); await expect(page.locator('.pip-portrait')).not.toHaveAttribute('data-state', 'speaking'); }
  return { context, instruction, text };
}

async function finishProposalReply(page: Page, provider: Provider, id: string) {
  // A tool result has its own normal final continuation before the player
  // confirms. The tool-emitting reply.done alone cannot open the ACK boundary.
  provider.emit({ type: 'reply.started', reply_id: `proposal-final-${id}` });
  provider.emit({ type: 'transcript.agent', reply_id: `proposal-final-${id}`, text: 'The proposal is ready for your confirmation.' });
  provider.emit({ type: 'reply.done', reply_id: `proposal-final-${id}`, status: 'completed' });
  await expect(page.getByTestId('caption')).toHaveText('The proposal is ready for your confirmation.');
}

async function enterGallery(page: Page, provider: Provider) {
  await provider.tool('propose_interaction', { object: 'latch', action: 'latch_open' }, 'arrival-latch');
  await finishProposalReply(page, provider, 'latch');
  const latch = await confirmFixtureProposal(page, 'Engage the Latch'); const interaction = await replyToDecision(page, provider, latch);
  expect(interaction.context.perception).toBeUndefined(); expect(interaction.instruction).toMatch(/^Briefly acknowledge only/);
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click(); await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await provider.tool('propose_move', { target: 'far_side' }, 'arrival-crossing');
  await finishProposalReply(page, provider, 'crossing');
  const crossing = await confirmFixtureProposal(page, 'Move to the far-side platform'); const entry = await replyToDecision(page, provider, crossing);
  expect(entry.context.perception?.emblem).toBe('Ring'); expect(entry.instruction).toMatch(/^Give one concise arrival and orientation report/);
  await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
  return crossing;
}

test('compiled confirmed movement preserves robot-only typed perception through one constructed arrival reply and playback', async ({ page, rescueServer }, info) => {
  const provider = await start(page);
  try {
    await enterGallery(page, provider);
    const requests: string[] = [];
    const playerReport = { route: [] as string[], steps: [] as unknown[], acquisitions: [] as Array<{ outcome: string; value?: string; exchanges: unknown[] }> };
    await expect(runRescuePlayer({ page, report: playerReport, say: async text => {
      requests.push(text); throw new Error('Synthetic entry-consumption probe finished before submitting another request.');
    } })).rejects.toThrow(/Synthetic entry-consumption probe finished/);
    expect(requests).toEqual(['Please inspect the east gate and tell me whether anything blocks it.']);
    expect(playerReport.acquisitions[0]).toMatchObject({ outcome: 'already_reported', value: 'ring', exchanges: [] });
    if (await page.getByTestId('acknowledged-relay').textContent() !== 'Beacon') await page.getByRole('button', { name: 'Relay Beacon', exact: true }).click();
    await expect(page.getByTestId('acknowledged-relay')).toHaveText('Beacon');
    const pending = await provider.tool('propose_move', { target: 'gallery.g1' }, 'arrival-east');
    await finishProposalReply(page, provider, 'east');
    expect(pending.perception).toBeUndefined(); expect(pending.code).toBe('awaiting_confirmation');
    const result = await confirmFixtureProposal(page, 'Move through the east gate');
    expect(result.perception?.emblem).toBe('Fork');
    const reply = await replyToDecision(page, provider, result, true);
    expect(reply.context.perception).toEqual(result.perception);
    expect(reply.context.perception?.origin).toBe('confirmed_arrival');
    expect(reply.context.perception?.stateRevision).toBe(result.view.revision);
    expect(reply.context.perception?.gates.map(gate => gate.direction)).toEqual(['West', 'Northeast', 'Southeast']);
    expect(reply.context.perception?.gates.every(gate => gate.passage === 'unchecked')).toBe(true);
    const responseFacts = JSON.parse(reply.instruction.split('\nVerified response facts: ')[1]);
    expect(responseFacts.arrival.emblem).toBe(result.perception!.emblem);
    expect(responseFacts.arrival.gates).toEqual(result.perception!.gates.map(({ handle, direction, power, door, passage }) => ({ handle, direction, power, door, passage })));
    expect(reply.instruction).toContain('Do not call tools');
    expect(reply.instruction).toContain('handles only in tool arguments, never in speech');
    expect(reply.text).not.toMatch(/gallery\.g[1-5]/);
    expect(JSON.stringify([result.view, result.proposal, result.decisionEvent])).not.toMatch(/Fork|gallery\.g2|gallery\.g4|perception|visitId/);
    expect(rescueServer.store.record(result.view.sessionId, result.view.roundId).annotations?.location).toBeNull();
    expect(rescueServer.commits).toHaveLength(3);
    if (await page.getByRole('button', { name: 'Open transcript history', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
    await expect(page.locator('.history-message').filter({ has: page.locator('p', { hasText: reply.text }) })).toHaveCount(1);
    await fixtureScreenshot(page, info.outputPath('constructed-scoped-arrival.png'));
    const count = acknowledgements(provider).length;
    const status = await provider.tool('get_action_status', { proposal_id: result.proposal!.id }, 'arrival-status');
    expect(status.perception).toEqual(result.perception);
    expect(acknowledgements(provider)).toHaveLength(count); expect(contexts(provider)).toHaveLength(3);
    expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'arrival-east')).toHaveLength(1);
    expect(provider.tokenRequests).toBe(1); expect(provider.connections).toBe(1);
  } finally {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});

test('changing Relay before scheduled arrival dispatch preserves the committed move but makes orientation historical', async ({ page, rescueServer }) => {
  const provider = await start(page);
  try {
    await enterGallery(page, provider);
    await page.getByRole('button', { name: 'Relay Beacon', exact: true }).click(); await expect(page.getByTestId('acknowledged-relay')).toHaveText('Beacon');
    await provider.tool('propose_move', { target: 'gallery.g1' }, 'stale-arrival-east');
    await finishProposalReply(page, provider, 'stale-east');
    await page.clock.install(); await page.clock.pauseAt(new Date());
    const moved = await confirmFixtureProposal(page, 'Move through the east gate');
    await expect.poll(() => contexts(provider).length).toBe(3);
    expect(contexts(provider).at(-1)?.perception?.emblem).toBe('Fork');
    await page.getByRole('button', { name: 'Relay Harbor', exact: true }).click(); await expect(page.getByTestId('acknowledged-relay')).toHaveText('Harbor');
    await page.clock.fastForward(151);
    await expect.poll(() => acknowledgements(provider).length).toBe(3);
    const instruction = String(acknowledgements(provider).at(-1)!.instructions);
    expect(instruction).toMatch(/^Briefly acknowledge only/); expect(instruction).toContain('room observation is historical');
    expect(instruction).not.toMatch(/^Give one concise arrival/);
    expect(instruction).not.toMatch(/Fork|Northeast|Southeast|unchecked|gallery\.g[1-5]/);
    expect(rescueServer.commits).toHaveLength(3);
    provider.emit({ type: 'reply.started', reply_id: 'historical-move-ack' });
    provider.emit({ type: 'transcript.agent', reply_id: 'historical-move-ack', text: 'The game confirmed the gate crossing.' });
    provider.emit({ type: 'reply.done', reply_id: 'historical-move-ack', status: 'completed' });
    await expect(page.getByTestId('caption')).toHaveText('The game confirmed the gate crossing.');
    const status = await provider.tool('get_action_status', { proposal_id: moved.proposal!.id }, 'historical-arrival-status');
    expect(status.proposal?.status).toBe('committed'); expect(status.perception).toBeUndefined(); expect(status.message).toMatch(/Historical action receipt/);
    expect(rescueServer.store.record(moved.view.sessionId, moved.view.roundId).annotations?.location).toBeNull();
  } finally {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});

test('compiled direction read carries private request-time scope and keeps controls usable through a delayed empty reply', async ({ page, rescueServer }, info) => {
  const provider = await start(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let request: Record<string, any> | undefined;
  try {
    const arrival = await enterGallery(page, provider);
    await page.route('**/api/sessions/*/tools', async route => {
      const body = route.request().postDataJSON();
      if (body.name === 'inspect_gate') { request = body; await held; }
      await route.fallback();
    });
    const reading = provider.tool('inspect_gate', { direction: 'east' }, 'scoped-read');
    await expect.poll(() => request).toBeTruthy();
    expect(request!.arguments).toEqual({ direction: 'east' });
    expect(request!.inspectionScope).toEqual({ visitId: arrival.perception!.visitId });
    expect(request!.chapterEpoch).toBe(arrival.view.chapterEpoch);
    await expect(page.getByText('Pip is checking equipment', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Interrupt', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    release();
    const result = await reading;
    expect(result.ok).toBe(true);
    expect(result.perception?.gates.find(gate => gate.direction === 'East')).toMatchObject({ door: 'closed', passage: 'clear' });
    expect(rescueServer.commits).toHaveLength(2);
    await expect(page.getByText('Check sent · waiting for Pip’s reply', { exact: true })).toBeVisible();
    await page.clock.install(); await page.clock.fastForward(13_000);
    provider.emit({ type: 'reply.done', reply_id: 'ordinary-scoped-read', status: 'completed' });
    provider.emit({ type: 'tool.call', call_id: 'scoped-read', name: 'inspect_gate', arguments: { direction: 'east' } });
    await provider.drain();
    await expect(page.getByText('Check sent · waiting for Pip’s reply', { exact: true })).toBeVisible();
    expect(provider.sent.filter(event => event.type === 'tool.result' && event.call_id === 'scoped-read')).toHaveLength(1);
    expect(provider.sent.filter(event => event.type === 'reply.create')).toHaveLength(2);
    await fixtureScreenshot(page, info.outputPath('constructed-delayed-inspection.png'));
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeInViewport();
    await fixtureScreenshot(page, info.outputPath('constructed-delayed-inspection-narrow.png'));
    await page.setViewportSize(viewport);
    provider.emit({ type: 'reply.started', reply_id: 'empty-inspection' });
    provider.emit({ type: 'reply.done', reply_id: 'empty-inspection', status: 'completed' });
    await expect(page.getByText('Check sent · waiting for Pip’s reply', { exact: true })).toHaveCount(0);
    const fresh = await provider.tool('inspect_gate', { direction: 'east' }, 'repeat-read');
    expect(fresh.ok).toBe(true);
    provider.emit({ type: 'reply.started', reply_id: 'fresh-read-answer' });
    provider.emit({ type: 'transcript.agent', reply_id: 'fresh-read-answer', text: 'The east gate is closed. Its passage is clear.' });
    provider.emit({ type: 'reply.done', reply_id: 'fresh-read-answer', status: 'completed' });
    await expect(page.getByTestId('caption')).toHaveText('The east gate is closed. Its passage is clear.');
    expect(rescueServer.store.record(arrival.view.sessionId, arrival.view.roundId).annotations?.location).toBeNull();
    expect(rescueServer.commits).toHaveLength(2);
  } finally {
    release();
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});

test('direction rejections remain specific and interrupted late reports cannot become current navigation', async ({ page, rescueServer }) => {
  const provider = await start(page);
  try {
    const arrival = await enterGallery(page, provider);
    const unavailable = await provider.tool('inspect_gate', { direction: 'north' }, 'absent-direction');
    expect(unavailable).toMatchObject({ ok: false, code: 'direction_unavailable', recovery: 'observe_room' });
    expect(unavailable.message).not.toMatch(/correct (?:label|identifier)/i);
    expect(unavailable.perception).toBeUndefined();
    await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
    provider.emit({ type: 'reply.started', reply_id: 'late-interrupted-read' });
    provider.emit({ type: 'transcript.agent', reply_id: 'late-interrupted-read', text: 'Constructed late report must not appear.' });
    provider.emit({ type: 'reply.done', reply_id: 'late-interrupted-read', status: 'completed' });
    await expect(page.getByTestId('caption')).not.toHaveText('Constructed late report must not appear.');
    await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeEnabled();
    expect(rescueServer.commits).toHaveLength(2);
    expect(rescueServer.store.record(arrival.view.sessionId, arrival.view.roundId).annotations?.location).toBeNull();
  } finally {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});
