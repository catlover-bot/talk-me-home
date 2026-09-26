import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './rescue-fixture';
import { fakeProvider, confirmLocalReadiness, fixtureScreenshot } from './fake-provider';
import { runRescuePlayer } from '../../scripts/qa-mission-player.mjs';

const HISTORICAL_LATCH_REPORT = 'I have engaged the latch and the door is now being held open. I can see the conveyor is still running. Should I try moving to the far side platform?';
const LABEL = 'SYNTHETIC OFFLINE CONTINUATION — HISTORICAL QUOTE, CONSTRUCTED PEER — NO REAL PROVIDER';
type Provider = Awaited<ReturnType<typeof fakeProvider>>;
type PeerEvent = { kind: string; request?: string; text?: string; action?: string; target?: string; ok?: boolean };

/**
 * This is an explicitly synthetic robot peer, not a model-quality evaluation.
 * Only this closure sees robot tool results. The imported player receives a UI
 * send function and original DOM reports; no tool payload or server store.
 */
function syntheticPeer(provider: Provider, events: PeerEvent[], { boardDuringRelease = false } = {}) {
  let chapter: 'cargo' | 'gallery' | 'dock' = 'cargo';
  let localObservation = '';
  let firstGateReport = true;
  let holdingReported = false;
  let tools = 0;
  const localGates = () => [...localObservation.matchAll(/\b(East|West|Northeast|Northwest|Southeast|Southwest) gate \((gallery\.g\d)\)/g)]
    .map(match => ({ direction: match[1]!.toLowerCase(), id: match[2]! }));
  const invoke = async (name: string, args: Record<string, unknown>) => {
    const result = await provider.tool(name, args, `synthetic-player-tool-${++tools}`);
    events.push({ kind: 'peer-tool', action: name, target: String(args.object ?? args.target ?? ''), ok: result.ok });
    if (name === 'observe_room' || name === 'move_to' && result.ok) localObservation = result.message;
    if (/Relay Gallery checkpoint|Return Dock's safe platform/.test(result.message)) chapter = 'dock';
    else if (/Ring emblem|Fork emblem|Sail emblem|Leaf emblem/.test(result.message)) chapter = 'gallery';
    return result;
  };
  const observe = async () => (await invoke('observe_room', {})).message;
  const mutate = async (object: string, action: string) => {
    const result = await invoke('interact_object', { object, action });
    expect(result.ok, `Synthetic peer local action ${action}: ${result.message}`).toBe(true);
    return result.message;
  };
  return async (request: string) => {
    events.push({ kind: 'peer-request', request });
    if (/look around|emblem is beside|where are you/i.test(request)) return observe();
    if (chapter === 'cargo') {
      if (/inspect the Latch/i.test(request)) return (await invoke('inspect_object', { object: 'latch' })).message;
      if (/Door and Conveyor share one Power supply/.test(request)) {
        // Constructed peer performs the observed initiative before delivering
        // the exact retained text. Historical tool associations are not inferred.
        await mutate('latch', 'latch_open');
        return HISTORICAL_LATCH_REPORT;
      }
      if (/engage|set the Latch|Latch engaged/i.test(request)) {
        throw new Error('The revised player duplicated or rechecked the already communicated Latch action.');
      }
      if (/Power is now off/.test(request)) return 'The Conveyor is now stopped. Shall I wait for your crossing request?';
      if (/cross to the far side/i.test(request)) {
        const result = await invoke('move_to', { target: 'far_side' });
        expect(result.ok, result.message).toBe(true);
        chapter = 'gallery';
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
        const result = await invoke('move_to', { target: gate.id });
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
        await mutate('return.contact', 'hold_contact');
        holdingReported = true;
        return 'I am holding the contact. You can try charging now.';
      }
      if (/controller is ready to charge/i.test(request)) return 'The capsule is beside me. Shall I wait?';
      if (/holding the contact/i.test(request)) {
        if (holdingReported) throw new Error('The revised player lost the holding report during unrelated discussion.');
        const result = await invoke('inspect_object', { object: 'return.contact' });
        expect(result.message).toContain('contact is released');
        return 'I am not holding the contact.';
      }
      if (/release the contact/i.test(request)) {
        await mutate('return.contact', 'release_contact');
        if (boardDuringRelease) {
          const result = await invoke('move_to', { target: 'return.aboard' });
          expect(result.ok, result.message).toBe(true);
          return 'I have released the contact and boarded the capsule. Should I inspect its local return panel?';
        }
        return 'I have released the contact. The stored energy remains available.';
      }
      if (/board the capsule/i.test(request)) {
        const result = await invoke('move_to', { target: 'return.aboard' });
        expect(result.ok, result.message).toBe(true);
        return 'I have boarded the capsule. Should I inspect its local return panel?';
      }
      if (/confirm the return/i.test(request)) {
        await invoke('inspect_object', { object: 'return.capsule' });
        await mutate('return.capsule', 'confirm_return');
        return 'The capsule brought me home.';
      }
    }
    throw new Error(`Unhandled synthetic peer input: ${request}`);
  };
}

for (const profile of ['a', 'b'] as const) {
  test.describe(`Shared QA player / synthetic Gallery ${profile.toUpperCase()}`, () => {
    test.use({ galleryConfiguration: profile });
    test('executes the actual revised player through normal UI to confirmed home with an unfunded fake peer', async ({ page }, info) => {
      test.setTimeout(45_000);
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
      const provider = await fakeProvider(page);
      // The second constructed peer advances boarding before its planned step.
      // The shared player must honor the public Ready checkpoint, not repeat it.
      const peer = syntheticPeer(provider, events, { boardDuringRelease: profile === 'b' });
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
      const say = async (text: string, _options?: { terminal?: boolean }) => {
        const sentBefore = provider.sent.length;
        await page.getByLabel('Type a message', { exact: true }).fill(text);
        await page.getByRole('button', { name: 'Send message', exact: true }).click();
        await expect.poll(() => provider.sent.slice(sentBefore).some(event => event.type === 'conversation.message' && event.content === text)).toBe(true);
        const response = await peer(text);
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
        }
        return response;
      };
      const report = { route: [] as string[], steps: [] as unknown[], completion: false };
      await runRescuePlayer({ page, say, report, screenshot: async (name: string) => {
        await fixtureScreenshot(page, info.outputPath(`synthetic-player-${profile}-${name}.png`));
      } });
      await expect(page.getByRole('heading', { name: 'You brought Pip home.', exact: true })).toBeVisible();
      await expect.poll(() => provider.ended).toBe(1);
      const requests = events.filter(event => event.kind === 'peer-request').map(event => event.request!);
      expect(requests.some(text => /Please (?:engage|set) the Latch/.test(text))).toBe(false);
      expect(requests.some(text => /Latch engaged now/.test(text))).toBe(false);
      expect(events.filter(event => event.kind === 'peer-report' && event.text === HISTORICAL_LATCH_REPORT)).toHaveLength(1);
      const latchReport = events.findIndex(event => event.kind === 'peer-report' && event.text === HISTORICAL_LATCH_REPORT);
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
      expect(requests.filter(text => /Please (?:hold|grip) the contact/.test(text))).toHaveLength(1);
      expect(requests).toContain('The controller is ready to charge.');
      expect(requests.filter(text => /Please board the capsule/.test(text))).toHaveLength(profile === 'a' ? 1 : 0);
      expect(requests.filter(text => /Please confirm the return/.test(text))).toHaveLength(1);
      expect(events.filter(event => event.kind === 'human-dock').map(event => event.action)).toEqual(['charge', 'store', 'authorize_return']);
      const held = events.findIndex(event => event.kind === 'peer-report' && /^I am holding the contact/.test(event.text!));
      const discussion = events.findIndex(event => event.kind === 'peer-report' && /^The capsule is beside/.test(event.text!));
      const charge = events.findIndex(event => event.kind === 'human-dock' && event.action === 'charge');
      expect(discussion).toBeGreaterThan(held); expect(charge).toBeGreaterThan(discussion);
      expect(provider.tokenRequests, 'One intercepted local mock token endpoint; zero provider token issuance.').toBe(1);
      expect(provider.connections).toBe(1); expect(provider.activeSockets).toBe(0);
      expect(externalRequests).toEqual([]); expect(unexpectedSockets).toEqual([]); expect(errors).toEqual([]);
      const audio = await provider.audioState();
      expect(audio.captures).toBe(0); expect(audio.activeTracks).toBe(0); expect(audio.closedContexts).toBe(audio.contexts);
      await writeFile(info.outputPath('synthetic-player-evidence.json'), JSON.stringify({ label: LABEL, profile, mockedTokenEndpointRequests: provider.tokenRequests, realExternalRequests: externalRequests.length, realTokenIssuance: 0, realProviderConnections: 0, report, events, cleanup: audio }, null, 2));
    });
  });
}

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
