import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createGameServer } from './http.js'
import { LiveAdmission } from './admission.js'

// Production reads hosting environment variables only. It never loads the owner's .env.
const port = Number(process.env.PORT ?? 3001)
const host = process.env.GAME_BIND_ADDRESS ?? '127.0.0.1'
const origin = process.env.GAME_ORIGIN ?? `http://127.0.0.1:${port}`
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
const directory = resolve('dist/client')

try {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')
  if (!existsSync(resolve(directory, 'index.html'))) throw new Error('Missing build')
  if (!local && !origin.startsWith('https://')) throw new Error('Public origin requires HTTPS')
  if (!process.env.GAME_ORIGIN && host !== '127.0.0.1') throw new Error('Public bind requires an explicit origin')
  const admission = process.env.GAME_LIVE_ALLOWANCE_FILE ? new LiveAdmission(process.env.GAME_LIVE_ALLOWANCE_FILE, Number(process.env.GAME_LIVE_CONCURRENT_LIMIT ?? 2)) : undefined
  const server = createGameServer({
    production: true, staticDirectory: directory, allowedOrigins: [origin], secureCookies: !local,
    publicLiveEnabled: process.env.GAME_PUBLIC_LIVE_ENABLED === '1', demoAccessCode: process.env.GAME_DEMO_ACCESS_CODE,
    admission,
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000
  server.listen(port, host, () => console.log('Talk Me Home production game is ready. Missions remain in process memory.'))
  server.on('error', () => { console.error('The production game could not listen. Check PORT and the bind address.'); process.exitCode = 1 })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    server.close(() => { process.exitCode = 0 })
    server.closeAllConnections()
  })
} catch {
  console.error('The production game could not start. Build the game and check its documented environment settings.')
  process.exitCode = 1
}
