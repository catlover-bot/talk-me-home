import type { HintResult, HumanView, LifecycleRequest, MessageRequest, MissionRecord, NotebookEntry, NotebookRequest, PowerRequest, RecordedMessage, RobotRecap, Scenario, ToolRequest, ToolResponse } from '../shared/contracts.js'
import { applyHumanPower, applyRobotTool, exactObject, humanView, initialState, type GameState } from './state.js'
import { GameError } from './errors.js'
import { RoundRecords } from './records.js'
export { GameError } from './errors.js'

interface CachedRequest {
  fingerprint: string
  response: Promise<unknown>
}

interface Session {
  state: GameState
  touchedAt: number
  requests: Map<string, CachedRequest>
  lastTokenAt: number
  records: RoundRecords
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

function scenario(value: unknown): value is Scenario { return value === 'classic' || value === 'maintenance' }
function messageIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_:.-]{1,180}$/.test(value)
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

  create(selectedScenario: Scenario = 'classic'): HumanView {
    if (!scenario(selectedScenario)) throw new GameError(400, 'Choose Classic or Maintenance for the mission.')
    for (const [id, session] of this.sessions) {
      if (this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) this.sessions.delete(id)
    }
    if (this.sessions.size >= (this.options.maxSessions ?? 100)) throw new GameError(429, 'The local server has reached its session limit. Try again later or restart it.')
    const state = initialState(undefined, selectedScenario)
    this.sessions.set(state.sessionId, { state, touchedAt: this.now(), requests: new Map(), lastTokenAt: -Infinity, records: new RoundRecords(state.roundId, selectedScenario, this.now) })
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

  private once<T>(session: Session, key: string, payload: unknown, operation: () => T | Promise<T>): Promise<T> {
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
      const before = current.revision
      const result = applyHumanPower(current, request.powerOn)
      if (!result.ok) throw new GameError(409, result.message)
      if (before !== current.revision) session.records.markHistorical()
      session.records.event('power', 'human', result.message)
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
      const before = current.revision
      const result = applyRobotTool(current, request.name, request.arguments)
      if (result.ok && current.revision !== before) {
        session.records.event('action', 'robot', result.message)
        if (current.robotLocation === 'far_side') session.records.event('completion', 'public', 'Pip arrived on the far-side safe platform. The server confirmed completion.')
      } else if (result.ok || ['interact_object', 'move_to'].includes(request.name)) {
        session.records.event('observation', 'robot', result.message)
      }
      return { ...result, view: humanView(current) }
    })
  }

  lifecycle(id: string, action: 'stop' | 'resume' | 'reset' | 'end' | 'cancel', input: unknown): Promise<HumanView> {
    const plain = exactObject(input, ['roundId', 'requestId'])
    const withScenario = action === 'reset' && exactObject(input, ['roundId', 'requestId', 'scenario']) && scenario(input.scenario)
    if ((!plain && !withScenario) || !identifier(input.roundId) || !identifier(input.requestId)) throw new GameError(400, 'This command requires the current round and a request identifier. Only Restart may choose Classic or Maintenance.')
    const request = input as unknown as LifecycleRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `${action}:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      if (action === 'reset') {
        session.state = initialState(id, request.scenario ?? current.scenario)
        session.records = new RoundRecords(session.state.roundId, session.state.scenario, this.now)
        session.requests.clear()
      } else {
        if (current.status === 'ended' && action !== 'end') throw new GameError(409, 'The mission has ended. Restart to begin a new round.')
        current.actionEpoch += 1
        current.revision += 1
        if (action !== 'cancel') current.status = action === 'resume' ? 'active' : action === 'end' ? 'ended' : 'stopped'
        if (action === 'resume') session.records.markHistorical()
      }
      return humanView(session.state)
    })
  }

  record(id: string, roundId: string): MissionRecord {
    if (!identifier(roundId)) throw new GameError(400, 'This record requires the current round identifier.')
    const session = this.session(id, roundId)
    return session.records.publicRecord(session.state.robotLocation === 'far_side')
  }

  recap(id: string, roundId: string): RobotRecap {
    if (!identifier(roundId)) throw new GameError(400, 'This recap requires the current round identifier.')
    return this.session(id, roundId).records.recap()
  }

  message(id: string, input: unknown): Promise<RecordedMessage> {
    if (!exactObject(input, ['roundId', 'messageId', 'segmentId', 'role', 'text', 'origin', 'inputMethod', 'interrupted'])
      || !identifier(input.roundId) || !messageIdentifier(input.messageId) || !messageIdentifier(input.segmentId)
      || typeof input.role !== 'string' || !['human', 'robot'].includes(input.role)
      || typeof input.origin !== 'string' || !['practice', 'live_voice', 'live_text'].includes(input.origin)
      || typeof input.inputMethod !== 'string' || !['typed', 'speech', 'robot'].includes(input.inputMethod)
      || typeof input.interrupted !== 'boolean'
      || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000
      || (input.role === 'robot') !== (input.inputMethod === 'robot')
      || (input.inputMethod === 'speech' && input.origin !== 'live_voice')) {
      throw new GameError(400, 'Record one finalized message with its round, message and call identifiers, origin, input method, and text of at most 2000 characters.')
    }
    const request = input as unknown as MessageRequest
    this.session(id, request.roundId)
    return Promise.resolve().then(() => this.session(id, request.roundId).records.message(request))
  }

  notebook(id: string, input: unknown): Promise<NotebookEntry> {
    if ((!exactObject(input, ['roundId', 'requestId', 'kind', 'messageId']) && !exactObject(input, ['roundId', 'requestId', 'kind', 'text']))
      || !identifier(input.roundId) || !identifier(input.requestId)
      || !(input.kind === 'report' && messageIdentifier(input.messageId) && !('text' in input)
        || input.kind === 'note' && typeof input.text === 'string' && !!input.text.trim() && input.text.length <= 500 && !('messageId' in input))) {
      throw new GameError(400, 'Pin one finalized Robot report or write a private note of at most 500 characters, using the current round and a request identifier.')
    }
    const request = input as unknown as NotebookRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `notebook:${request.requestId}`, request, () => this.session(id, request.roundId).records.pin(request))
  }

  hint(id: string, input: unknown): Promise<HintResult> {
    if (!exactObject(input, ['roundId', 'requestId', 'level']) || !identifier(input.roundId) || !identifier(input.requestId) || (input.level !== 1 && input.level !== 2)) {
      throw new GameError(400, 'Request hint level 1 or 2 with the current round and a request identifier.')
    }
    const request = input as { roundId: string; requestId: string; level: 1 | 2 }
    const session = this.session(id, request.roundId)
    return this.once(session, `hint:${request.requestId}`, request, () => this.session(id, request.roundId).records.hint(request.level))
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
