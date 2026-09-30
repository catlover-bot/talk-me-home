import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const commit = process.env.RENDER_GIT_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(commit) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release identity')
writeFileSync('dist/release.json', JSON.stringify({ commit, version }) + '\n')
