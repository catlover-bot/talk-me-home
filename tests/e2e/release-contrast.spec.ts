import type { Page } from '@playwright/test';
import { test, expect } from './rescue-fixture';

type Pair = { foreground: string; property?: 'color' | 'fill' | 'stroke'; background?: string; backgroundProperty?: 'backgroundColor' | 'fill' | 'stroke'; minimum?: number };
type Measurement = { selector: string; text: string; ratio: number; minimum: number; foreground: number[]; background: number[] };

/** Sample computed colors after every stylesheet and responsive rule has applied. */
async function pairs(page: Page, definitions: Pair[]): Promise<Measurement[]> {
  return page.evaluate(definitions => {
    const parse = (value: string): number[] => {
      const channels = value.match(/[\d.]+/g)?.map(Number);
      if (!channels || channels.length < 3) throw new Error(`Unreviewed computed color: ${value}`);
      return [...channels.slice(0, 3), channels[3] ?? 1];
    };
    const blend = (front: number[], back: number[]) => [...front.slice(0, 3).map((v, i) => v * front[3]! + back[i]! * (1 - front[3]!)), 1];
    const luminance = (color: number[]) => color.slice(0, 3).map(v => {
      const c = v / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    const surface = (element: Element) => {
      const ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
      return ancestors.reverse().reduce((color, node) => blend(parse(getComputedStyle(node).backgroundColor), color), [255, 255, 255, 1]);
    };
    return definitions.flatMap(definition => {
      const elements = [...document.querySelectorAll(definition.foreground)].filter(element => element.getClientRects().length);
      if (!elements.length) throw new Error(`Missing visible contrast subject: ${definition.foreground}`);
      return elements.map(element => {
        const backgroundElement = definition.background ? document.querySelector(definition.background) : null;
        if (definition.background && !backgroundElement) throw new Error(`Missing contrast surface: ${definition.background}`);
        const background = backgroundElement ? parse(getComputedStyle(backgroundElement)[definition.backgroundProperty ?? 'backgroundColor']) : surface(element);
        const foreground = blend(parse(getComputedStyle(element)[definition.property ?? 'color']), background);
        const a = luminance(foreground), b = luminance(background);
        return { selector: definition.foreground, text: element.textContent?.trim().slice(0, 70) ?? '', foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), minimum: definition.minimum ?? 4.5 };
      });
    });
  }, definitions);
}

/** Sample the local title illustration below actual text-line rectangles, including image opacity. */
async function titleImageContrast(page: Page): Promise<Measurement[]> {
  return page.evaluate(async () => {
    const image = document.querySelector<HTMLImageElement>('.title-landscape')!;
    await image.decode();
    const box = image.getBoundingClientRect(), style = getComputedStyle(image);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(box.width); canvas.height = Math.ceil(box.height);
    const context = canvas.getContext('2d')!;
    context.fillStyle = getComputedStyle(document.querySelector('.title-scene')!).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = Number(style.opacity);
    const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const positions = style.objectPosition.split(' ').map(parseFloat);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image, (box.width - width) * positions[0]! / 100, (box.height - height) * positions[1]! / 100, width, height);
    context.globalAlpha = 1;
    const copy = document.querySelector('.title-copy')!;
    const copyBox = copy.getBoundingClientRect();
    context.fillStyle = getComputedStyle(copy).backgroundColor;
    context.fillRect(copyBox.left - box.left, copyBox.top - box.top, copyBox.width, copyBox.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = (color: number[]) => color.slice(0, 3).map(v => {
      const c = v / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    return ['.title-eyebrow', '.release-briefing h1', '.release-briefing h1 em', '.briefing-premise', '.title-frequency'].map(selector => {
      const element = document.querySelector(selector)!;
      const foreground = getComputedStyle(element).color.match(/[\d.]+/g)!.map(Number).slice(0, 3);
      let ratio = Infinity, background: number[] = [];
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          for (let y = Math.max(0, Math.floor(rect.top - box.top)); y < Math.min(canvas.height, rect.bottom - box.top); y += 2) {
            for (let x = Math.max(0, Math.floor(rect.left - box.left)); x < Math.min(canvas.width, rect.right - box.left); x += 2) {
              const offset = (y * canvas.width + x) * 4;
              const sample = [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
              const a = luminance(foreground), b = luminance(sample);
              const value = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
              if (value < ratio) { ratio = value; background = sample; }
            }
          }
        }
      }
      if (!Number.isFinite(ratio)) throw new Error(`No title pixels sampled: ${selector}`);
      return { selector, text: element.textContent?.trim().slice(0, 70) ?? '', foreground, background, ratio, minimum: 4.5 };
    });
  });
}

const textPairs = (...selectors: string[]): Pair[] => selectors.map(foreground => ({ foreground }));
const svgPair = (foreground: string, background: string, property: 'fill' | 'stroke' = 'fill', backgroundProperty: 'fill' | 'stroke' = 'fill', minimum = 4.5): Pair => ({ foreground, property, background, backgroundProperty, minimum });

test('release contrast follows the rendered title, settings, controls, and three document surfaces', async ({ page }, info) => {
  const measured: Measurement[] = [];
  page.on('request', request => {
    if (/assemblyai\.com|\/voice-token(?:\?|$)/.test(request.url())) throw new Error('Contrast checks must remain offline.');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  measured.push(...await pairs(page, textPairs('.topbar .wordmark', '.topbar .mission-bar', '.shell-panel > summary', '.setup-fieldset legend', '.scenario-choice strong', '.scenario-choice small', '.mode-choice strong', '.mode-choice small', '.connection-explanation', '.launch-note', '.briefing-journey li', '.briefing-action button', '.quick-guide summary', '.quick-guide summary span', '.app-footer')));
  await page.getByText('Settings', { exact: true }).click();
  measured.push(...await pairs(page, textPairs('.settings-panel h2', '.settings-panel label', '.settings-panel output', '.settings-panel p', '.settings-panel button', '.settings-panel > summary')));
  await page.getByText('Settings', { exact: true }).click();
  measured.push(...await titleImageContrast(page));
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  measured.push(...await titleImageContrast(page));
  await page.setViewportSize(originalViewport);
  await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
  await expect(page.getByLabel('Type a message')).toBeEnabled();
  measured.push(...await pairs(page, [...textPairs('.chapter-objective h1', '.chapter-objective p', '.chapter-progress li', '.chapter-progress li small', '.human-controls p', '.human-controls h2', '.power-buttons button:not(:disabled)', '.document-heading h2', '.document-heading .section-kicker', '.document-reference', '.document-tabs button', '.document-caption', '.wiring-note p', '.pip-state-label', '.pip-name span', '.connection-readout', '.caption-text', '.caption-speaker', '.source-label', '.message-form label', '.communication-actions button'), svgPair('.map-meta', '.cargo-map > rect'), svgPair('.map-equipment-label text', '.cargo-map > rect'), svgPair('.map-secondary-label', '.cargo-map > rect'), svgPair('.draft-backed-label', '.draft-backed-label', 'fill', 'stroke')]));
  const say = async (text: string) => {
    await page.getByLabel('Type a message').fill(text);
    const response = page.waitForResponse(response => response.url().endsWith('/tools'));
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    expect((await (await response).json()).ok).toBe(true);
    await expect(page.getByLabel('Type a message')).toBeEnabled();
    await confirmProposalForRequest(page, text);
  };
  const relay = async (name: string) => {
    const response = page.waitForResponse(response => response.url().endsWith('/relay'));
    await page.getByRole('button', { name: `Relay ${name}`, exact: true }).click();
    expect((await response).ok()).toBe(true);
    await expect(page.getByTestId('acknowledged-relay')).toHaveText(name);
  };
  await say('Look around'); await say('Inspect the latch'); await say('Keep the door open');
  await page.getByRole('button', { name: 'Power OFF', exact: true }).click();
  await expect(page.getByTestId('acknowledged-power')).toHaveText('OFF');
  await say('Cross to the far side'); await say('Where are you?');
  await page.getByText('Mark your map', { exact: false }).click();
  await page.getByLabel('Where I think Pip is').selectOption('sail');
  await expect(page.locator('.private-location-mark')).toBeVisible();
  measured.push(...await pairs(page, [...textPairs('.atlas-key', '.private-map-notes summary', '.private-map-notes p', '.annotation-location label', '.blocked-gate-choices label', '.blocked-gate-choices small', '.source-label', '.power-buttons button:not(:disabled)'), svgPair('.atlas-gate text.gate-full-name', '.atlas-gate rect'), svgPair('.room-name', '.gallery-map > rect'), svgPair('.atlas-imprint', '.gallery-map > rect'), svgPair('.atlas-route-note', '.gallery-map > rect'), svgPair('.private-marker-label', '.gallery-map > rect'), svgPair('.atlas-track', '.atlas-track-bed', 'stroke', 'stroke', 3), svgPair('.private-location-mark', '.gallery-map > rect', 'stroke', 'fill', 3), svgPair('.room-emblem', '.room-disc', 'stroke', 'fill', 3)]));
  await page.getByText('Mark your map', { exact: false }).click();
  await relay('Beacon'); await say('Go through the east gate'); await say('Go through the southeast gate'); await relay('Harbor'); await say('Go through the northeast gate');
  measured.push(...await pairs(page, [...textPairs('.procedure-intro p', '.procedure-notes h3', '.procedure-notes p', '.procedure-footer', '.procedure-stamp', '.dock-instruments dt', '.dock-instruments dd', '.dock-buttons button:not(:disabled)', '.dock-control-reason'), svgPair('.procedure-main-label', '.return-schematic > rect'), svgPair('.procedure-small-label', '.return-schematic > rect')]));
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await info.attach('release-rendered-contrast.json', { body: JSON.stringify(measured, null, 2), contentType: 'application/json' });
  for (const sample of measured) expect(sample.ratio, `${sample.selector}: ${sample.ratio.toFixed(3)}:1; ${sample.text}`).toBeGreaterThanOrEqual(sample.minimum);
});
import { confirmProposalForRequest } from '../../scripts/qa-mission-player.mjs';
