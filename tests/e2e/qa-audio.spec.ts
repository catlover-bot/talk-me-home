import { test, expect, type WebSocketRoute } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sessionConfig } from '../../game/agent/config';
import { installAudioInstrumentation, queueSpeech, audioSnapshot, cleanupAudioInstrumentation, collectAudioEvidence } from '../../scripts/qa-browser-instrumentation.mjs';
import { encodePcmWav } from '../../scripts/qa-speech-fixtures.mjs';

test('offline fake provider installs the exact Goal 004E evidence label through Voice preparation', async ({ page }) => {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  // This deliberately tests the production label string. The intercepted peer
  // and token endpoint remain synthetic; no real-provider evidence is produced.
  const label = 'AUTOMATED QA — SYNTHETIC VOICE + UI CONFIRMATION — REAL ASSEMBLYAI';
  const digest = createHash('sha256').update(JSON.stringify({ type: 'session.update', session: sessionConfig })).digest('hex');
  const externalRequests: string[] = []; const unexpectedSockets: string[] = [];
  let tokenRequests = 0; let configurationMessages = 0;
  await installAudioInstrumentation(page, { label, expectedSessionUpdateSha256: digest });
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { externalRequests.push(host); return route.abort(); }
    return route.fallback();
  });
  await page.routeWebSocket(/.*/, peer => { unexpectedSockets.push('Unexpected non-fixture socket'); void peer.close(); });
  await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, message: 'Offline fixture only.' } }));
  await page.route('**/api/sessions/*/voice-token', route => {
    tokenRequests++;
    return route.fulfill({ json: { token: 'offline-only', sessionConfig, maxSessionSeconds: 600 } });
  });
  await page.routeWebSocket('wss://agents.assemblyai.com/**', peer => {
    // Never connectToServer(): only this local fixture answers the socket.
    peer.onMessage(data => {
      const event = JSON.parse(String(data));
      if (event.type === 'session.update') { configurationMessages++; peer.send(JSON.stringify({ type: 'session.ready' })); }
      if (event.type === 'session.end') { peer.send(JSON.stringify({ type: 'session.ended' })); void peer.close({ code: 1000 }); }
    });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice' }).click();
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await expect(page.getByRole('meter', { name: 'Local microphone level' })).toBeVisible();
  expect(tokenRequests).toBe(0);
  await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Live Voice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect.poll(async () => (await audioSnapshot(page)).events.filter(event => event.type === 'configuration.delivery').length).toBe(1);
  const snapshot = await audioSnapshot(page);
  expect(snapshot.label).toBe(label);
  expect(snapshot.events.find(event => event.type === 'configuration.delivery')).toMatchObject({ sha256: digest, matchesExpected: true, sequence: 1 });
  expect(configurationMessages).toBe(1); expect(tokenRequests).toBe(1);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.type === 'session.ended')).toBe(true);
  await expect.poll(async () => (await audioSnapshot(page)).activeTracks).toBe(0);
  await expect.poll(async () => (await audioSnapshot(page)).openApplicationContexts).toBe(0);
  await cleanupAudioInstrumentation(page);
  expect(externalRequests).toEqual([]); expect(unexpectedSockets).toEqual([]);
});

test('offline configuration delivery hashes exact successful wire bytes without retaining payloads', async ({ page }) => {
  const privateSentinel = 'fixture-private-config-must-not-survive';
  const payload = JSON.stringify({ type: 'session.update', session: { system_prompt: privateSentinel, secret: privateSentinel } });
  const reformatted = JSON.stringify(JSON.parse(payload), null, 2);
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
  await installAudioInstrumentation(page, { label: 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO', expectedSessionUpdateSha256: sha256(payload) });
  let sentCount = 0;
  await page.routeWebSocket('wss://agents.assemblyai.com/**', peer => {
    // An isolated offline peer. Never connect this route to a provider.
    peer.onMessage(() => { sentCount++; });
  });
  await page.goto('/');
  await page.evaluate(async inputs => {
    const socket = new WebSocket('wss://agents.assemblyai.com/offline-digest-fixture');
    await new Promise<void>(resolve => socket.addEventListener('open', () => resolve(), { once: true }));
    for (const input of inputs) socket.send(input);
    socket.close();
  }, [payload, reformatted]);
  await expect.poll(async () => (await audioSnapshot(page)).events.filter(event => event.type === 'configuration.delivery').length).toBe(2);
  const snapshot = await audioSnapshot(page);
  const deliveries = snapshot.events.filter(event => event.type === 'configuration.delivery').sort((a, b) => Number(a.sequence) - Number(b.sequence));
  expect(sentCount).toBe(2);
  expect(snapshot.configurationUpdatesSent).toBe(2);
  expect(deliveries.map(({ sha256: digest, matchesExpected, sequence }) => ({ sha256: digest, matchesExpected, sequence }))).toEqual([
    { sha256: sha256(payload), matchesExpected: true, sequence: 1 },
    { sha256: sha256(reformatted), matchesExpected: false, sequence: 2 },
  ]);
  expect(JSON.stringify(snapshot)).not.toContain(privateSentinel);
  expect(JSON.stringify(snapshot)).not.toContain('system_prompt');
  expect(JSON.stringify(snapshot)).not.toContain('wss://');
  expect(snapshot.events.some(event => event.type === 'session.update')).toBe(false);
  await cleanupAudioInstrumentation(page);
});

test('offline fake provider: genuine microphone MediaStream, shipped DSP, rendered PCM, stop and no echo', async ({ page }, info) => {
  test.setTimeout(30_000);
  const expectedSessionUpdateSha256 = createHash('sha256').update(JSON.stringify({ type: 'session.update', session: sessionConfig })).digest('hex');
  await installAudioInstrumentation(page, { label: 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO', expectedSessionUpdateSha256 });
  let socket: WebSocketRoute | undefined; let tokenRequests = 0; let inputChunks = 0;
  await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, message: 'Offline fixture. No provider is contacted.' } }));
  await page.route('**/api/sessions/*/voice-token', route => { tokenRequests++; return route.fulfill({ json: { token: 'offline-only', sessionConfig, maxSessionSeconds: 600 } }); });
  await page.routeWebSocket('wss://agents.assemblyai.com/**', peer => {
    socket = peer;
    // No connectToServer(): this is explicitly offline, and only the wire peer is fake.
    peer.onMessage(data => {
      const event = JSON.parse(String(data));
      if (event.type === 'input.audio') inputChunks++;
      if (event.type === 'session.update') peer.send(JSON.stringify({ type: 'session.ready' }));
      if (event.type === 'session.end') { peer.send(JSON.stringify({ type: 'session.ended' })); void peer.close({ code: 1000 }); }
    });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /Live Voice/ }).check();
  await page.getByRole('button', { name: 'Start with Voice' }).click();
  await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await expect(page.getByRole('meter', { name: 'Local microphone level' })).toBeVisible();
  expect(tokenRequests).toBe(0);
  await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Live Voice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(tokenRequests).toBe(1);
  await expect.poll(async () => (await audioSnapshot(page)).events.filter(event => event.type === 'configuration.delivery').length).toBe(1);
  const configuration = await audioSnapshot(page);
  expect(configuration.configurationUpdatesSent).toBe(1);
  expect(configuration.events.find(event => event.type === 'configuration.delivery')).toMatchObject({ sha256: expectedSessionUpdateSha256, matchesExpected: true, sequence: 1 });
  const samples = new Int16Array(24000);
  for (let i = 4320; i < 16000; i++) samples[i] = Math.round(Math.sin(i * 2 * Math.PI * 330 / 24000) * 8000);
  const path = info.outputPath('offline-tonal-input.wav'); await writeFile(path, encodePcmWav(samples));
  await queueSpeech(page, { path, id: 'offline-tone', text: 'Offline tonal signal; not speech recognition evidence.' });
  await expect.poll(async () => (await audioSnapshot(page)).counters.input.nonzeroSamples).toBeGreaterThan(8000);
  expect(inputChunks).toBeGreaterThan(10);
  expect((await audioSnapshot(page)).counters.provider.chunks).toBe(0);
  const inputBeforeOutput = (await audioSnapshot(page)).counters.input.nonzeroSamples;
  const output = Buffer.alloc(4 * 24000 * 2);
  for (let i = 0; i < 4 * 24000; i++) output.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 24000) * 9000), i * 2);
  socket!.send(JSON.stringify({ type: 'reply.started', reply_id: 'offline-render' }));
  socket!.send(JSON.stringify({ type: 'reply.audio', data: output.toString('base64') }));
  socket!.send(JSON.stringify({ type: 'transcript.agent', reply_id: 'offline-render', text: 'Offline tonal playback fixture.' }));
  socket!.send(JSON.stringify({ type: 'reply.done', reply_id: 'offline-render', status: 'completed' }));
  await expect.poll(async () => (await audioSnapshot(page)).counters.rendered.nonzeroSamples).toBeGreaterThan(1000);
  await expect.poll(async () => (await audioSnapshot(page)).counters.postVolume.nonzeroSamples).toBeGreaterThan(1000);
  expect((await audioSnapshot(page)).counters.input.nonzeroSamples).toBe(inputBeforeOutput);
  await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.type === 'playback.stop')).toBe(true);
  await page.waitForTimeout(250);
  const afterStop = (await audioSnapshot(page)).counters.rendered.nonzeroSamples;
  await page.waitForTimeout(250);
  expect((await audioSnapshot(page)).counters.rendered.nonzeroSamples).toBe(afterStop);
  expect(afterStop).toBeLessThan(output.length / 2);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.type === 'session.ended')).toBe(true);
  await expect.poll(async () => (await audioSnapshot(page)).activeTracks).toBe(0);
  await expect.poll(async () => (await audioSnapshot(page)).openApplicationContexts).toBe(0);
  const summary = await collectAudioEvidence(page, info.outputPath('digital-evidence'));
  expect(summary.counters.provider.nonzeroSamples).toBeGreaterThan(summary.counters.rendered.nonzeroSamples);
  expect(summary.media.postVolume!.chunks).toBeGreaterThan(0);
  await cleanupAudioInstrumentation(page);
});
