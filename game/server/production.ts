import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createGameServer } from './http.js'
import { LiveAdmission } from './admission.js'
import type { SessionStore } from './sessions.js'

// Production reads hosting environment variables only. It never loads the owner's .env.
export function startProductionServer(store?: SessionStore, qaOptions?: { maxVoiceSessionSeconds: 900; onProviderAccountRefusal?: (reason: 'provider_credit_refused' | 'provider_credential_or_account_refused') => Promise<void>; confirmedClosed: (reservation: Readonly<{ reservedAt: number; leaseUntil: number }>) => boolean }) {
  const port = Number(process.env.PORT ?? 3001)
  const host = process.env.GAME_BIND_ADDRESS ?? '127.0.0.1'
  const origin = process.env.GAME_ORIGIN ?? `http://127.0.0.1:${port}`
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const directory = resolve('dist/client')
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')
  if (!existsSync(resolve(directory, 'index.html'))) throw new Error('Missing build')
  if (!local && !origin.startsWith('https://')) throw new Error('Public origin requires HTTPS')
  if (!process.env.GAME_ORIGIN && host !== '127.0.0.1') throw new Error('Public bind requires an explicit origin')
  if (qaOptions && (qaOptions.maxVoiceSessionSeconds !== 900 || host !== '127.0.0.1' || !local)) throw new Error('The approved extended QA service is local only')
  const admission = process.env.GAME_LIVE_ALLOWANCE_FILE ? new LiveAdmission(process.env.GAME_LIVE_ALLOWANCE_FILE, Number(process.env.GAME_LIVE_CONCURRENT_LIMIT ?? 2), Date.now, qaOptions?.maxVoiceSessionSeconds ?? 600, qaOptions?.confirmedClosed) : undefined
  const server = createGameServer({
    store,
    production: true, staticDirectory: directory, allowedOrigins: [origin], secureCookies: !local,
    publicLiveEnabled: process.env.GAME_PUBLIC_LIVE_ENABLED === '1', demoAccessCode: process.env.GAME_DEMO_ACCESS_CODE,
    admission,
    onProviderAccountRefusal: qaOptions?.onProviderAccountRefusal,
    maxVoiceSessionSeconds: qaOptions?.maxVoiceSessionSeconds ?? 600,
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
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { startProductionServer() }
  catch {
    console.error('The production game could not start. Build the game and check its documented environment settings.')
    process.exitCode = 1
  }
}
