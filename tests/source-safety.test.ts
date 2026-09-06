import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function files(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('application-authored code, UI, comments, and documentation use English', () => {
  const paths = [...files('game'), ...files('docs'), ...files('scripts'), ...files('tests')];
  for (const path of paths.filter(path => /\.(ts|tsx|js|mjs|css|html|md)$/.test(path))) {
    assert.equal(/[\u3040-\u30ff\u3400-\u9fff]/u.test(readFileSync(path, 'utf8')), false, `Unexpected non-English authored copy in ${path}`);
  }
});

test('client source does not access server credentials or persist provider tokens', () => {
  const source = files('game/client').map(path => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(source, /VITE_.*(?:KEY|TOKEN)|process\.env|localStorage|sessionStorage/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*server\//);
});

test('ignored local credential values are absent from game source and any built bundle', () => {
  if (!existsSync('.env')) return;
  // Only compare in memory. Assertion output must never contain credential values.
  const values = readFileSync('.env', 'utf8').split('\n').flatMap(line => {
    const match = /^\s*([A-Z_]*(?:KEY|TOKEN|SECRET)[A-Z_]*)\s*=\s*(.*?)\s*$/.exec(line);
    const value = match?.[2].replace(/^(['"])(.*)\1$/, '$2');
    return value && value.length >= 12 ? [value] : [];
  });
  for (const path of [...files('game'), ...files('dist/client')]) {
    const text = readFileSync(path, 'utf8');
    assert.equal(values.some(value => text.includes(value)), false, `Credential exposure in ${path}`);
  }
  const ignored = readFileSync('.gitignore', 'utf8');
  assert.match(ignored, /^\.env$/m);
  assert.match(ignored, /^agents\/\*\.env$/m);
});
