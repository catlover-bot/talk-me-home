import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('game/client/styles.css', 'utf8');
const token = (name: string) => {
  const hex = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-f]{6})', 'i'))?.[1];
  assert.ok(hex, 'Missing contrast token ' + name);
  return hex;
};
function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
test('normal text design tokens meet 4.5:1 on their paper and console surfaces', () => {
  for (const [foreground, background] of [
    ['ink', 'paper'], ['ink', 'sheet'], ['muted', 'paper'], ['muted', 'sheet'],
    ['console-ink', 'console'], ['console-muted', 'console'], ['console-ink', 'console-raised'],
    ['accent', 'sheet'], ['error', 'error-surface'], ['button-ink', 'accent'],
  ]) {
    const values = [luminance(token(foreground!)), luminance(token(background!))].sort((a, b) => b - a);
    const ratio = (values[0]! + 0.05) / (values[1]! + 0.05);
    assert.ok(ratio >= 4.5, foreground + ' on ' + background + ': ' + ratio.toFixed(3));
  }
});

const gallery = readFileSync('game/client/components/GalleryDocument.tsx', 'utf8');
const dock = readFileSync('game/client/components/ReturnDockDocument.tsx', 'utf8');
const controls = readFileSync('game/client/components/HumanControls.tsx', 'utf8');
const chapterHeader = readFileSync('game/client/components/ChapterHeader.tsx', 'utf8');
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Read declared opaque colors, including same-selector media variants, rather than copying hex fixtures. */
function declaredColors(selector: string, property: string): string[] {
  const rules = [...css.matchAll(new RegExp('(?:^|\\n)\\s*' + escapePattern(selector) + '\\s*\\{([^{}]*)\\}', 'g'))];
  assert.ok(rules.length, 'Missing contrast selector: ' + selector);
  const values = rules.flatMap(rule => {
    const declaration = rule[1]!.match(new RegExp('(?:^|;)\\s*' + escapePattern(property) + '\\s*:\\s*([^;]+)'))?.[1]?.trim();
    if (declaration === undefined) return [];
    assert.match(declaration, /^#[0-9a-f]{6}$/i, 'Review non-opaque or indirect color in ' + selector + ' / ' + property);
    return declaration.toLowerCase();
  });
  assert.ok(values.length, 'Missing contrast color: ' + selector + ' / ' + property);
  return [...new Set(values)];
}

function checkPair(t: TestContext, name: string, foreground: [string, string], background: [string, string], minimum: number) {
  for (const fg of declaredColors(...foreground)) {
    for (const bg of declaredColors(...background)) {
      const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (values[0]! + 0.05) / (values[1]! + 0.05);
      const description = `${name}: ${ratio.toFixed(3)}:1 (${fg} on ${bg}; minimum ${minimum}:1)`;
      t.diagnostic(description);
      assert.ok(ratio >= minimum, description);
    }
  }
}

test('Gallery gate and route labels meet 4.5:1 on their declared SVG surfaces', t => {
  assert.match(gallery, /className="gallery-map"/);
  assert.match(gallery, /className=\{`atlas-gate /);
  assert.match(gallery, /className="gate-full-name"/);
  assert.match(gallery, /className="atlas-route-note"/);
  checkPair(t, 'Gallery gate labels', ['.atlas-gate text', 'fill'], ['.atlas-gate rect', 'fill'], 4.5);
  checkPair(t, 'Gallery secondary labels', ['.atlas-route-note', 'fill'], ['.gallery-map', 'background'], 4.5);
});

test('Dock procedures, acknowledged instruments and authorization text meet 4.5:1', t => {
  assert.match(dock, /className="mission-documents return-document"/);
  assert.match(dock, /className="procedure-notes"/);
  assert.match(dock, /className="procedure-small-label"/);
  assert.match(controls, /className="dock-instruments"/);
  assert.match(controls, /className="dock-buttons"/);
  assert.match(controls, /className="primary-button"[\s\S]*?>Authorize return</);
  checkPair(t, 'Dock procedure text', ['.procedure-notes p', 'color'], ['.return-document', 'background'], 4.5);
  checkPair(t, 'Dock schematic labels', ['.procedure-small-label', 'fill'], ['.return-document', 'background'], 4.5);
  checkPair(t, 'Dock acknowledged instrument values', ['.dock-instruments dd', 'color'], ['.dock-instruments', 'background'], 4.5);
  checkPair(t, 'Dock enabled authorization button', ['.dock-buttons .primary-button', 'color'], ['.dock-buttons .primary-button', 'background'], 4.5);
});

test('public checkpoint status text meets 4.5:1 on the page surface', t => {
  assert.match(chapterHeader, /className="chapter-progress"/);
  assert.match(chapterHeader, /<small>\{cleared \? 'Cleared'/);
  checkPair(t, 'Checkpoint status text', ['.chapter-progress li small', 'color'], [':root', 'background'], 4.5);
});

test('essential Gallery routes and private location marks meet 3:1 on the declared sheet', t => {
  assert.match(gallery, /className="atlas-track"/);
  assert.match(gallery, /className="private-location-mark"/);
  checkPair(t, 'Gallery circuit tracks', ['.atlas-track', 'stroke'], ['.gallery-map', 'background'], 3);
  checkPair(t, 'Private inferred-location outline', ['.private-location-mark', 'stroke'], ['.gallery-map', 'background'], 3);
  // Selected solid-color checks do not model grid blending, antialiasing, the entire cascade, or accessibility overall.
});
