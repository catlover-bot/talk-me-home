import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { sessionConfig } from '../agent/config.js'
import { exactObject } from './state.js'
import { GameError, SessionStore } from './sessions.js'

interface ServerOptions {
  store?: SessionStore
  apiKey?: string
  fetch?: typeof globalThis.fetch
  allowedOrigins?: string[]
  maxVoiceSessionSeconds?: number
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  response.end(JSON.stringify(body))
}

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new GameError(415, 'Send this request as JSON.')
  const parts: Buffer[] = []
  let length = 0
  for await (const part of request) {
    const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part)
    length += bytes.length
    if (length > 16_384) throw new GameError(413, 'This request is too large.')
    parts.push(bytes)
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')) }
  catch { throw new GameError(400, 'This request contains invalid JSON.') }
}

function checkLocalRequest(request: IncomingMessage, allowedOrigins: string[]): void {
  const host = request.headers.host ?? ''
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw new GameError(403, 'The game server accepts local browser requests only.')
  const origin = request.headers.origin
  if (origin && !allowedOrigins.includes(origin) && origin !== `http://${host}`) throw new GameError(403, 'This browser origin is not allowed to use the game server.')
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new GameError(403, 'Cross-site game requests are not allowed.')
}

export function createGameServer(options: ServerOptions = {}) {
  const store = options.store ?? new SessionStore()
  const providerFetch = options.fetch ?? globalThis.fetch
  const apiKey = options.apiKey ?? process.env.ASSEMBLYAI_API_KEY
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173']
  const maxVoiceSessionSeconds = options.maxVoiceSessionSeconds ?? 600
  if (!Number.isInteger(maxVoiceSessionSeconds) || maxVoiceSessionSeconds < 60 || maxVoiceSessionSeconds > 600) throw new Error('Voice session duration must be between 60 and 600 seconds.')
  return createServer(async (request, response) => {
    try {
      checkLocalRequest(request, allowedOrigins)
      const path = new URL(request.url ?? '/', 'http://localhost').pathname
      if (request.method === 'GET' && path === '/api/health') return reply(response, 200, { ok: true })
      if (request.method === 'POST' && path === '/api/sessions') {
        if (!exactObject(await jsonBody(request), [])) throw new GameError(400, 'Start a mission with an empty JSON object.')
        return reply(response, 201, store.create())
      }
      const route = path.match(/^\/api\/sessions\/([A-Za-z0-9_-]+)(?:\/(power|tools|stop|resume|reset|end|cancel|voice-token))?$/)
      if (!route) throw new GameError(404, 'This game endpoint does not exist.')
      const id = route[1]!
      const action = route[2]
      if (request.method === 'GET' && !action) return reply(response, 200, store.get(id))
      if (request.method !== 'POST' || !action) throw new GameError(405, 'This method is not available for the game endpoint.')
      const body = await jsonBody(request)
      if (action === 'power') return reply(response, 200, await store.power(id, body))
      if (action === 'tools') return reply(response, 200, await store.tool(id, body))
      if (action === 'voice-token') {
        const view = store.reserveToken(id, body)
        if (process.env.GAME_DISABLE_LIVE === '1') throw new GameError(503, 'Live AssemblyAI is disabled for this server. Use Mock / Simulation.')
        if (!apiKey) throw new GameError(503, 'Live AssemblyAI is unavailable: set ASSEMBLYAI_API_KEY in the root .env file, then restart the game server. Mock / Simulation remains available.')
        // Official browser integration: token redemption and session duration are separate limits.
        // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
        const url = new URL('https://agents.assemblyai.com/v1/token')
        url.searchParams.set('expires_in_seconds', '60')
        url.searchParams.set('max_session_duration_seconds', String(maxVoiceSessionSeconds))
        let token: unknown
        try {
          const upstream = await providerFetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) })
          if (!upstream.ok) throw new Error('Token request failed')
          const data: unknown = await upstream.json()
          token = data && typeof data === 'object' && 'token' in data ? data.token : undefined
          if (typeof token !== 'string' || token.length === 0) throw new Error('Invalid token response')
        } catch {
          // Never forward provider diagnostics: they can contain credentials or authorization data.
          throw new GameError(502, 'Live AssemblyAI could not issue a voice token. Check the server credential and network connection, then try again.')
        }
        const current = store.get(id)
        if (current.roundId !== view.roundId || current.actionEpoch !== view.actionEpoch || current.status !== 'active') throw new GameError(409, 'The mission changed while connecting. Connect again from the current round.')
        return reply(response, 200, { token, sessionConfig, maxSessionSeconds: maxVoiceSessionSeconds })
      }
      return reply(response, 200, await store.lifecycle(id, action as 'stop' | 'resume' | 'reset' | 'end' | 'cancel', body))
    } catch (error) {
      if (response.headersSent) return response.end()
      reply(response, error instanceof GameError ? error.status : 500, { error: error instanceof GameError ? error.message : 'The game server could not complete this request.' })
    }
  })
}
