import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readReleaseIdentity } from '../game/server/release.js'

test('release identity is a validated public projection, never an arbitrary build document', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tmh-release-'))
  const path = join(directory, 'release.json')
  try {
    const identity = { commit: 'b'.repeat(40), version: '0.7.0' }
    writeFileSync(path, JSON.stringify({ ...identity, privatePath: '/private/source', secret: 'fixture-only' }))
    assert.deepEqual(readReleaseIdentity(path), identity)
    for (const value of [null, [], { ...identity, commit: 'not-a-commit' }, { ...identity, version: '/private/path' }]) {
      writeFileSync(path, JSON.stringify(value))
      assert.throws(() => readReleaseIdentity(path), /Invalid release identity/)
    }
    writeFileSync(path, '{')
    assert.throws(() => readReleaseIdentity(path))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
