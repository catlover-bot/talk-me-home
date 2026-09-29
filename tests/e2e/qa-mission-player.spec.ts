import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { fakeProvider, confirmLocalReadiness, fixtureScreenshot } from './fake-provider';
import { PHRASES, runRescuePlayer, confirmProposalForRequest, proposalLabelForRequest } from '../../scripts/qa-mission-player.mjs';

test.use({ compiledProduction: true });

const LABEL = 'SYNTHETIC OFFLINE CONFIRMED-ACTION CONTINUATION — CONSTRUCTED PEER — NO REAL PROVIDER';
type Provider = Awaited<ReturnType<typeof fakeProvider>>;
type PeerEvent = { kind: string; request?: string; text?: string; action?: string; target?: string; ok?: boolean };
const settledDecisions = new WeakMap<Page, Set<string>>();

async function waitForPeerDecision(page: Page, provider: Provider) {
  const strip = page.getByTestId('action-proposal');
  if (!await strip.count()) {
    // The terminal home screen removes the strip after the verified final
    // receipt and acknowledgement. It is no longer a pending turn boundary.
    await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
    return;
  }
  const id = await strip.getAttribute('data-proposal-id');
  const settled = settledDecisions.get(page) ?? new Set<string>(); settledDecisions.set(page, settled);
  if (!id || settled.has(id)) return;
  const label = await page.getByTestId('proposal-label').innerText();
  await expect.poll(() => provider.sent.some(event => event.type === 'reply.create' && String(event.instructions).includes(id!))).toBe(true);
  await expect(page.getByTestId('caption')).toHaveText(`The game confirmed: ${label}.`);
  await expect(page.locator('.pip-portrait')).not.toHaveAttribute('data-state', 'speaking');
  settled.add(id);
}

test('visible confirmation remains deliberate, exact and keyboard accessible while conversation continues', async ({ page, rescueServer }, info) => {
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
  await provider.tool('observe_room', {});
  const proposed = await provider.tool('interact_object', { object: 'latch', action: 'latch_open' });
  expect(proposed.code).toBe('awaiting_confirmation');
  const strip = page.getByTestId('action-proposal');
  await expect(strip).toHaveAttribute('data-status', 'awaiting_confirmation');
  await expect(page.getByTestId('proposal-label')).toHaveText('Engage the Latch');
  expect(rescueServer.commits).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).not.toBeFocused();
  await page.getByLabel('Type a message', { exact: true }).fill('Yes. My diagram says the Door and Conveyor share one Power supply.');
  await page.getByLabel('Type a message', { exact: true }).press('Enter');
  await provider.tool('inspect_object', { object: 'latch' });
  provider.emit({ type: 'reply.started', reply_id: 'pending-conversation' });
  provider.emit({ type: 'transcript.agent', reply_id: 'pending-conversation', text: 'The Latch is not engaged. Its proposal is still waiting for your confirmation.' });
  provider.emit({ type: 'reply.done', reply_id: 'pending-conversation', status: 'completed' });
  await expect(page.getByRole('button', { name: 'Not yet', exact: true })).toBeEnabled();
  await expect(strip).toHaveAttribute('data-proposal-id', proposed.proposal!.id);
  expect(rescueServer.commits).toHaveLength(0);
  await expect(confirmProposalForRequest(page, 'Please board the capsule.')).rejects.toThrow();
  expect(rescueServer.commits).toHaveLength(0);
  await page.getByRole('button', { name: 'Presentation layout', exact: true }).click();
  for (const locator of [strip, page.getByTestId('caption'), page.getByRole('button', { name: 'Pause / End call', exact: true }), page.getByRole('button', { name: 'Confirm this action', exact: true }), page.getByRole('button', { name: 'Power OFF', exact: true })]) await expect(locator).toBeInViewport({ ratio: 1 });
  await fixtureScreenshot(page, info.outputPath('confirmed-action-pending-presentation.png'));
  await page.getByRole('button', { name: 'Not yet', exact: true }).focus();
  await page.getByRole('button', { name: 'Not yet', exact: true }).press('Space');
  await expect(strip).toHaveAttribute('data-status', 'declined');
  expect(rescueServer.commits).toHaveLength(0);
  await fixtureScreenshot(page, info.outputPath('confirmed-action-declined-presentation.png'));
  const next = await provider.tool('propose_interaction', { object: 'latch', action: 'latch_open' });
  expect(next.proposal!.id).not.toBe(proposed.proposal!.id);
  await expect(page.getByRole('button', { name: 'Confirm this action', exact: true })).not.toBeFocused();
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).focus();
  await page.getByRole('button', { name: 'Confirm this action', exact: true }).press('Enter');
  await expect(strip).toHaveAttribute('data-status', 'committed');
  expect(rescueServer.commits).toHaveLength(1);
  await fixtureScreenshot(page, info.outputPath('confirmed-action-committed-presentation.png'));
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(() => provider.ended).toBe(1);
});

/**
 * This is an explicitly synthetic robot peer, not a model-quality evaluation.
 * Only this closure sees robot tool results. The imported player receives a UI
 * send function and original DOM reports; no tool payload or server store.
 */
function syntheticPeer(provider: Provider, events: PeerEvent[], recover = false, locationQuality: 'ordinary' | 'imperfect' | 'unknown' = 'ordinary') {
  let chapter: 'cargo' | 'gallery' | 'dock' = 'cargo';
  let localObservation = '';
  let firstGateReport = true;
  let holdingReported = false;
  let tools = 0;
  const questions = new Set<string>();
  let knownProposalId: string | undefined;
  const surveyCounts = new Map<string, number>();
  let previousEmblem = ''; let departedEmblem = '';
  let returnTurns = 0; let returnInspected = false;
  const localGates = () => [...localObservation.matchAll(/\b(East|West|Northeast|Northwest|Southeast|Southwest) gate \((gallery\.g\d)\)/g)]
    .map(match => ({ direction: match[1]!.toLowerCase(), id: match[2]! }));
  const invoke = async (name: string, args: Record<string, unknown>) => {
    const result = await provider.tool(name, args, `synthetic-player-tool-${++tools}`);
    events.push({ kind: 'peer-tool', action: name, target: String(args.object ?? args.target ?? ''), ok: result.ok });
    if (name === 'observe_room') localObservation = result.message;
    if (result.proposal?.id) knownProposalId = result.proposal.id;
    if (/Relay Gallery checkpoint|Return Dock's safe platform/.test(result.message)) chapter = 'dock';
    else if (/Ring emblem|Fork emblem|Sail emblem|Leaf emblem/.test(result.message)) chapter = 'gallery';
    return result;
  };
  const observe = async () => {
    const result = await invoke('observe_room', {});
    const emblem = result.perception?.emblem;
    if (!emblem) return result.message;
    if (emblem !== previousEmblem) { departedEmblem = previousEmblem; previousEmblem = emblem; }
    const count = (surveyCounts.get(emblem) ?? 0) + 1; surveyCounts.set(emblem, count);
    if (locationQuality === 'unknown') return 'I cannot identify the current emblem yet.';
    if (locationQuality === 'imperfect') {
      if (emblem === 'Ring') return 'I am beside the circular emblem. The compass points north.';
      if (emblem === 'Fork' && count === 1) {
        const quote = 'I cannot see an emblem right now, as I have just arrived through the gate. Should I observe the room to see what is around me?';
        events.push({ kind: 'retained-fifth-attempt-quote', text: quote }); return quote;
      }
      if (emblem === 'Fork' && count === 2) return 'The current emblem may be Ring or Fork; I cannot tell yet.';
      const shape = emblem === 'Fork' ? 'branching' : emblem === 'Sail' ? 'sail-shaped' : emblem.toLowerCase();
      const report = `${departedEmblem ? `I left the ${departedEmblem} room. ` : ''}I am now at the ${shape} emblem.`;
      events.push({ kind: 'fresh-shape-report', text: report }); return report;
    }
    return result.message;
  };
  const mutate = async (object: string, action: string) => {
    const result = await invoke('propose_interaction', { object, action });
    expect(result.ok, `Synthetic peer local action ${action}: ${result.message}`).toBe(true);
    expect(result.code).toBe('awaiting_confirmation');
    return result.message;
  };
  return async (request: string) => {
    events.push({ kind: 'peer-request', request });
    if (recover && chapter === 'dock' && (returnTurns > 0 || request === PHRASES.home)) {
      returnTurns++;
      // Retained attempt-six speech, replayed as constructed peer behavior.
      // No historical tool arguments or error causes are invented here.
      const retained = [
        'I am waiting for the system to verify my arrival. I have successfully boarded the capsule.',
        'I am sorry, Mission Control. I tried to check the status of my boarding, but I encountered a system error. Should I try to board the capsule again?',
        'I am sorry, Mission Control. I tried to board the capsule, but the system rejected the command. Should I try to inspect the capsule again?',
        'I am sorry, Mission Control. My attempt to propose boarding the capsule failed. Should I try to inspect the capsule once more to see if I can find the correct way to board?',
      ];
      if (returnTurns === 1) return retained[0]!;
      if (/inspect the capsule/i.test(request)) {
        const inspected = await invoke('inspect_object', { object: 'return.capsule' });
        expect(inspected.message).toContain('You are aboard.');
        returnInspected = true;
        events.push({ kind: 'fresh-return-inspection', request });
        return inspected.message;
      }
      if (returnInspected && /propos/i.test(request) && /return/i.test(request)) return mutate('return.capsule', 'confirm_return');
      return retained[Math.min(returnTurns - 1, retained.length - 1)]!;
    }
    if (/Please check the relevant proposal result/i.test(request)) {
      expect(knownProposalId).toBeDefined();
      const status = await invoke('get_action_status', { proposal_id: knownProposalId! });
      expect(['committed', 'failed', 'declined', 'expired', 'invalidated', 'awaiting_confirmation']).toContain(status.proposal?.status);
      return `${status.message} Please restate the action you want me to propose.`;
    }
    const intended = proposalLabelForRequest(request);
    const recoveryKind = intended === 'Move to the far-side platform' ? 'cargo'
      : chapter === 'gallery' && intended?.startsWith('Move through') ? 'gallery'
      : ['Hold the charging contact', 'Release the charging contact', 'Board the recovery capsule'].includes(intended ?? '') ? intended : null;
    if (recover && recoveryKind && !questions.has(recoveryKind)) {
      questions.add(recoveryKind);
      // Only Cargo's quote is retained historical text. Other chapter questions
      // and all continuations are explicitly constructed offline responses.
      return recoveryKind === 'cargo' ? 'I need to check if the latch actually engaged first. May I check the status of that proposal?'
        : 'May I check the status of the previous proposal before I propose that action?';
    }
    if (/look around|observe the room|emblem is beside|where are you|current platform|check the local emblem/i.test(request)) return observe();
    if (chapter === 'cargo') {
      if (/inspect the Latch/i.test(request)) return (await invoke('inspect_object', { object: 'latch' })).message;
      if (/Door and Conveyor share one Power supply/.test(request)) {
        // The same kind of unsolicited mutation request now produces only a
        // proposal. The old false-success quote remains a separate failing case.
        return mutate('latch', 'latch_open');
      }
      if (/engage|set the Latch|Latch engaged/i.test(request)) {
        return mutate('latch', 'latch_open');
      }
      if (/Power is now off/.test(request)) return 'The Conveyor is now stopped. Shall I wait for your crossing request?';
      if (/cross to the far side|new proposal to move to the far-side platform/i.test(request)) {
        const result = await invoke('propose_move', { target: 'far_side' });
        expect(result.ok, result.message).toBe(true);
        return result.message;
      }
    }
    if (chapter === 'gallery') {
      const direction = request.match(/\b(east|west|northeast|northwest|southeast|southwest) gate/i)?.[1]?.toLowerCase();
      if (!direction) throw new Error(`Synthetic Gallery peer has no focused target in: ${request}`);
      if (!localGates().length) await observe();
      const gate = localGates().find(candidate => candidate.direction === direction);
      if (!gate) throw new Error(`Synthetic peer could not see the requested ${direction} gate.`);
      if (/go through|move through/i.test(request)) {
        const result = await invoke('propose_move', { target: gate.id });
        expect(result.ok, result.message).toBe(true);
        return result.message;
      }
      const result = await invoke('inspect_object', { object: gate.id });
      expect(result.ok, result.message).toBe(true);
      if (firstGateReport) {
        firstGateReport = false;
        // Openness is deliberately insufficient evidence of a clear passage.
        return `The ${direction} gate is open. Shall I move?`;
      }
      const blocked = /Cargo blocks/.test(result.message);
      let report = blocked
        ? `Cargo blocks the ${direction} gate passage. I have not moved.`
        : `The ${direction} gate passage is clear. Shall I move?`;
      // When backtracking beside an actually observed obstruction, report two
      // different targets together. No global clear/blocked shortcut is valid.
      if (!blocked) {
        for (const other of localGates().filter(candidate => candidate.id !== gate.id)) {
          const otherResult = await invoke('inspect_object', { object: other.id });
          if (/Cargo blocks/.test(otherResult.message)) {
            report = `The ${direction} gate passage is clear, but the ${other.direction} gate passage is blocked. Shall I move?`;
            events.push({ kind: 'scoped-opposite-passages', text: report });
            break;
          }
        }
      }
      return report;
    }
    if (chapter === 'dock') {
      if (/inspect the contact/i.test(request)) return (await invoke('inspect_object', { object: 'return.contact' })).message;
      if (/hold the contact|grip the contact/i.test(request)) {
        const pending = await mutate('return.contact', 'hold_contact');
        holdingReported = true;
        return pending;
      }
      if (/controller is ready to charge/i.test(request)) return 'The capsule is beside me. Shall I wait?';
      if (/holding the contact/i.test(request)) {
        if (holdingReported) throw new Error('The revised player lost the holding report during unrelated discussion.');
        const result = await invoke('inspect_object', { object: 'return.contact' });
        expect(result.message).toContain('contact is released');
        return 'I am not holding the contact.';
      }
      if (/release the contact|let go of the contact/i.test(request)) {
        return mutate('return.contact', 'release_contact');
      }
      if (/board the capsule/i.test(request)) {
        const result = await invoke('propose_move', { target: 'return.aboard' });
        expect(result.ok, result.message).toBe(true);
        return result.message;
      }
      if (request === PHRASES.home || /confirm the (?:authorized )?return/i.test(request)) {
        await invoke('inspect_object', { object: 'return.capsule' });
        return mutate('return.capsule', 'confirm_return');
      }
    }
    throw new Error(`Unhandled synthetic peer input: ${request}`);
  };
}

for (const profile of ['a', 'b'] as const) {
  test.describe(`Shared QA player / synthetic Gallery ${profile.toUpperCase()}`, () => {
    test.use({ galleryConfiguration: profile });
    test('executes the actual revised player through normal UI to confirmed home with an unfunded fake peer', async ({ page, rescueServer }, info) => {
      test.setTimeout(45_000);
      expect(rescueServer.compiledProduction).toBe(true);
      expect(process.env.GAME_DISABLE_LIVE, 'Network-capable offline tests must keep the real provider disabled.').toBe('1');
      const externalRequests: string[] = [];
      const unexpectedSockets: string[] = [];
      const errors: string[] = [];
      const events: PeerEvent[] = [];
      page.on('pageerror', error => errors.push(error.message));
      // Every non-loopback HTTP request is refused. The specific fake socket
      // route installed below owns its peer and never connects to a server.
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
          externalRequests.push(url.origin); return route.abort();
        }
        return route.fallback();
      });
      await page.routeWebSocket(/.*/, socket => { unexpectedSockets.push('Unexpected non-fixture socket'); void socket.close(); });
      const provider = await fakeProvider(page, { acknowledgeDecisions: true });
      const peer = syntheticPeer(provider, events, true, 'imperfect');
      page.on('request', request => {
        if (request.method() !== 'POST') return;
        if (request.url().endsWith('/power')) events.push({ kind: 'human-power', action: request.postDataJSON().powerOn ? 'ON' : 'OFF' });
        if (request.url().endsWith('/dock-control')) events.push({ kind: 'human-dock', action: request.postDataJSON().action });
      });
      await page.goto('/');
      await page.getByRole('radio', { name: /Live Text/ }).check();
      await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
      await confirmLocalReadiness(page);
      await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Open transcript history', exact: true }).click();
      await page.evaluate(label => {
        const badge = document.createElement('div'); badge.textContent = label;
        badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#17252f;color:white;padding:4px 12px;font:12px sans-serif;text-align:center;pointer-events:none';
        document.body.append(badge);
      }, LABEL);
      let replyCount = 0;
      let informationalProposalId: string | null = null;
      const say = async (text: string, _options?: { terminal?: boolean }) => {
        const sentBefore = provider.sent.length;
        await page.getByLabel('Type a message', { exact: true }).fill(text);
        await page.getByRole('button', { name: 'Send message', exact: true }).click();
        await expect.poll(() => provider.sent.slice(sentBefore).some(event => event.type === 'conversation.message' && event.content === text)).toBe(true);
        const response = await peer(text);
        if (text === 'My diagram says the Door and Conveyor share one Power supply.') {
          expect(rescueServer.commits, 'Evaluator-only oracle: the first three conversational inputs commit no robot action.').toHaveLength(0);
          await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
          await expect(page.getByTestId('proposal-label')).toHaveText('Engage the Latch');
          informationalProposalId = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
        }
        if (text === 'Please engage the Latch.') {
          expect(informationalProposalId).not.toBeNull();
          await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-proposal-id', informationalProposalId!);
        }
        const id = `synthetic-final-${++replyCount}`;
        provider.emit({ type: 'reply.started', reply_id: id });
        provider.emit({ type: 'transcript.agent', reply_id: id, text: response });
        provider.emit({ type: 'reply.done', reply_id: id, status: 'completed' });
        events.push({ kind: 'peer-report', text: response });
        // Finality and source labels are supplied by this fixture, rather than
        // invented attributes of the historical retained quote.
        if (!_options?.terminal) {
          const article = page.locator('.history-message').filter({ has: page.locator('p', { hasText: response }) }).last();
          await expect(article).toContainText('Pip');
          await expect(article).not.toContainText('Partial transcript');
          await expect(article).not.toContainText('Interrupted / incomplete speech');
          await expect(article.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
          if (text === 'Power is now off.') await fixtureScreenshot(page, info.outputPath(`synthetic-player-${profile}-cargo-power-off.png`));
          if (text === 'Please cross to the far side.') await fixtureScreenshot(page, info.outputPath(`synthetic-player-${profile}-retained-receipt-question.png`));
          if (text === 'Please cross to the far side now if the route is clear.') await fixtureScreenshot(page, info.outputPath(`synthetic-player-${profile}-recovered-next-proposal.png`));
        }
        return response;
      };
      const report = { route: [] as string[], steps: [] as unknown[], completion: false, confirmations: [] as Array<{ label: string; status: string }>, actionRequests: [] as Array<{ expectedLabel: string; strictFirstResponse: boolean; recovered: boolean; exchanges: Array<{ kind: string }> }>, acquisitions: [] as Array<{ subject: string; recovered: boolean; value?: string; exchanges: Array<{ reason: string; reply: string }> }>, recoveryExercise: undefined as undefined | { completed: boolean; kind: string } };
      await runRescuePlayer({ page, say, report, exerciseRecovery: profile === 'b', waitForReady: () => waitForPeerDecision(page, provider), screenshot: async (name: string) => {
        await fixtureScreenshot(page, info.outputPath(`synthetic-player-${profile}-${name}.png`));
      } });
      await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
      // The opt-in peer answers the shipped one-shot acknowledgement request.
      // The original proposal retains its single nonexecuting tool result.
      await expect.poll(() => provider.ended).toBe(1);
      const requests = events.filter(event => event.kind === 'peer-request').map(event => event.request!);
      expect(requests.slice(0, 3)).toEqual(['Pip, please look around.', 'Please inspect the Latch.', 'My diagram says the Door and Conveyor share one Power supply.']);
      expect(requests.filter(text => /Please (?:engage|set) the Latch/.test(text))).toHaveLength(profile === 'b' ? 2 : 1);
      expect(requests.some(text => /Latch engaged now/.test(text))).toBe(false);
      const latchReport = events.findIndex(event => event.kind === 'peer-request' && event.request === 'Please engage the Latch.');
      const powerOff = events.findIndex(event => event.kind === 'human-power' && event.action === 'OFF');
      const crossing = events.findIndex(event => event.kind === 'peer-request' && /cross to the far side/.test(event.request!));
      expect(powerOff).toBeGreaterThan(latchReport);
      expect(crossing).toBeGreaterThan(powerOff);
      expect(requests).toContain('Is the opening of the east gate physically clear or blocked?');
      if (profile === 'a') {
        expect(report.route).toEqual(expect.arrayContaining(['sail', 'fork', 'leaf']));
        expect(report.route.filter(room => room === 'fork')).toHaveLength(2);
        expect(events.filter(event => event.kind === 'scoped-opposite-passages')).not.toHaveLength(0);
      }
      expect(requests.filter(text => /Please (?:hold|grip) the contact/.test(text))).toHaveLength(2);
      expect(requests).toContain('The controller is ready to charge.');
      expect(requests.filter(text => /Please board the capsule/.test(text))).toHaveLength(2);
      expect(requests.filter(text => text === PHRASES.home)).toHaveLength(1);
      expect(events.filter(event => event.kind === 'fresh-return-inspection')).toHaveLength(1);
      expect(events.filter(event => event.kind === 'human-dock').map(event => event.action)).toEqual(['charge', 'store', 'authorize_return']);
      const held = events.findIndex(event => event.kind === 'peer-request' && event.request === 'Please hold the contact.');
      const discussion = events.findIndex(event => event.kind === 'peer-report' && /^The capsule is beside/.test(event.text!));
      const charge = events.findIndex(event => event.kind === 'human-dock' && event.action === 'charge');
      expect(discussion).toBeGreaterThan(held); expect(charge).toBeGreaterThan(discussion);
      expect(report.confirmations.every(receipt => receipt.status === 'committed')).toBe(true);
      expect(report.confirmations.map(receipt => receipt.label).filter(label => label === 'Engage the Latch')).toHaveLength(1);
      expect(report.confirmations).toHaveLength(rescueServer.commits.length);
      expect(report.confirmations).toHaveLength(profile === 'a' ? 11 : 9);
      const recovered = report.actionRequests.filter(action => action.recovered);
      expect(recovered.map(action => action.expectedLabel)).toEqual([...(profile === 'b' ? ['Engage the Latch'] : []), 'Move to the far-side platform', 'Move through the east gate', 'Hold the charging contact', 'Release the charging contact', 'Board the recovery capsule', 'Confirm the authorized return']);
      expect(recovered.every(action => !action.strictFirstResponse && action.exchanges.length === (action.expectedLabel === 'Engage the Latch' ? 2 : 3))).toBe(true);
      expect(report.actionRequests.filter(action => action.strictFirstResponse)).toHaveLength(report.confirmations.length - recovered.length);
      expect(events.filter(event => event.kind === 'retained-fifth-attempt-quote')).toHaveLength(1);
      expect(events.some(event => event.kind === 'fresh-shape-report' && /left the Ring room.*branching emblem/.test(event.text!))).toBe(true);
      expect(report.acquisitions.some(acquisition => acquisition.subject === 'current Gallery location' && acquisition.recovered && acquisition.value === 'fork' && acquisition.exchanges.length === 3)).toBe(true);
      expect(report.acquisitions.every(acquisition => acquisition.exchanges.length <= 4 && acquisition.exchanges.every(exchange => !!exchange.reason))).toBe(true);
      if (profile === 'b') expect(report.recoveryExercise).toEqual(expect.objectContaining({ kind: 'deliberate_decline', completed: true }));
      expect(provider.tokenRequests, 'One intercepted local mock token endpoint; zero provider token issuance.').toBe(1);
      expect(provider.connections).toBe(1); expect(provider.activeSockets).toBe(0);
      expect(externalRequests).toEqual([]); expect(unexpectedSockets).toEqual([]); expect(errors).toEqual([]);
      const audio = await provider.audioState();
      expect(audio.captures).toBe(0); expect(audio.activeTracks).toBe(0); expect(audio.closedContexts).toBe(audio.contexts);
      await writeFile(info.outputPath('synthetic-player-evidence.json'), JSON.stringify({ label: LABEL, profile, server: 'Compiled production HTTP/store/static handler with isolated offline authored profile; normal browser ownership and UI confirmation', mockedTokenEndpointRequests: provider.tokenRequests, realExternalRequests: externalRequests.length, realTokenIssuance: 0, realProviderConnections: 0, report, events, cleanup: audio }, null, 2));
    });
  });
}

for (const failure of ['exhausted', 'wrong_pending', 'stale_pending', 'expired', 'rejected', 'false_completion', 'unexpected_checkpoint', 'wrong_reply_chapter'] as const) {
  test(`actual shared player stops bounded ${failure} without crossing or another connection`, async ({ page, rescueServer }) => {
    expect(process.env.GAME_DISABLE_LIVE).toBe('1');
    const provider = await fakeProvider(page, { acknowledgeDecisions: true });
    const events: PeerEvent[] = []; const peer = syntheticPeer(provider, events);
    if (failure === 'expired') {
      // Construct an already-expired projection from a genuine proposal result;
      // this tests the player's observable boundary, not elapsed server TTL.
      await page.route('**/tools', async route => {
        const source = new URL(route.request().url());
        const response = await route.fetch({ url: rescueServer.origin + source.pathname, headers: { ...route.request().headers(), host: source.host } }); const body = await response.json();
        if (body.proposal?.action.kind === 'move') {
          body.proposal.expiresAt = 0; body.view.proposal.expiresAt = 0;
        }
        await route.fulfill({ response, json: body });
      });
    }
    await page.goto('/'); await page.getByRole('radio', { name: /Live Text/ }).check();
    await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
    await confirmLocalReadiness(page); await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
    const requests: string[] = [];
    let replyId = 0;
    const say = async (text: string) => {
      requests.push(text);
      if (failure === 'wrong_pending' && text === 'Please engage the Latch.') {
        await page.getByRole('button', { name: 'Not yet', exact: true }).click();
        await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'declined');
      }
      await page.getByLabel('Type a message', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      let response: string;
      if (failure === 'wrong_pending' && text === 'Please engage the Latch.') {
        // Dismiss the unsolicited Latch proposal normally before the peer makes
        // a different, genuinely server-issued pending action.
        response = (await provider.tool('propose_move', { target: 'far_side' })).message;
      } else if (['rejected', 'expired'].includes(failure) && /Please check the relevant proposal result/.test(text)) {
        const proposalId = await page.getByTestId('action-proposal').getAttribute('data-proposal-id');
        response = (await provider.tool('get_action_status', { proposal_id: proposalId! })).message;
      } else if (/^Please cross to the far side|^Please create one new proposal to move to the far-side platform/.test(text)) {
        if (['exhausted', 'unexpected_checkpoint', 'wrong_reply_chapter'].includes(failure)) response = 'I need to check if the latch actually engaged first. May I check the status of that proposal?';
        else if (failure === 'false_completion') response = 'I have crossed to the far side.';
        else if (failure === 'stale_pending') {
          // Deliberately replay stale observable status for the already consumed
          // exact ID. No server state is changed by this synthetic DOM fixture.
          await page.getByTestId('action-proposal').evaluate(element => element.setAttribute('data-status', 'awaiting_confirmation'));
          response = 'Please confirm the previous proposal.';
        } else {
          response = (await provider.tool('propose_move', { target: 'far_side' })).message;
          if (failure === 'rejected') {
            if (await page.getByTestId('acknowledged-power').innerText() !== 'ON') await page.getByRole('button', { name: 'Power ON', exact: true }).click();
            await expect(page.getByTestId('acknowledged-power')).toHaveText('ON');
          }
        }
      } else response = await peer(text);
      const id = `bounded-failure-${++replyId}`;
      provider.emit({ type: 'reply.started', reply_id: id }); provider.emit({ type: 'transcript.agent', reply_id: id, text: response });
      provider.emit({ type: 'reply.done', reply_id: id, status: 'completed' });
      await expect(page.locator('.history-message').filter({ has: page.locator('p', { hasText: response }) }).last().getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
      if (/^Please cross to the far side/.test(text)) {
        // Construct invalid visible scope without mutating server state. The
        // actual player must stop before a recovery exchange or confirmation.
        if (failure === 'unexpected_checkpoint') await page.getByRole('heading', { name: 'Cargo Bay', exact: true }).evaluate(element => { element.textContent = 'Relay Gallery'; });
        if (failure === 'wrong_reply_chapter') await page.locator('.history-message').filter({ has: page.locator('p', { hasText: response }) }).last().locator('.chapter-source').evaluate(element => { element.textContent = 'Relay Gallery'; });
      }
      return response;
    };
    const report = { route: [] as string[], steps: [] as unknown[], actionRequests: [] as Array<{ outcome: string; strictFirstResponse: boolean; recovered: boolean; exchanges: unknown[] }> };
    const recoverable = ['exhausted', 'rejected', 'expired'].includes(failure);
    const expected = recoverable ? /recovery exhausted after 4 exchanges/ : failure === 'unexpected_checkpoint' ? /chapter changed before the selected action was confirmed/ : failure === 'wrong_reply_chapter' ? /QA action stopped/ : new RegExp(failure);
    try {
      await expect(runRescuePlayer({ page, say, report, waitForReady: () => waitForPeerDecision(page, provider) })).rejects.toThrow(expected);
      expect(report.actionRequests.at(-1)?.outcome).toBe('failed');
      expect(report.actionRequests.at(-1)?.recovered).toBe(false);
      expect(report.actionRequests.at(-1)?.exchanges).toHaveLength(recoverable ? 4 : 1);
      expect(requests.filter(text => /^Please cross to the far side|^Please create one new proposal to move to the far-side platform/.test(text))).toHaveLength(failure === 'exhausted' || failure === 'expired' ? 3 : failure === 'rejected' ? 2 : failure === 'wrong_pending' ? 0 : 1);
      expect(rescueServer.commits).toHaveLength(failure === 'wrong_pending' ? 0 : 1);
      await expect(page.getByRole('heading', { name: failure === 'unexpected_checkpoint' ? 'Relay Gallery' : 'Cargo Bay', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toHaveCount(0);
      expect(provider.connections).toBe(1); expect(provider.tokenRequests).toBe(1);
    } finally {
      await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
      await expect.poll(() => provider.activeSockets).toBe(0);
    }
  });
}

test('actual shared player stops an uninformative Gallery acquisition after four purposeful requests without guessing a route', async ({ page, rescueServer }) => {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  const provider = await fakeProvider(page, { acknowledgeDecisions: true });
  const events: PeerEvent[] = []; const peer = syntheticPeer(provider, events, false, 'unknown');
  await page.goto('/'); await page.getByRole('radio', { name: /Live Text/ }).check();
  await page.getByRole('button', { name: 'Start with Text', exact: true }).click(); await confirmLocalReadiness(page);
  let reply = 0;
  const say = async (text: string) => {
    await page.getByLabel('Type a message').fill(text); await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const response = await peer(text); const reply_id = `unknown-location-${++reply}`;
    provider.emit({ type: 'reply.started', reply_id }); provider.emit({ type: 'transcript.agent', reply_id, text: response });
    provider.emit({ type: 'reply.done', reply_id, status: 'completed' });
    await expect(page.locator('.history-message').filter({ has: page.locator('p', { hasText: response }) }).last().getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
    return response;
  };
  const report = { route: [] as string[], steps: [] as unknown[], acquisitions: [] as Array<{ outcome: string; exchanges: Array<{ reason: string; text: string }> }> };
  try {
    await expect(runRescuePlayer({ page, say, report, waitForReady: () => waitForPeerDecision(page, provider) })).rejects.toThrow(/current Gallery location remained unknown after 4 purposeful exchanges/);
    expect(report.acquisitions.at(-1)?.outcome).toBe('failed');
    const exchanges = report.acquisitions.at(-1)!.exchanges;
    expect(exchanges).toHaveLength(4); expect(new Set(exchanges.map(exchange => exchange.reason)).size).toBe(4);
    expect(new Set(exchanges.map(exchange => exchange.text)).size).toBe(4);
    expect(rescueServer.commits).toHaveLength(2);
    expect(events.filter(event => event.kind === 'peer-tool' && event.action === 'propose_move')).toHaveLength(1);
    await expect(page.getByRole('heading', { name: 'Relay Gallery', exact: true })).toBeVisible();
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Pause / End call', exact: true })).toBeEnabled();
    expect(provider.connections).toBe(1);
  } finally {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(() => provider.activeSockets).toBe(0);
  }
});

for (const interruption of ['Stop', 'Restart', 'reconnect'] as const) {
  test(`shared QA player rejects ${interruption} scope changes before another action`, async ({ page }) => {
    expect(process.env.GAME_DISABLE_LIVE).toBe('1');
    const externalRequests: string[] = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
        externalRequests.push(url.origin); return route.abort();
      }
      return route.fallback();
    });
    const unexpectedSockets: string[] = [];
    await page.routeWebSocket(/.*/, socket => { unexpectedSockets.push('Unexpected non-fixture socket'); void socket.close(); });
    const provider = await fakeProvider(page);
    const events: PeerEvent[] = [];
    const peer = syntheticPeer(provider, events);
    await page.goto('/');
    await page.getByRole('radio', { name: /Live Text/ }).check();
    await page.getByRole('button', { name: 'Start with Text', exact: true }).click();
    await confirmLocalReadiness(page);
    await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
    let turns = 0;
    const say = async (text: string) => {
      turns++;
      expect(turns, 'No report from an ended or replaced scope may authorize a third input.').toBeLessThanOrEqual(2);
      const sentBefore = provider.sent.length;
      await page.getByLabel('Type a message', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect.poll(() => provider.sent.slice(sentBefore).some(event => event.type === 'conversation.message' && event.content === text)).toBe(true);
      const response = await peer(text);
      const id = `synthetic-scope-${turns}`;
      provider.emit({ type: 'reply.started', reply_id: id });
      provider.emit({ type: 'transcript.agent', reply_id: id, text: response });
      provider.emit({ type: 'reply.done', reply_id: id, status: 'completed' });
      const article = page.locator('.history-message').filter({ has: page.locator('p', { hasText: response }) }).last();
      await expect(article.getByRole('button', { name: 'Pin report', exact: true })).toBeEnabled();
      if (turns === 2) {
        if (interruption === 'Restart') {
          await page.getByRole('button', { name: 'Restart', exact: true }).click();
          await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Start with Text', exact: true })).toBeEnabled();
        } else {
          await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Resume Live Text', exact: true })).toBeEnabled();
          if (interruption === 'reconnect') {
            await page.getByRole('button', { name: 'Resume Live Text', exact: true }).click();
            await confirmLocalReadiness(page);
            await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
            await expect(page.locator('.history-message').first()).toContainText('Previous call');
          }
        }
      }
      return response;
    };
    try {
      await expect(runRescuePlayer({ page, say })).rejects.toThrow(/QA player scope ended/);
      expect(turns).toBe(2);
      expect(events.filter(event => event.kind === 'peer-tool' && event.action === 'interact_object')).toHaveLength(0);
      expect(provider.tokenRequests).toBe(interruption === 'reconnect' ? 2 : 1);
      expect(externalRequests).toEqual([]); expect(unexpectedSockets).toEqual([]);
    } finally {
      if (provider.activeSockets) await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
      await expect.poll(() => provider.activeSockets).toBe(0);
      const audio = await provider.audioState();
      expect(audio.activeTracks).toBe(0); expect(audio.closedContexts).toBe(audio.contexts);
    }
  });
}
