import { fileURLToPath } from 'node:url'
import { createGameServer } from './http.js'
import { SessionStore } from './sessions.js'
import { localToolDiagnosticSink } from './tool-diagnostics.js'

try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))) }
catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    console.error('The root .env file could not be loaded. Check its permissions and format.')
    process.exit(1)
  }
}

const port = Number(process.env.GAME_PORT ?? 3001)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('GAME_PORT must be a valid local port.')
const server = createGameServer({ store: new SessionStore({ onToolDiagnostic: localToolDiagnosticSink(process.env.GAME_LOCAL_TOOL_DIAGNOSTICS, '127.0.0.1', `http://127.0.0.1:${port}`) }) })
server.listen(port, '127.0.0.1', () => console.log(`Talk Me Home game API: http://127.0.0.1:${port}`))
server.on('error', () => {
  console.error('The game server could not start. Check whether GAME_PORT is already in use.')
  process.exitCode = 1
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => { process.exitCode = 0 })
    server.closeAllConnections()
  })
}
