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
  const paths = ['README.md', 'AGENTS.md', ...files('game'), ...files('docs'), ...files('scripts'), ...files('tests')];
  for (const path of paths.filter(path => /\.(ts|tsx|js|mjs|css|html|md)$/.test(path))) {
    assert.equal(/[\u3040-\u30ff\u3400-\u9fff]/u.test(readFileSync(path, 'utf8')), false, `Unexpected non-English authored copy in ${path}`);
  }
});

test('client source does not access server credentials or persist provider tokens', () => {
  for (const path of files('game/client')) {
    const source = readFileSync(path, 'utf8');
    // Goal 010 authorizes a bounded code/outcome diary through one adapter.
    // All other storage access and all client credential access remain forbidden.
    let checked = path === join('game/client', 'release-stop.ts') ? source
      .replace("sessionStorage.getItem('tmh-goal-007-provider-stopped')", '')
      .replace("sessionStorage.setItem('tmh-goal-007-provider-stopped', '1')", '') : source;
    if (path === join('game/client', 'switchyard-history.ts')) {
      assert.match(source, /SWITCHYARD_HISTORY_KEY = 'talk-me-home\.remix-history\.v1'/);
      assert.deepEqual(source.match(/\.(?:getItem|setItem|removeItem)\([^;\n]+/g), [
        '.getItem(SWITCHYARD_HISTORY_KEY)',
        '.setItem(SWITCHYARD_HISTORY_KEY, JSON.stringify(merged))',
        '.removeItem(SWITCHYARD_HISTORY_KEY)',
      ]);
      checked = source.replaceAll('window.localStorage', '');
    }
    assert.equal(/VITE_.*(?:KEY|TOKEN)|process\.env|localStorage|sessionStorage/.test(checked), false, `Forbidden client credential or storage access in ${path}`);
    assert.equal(/from\s+['"][^'"]*server\//.test(source), false, `Server import in ${path}`);
  }
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
