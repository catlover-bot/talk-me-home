import type { HumanView, LifecycleRequest, PowerRequest, ToolRequest, ToolResponse } from '../shared/contracts.js'
import { applyHumanPower, applyRobotTool, exactObject, humanView, initialState, type GameState } from './state.js'

export class GameError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}

interface CachedRequest {
  fingerprint: string
  response: Promise<HumanView | ToolResponse>
}

interface Session {
  state: GameState
  touchedAt: number
  requests: Map<string, CachedRequest>
  lastTokenAt: number
}

interface StoreOptions {
  now?: () => number
  maxSessions?: number
  idleMilliseconds?: number
  /** Test seam for verifying cancellation and preconditions at the commit boundary. */
  beforeToolCommit?: () => Promise<void>
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>()
  private readonly now: () => number
  constructor(private readonly options: StoreOptions = {}) { this.now = options.now ?? Date.now }

  create(): HumanView {
    for (const [id, session] of this.sessions) {
      if (this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) this.sessions.delete(id)
    }
    if (this.sessions.size >= (this.options.maxSessions ?? 100)) throw new GameError(429, 'The local server has reached its session limit. Try again later or restart it.')
    const state = initialState()
    this.sessions.set(state.sessionId, { state, touchedAt: this.now(), requests: new Map(), lastTokenAt: -Infinity })
    return humanView(state)
  }

  private session(id: string, roundId?: string): Session {
    const session = this.sessions.get(id)
    if (!session || this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) {
      this.sessions.delete(id)
      throw new GameError(404, 'This mission session is unavailable. Start a new mission.')
    }
    if (roundId !== undefined && roundId !== session.state.roundId) throw new GameError(409, 'This request belongs to an earlier round. Use the current mission round.')
    session.touchedAt = this.now()
    return session
  }

  get(id: string): HumanView { return humanView(this.session(id).state) }

  private once<T extends HumanView | ToolResponse>(session: Session, key: string, payload: unknown, operation: () => T | Promise<T>): Promise<T> {
    const fingerprint = canonical(payload)
    const cached = session.requests.get(key)
    if (cached) {
      if (cached.fingerprint !== fingerprint) throw new GameError(409, 'This request identifier was already used for a different request.')
      return cached.response as Promise<T>
    }
    if (session.requests.size >= 1000) throw new GameError(429, 'This round has reached its request limit. Restart the mission.')
    // Reserve before running so concurrent retries share the same operation.
    const response = Promise.resolve().then(operation)
    session.requests.set(key, { fingerprint, response })
    return response
  }

  power(id: string, input: unknown): Promise<HumanView> {
    if (!exactObject(input, ['roundId', 'requestId', 'revision', 'powerOn']) || !identifier(input.roundId) || !identifier(input.requestId) || !integer(input.revision) || typeof input.powerOn !== 'boolean') {
      throw new GameError(400, 'Power requires the current round, a request identifier, a revision, and an explicit ON or OFF state.')
    }
    const request = input as unknown as PowerRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `power:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      if (request.revision !== current.revision) throw new GameError(409, 'The mission changed before this Power command arrived. Check the current state and try again.')
      const result = applyHumanPower(current, request.powerOn)
      if (!result.ok) throw new GameError(409, result.message)
      return humanView(current)
    })
  }

  tool(id: string, input: unknown): Promise<ToolResponse> {
    if (!exactObject(input, ['roundId', 'callId', 'actionEpoch', 'name', 'arguments']) || !identifier(input.roundId) || !identifier(input.callId) || !integer(input.actionEpoch) || typeof input.name !== 'string' || input.name.length > 80 || typeof input.arguments !== 'object' || input.arguments === null || Array.isArray(input.arguments)) {
      throw new GameError(400, 'A local tool request requires the current round, call identifier, action epoch, tool name, and object arguments.')
    }
    const request = input as unknown as ToolRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `tool:${request.callId}`, request, async () => {
      await this.options.beforeToolCommit?.()
      const current = this.session(id, request.roundId).state
      if (request.actionEpoch !== current.actionEpoch) return { ok: false, message: 'This pending action was canceled before it committed. Observe again when Mission Control is ready.', view: humanView(current) }
      const result = applyRobotTool(current, request.name, request.arguments)
      return { ...result, view: humanView(current) }
    })
  }

  lifecycle(id: string, action: 'stop' | 'resume' | 'reset' | 'end' | 'cancel', input: unknown): Promise<HumanView> {
    if (!exactObject(input, ['roundId', 'requestId']) || !identifier(input.roundId) || !identifier(input.requestId)) throw new GameError(400, 'This command requires the current round and a request identifier.')
    const request = input as unknown as LifecycleRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `${action}:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      if (action === 'reset') {
        session.state = initialState(id)
        session.requests.clear()
      } else {
        if (current.status === 'ended' && action !== 'end') throw new GameError(409, 'The mission has ended. Restart to begin a new round.')
        current.actionEpoch += 1
        current.revision += 1
        if (action !== 'cancel') current.status = action === 'resume' ? 'active' : action === 'end' ? 'ended' : 'stopped'
      }
      return humanView(session.state)
    })
  }

  reserveToken(id: string, input: unknown): HumanView {
    if (!exactObject(input, ['roundId']) || !identifier(input.roundId)) throw new GameError(400, 'Voice connection requires the current mission round.')
    const session = this.session(id, input.roundId)
    if (session.state.status !== 'active') throw new GameError(409, 'Resume the mission before connecting Live voice.')
    if (this.now() - session.lastTokenAt < 2000) throw new GameError(429, 'Please wait a moment before reconnecting Live voice.')
    session.lastTokenAt = this.now()
    return humanView(session.state)
  }
}
