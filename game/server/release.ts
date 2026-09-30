import { readFileSync } from 'node:fs'

export interface ReleaseIdentity { commit: string; version: string }

export function readReleaseIdentity(path: string): ReleaseIdentity {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!value || typeof value !== 'object' || !('commit' in value) || !('version' in value)
    || typeof value.commit !== 'string' || !/^[a-f0-9]{40}$/.test(value.commit)
    || typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version)) {
    throw new Error('Invalid release identity')
  }
  return { commit: value.commit, version: value.version }
}
