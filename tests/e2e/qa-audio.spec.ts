import { test, expect, type WebSocketRoute } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { sessionConfig } from '../../game/agent/config';
import { installAudioInstrumentation, queueSpeech, audioSnapshot, cleanupAudioInstrumentation, collectAudioEvidence } from '../../scripts/qa-browser-instrumentation.mjs';
import { encodePcmWav } from '../../scripts/qa-speech-fixtures.mjs';

test('offline fake provider: genuine microphone MediaStream, shipped DSP, rendered PCM, stop and no echo', async ({ page }, info) => {
  test.setTimeout(30_000);
  await installAudioInstrumentation(page, { label: 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO' });
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
