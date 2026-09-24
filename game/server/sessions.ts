import type { AnnotationRequest, Chapter, DockControl, HintLevel, HintResult, HumanView, LifecycleRequest, MessageRequest, MissionKind, MissionRecord, NotebookEntry, NotebookRequest, PowerRequest, RecordedMessage, Relay, RobotRecap, Scenario, ToolRequest, ToolResponse } from '../shared/contracts.js'
import { applyHumanPower, applyRobotTool, exactObject, humanView, initialState, missionCompleted, type GameState } from './state.js'
import { GameError } from './errors.js'
import { RoundRecords } from './records.js'
import { applyHumanRelay, type GalleryConfiguration } from './gallery.js'
import { applyHumanDock } from './return-dock.js'
export { GameError } from './errors.js'

interface CachedRequest {
  fingerprint: string
  response: Promise<unknown>
}

interface Session {
  owner?: string
  state: GameState
  touchedAt: number
  requests: Map<string, CachedRequest>
  safetyRequests: Map<string, CachedRequest>
  lastTokenAt: number
  records: RoundRecords
}

interface StoreOptions {
  now?: () => number
  maxSessions?: number
  idleMilliseconds?: number
  /** Test seam for verifying cancellation and preconditions at the commit boundary. */
  beforeToolCommit?: () => Promise<void>
  /** Server-side deterministic test seam; no HTTP field selects this hidden configuration. */
  galleryConfiguration?: GalleryConfiguration
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function scenario(value: unknown): value is Scenario { return value === 'classic' || value === 'maintenance' }
function missionKind(value: unknown): value is MissionKind { return value === 'training' || value === 'rescue' }
function fields(value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}
function currentChapter(state: GameState, epoch: unknown, safety = false): void {
  if (epoch === undefined && state.missionKind === 'training') return
  if (!integer(epoch)) throw new GameError(400, 'This command requires the current chapter generation.')
  if (!safety && epoch !== state.chapterEpoch) throw new GameError(409, 'This request belongs to an earlier chapter. Use the current chapter and observe again.')
  if (safety && epoch > state.chapterEpoch) throw new GameError(409, 'That chapter has not been reached in this mission.')
}
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

  create(selectedScenario: Scenario = 'classic', kind: MissionKind = 'training', owner?: string): HumanView {
    if (!scenario(selectedScenario) || !missionKind(kind) || (kind === 'rescue' && selectedScenario !== 'classic')) throw new GameError(400, 'Choose Rescue Mission or Classic/Maintenance Training.')
    for (const [id, session] of this.sessions) {
      if (this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) this.sessions.delete(id)
    }
    if (this.sessions.size >= (this.options.maxSessions ?? 100)) throw new GameError(429, 'The local server has reached its session limit. Try again later or restart it.')
    const state = initialState(undefined, selectedScenario, undefined, kind, this.options.galleryConfiguration)
    this.sessions.set(state.sessionId, { owner, state, touchedAt: this.now(), requests: new Map(), safetyRequests: new Map(), lastTokenAt: -Infinity, records: new RoundRecords(state.roundId, selectedScenario, this.now) })
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

  assertOwner(id: string, owner: string | undefined): void {
    // Check ownership before touching expiry or disclosing whether a session exists.
    if (!owner || this.sessions.get(id)?.owner !== owner) throw new GameError(404, 'This mission session is unavailable in this browser. Start a new mission.')
  }

  private once<T>(session: Session, key: string, payload: unknown, operation: () => T | Promise<T>, safety = false): Promise<T> {
    const fingerprint = canonical(payload)
    const requests = safety ? session.safetyRequests : session.requests
    const cached = requests.get(key)
    if (cached) {
      if (cached.fingerprint !== fingerprint) throw new GameError(409, 'This request identifier was already used for a different request.')
      return cached.response as Promise<T>
    }
    if (!safety && requests.size >= 1000) throw new GameError(429, 'This round has reached its request limit. Restart the mission.')
    // Safety commands remain usable at saturation without evicting physical-action receipts.
    // Repeating an evicted safety command can only stop/revoke again; it cannot replay a move.
    if (safety && requests.size >= 32) requests.delete(requests.keys().next().value!)
    // Reserve before running so concurrent retries share the same operation.
    const response = Promise.resolve().then(operation)
    requests.set(key, { fingerprint, response })
    return response
  }

  power(id: string, input: unknown): Promise<HumanView> {
    if (!fields(input, ['roundId', 'requestId', 'revision', 'powerOn'], ['chapterEpoch']) || !identifier(input.roundId) || !identifier(input.requestId) || !integer(input.revision) || typeof input.powerOn !== 'boolean') {
      throw new GameError(400, 'Power requires the current round, a request identifier, a revision, and an explicit ON or OFF state.')
    }
    const request = input as unknown as PowerRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `power:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      currentChapter(current, request.chapterEpoch)
      if (request.revision !== current.revision) throw new GameError(409, 'The mission changed before this Power command arrived. Check the current state and try again.')
      const before = current.revision
      const result = applyHumanPower(current, request.powerOn)
      if (!result.ok) throw new GameError(409, result.message)
      if (before !== current.revision) session.records.markHistorical()
      session.records.event('power', 'human', result.message, current.chapter, current.chapterEpoch)
      return humanView(current)
    })
  }

  tool(id: string, input: unknown): Promise<ToolResponse> {
    if (!fields(input, ['roundId', 'callId', 'actionEpoch', 'name', 'arguments'], ['chapterEpoch']) || !identifier(input.roundId) || !identifier(input.callId) || !integer(input.actionEpoch) || typeof input.name !== 'string' || input.name.length > 80 || typeof input.arguments !== 'object' || input.arguments === null || Array.isArray(input.arguments)) {
      throw new GameError(400, 'A local tool request requires the current round, call identifier, action epoch, tool name, and object arguments.')
    }
    const request = input as unknown as ToolRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `tool:${request.callId}`, request, async () => {
      await this.options.beforeToolCommit?.()
      const current = this.session(id, request.roundId).state
      currentChapter(current, request.chapterEpoch)
      if (request.actionEpoch !== current.actionEpoch) return { ok: false, message: 'This pending action was canceled before it committed. Observe again when Mission Control is ready.', view: humanView(current) }
      const before = current.revision
      const chapter = current.chapter, epoch = current.chapterEpoch
      const result = applyRobotTool(current, request.name, request.arguments)
      if (result.ok && current.revision !== before) {
        session.records.event('action', 'robot', result.message, chapter, epoch)
        if (current.chapter !== chapter) {
          session.records.event('checkpoint', 'public', `${chapter === 'cargo' ? 'Cargo Bay' : 'Relay Gallery'} checkpoint confirmed. The rescue continues.`, chapter, epoch)
          session.records.markHistorical()
        }
        if (missionCompleted(current)) session.records.event('completion', 'public', current.missionKind === 'rescue' ? 'Pip returned home. The server confirmed rescue completion.' : 'Pip arrived on the far-side safe platform. The server confirmed completion.', chapter, epoch)
      } else if (result.ok || ['interact_object', 'move_to'].includes(request.name)) {
        session.records.event('observation', 'robot', result.message, chapter, epoch)
      }
      return { ...result, view: humanView(current) }
    })
  }

  lifecycle(id: string, action: 'stop' | 'resume' | 'reset' | 'end' | 'cancel', input: unknown): Promise<HumanView> {
    const optional = ['chapterEpoch', ...(action === 'reset' ? ['scenario', 'missionKind'] : []), ...(action === 'cancel' ? ['reason'] : [])]
    if (!fields(input, ['roundId', 'requestId'], optional) || !identifier(input.roundId) || !identifier(input.requestId)
      || ('scenario' in input && !scenario(input.scenario)) || ('missionKind' in input && !missionKind(input.missionKind))
      || ('reason' in input && (typeof input.reason !== 'string' || !['interrupt', 'supersede', 'stop'].includes(input.reason)))) throw new GameError(400, 'This command requires the current round and a request identifier. Only Restart may choose Classic or Maintenance.')
    const request = input as unknown as LifecycleRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `${action}:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      currentChapter(current, request.chapterEpoch, ['stop', 'end', 'cancel'].includes(action))
      if (action === 'reset') {
        const nextKind = request.missionKind ?? current.missionKind
        const nextScenario = request.scenario ?? current.scenario
        if (nextKind === 'rescue' && nextScenario !== 'classic') throw new GameError(400, 'Rescue Mission starts with Classic Cargo Bay rules.')
        session.state = initialState(id, nextScenario, undefined, nextKind, this.options.galleryConfiguration)
        session.records = new RoundRecords(session.state.roundId, session.state.scenario, this.now)
        session.requests.clear()
        session.safetyRequests.clear()
      } else {
        if (current.status === 'ended' && action !== 'end') throw new GameError(409, 'The mission has ended. Restart to begin a new round.')
        current.actionEpoch += 1
        current.revision += 1
        if (action !== 'cancel') current.status = action === 'resume' ? 'active' : action === 'end' ? 'ended' : 'stopped'
        if (action !== 'cancel' || request.reason !== 'supersede') current.dock.grant = null
        if (action === 'resume') session.records.markHistorical()
      }
      return humanView(session.state)
    }, ['stop', 'end', 'cancel', 'reset'].includes(action))
  }

  record(id: string, roundId: string): MissionRecord {
    if (!identifier(roundId)) throw new GameError(400, 'This record requires the current round identifier.')
    const session = this.session(id, roundId)
    return session.records.publicRecord(missionCompleted(session.state))
  }

  recap(id: string, roundId: string): RobotRecap {
    if (!identifier(roundId)) throw new GameError(400, 'This recap requires the current round identifier.')
    const session = this.session(id, roundId)
    return session.records.recap(session.state.chapter, session.state.chapterEpoch)
  }

  message(id: string, input: unknown): Promise<RecordedMessage> {
    if (!fields(input, ['roundId', 'messageId', 'segmentId', 'role', 'text', 'origin', 'inputMethod', 'interrupted'], ['chapter', 'chapterEpoch'])
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
    return Promise.resolve().then(() => {
      const session = this.session(id, request.roundId)
      const state = session.state
      const epoch = request.chapterEpoch ?? (state.missionKind === 'training' ? 0 : undefined)
      const chapter = request.chapter ?? (state.missionKind === 'training' ? 'cargo' : undefined)
      if (!integer(epoch) || epoch > state.chapterEpoch || ['cargo', 'gallery', 'return_dock'][epoch] !== chapter) throw new GameError(400, 'A finalized message must name a chapter already reached in this mission round.')
      return session.records.message({ ...request, chapter, chapterEpoch: epoch })
    })
  }

  notebook(id: string, input: unknown): Promise<NotebookEntry> {
    if ((!fields(input, ['roundId', 'requestId', 'kind', 'messageId'], ['chapterEpoch']) && !fields(input, ['roundId', 'requestId', 'kind', 'text'], ['chapterEpoch']))
      || !identifier(input.roundId) || !identifier(input.requestId)
      || !(input.kind === 'report' && messageIdentifier(input.messageId) && !('text' in input)
        || input.kind === 'note' && typeof input.text === 'string' && !!input.text.trim() && input.text.length <= 500 && !('messageId' in input))) {
      throw new GameError(400, 'Pin one finalized Robot report or write a private note of at most 500 characters, using the current round and a request identifier.')
    }
    const request = input as unknown as NotebookRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `notebook:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId)
      currentChapter(current.state, request.chapterEpoch)
      return current.records.pin(request, current.state.chapter, current.state.chapterEpoch)
    })
  }

  hint(id: string, input: unknown): Promise<HintResult> {
    if (!fields(input, ['roundId', 'requestId', 'level'], ['chapterEpoch']) || !identifier(input.roundId) || !identifier(input.requestId) || ![1, 2, 3].includes(Number(input.level)) || typeof input.level !== 'number') {
      throw new GameError(400, 'Request hint level 1 or 2 or 3 with the current round and a request identifier.')
    }
    const request = input as { roundId: string; requestId: string; level: HintLevel; chapterEpoch?: number }
    const session = this.session(id, request.roundId)
    return this.once(session, `hint:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId)
      currentChapter(current.state, request.chapterEpoch)
      return current.records.hint(request.level, current.state.chapter, current.state.chapterEpoch)
    })
  }

  control(id: string, kind: 'relay' | 'dock', input: unknown): Promise<HumanView> {
    const field = kind === 'relay' ? 'relay' : 'action'
    if (!fields(input, ['roundId', 'requestId', 'revision', 'chapterEpoch', field]) || !identifier(input.roundId) || !identifier(input.requestId) || !integer(input.revision)
      || typeof input[field] !== 'string' || !(kind === 'relay' ? ['off', 'beacon', 'harbor'] : ['charge', 'store', 'authorize_return', 'revoke_return']).includes(input[field] as string)) throw new GameError(400, 'Use the current chapter, revision, request identifier, and one supported human controller command.')
    const request = input as { roundId: string; requestId: string; revision: number; chapterEpoch: number; relay?: Relay; action?: DockControl }
    const session = this.session(id, request.roundId)
    return this.once(session, `${kind}:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId).state
      currentChapter(current, request.chapterEpoch)
      if (current.revision !== request.revision) throw new GameError(409, 'The mission changed before this command arrived. Read the current controller and try again.')
      const before = current.revision
      const result = kind === 'relay' ? applyHumanRelay(current, request.relay!) : applyHumanDock(current, request.action!)
      if (!result.ok) throw new GameError(409, result.message)
      if (before !== current.revision) session.records.markHistorical()
      session.records.event(kind, 'human', result.message, current.chapter, current.chapterEpoch)
      return humanView(current)
    })
  }

  annotate(id: string, input: unknown): Promise<MissionRecord> {
    if ((!fields(input, ['roundId', 'chapterEpoch', 'requestId', 'kind', 'target']) && !fields(input, ['roundId', 'chapterEpoch', 'requestId', 'kind', 'target', 'marked']))
      || !identifier(input.roundId) || !identifier(input.requestId)
      || !(input.kind === 'location' && !('marked' in input) && (input.target === null || typeof input.target === 'string' && ['ring', 'fork', 'sail', 'leaf', 'dock'].includes(input.target))
        || input.kind === 'blocked_gate' && typeof input.marked === 'boolean' && typeof input.target === 'string' && /^g[1-5]$/.test(input.target))) throw new GameError(400, 'Annotate one room emblem or suspected gate from your Gallery map. An annotation is your inference, not a sensor reading.')
    const request = input as AnnotationRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `annotation:${request.requestId}`, request, () => {
      const current = this.session(id, request.roundId)
      currentChapter(current.state, request.chapterEpoch)
      if (current.state.chapter !== 'gallery') throw new GameError(409, 'Map annotations belong to the Relay Gallery chapter.')
      current.records.annotate(request)
      return current.records.publicRecord(missionCompleted(current.state))
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
