import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createGameServer } from './http.js'
import { LiveAdmission } from './admission.js'
import { SessionStore } from './sessions.js'
import { localToolDiagnosticSink } from './tool-diagnostics.js'
import { readReleaseIdentity } from './release.js'
import { RELEASE_ALLOCATION_PATH, ReleaseAdmission, releaseRuntimeFingerprint } from './release-admission.js'

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
  const protectedRelease = process.env.GAME_RELEASE_PROFILE === 'goal-007'
  if (protectedRelease && (qaOptions || process.env.GAME_LIVE_ALLOWANCE_FILE || local || process.env.GAME_RELEASE_ALLOCATION_FILE !== RELEASE_ALLOCATION_PATH
    || process.env.GAME_LIVE_CONCURRENT_LIMIT !== '1')) throw new Error('The protected release requires its one hosted allocation and connection')
  const diagnostics = localToolDiagnosticSink(process.env.GAME_LOCAL_TOOL_DIAGNOSTICS, host, origin)
  if (diagnostics) { store ??= new SessionStore(); store.enableLocalToolDiagnostics(diagnostics) }
  const admission = process.env.GAME_LIVE_ALLOWANCE_FILE ? new LiveAdmission(process.env.GAME_LIVE_ALLOWANCE_FILE, Number(process.env.GAME_LIVE_CONCURRENT_LIMIT ?? 2), Date.now, qaOptions?.maxVoiceSessionSeconds ?? 600, qaOptions?.confirmedClosed) : undefined
  // Construction does not initialize or read the grant. Missing/corrupt data disables Live while Practice stays usable.
  const releaseAdmission = protectedRelease ? new ReleaseAdmission(RELEASE_ALLOCATION_PATH, { origin, serviceId: process.env.RENDER_SERVICE_ID ?? '', runtimeSha256: releaseRuntimeFingerprint(resolve('dist')) }) : undefined
  const server = createGameServer({
    store,
    releaseIdentity: readReleaseIdentity(resolve('dist/release.json')),
    production: true, staticDirectory: directory, allowedOrigins: [origin], secureCookies: !local,
    publicLiveEnabled: process.env.GAME_PUBLIC_LIVE_ENABLED === '1', demoAccessCode: process.env.GAME_DEMO_ACCESS_CODE,
    admission,
    releaseAdmission, hostedQaEnabled: process.env.GAME_HOSTED_QA_ENABLED === '1',
    qaAccessCode: process.env.GAME_QA_ACCESS_CODE, qaTextAccessCode: process.env.GAME_QA_TEXT_ACCESS_CODE,
    onProviderAccountRefusal: qaOptions?.onProviderAccountRefusal,
    maxVoiceSessionSeconds: protectedRelease ? 900 : qaOptions?.maxVoiceSessionSeconds ?? 600,
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
