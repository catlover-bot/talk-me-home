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
    expect(responseFacts.arrival.gates).toEqual(result.perception!.gates.map(({ direction, power, door, passage }) => ({ direction, power, door, passage })));
    expect(reply.instruction).toContain('Do not call tools');
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
    expect(instruction).not.toMatch(/Fork|Northeast|Southeast|unchecked/);
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
