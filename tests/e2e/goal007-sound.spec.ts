import { test, expect } from '@playwright/test';
import { fakeProvider, confirmLocalReadiness } from './fake-provider';

test('opt-in radio sound follows actual playback and microphone signals and closes on End', async ({ page }) => {
  const provider = await fakeProvider(page);
  await page.goto('/');
  await page.evaluate(() => {
    const active = new Set<OscillatorNode>();
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const source = create.call(this), start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => { active.add(source); start(...args); };
      source.stop = (...args) => { active.delete(source); stop(...args); };
      return source;
    };
    Object.defineProperty(window, '__radioSoundCount', { value: () => active.size });
  });
  const active = () => page.evaluate(() => (window as unknown as { __radioSoundCount(): number }).__radioSoundCount());
  expect((await provider.audioState()).contexts).toBe(0);
  await page.locator('.settings-panel > summary').click();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).focus();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).press('End');
  expect(await active()).toBe(0);
  expect(provider.tokenRequests).toBe(0);
  await page.locator('.settings-panel > summary').click();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect.poll(active).toBe(2);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect.poll(active).toBe(0);
  await page.getByText('Connection & sound', { exact: true }).click();
  await page.getByLabel('Next connection').selectOption('live_text');
  await page.getByRole('button', { name: 'Resume Live Text', exact: true }).click();
  await confirmLocalReadiness(page);
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  await expect.poll(active).toBe(2);
  provider.emit({ type: 'reply.started', reply_id: 'sound-check' });
  provider.emit({ type: 'reply.audio', data: 'AEAAQA==' });
  await expect.poll(async () => (await provider.audioState()).queuedChunks).toBe(1);
  expect(await active()).toBe(2); // Received bytes alone are not actual playback.
  await provider.render();
  await expect.poll(active).toBe(0);
  await provider.drain();
  await expect.poll(active).toBe(2);
  provider.emit({ type: 'reply.done', reply_id: 'sound-check', status: 'completed' });
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(active).toBe(0);
  await expect.poll(() => provider.ended).toBe(1);
  await page.getByLabel('Next connection').selectOption('live_voice');
  await page.getByRole('button', { name: 'Resume Live Voice', exact: true }).click();
  await confirmLocalReadiness(page, 'Voice');
  // Readiness already owns a microphone; wait for the actual call before ending it.
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  expect(provider.connections).toBe(2);
  expect((await provider.audioState()).activeTracks).toBe(1);
  expect(await active()).toBe(0); // An active microphone suppresses the radio bed.
  await page.getByRole('button', { name: 'Pause / End call', exact: true }).click();
  await expect.poll(active).toBe(0);
  expect((await provider.audioState()).activeTracks).toBe(0);
  await expect.poll(() => provider.ended).toBe(2);
  expect(provider.activeSockets).toBe(0);
  await expect.poll(async () => { const audio = await provider.audioState(); return audio.contexts - audio.closedContexts; }).toBe(0);
});
test('shipped procedural radio bed produces nonzero local PCM and independent mute silences it', async ({ page }) => {
  page.on('request', request => { if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Local sound check must not request a provider.'); });
  await page.addInitScript(() => {
    const analysers: { analyser: AnalyserNode; context: AudioContext }[] = [];
    const original = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = original.call(this), analyser = this.createAnalyser(), silent = original.call(this);
      analyser.fftSize = 1024; silent.gain.value = 0;
      gain.connect(analyser); analyser.connect(silent); silent.connect(this.destination);
      analysers.push({ analyser, context: this });
      return gain;
    };
    Object.defineProperty(window, '__radioPcm', { value: () => analysers.map(({ analyser, context }) => {
      const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
      return { state: context.state, rms: Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) };
    }) });
  });
  const pcm = () => page.evaluate(() => (window as unknown as { __radioPcm(): { state: string; rms: number }[] }).__radioPcm());
  await page.goto('/'); expect(await pcm()).toEqual([]);
  await page.locator('.settings-panel > summary').click();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).focus();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).press('End');
  await page.locator('.settings-panel > summary').click();
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect.poll(async () => Math.max(0, ...(await pcm()).map(value => value.rms))).toBeGreaterThan(0.001);
  await page.locator('.settings-panel > summary').click();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).focus();
  await page.locator('.settings-panel').getByLabel('Radio ambience', { exact: true }).press('Home');
  await expect.poll(async () => (await pcm()).every(value => value.state === 'closed' || value.rms < 0.0001)).toBe(true);
  await page.locator('.settings-panel > summary').click();
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect.poll(async () => (await pcm()).every(value => value.state === 'closed')).toBe(true);
});
