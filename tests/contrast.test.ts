import test from 'node:test';
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
