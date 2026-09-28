import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { sessionConfig } from '../../game/agent/config';
import { audioSnapshot, installAudioInstrumentation, queueSpeech, cleanupAudioInstrumentation } from '../../scripts/qa-browser-instrumentation.mjs';
import { submitPlayerTurn, waitBeforePlayerTurn, waitForTurn, turnCycleStatus } from '../../scripts/qa-turn-pacing.mjs';
import { encodePcmWav } from '../../scripts/qa-speech-fixtures.mjs';
import { confirmVisibleProposal } from '../../scripts/qa-mission-player.mjs';

async function offlinePeer(page: Page, mode: 'text' | 'voice') {
  let peer: WebSocketRoute; let tokens = 0; const typed: string[] = [];
  const lifecycle: Array<{ type: string; atMs: number }> = [];
  await installAudioInstrumentation(page, { label: 'OFFLINE QA — FAKE PROVIDER — SYNTHETIC AUDIO', onLifecycle: event => lifecycle.push({ type: event.type, atMs: event.atMs }) });
  await page.route('**/api/access', route => route.fulfill({ json: { liveEnabled: true, authorized: true, available: true, message: 'Explicit offline fake provider.' } }));
  await page.route('**/api/sessions/*/voice-token', route => { tokens++; return route.fulfill({ json: { token: 'offline-only', sessionConfig, maxSessionSeconds: 600 } }); });
  await page.routeWebSocket('wss://agents.assemblyai.com/**', socket => {
    peer = socket;
    socket.onMessage(data => {
      const message = JSON.parse(String(data));
      if (message.type === 'session.update') socket.send(JSON.stringify({ type: 'session.ready' }));
      if (message.type === 'conversation.message') typed.push(message.content);
      if (message.type === 'session.end') { socket.send(JSON.stringify({ type: 'session.ended' })); void socket.close({ code: 1000 }); }
    });
  });
  await page.goto('/');
  expect(tokens).toBe(0);
  await page.getByRole('radio', { name: mode === 'text' ? /Live Text/ : /Live Voice/ }).check();
  await page.getByRole('button', { name: mode === 'text' ? 'Start with Text' : 'Start with Voice', exact: true }).click();
  if (mode === 'voice') await page.getByRole('button', { name: 'Enable microphone check', exact: true }).click();
  await page.getByRole('button', { name: 'Play test tone', exact: true }).click();
  expect(tokens).toBe(0);
  await page.getByRole('button', { name: mode === 'text' ? 'Connect Live Text' : 'Connect Live Voice', exact: true }).click();
  await expect(page.getByLabel('Type a message', { exact: true })).toBeEnabled();
  expect(tokens).toBe(1);
  return { send: (event: unknown) => peer!.send(JSON.stringify(event)), typed, lifecycle };
}

function audibleReply(send: (event: unknown) => void, id: string, text: string, seconds = 1) {
  const pcm = new Int16Array(24_000 * seconds);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin(i * 2 * Math.PI * 440 / 24_000) * 7000);
  send({ type: 'reply.started', reply_id: id });
  send({ type: 'reply.audio', data: Buffer.from(pcm.buffer).toString('base64') });
  send({ type: 'transcript.agent', reply_id: id, text });
  send({ type: 'reply.done', reply_id: id, status: 'completed' });
}

test('shared player submits Live Text through UI and waits for shipped playback with zero microphone acquisition', async ({ page }) => {
  const peer = await offlinePeer(page, 'text');
  const before = (await audioSnapshot(page)).elapsedMs;
  await submitPlayerTurn(page, { mode: 'text', text: 'Please look around.' });
  await expect.poll(() => peer.typed).toContain('Please look around.');
  audibleReply(peer.send, 'text-response', 'Offline fixture response.');
  await expect.poll(async () => (await audioSnapshot(page)).playbackPending).toBe(true);
  expect(turnCycleStatus(await audioSnapshot(page), { afterMs: before, mode: 'text' }).settled).toBe(false);
  await waitForTurn(page, { afterMs: before, mode: 'text', timeoutMs: 5000 });
  const snapshot = await audioSnapshot(page);
  expect(snapshot.activeTracks).toBe(0);
  expect(snapshot.events.some(event => event.type === 'synthetic.microphone.created')).toBe(false);
  expect(snapshot.counters.input.chunks).toBe(0);
  expect(snapshot.counters.rendered.nonzeroSamples).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.type === 'session.ended')).toBe(true);
  await expect.poll(() => peer.lifecycle.some(event => event.type === 'socket.close')).toBe(true);
  expect(peer.lifecycle.map(event => event.type)).toEqual(['socket.open', 'end.requested', 'session.end', 'session.ended', 'socket.close']);
  expect(peer.lifecycle.every((event, index) => index === 0 || event.atMs >= peer.lifecycle[index - 1]!.atMs)).toBe(true);
  await cleanupAudioInstrumentation(page);
});

test('shared voice player drains the actual capture stream and rejects overlap while one fixture yields two synthetic ASR items', async ({ page }, info) => {
  const peer = await offlinePeer(page, 'voice');
  const samples = new Int16Array(24_000);
  for (let i = 4320; i < 16_000; i++) samples[i] = Math.round(Math.sin(i * 2 * Math.PI * 330 / 24_000) * 8000);
  const path = info.outputPath('synthetic-adversarial-split.wav'); await writeFile(path, encodePcmWav(samples));
  const fixture = { path, id: 'split-tone', text: 'Offline tone; ASR events below are reconstructed adversarial scheduling inputs.' };
  const before = (await audioSnapshot(page)).elapsedMs;
  const speech = submitPlayerTurn(page, { mode: 'voice', text: fixture.text, fixture });
  await expect.poll(async () => (await audioSnapshot(page)).activeSources).toBe(1);
  await expect(queueSpeech(page, { ...fixture, id: 'forbidden-overlap' })).rejects.toThrow(/no queued speech/);
  peer.send({ type: 'input.speech.started' }); peer.send({ type: 'input.speech.stopped' });
  peer.send({ type: 'transcript.user', item_id: 'first-half', text: 'First synthetic fragment.' });
  audibleReply(peer.send, 'first-response', 'First synthetic response.');
  expect(turnCycleStatus(await audioSnapshot(page), { afterMs: before }).settled).toBe(false);
  peer.send({ type: 'input.speech.started' });
  await speech;
  expect(turnCycleStatus(await audioSnapshot(page), { afterMs: before }).reason).toBe('asr_turn_open');
  peer.send({ type: 'input.speech.stopped' }); peer.send({ type: 'transcript.user', item_id: 'second-half', text: 'Second synthetic fragment.' });
  audibleReply(peer.send, 'second-response', 'Second synthetic response.');
  const settled = await waitForTurn(page, { afterMs: before, timeoutMs: 5000 });
  expect(settled.asrItems).toBe(2);
  const snapshot = await audioSnapshot(page);
  const ended = snapshot.events.find(event => event.type === 'synthetic.speech.ended')!;
  const drained = snapshot.events.find(event => event.type === 'synthetic.speech.drained')!;
  expect(drained.atMs).toBeGreaterThan(ended.atMs);
  expect(Number(drained.captureAtMs)).toBeGreaterThan(ended.atMs);
  expect(snapshot.events.filter(event => event.type === 'synthetic.speech.queued')).toHaveLength(1);
  const nextBefore = snapshot.elapsedMs;
  await submitPlayerTurn(page, { mode: 'voice', text: 'Offline next tone', fixture: { ...fixture, id: 'next-tone' } });
  expect((await audioSnapshot(page)).events.find(event => event.type === 'synthetic.speech.queued' && event.id === 'next-tone')!.atMs).toBeGreaterThan(nextBefore);
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await cleanupAudioInstrumentation(page);
});

test('real QA pre-submit helper waits for the compiled confirmation ACK and worklet drain before the next synthetic input', async ({ page }, info) => {
  expect(process.env.GAME_DISABLE_LIVE).toBe('1');
  const peer = await offlinePeer(page, 'voice');
  try {
    peer.send({ type: 'tool.call', call_id: 'offline-latch-proposal', name: 'propose_interaction', arguments: { object: 'latch', action: 'latch_open' } });
    peer.send({ type: 'reply.done', reply_id: 'fc-offline-latch-proposal', status: 'completed' });
    await expect(page.getByTestId('action-proposal')).toHaveAttribute('data-status', 'awaiting_confirmation');
    audibleReply(peer.send, 'proposal-explanation', 'Please confirm the proposed Latch action.', 0.1);
    await waitForTurn(page, { mode: 'voice', timeoutMs: 5000 });
    const confirmation = await confirmVisibleProposal(page, 'Engage the Latch', 'Please engage the Latch.');
    let ready = false;
    const waiting = waitBeforePlayerTurn(page, { mode: 'voice', confirmation, timeoutMs: 5000 }).then(result => { ready = true; return result; });
    await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.purpose === 'decision_acknowledgement')).toBe(true);
    expect(ready).toBe(false);
    // A late completion from the earlier reply must not satisfy the new request.
    peer.send({ type: 'reply.done', reply_id: 'proposal-explanation', status: 'completed' });
    expect((await audioSnapshot(page)).events.filter(event => event.type === 'synthetic.speech.queued')).toHaveLength(0);
    audibleReply(peer.send, 'actual-confirmation-ack', 'The confirmed Latch action is complete.', 1);
    await expect.poll(async () => (await audioSnapshot(page)).playbackPending).toBe(true);
    expect(ready).toBe(false);
    const waited = await waiting;
    expect(waited.reason).toBe('acknowledgement_and_playback_drained');
    const before = await audioSnapshot(page);
    expect(before.playbackPending).toBe(false);
    expect(before.events.filter(event => event.purpose === 'decision_acknowledgement')).toHaveLength(1);
    const ackFinal = before.events.find(event => event.type === 'transcript.agent' && event.text === 'The confirmed Latch action is complete.')!;
    expect(ackFinal.atMs).toBeLessThan(before.elapsedMs);
    const samples = new Int16Array(24_000); for (let i = 4320; i < 16_000; i++) samples[i] = Math.round(Math.sin(i / 24) * 7000);
    const path = info.outputPath('offline-next-input.wav'); await writeFile(path, encodePcmWav(samples));
    await submitPlayerTurn(page, { mode: 'voice', text: 'Constructed offline input tone', fixture: { path, id: 'after-confirmation-ack' } });
    const after = await audioSnapshot(page);
    const queued = after.events.find(event => event.type === 'synthetic.speech.queued')!;
    expect(queued.atMs).toBeGreaterThan(before.elapsedMs);
    expect(after.events.filter(event => event.type === 'transcript.agent' && event.atMs > before.elapsedMs)).toHaveLength(0);
  } finally {
    await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
    await expect.poll(async () => (await audioSnapshot(page)).events.some(event => event.type === 'session.ended')).toBe(true);
    await cleanupAudioInstrumentation(page);
  }
});
