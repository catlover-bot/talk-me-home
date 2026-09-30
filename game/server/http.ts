import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { sessionConfig } from '../agent/config.js'
import { exactObject } from './state.js'
import { GameError, SessionStore } from './sessions.js'
import { BrowserAccess } from './browser-access.js'
import { LiveAdmission } from './admission.js'
import { serveGame } from './static.js'
import type { ReleaseIdentity } from './release.js'
import { RELEASE_GRANT_ID, ReleaseAdmission, type ReleaseCapability, type ReleaseReservation } from './release-admission.js'

interface ServerOptions {
  releaseIdentity?: ReleaseIdentity
  store?: SessionStore
  apiKey?: string
  fetch?: typeof globalThis.fetch
  allowedOrigins?: string[]
  maxVoiceSessionSeconds?: number
  /** Internal supervised QA only; never exposes raw provider diagnostics. */
  onProviderAccountRefusal?: (reason: 'provider_credit_refused' | 'provider_credential_or_account_refused') => Promise<void>
  /** Offline tests may exercise an explicitly injected provider while Live is disabled. */
  allowTestProvider?: boolean
  production?: boolean
  staticDirectory?: string
  publicLiveEnabled?: boolean
  demoAccessCode?: string
  admission?: LiveAdmission
  /** Goal 007's single hosted allocation; never combined with a legacy allowance. */
  releaseAdmission?: ReleaseAdmission
  hostedQaEnabled?: boolean
  qaAccessCode?: string
  qaTextAccessCode?: string
  /** HTTP-only localhost production smoke tests; deployed cookies stay Secure. */
  secureCookies?: boolean
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
  if (options.allowTestProvider && !options.fetch) throw new Error('A test provider override requires an injected provider transport.')
  const store = options.store ?? new SessionStore()
  const providerFetch = options.fetch ?? globalThis.fetch
  const apiKey = options.apiKey ?? process.env.ASSEMBLYAI_API_KEY
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173']
  const maxVoiceSessionSeconds = options.maxVoiceSessionSeconds ?? 600
  const production = options.production ?? false
  if (production && (!options.allowedOrigins?.length || options.allowedOrigins.some(origin => {
    try { const parsed = new URL(origin); return parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) }
    catch { return true }
  }))) throw new Error('Production requires explicit game origins.')
  if (options.releaseAdmission && (!production || options.admission || maxVoiceSessionSeconds !== 900)) throw new Error('The protected release requires its exclusive hosted 900-second allocation')
  const releaseStatus = (capability: ReleaseCapability, owner?: string) => {
    const enabled = capability.purpose === 'qa' ? options.hostedQaEnabled : options.publicLiveEnabled
    return enabled ? options.releaseAdmission!.status(capability, owner) : { available: false, status: 503, message: 'This Live access is not open. Practice is available.' }
  }
  const browserAccess = new BrowserAccess(options.demoAccessCode, options.secureCookies ?? production, Date.now, options.releaseAdmission ? {
    qa: options.qaAccessCode, qaText: options.qaTextAccessCode,
    allowed: (capability, owner) => { const status = releaseStatus(capability, owner); if (!status.available) throw new GameError(status.status, status.message) },
  } : undefined)
  // At most sixteen entries for this grant; never exposed as a diagnostics or administration API.
  const issuedReleaseConnections = new Map<string, { roundId: string; owner: string; reservation: ReleaseReservation }>()
  const liveEnabled = () => Boolean(apiKey && (process.env.GAME_DISABLE_LIVE !== '1' || options.allowTestProvider)
    && (!production || (options.releaseAdmission
      ? options.hostedQaEnabled && (options.qaAccessCode || options.qaTextAccessCode) || options.publicLiveEnabled && options.demoAccessCode
      : options.publicLiveEnabled && options.demoAccessCode && options.demoAccessCode.length >= 16 && options.admission)))
  const accessStatus = (request: IncomingMessage, justAuthorized = false, exchangedCapability?: ReleaseCapability) => {
    const enabled = liveEnabled()
    const capability = exchangedCapability ?? browserAccess.capability(request)
    const status = production && enabled ? options.releaseAdmission
      ? releaseStatus(capability ?? { purpose: 'reviewer', mode: 'voice' }, browserAccess.owner(request))
      : options.admission!.status() : undefined
    return {
      liveEnabled: enabled,
      maxSessionSeconds: maxVoiceSessionSeconds,
      authorized: !production || justAuthorized || browserAccess.authorized(request),
      available: enabled && (status?.available ?? true),
      message: !enabled ? 'Live is unavailable for this demo. Practice is available without a connection.' : status?.message ?? 'Live is available. Connect only when you are ready.',
      ...(capability && options.releaseAdmission ? { allocation: options.releaseAdmission.accessSummary(capability, browserAccess.owner(request)) } : {}),
    }
  }
  if (!Number.isInteger(maxVoiceSessionSeconds) || maxVoiceSessionSeconds < 60 || maxVoiceSessionSeconds > 600 && maxVoiceSessionSeconds !== 900) throw new Error('Voice session duration must be 60 to 600 seconds or the approved 900-second QA cap.')
  if (maxVoiceSessionSeconds === 900 && (!production || !options.releaseAdmission && options.admission?.validateSessionLimit() !== 900)) throw new Error('The extended QA cap requires its matching durable allowance.')
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost')
      const path = requestUrl.pathname
      if (/%2f|%5c/i.test(path)) throw new GameError(400, 'This game address is invalid.')
      const apiRequest = path === '/api' || path.startsWith('/api/')
      if (production) {
        if (!allowedOrigins.some(origin => new URL(origin).host === request.headers.host)) throw new GameError(403, 'This game address is not allowed.')
        if (apiRequest && (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && !allowedOrigins.includes(request.headers.origin) || !['GET', 'HEAD'].includes(request.method ?? '') && !request.headers.origin)) throw new GameError(403, 'This browser origin is not allowed to use the game server.')
      } else { checkLocalRequest(request, allowedOrigins) }
      if (!apiRequest && options.staticDirectory) return await serveGame(request, response, options.staticDirectory)
      if (request.method === 'GET' && path === '/api/health') return reply(response, 200, { ok: true })
      if (request.method === 'GET' && path === '/api/version') return reply(response, 200, options.releaseIdentity ? { commit: options.releaseIdentity.commit, version: options.releaseIdentity.version } : { commit: 'unbuilt', version: 'development' })
      if (path === '/api/access' && request.method === 'GET') return reply(response, 200, accessStatus(request))
      if (path === '/api/access' && request.method === 'POST') {
        if (!liveEnabled()) throw new GameError(503, 'Live is unavailable for this demo. Choose Practice.')
        const input = await jsonBody(request)
        const capability = production ? browserAccess.exchange(request, response, input) : undefined
        return reply(response, 200, accessStatus(request, true, capability))
      }
      if (request.method === 'POST' && path === '/api/sessions') {
        const setup = await jsonBody(request)
        const owner = browserAccess.owner(request, response)
        if (exactObject(setup, [])) return reply(response, 201, store.create('classic', 'training', owner))
        if (exactObject(setup, ['missionKind', 'scenario', 'optionalObjective']) && (setup.missionKind === 'training' || setup.missionKind === 'rescue') && (setup.scenario === 'classic' || setup.scenario === 'maintenance') && (setup.optionalObjective === null || setup.optionalObjective === 'flight_recorder')) return reply(response, 201, store.create(setup.scenario, setup.missionKind, owner, setup.optionalObjective))
        if (exactObject(setup, ['missionKind', 'scenario']) && (setup.missionKind === 'training' || setup.missionKind === 'rescue') && (setup.scenario === 'classic' || setup.scenario === 'maintenance')) return reply(response, 201, store.create(setup.scenario, setup.missionKind, owner))
        if (!exactObject(setup, ['scenario']) || (setup.scenario !== 'classic' && setup.scenario !== 'maintenance')) throw new GameError(400, 'Choose Classic or Maintenance when starting a mission.')
        return reply(response, 201, store.create(setup.scenario, 'training', owner))
      }
      const route = path.match(/^\/api\/sessions\/([A-Za-z0-9_-]+)(?:\/(power|relay|dock-control|annotations|tools|proposal-decision|stop|resume|reset|end|cancel|voice-token|live-refusal|messages|record|notebook|recap|hint))?$/)
      if (!route) throw new GameError(404, 'This game endpoint does not exist.')
      const id = route[1]!
      const action = route[2]
      store.assertOwner(id, browserAccess.owner(request))
      if (request.method === 'GET' && !action) return reply(response, 200, store.get(id))
      if (request.method === 'GET' && (action === 'record' || action === 'recap')) {
        const roundId = requestUrl.searchParams.get('roundId') ?? ''
        if ([...requestUrl.searchParams.keys()].length !== 1) throw new GameError(400, 'Read the mission record using only the current round identifier.')
        return reply(response, 200, action === 'record' ? store.record(id, roundId) : store.recap(id, roundId))
      }
      if (request.method !== 'POST' || !action) throw new GameError(405, 'This method is not available for the game endpoint.')
      const body = await jsonBody(request)
      if (action === 'live-refusal') {
        if (requestUrl.searchParams.size || !exactObject(body, ['roundId', 'reason']) || typeof body.roundId !== 'string'
          || body.reason !== 'provider_credit_refused' && body.reason !== 'provider_credential_or_account_refused') throw new GameError(400, 'Send only the current connection and a supported Live stop reason.')
        const issued = issuedReleaseConnections.get(id)
        const owner = browserAccess.owner(request)
        if (!options.releaseAdmission || !issued || !owner || issued.owner !== owner || issued.roundId !== body.roundId) throw new GameError(403, 'An issued protected connection is required for this report.')
        // An access-code cookie can expire during an issued call. The owned session and
        // issued reservation remain sufficient for this stop-only report, never a new token.
        options.releaseAdmission.reportClientRefusal(issued.reservation.attempt, issued.reservation, owner, body.reason)
        return reply(response, 200, { stopped: true, source: 'client_report' })
      }
      if (action === 'power') return reply(response, 200, await store.power(id, body))
      if (action === 'relay' || action === 'dock-control') return reply(response, 200, await store.control(id, action === 'relay' ? 'relay' : 'dock', body))
      if (action === 'annotations') return reply(response, 200, await store.annotate(id, body))
      if (action === 'tools') return reply(response, 200, await store.tool(id, body))
      if (action === 'proposal-decision') return reply(response, 200, await store.decideProposal(id, body, browserAccess.owner(request)))
      if (action === 'messages') return reply(response, 200, await store.message(id, body))
      if (action === 'notebook') return reply(response, 200, await store.notebook(id, body))
      if (action === 'hint') return reply(response, 200, await store.hint(id, body))
      if (action === 'record' || action === 'recap') throw new GameError(405, 'Read this mission record with a GET request.')
      if (action === 'voice-token') {
        let releaseReservation: ReleaseReservation | undefined
        if (requestUrl.searchParams.size) throw new GameError(400, 'Voice connection limits are selected by the game server.')
        if (production) {
          if (!liveEnabled()) throw new GameError(503, 'Live is unavailable for this demo. Choose Practice.')
          if (!browserAccess.authorized(request)) throw new GameError(403, 'Enter the demo access code before connecting Live, or choose Practice.')
        }
        const view = store.reserveToken(id, body)
        if (process.env.GAME_DISABLE_LIVE === '1' && !options.allowTestProvider) throw new GameError(503, 'Live AssemblyAI is disabled for this server. Mock / Simulation remains available.')
        if (!apiKey) throw new GameError(503, 'Live AssemblyAI is unavailable: set ASSEMBLYAI_API_KEY in the root .env file, then restart the game server. Mock / Simulation remains available.')
        if (production) {
          if (options.releaseAdmission) {
            const capability = browserAccess.capability(request)!
            const owner = browserAccess.owner(request)!
            const status = releaseStatus(capability, owner)
            if (!status.available) throw new GameError(status.status, status.message)
            releaseReservation = options.releaseAdmission.reserve(capability, owner)
            // Also survives a failed provider request, without disclosing browser credentials.
            response.setHeader('x-tmh-allocation-attempt', String(releaseReservation.attempt))
          } else options.admission!.reserve()
        }
        // Official browser integration: token redemption and session duration are separate limits.
        // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
        const url = new URL('https://agents.assemblyai.com/v1/token')
        url.searchParams.set('expires_in_seconds', '60')
        url.searchParams.set('max_session_duration_seconds', String(maxVoiceSessionSeconds))
        let token: unknown
        try {
          const upstream = await providerFetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) })
          if (!upstream.ok) {
            const denied: unknown = await upstream.json().catch(() => null)
            const code = denied && typeof denied === 'object' ? ('code' in denied ? denied.code : 'error' in denied && denied.error && typeof denied.error === 'object' && 'code' in denied.error ? denied.error.code : null) : null
            const error = denied && typeof denied === 'object' && 'error' in denied ? denied.error : null
            const messages = [denied, code, error,
              denied && typeof denied === 'object' && 'message' in denied ? denied.message : null,
              error && typeof error === 'object' && 'message' in error ? error.message : null,
            ].filter((value): value is string => typeof value === 'string')
            const accountMismatch = messages.some(value => /\b(?:workspace|account)[\s_-]+(?:mismatch(?:ed)?|does[\s_-]+not[\s_-]+match)\b/i.test(value))
            const insufficientCredit = messages.some(value => /\binsufficient[\s_-]+(?:credits?|balance)\b/i.test(value))
            const reason = upstream.status === 401 || upstream.status === 403 || accountMismatch ? 'provider_credential_or_account_refused'
              : upstream.status === 402 || insufficientCredit || typeof code === 'string' && ['payment_required', 'account_balance_exhausted'].includes(code.toLowerCase()) ? 'provider_credit_refused' : null
            if (reason) {
              options.releaseAdmission?.halt(reason, 'token_response')
              await options.onProviderAccountRefusal?.(reason)
            }
            throw new Error('Token request failed')
          }
          const data: unknown = await upstream.json()
          token = data && typeof data === 'object' && 'token' in data ? data.token : undefined
          if (typeof token !== 'string' || token.length === 0) throw new Error('Invalid token response')
        } catch {
          // Never forward provider diagnostics: they can contain credentials or authorization data.
          throw new GameError(502, production ? 'Live could not connect. Wait a few minutes before trying again, or choose Practice.' : 'Live AssemblyAI could not issue a voice token. Check the server credential and network connection, then try again.')
        }
        const current = store.get(id)
        if (current.roundId !== view.roundId || current.actionEpoch !== view.actionEpoch || current.status !== 'active') throw new GameError(409, 'The mission changed while connecting. Connect again from the current round.')
        if (releaseReservation) issuedReleaseConnections.set(id, { roundId: view.roundId, owner: browserAccess.owner(request)!, reservation: releaseReservation })
        return reply(response, 200, { token, sessionConfig, maxSessionSeconds: maxVoiceSessionSeconds,
          ...(releaseReservation ? { allocation: { grantId: RELEASE_GRANT_ID, purpose: releaseReservation.purpose, mode: releaseReservation.mode, attempt: releaseReservation.attempt, poolAttempt: releaseReservation.poolAttempt, reservedSeconds: 970, leaseUntil: releaseReservation.leaseUntil, runtimeSha256: releaseReservation.runtimeSha256 } } : {}),
        })
      }
      return reply(response, 200, await store.lifecycle(id, action as 'stop' | 'resume' | 'reset' | 'end' | 'cancel', body))
    } catch (error) {
      if (response.headersSent) return response.end()
      reply(response, error instanceof GameError ? error.status : 500, { error: error instanceof GameError ? error.message : 'The game server could not complete this request.',
        ...(error instanceof GameError && error.code ? { code: error.code, recovery: error.recovery } : {}) })
    }
  })
}
