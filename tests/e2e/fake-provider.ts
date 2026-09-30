import { expect, type Page, type WebSocketRoute } from '@playwright/test';
import { sessionConfig } from '../../game/agent/config';
import type { ToolResponse, ToolResult } from '../../game/shared/contracts';
import { confirmVisibleProposal } from '../../scripts/qa-mission-player.mjs';

export type FixtureEvent = Record<string, unknown> & { type: string };
type AudioFixture = {
  stats(): { captures: number; activeTracks: number; contexts: number; closedContexts: number; queuedChunks: number };
  render(): void;
  drain(): void;
};
declare global { interface Window { __testAudio: AudioFixture } }

/** Browser-only fixtures. No provider connection, hardware audio, or production hooks. */
export async function fakeProvider(page: Page, { permissionDenied = false, acknowledgeDecisions = false, arrivalReports = false, readyOnUpdate = true } = {}) {
  await page.addInitScript(({ deny }) => {
    let captures = 0;
    let activeTracks = 0;
    let contexts = 0;
    let closedContexts = 0;
    let queuedChunks = 0;
    const playback: FakeWorklet[] = [];
    class FakeContext {
      state = 'running';
      sampleRate = 24_000;
      currentTime = 0;
      destination = {};
      onstatechange: (() => void) | null = null;
      audioWorklet = { addModule: async () => {} };
      constructor() { contexts++; }
      async resume() { this.state = 'running'; }
      async close() { if (this.state !== 'closed') closedContexts++; this.state = 'closed'; }
      createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 256, getFloatTimeDomainData(samples: Float32Array) { samples.fill(0.04); }, disconnect() {} }; }
      createOscillator() { return { type: 'sine', frequency: { value: 0 }, onended: null as (() => void) | null, connect() {}, disconnect() {}, start() {}, stop() { this.onended?.(); } }; }
    }
    class FakeWorklet {
      generation = 0;
      connected = true;
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: (data: { audio?: ArrayBuffer; generation?: number; type?: string }) => {
          if (data.generation !== undefined) this.generation = data.generation;
          if (data.audio) queuedChunks++;
        },
      };
      constructor(_context: unknown, name: string) { if (name === 'playback') playback.push(this); }
      connect() { this.connected = true; }
      disconnect() { this.connected = false; }
      emit(type: string) { if (this.connected) this.port.onmessage?.({ data: { type, generation: this.generation } }); }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeContext });
    Object.defineProperty(window, 'AudioWorkletNode', { configurable: true, value: FakeWorklet });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      async getUserMedia() {
        if (deny) throw new DOMException('Test permission denial', 'NotAllowedError');
        captures++; activeTracks++;
        let stopped = false;
        const track = { onended: null, stop() { if (!stopped) activeTracks--; stopped = true; } };
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      },
    } });
    window.__testAudio = {
      stats: () => ({ captures, activeTracks, contexts, closedContexts, queuedChunks }),
      render: () => playback.at(-1)?.emit('started'),
      drain: () => playback.at(-1)?.emit('drained'),
    };
  }, { deny: permissionDenied });

  let tokenRequests = 0;
  let activeSockets = 0;
  let ended = 0;
  const sockets: WebSocketRoute[] = [];
  const sent: FixtureEvent[] = [];
  const sentObservers = new Set<(event: FixtureEvent, index: number) => void>();
  const waitForSent = (matches: (event: FixtureEvent) => boolean, firstSent = 0): Promise<FixtureEvent> => {
    const previous = sent.slice(firstSent).find(matches);
    if (previous) return Promise.resolve(previous);
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); sentObservers.delete(receive); page.off('close', closed); };
      const closed = () => { cleanup(); reject(new Error('The offline peer closed before the expected message.')); };
      const receive = (event: FixtureEvent, index: number) => {
        if (index < firstSent) return;
        try { if (matches(event)) { cleanup(); resolve(event); } }
        catch (error) { cleanup(); reject(error); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('The offline peer did not receive the expected message within 5000ms.')); }, 5000);
      // Registration and the history check have no asynchronous gap.
      sentObservers.add(receive); page.once('close', closed);
      if (page.isClosed()) closed();
    });
  };
  let decision: { proposal: { id: string; label: string; status: string }; result: { ok: boolean }; perception?: { emblem: string; gates: { direction: string }[] } } | undefined;
  let acknowledgements = 0;
  await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, message: 'Offline fixture access. No provider is contacted.' } }));
  await page.route('**/api/sessions/*/voice-token', async route => {
    tokenRequests++;
    await route.fulfill({ json: { token: 'offline-fixture-only', sessionConfig, maxSessionSeconds: 600 } });
  });
  // This route deliberately never calls connectToServer(). Playwright owns the peer.
  // https://playwright.dev/docs/api/class-websocketroute
  await page.routeWebSocket('wss://agents.assemblyai.com/**', socket => {
    sockets.push(socket); activeSockets++;
    let closed = false;
    const markClosed = () => { if (!closed) { activeSockets--; closed = true; } };
    socket.onClose(markClosed);
    socket.onMessage(data => {
      const event = JSON.parse(String(data)) as FixtureEvent;
      // Never retain provider configuration echoes, URLs, or microphone bytes.
      sent.push(event.type === 'session.update' || event.type === 'input.audio' ? { type: event.type } : event);
      for (const receive of sentObservers) receive(sent.at(-1)!, sent.length - 1);
      if (acknowledgeDecisions && event.type === 'conversation.message' && event.role === 'system' && String(event.content).startsWith('Verified game decision receipt.')) {
        decision = JSON.parse(String(event.content).split('\n').slice(1).join('\n'));
      }
      if (acknowledgeDecisions && decision && event.type === 'reply.create' && (String(event.instructions).startsWith(`Briefly acknowledge only the verified result for proposal ${decision.proposal.id} `)
        || String(event.instructions).startsWith(`Give one concise arrival and orientation report for the verified movement proposal ${decision.proposal.id},`))) {
        // Constructed acknowledgement of the actual eligible receipt. No local
        // survey, player intention, tool call or unobserved state is invented.
        const reply_id = `fixture-decision-ack-${++acknowledgements}`;
        const text = decision.result.ok && decision.proposal.status === 'committed'
          ? arrivalReports && decision.perception ? `I arrived at the ${decision.perception.emblem} emblem. I see gates to the ${decision.perception.gates.map(gate => gate.direction.toLowerCase()).join(', ')}.`
            : `The game confirmed: ${decision.proposal.label}.` : `The game did not execute: ${decision.proposal.label}.`;
        socket.send(JSON.stringify({ type: 'reply.started', reply_id }));
        socket.send(JSON.stringify({ type: 'transcript.agent', reply_id, text }));
        socket.send(JSON.stringify({ type: 'reply.done', reply_id, status: 'completed' }));
      }
      if (event.type === 'session.update' && readyOnUpdate) socket.send(JSON.stringify({ type: 'session.ready' }));
      if (event.type === 'session.end') {
        ended++; socket.send(JSON.stringify({ type: 'session.ended', session_duration_seconds: 0 }));
        markClosed(); void socket.close({ code: 1000 });
      }
    });
  });
  return {
    sent,
    waitForSent,
    get tokenRequests() { return tokenRequests; },
    get connections() { return sockets.length; },
    get activeSockets() { return activeSockets; },
    get ended() { return ended; },
    emit(event: FixtureEvent) { const socket = sockets.at(-1); if (!socket) throw new Error('Start the simulated connection first.'); socket.send(JSON.stringify(event)); },
    async tool(name: string, args: Record<string, unknown>, callId = `fixture-${sent.length}`) {
      const firstSent = sent.length;
      const socket = sockets.at(-1)!;
      const emit = (event: FixtureEvent) => socket.send(JSON.stringify(event));
      emit({ type: 'reply.started', reply_id: `ordinary-${callId}` });
      emit({ type: 'tool.call', call_id: callId, name, arguments: args });
      emit({ type: 'reply.done', reply_id: `ordinary-${callId}`, status: 'completed' });
      await waitForSent(event => event.type === 'tool.result' && event.call_id === callId, firstSent);
      return JSON.parse(String(sent.slice(firstSent).find(event => event.call_id === callId)?.result)) as ToolResult;
    },
    async confirmTool(name: string, args: Record<string, unknown>, expectedLabel: string, callId?: string): Promise<ToolResponse> {
      const proposed = await this.tool(name, args, callId);
      expect(proposed.code, 'A fixture action first yields one nonexecuting proposal result.').toBe('awaiting_confirmation');
      return confirmFixtureProposal(page, expectedLabel);
    },
    async audioState() { return page.evaluate(() => window.__testAudio.stats()); },
    async render() { await page.evaluate(() => window.__testAudio.render()); },
    async drain() { await page.evaluate(() => window.__testAudio.drain()); },
  };
}

/** Explicit fixture intent, confirmed through the same visible UI as the player. */
export async function confirmFixtureProposal(page: Page, expectedLabel: string): Promise<ToolResponse> {
  const decision = page.waitForResponse(response => response.url().endsWith('/proposal-decision'));
  await confirmVisibleProposal(page, expectedLabel, `Offline fixture explicitly selects: ${expectedLabel}`);
  return (await decision).json() as Promise<ToolResponse>;
}

/** Explicitly complete the same local readiness step as a player, using fake devices. */
export async function confirmLocalReadiness(page: Page, kind: 'Voice' | 'Text' = 'Text') {
  await expect(page.getByRole('dialog', { name: 'Check your connection' })).toBeVisible();
  if (kind === 'Voice') {
    await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
    await expect(page.getByRole('meter', { name: 'Local microphone level' })).toHaveAttribute('aria-valuenow', '20');
  }
  await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
  await page.getByRole('button', { name: `Connect Live ${kind}`, exact: true }).click();
}

export async function fixtureScreenshot(page: Page, path: string) {
  // A passing protocol path with a missing stylesheet is not visual evidence.
  await expect.poll(() => page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).not.toMatch(/^"?(Times New Roman|serif)"?$/);
  const label = await page.evaluateHandle(() => {
    const node = document.createElement('div');
    node.textContent = 'SIMULATED PROVIDER · FAKE AUDIO DEVICES · OFFLINE TEST';
    Object.assign(node.style, { display: 'table', margin: '8px 26px 16px', padding: '7px 10px', background: '#fff8e9', color: '#253a32', border: '1px solid #253a32', font: '12px system-ui', pointerEvents: 'none' });
    document.body.append(node); return node;
  });
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await label.evaluate(node => node.remove());
  await label.dispose();
}
