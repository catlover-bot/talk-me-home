import { createHash, randomUUID } from 'node:crypto'
import type { ActionProposal, AnnotationRequest, Chapter, DockControl, HintLevel, HintResult, HumanView, LifecycleRequest, MessageRequest, MissionKind, MissionRecord, NotebookEntry, NotebookRequest, PowerRequest, ProposalDecisionRequest, RecordedMessage, Relay, RobotRecap, Scenario, ToolRequest, ToolResponse, ToolResult } from '../shared/contracts.js'
import { applyHumanPower, applyRobotTool, exactObject, humanView, initialState, missionCompleted, type GameState } from './state.js'
import { GameError } from './errors.js'
import { RoundRecords } from './records.js'
import { applyHumanRelay, perceptionIsCurrent, type GalleryConfiguration } from './gallery.js'
import { applyHumanDock } from './return-dock.js'
import { describeProposal, proposalLocation } from './proposals.js'
import { toolDiagnosticIdentity, type ToolDiagnostic } from './tool-diagnostics.js'
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
  proposals: Map<string, StoredProposal>
  latestProposal: string | null
  proposalRevision: number
}

interface StoredProposal {
  value: ActionProposal
  owner?: string
  location: string
  /** Detailed robot-local outcome never enters the human proposal or Game caption. */
  outcome?: ToolResult
  decision?: 'confirm' | 'decline'
  response?: Promise<ToolResponse>
}

interface StoreOptions {
  now?: () => number
  maxSessions?: number
  idleMilliseconds?: number
  /** Test seam for verifying cancellation and preconditions at the commit boundary. */
  beforeToolCommit?: () => Promise<void>
  /** Server-owned evaluator seam; never exposed to model tools or browser routes. */
  onRobotCommit?: (event: { sessionId: string; roundId: string; chapter: Chapter; chapterEpoch: number; proposalId: string; revisionBefore: number; revisionAfter: number }) => void
  /** Server-side deterministic test seam; no HTTP field selects this hidden configuration. */
  galleryConfiguration?: GalleryConfiguration
  /** Private local diagnostics, explicitly enabled by the loopback server entry point. */
  onToolDiagnostic?: (event: ToolDiagnostic) => void
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
  if (!integer(epoch)) throw new GameError(400, 'This command requires the current chapter generation.', 'invalid_arguments', 'observe_room')
  if (!safety && epoch !== state.chapterEpoch) throw new GameError(409, 'This request belongs to an earlier chapter. Use the current chapter and observe again.', 'stale_scope', 'observe_room')
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
  private toolDiagnosticSink?: (event: ToolDiagnostic) => void
  constructor(private readonly options: StoreOptions = {}) { this.now = options.now ?? Date.now; this.toolDiagnosticSink = options.onToolDiagnostic }

  /** Server bootstrap only; no browser/model route can enable this sink. */
  enableLocalToolDiagnostics(sink: (event: ToolDiagnostic) => void): void { this.toolDiagnosticSink = sink }

  create(selectedScenario: Scenario = 'classic', kind: MissionKind = 'training', owner?: string): HumanView {
    if (!scenario(selectedScenario) || !missionKind(kind) || (kind === 'rescue' && selectedScenario !== 'classic')) throw new GameError(400, 'Choose Rescue Mission or Classic/Maintenance Training.')
    for (const [id, session] of this.sessions) {
      if (this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) this.sessions.delete(id)
    }
    if (this.sessions.size >= (this.options.maxSessions ?? 100)) throw new GameError(429, 'The local server has reached its session limit. Try again later or restart it.')
    const state = initialState(undefined, selectedScenario, undefined, kind, this.options.galleryConfiguration)
    this.sessions.set(state.sessionId, { owner, state, touchedAt: this.now(), requests: new Map(), safetyRequests: new Map(), lastTokenAt: -Infinity, records: new RoundRecords(state.roundId, selectedScenario, this.now), proposals: new Map(), latestProposal: null, proposalRevision: 0 })
    return this.get(state.sessionId)
  }

  private session(id: string, roundId?: string): Session {
    const session = this.sessions.get(id)
    if (!session || this.now() - session.touchedAt > (this.options.idleMilliseconds ?? 7_200_000)) {
      this.sessions.delete(id)
      throw new GameError(404, 'This mission session is unavailable. Start a new mission.')
    }
    if (roundId !== undefined && roundId !== session.state.roundId) throw new GameError(409, 'This request belongs to an earlier round. Use the current mission round.', 'stale_scope', 'observe_room')
    session.touchedAt = this.now()
    return session
  }

  get(id: string): HumanView { return this.view(this.session(id)) }

  /** Physical-state digest for an owned server evaluator only; no public telemetry route. */
  physicalDigestForEvaluation(id: string): string {
    const state = this.session(id).state
    return createHash('sha256').update(JSON.stringify({ powerOn: state.powerOn, doorLatched: state.doorLatched, robotLocation: state.robotLocation,
      selector: state.selector, chapter: state.chapter, gallery: { room: state.gallery.room, relay: state.gallery.relay },
      dock: { location: state.dock.location, contactHeld: state.dock.contactHeld, energy: state.dock.energy } })).digest('hex')
  }

  private refreshProposal(session: Session): StoredProposal | undefined {
    const proposal = session.latestProposal ? session.proposals.get(session.latestProposal) : undefined
    if (proposal?.value.status === 'awaiting_confirmation') {
      const state = session.state
      if (proposal.value.expiresAt <= this.now()) this.invalidateProposal(session, proposal, 'expired', 'This proposal expired without execution. Ask Pip for a new proposal.')
      else if (state.status !== 'active' || proposal.value.roundId !== state.roundId || proposal.value.chapterEpoch !== state.chapterEpoch || proposal.location !== proposalLocation(state)) {
        this.invalidateProposal(session, proposal, 'invalidated', 'This proposal belongs to an earlier mission context and was not executed.')
      }
    }
    return proposal
  }

  private invalidateProposal(session: Session, proposal: StoredProposal, status: 'expired' | 'invalidated', message: string): void {
    if (proposal.value.status !== 'awaiting_confirmation') return
    proposal.value = { ...proposal.value, status, result: { ok: false, code: 'not_executed', message } }
    proposal.outcome = proposal.value.result
    session.proposalRevision += 1
  }

  private view(session: Session): HumanView {
    const proposal = this.refreshProposal(session)
    return { ...humanView(session.state), proposal: proposal ? structuredClone(proposal.value) : null, proposalRevision: session.proposalRevision }
  }

  private proposalResult(proposal: StoredProposal, state: GameState): ToolResult {
    const value = structuredClone(proposal.value)
    const outcome = structuredClone(proposal.outcome ?? value.result ?? { ok: true, code: 'awaiting_confirmation', message: `Proposal ${value.id}: ${value.label}. Awaiting Mission Control's console confirmation; not executed. Do not report completion or repeatedly poll. Read its status after the owner decides.` }) as ToolResult
    if (outcome.perception && !perceptionIsCurrent(state, outcome.perception)) {
      delete outcome.perception
      outcome.message = `Historical action receipt. Any room or gate description below was observed then and is not a current reading; observe your current surroundings if needed. ${outcome.message}`
    }
    return { ...outcome, proposal: value }
  }

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
      return this.view(session)
    })
  }

  tool(id: string, input: unknown): Promise<ToolResponse> {
    const startedAtMs = performance.now()
    let stage: ToolDiagnostic['stage'] = 'request_schema'
    const scope: ToolDiagnostic['scope'] = { round: null, chapter: null, action: null, visit: null }
    const diagnostic = (code: ToolDiagnostic['code'], finalStage = stage) => {
      if (!this.toolDiagnosticSink) return
      const finishedAtMs = performance.now()
      try { this.toolDiagnosticSink({ ...toolDiagnosticIdentity(id, input), scope: { ...scope }, stage: finalStage, code, startedAtMs, finishedAtMs, elapsedMs: finishedAtMs - startedAtMs }) }
      catch { /* Diagnostics never alter tool execution or its result. */ }
    }
    const failed = (error: unknown): never => { diagnostic(error instanceof GameError ? error.code ?? 'request_rejected' : 'request_rejected'); throw error }
    try {
    if (!fields(input, ['roundId', 'callId', 'actionEpoch', 'name', 'arguments'], ['chapterEpoch', 'inspectionScope']) || !identifier(input.roundId) || !identifier(input.callId) || !integer(input.actionEpoch) || typeof input.name !== 'string' || input.name.length > 80 || typeof input.arguments !== 'object' || input.arguments === null || Array.isArray(input.arguments)
      || input.inspectionScope !== undefined && (!exactObject(input.inspectionScope, ['visitId']) || !identifier(input.inspectionScope.visitId))) {
      throw new GameError(400, 'A local tool request requires the current round, call identifier, action epoch, tool name, and object arguments.', 'invalid_arguments', 'observe_room')
    }
    const request = input as unknown as ToolRequest
    stage = 'scope'
    const admitted = this.session(id).state
    scope.round = admitted.roundId === request.roundId
    const session = this.session(id, request.roundId)
    // Captured before any queued work. A missing envelope cannot silently acquire a later visit.
    const admittedVisit = admitted.gallery.visitId
    return this.once(session, `tool:${request.callId}`, request, async () => {
      try {
      await this.options.beforeToolCommit?.()
      const current = this.session(id).state
      scope.round = current.roundId === request.roundId
      scope.chapter = request.chapterEpoch === current.chapterEpoch || request.chapterEpoch === undefined && current.missionKind === 'training'
      scope.action = request.actionEpoch === current.actionEpoch
      scope.visit = request.inspectionScope ? request.inspectionScope.visitId === current.gallery.visitId && admittedVisit === current.gallery.visitId : null
      this.session(id, request.roundId)
      const finish = (result: ToolResult, resultStage: ToolDiagnostic['stage'] = 'tool_validation'): ToolResponse => {
        diagnostic(result.code ?? (result.ok ? 'ok' : 'precondition_failed'), result.ok ? 'complete' : resultStage)
        return { ...result, view: this.view(session) }
      }
      if (request.name === 'inspect_gate') {
        if (current.status !== 'active') return finish({ ok: false, code: 'mission_stopped', recovery: 'resume_mission', message: 'The mission is stopped. Wait for Mission Control to resume before inspecting.' }, 'scope')
        if (scope.chapter && scope.action && current.chapter !== 'gallery') return finish({ ok: false, code: 'tool_unavailable', recovery: 'observe_room', message: 'Direction-based gate inspection is available only in the Relay Gallery. Observe the current local equipment.' })
        if (!scope.chapter || !scope.action || scope.visit !== true) return finish({ ok: false, code: 'stale_scope', recovery: 'observe_room', message: 'This inspection belongs to an earlier or unobserved visit or action generation. Observe the current room, then inspect the requested direction again.' }, 'scope')
      }
      currentChapter(current, request.chapterEpoch)
      if (request.actionEpoch !== current.actionEpoch) return finish({ ok: false, code: 'cancelled_before_execution', recovery: 'wait_for_control', message: 'This pending action was canceled before it committed. Observe again when Mission Control is ready.' }, 'scope')
      stage = 'tool_validation'
      const pending = this.refreshProposal(session)
      if (request.name === 'get_action_status') {
        if (!exactObject(request.arguments, ['proposal_id']) || !identifier(request.arguments.proposal_id)) return finish({ ok: false, code: 'not_executed', message: 'Read status using one known proposal identifier.' })
        const proposal = session.proposals.get(request.arguments.proposal_id)
        if (!proposal || proposal.value.roundId !== current.roundId) return finish({ ok: false, code: 'not_executed', message: 'That proposal is unavailable in this mission round.' })
        return finish(this.proposalResult(proposal, current))
      }
      if (['interact_object', 'move_to', 'propose_interaction', 'propose_move'].includes(request.name)) {
        const descriptor = describeProposal(current, request.name, request.arguments)
        if (!descriptor) return finish({ ok: false, code: 'not_executed', message: 'That exact local action is unavailable. Observe or inspect a reachable object; approval flags are not accepted.' })
        if (pending?.value.status === 'awaiting_confirmation') {
          if (canonical(pending.value.action) === canonical(descriptor.action)) return finish(this.proposalResult(pending, current))
          return finish({ ok: false, code: 'not_executed', message: 'A different proposal is still awaiting a decision. It was not replaced. Mission Control must decline or cancel it before a different action is proposed.', proposal: structuredClone(pending.value) })
        }
        const proposal: StoredProposal = { owner: session.owner, location: proposalLocation(current), value: {
          id: randomUUID(), roundId: current.roundId, chapter: current.chapter, chapterEpoch: current.chapterEpoch,
          ...descriptor, status: 'awaiting_confirmation', expiresAt: this.now() + 90_000,
        } }
        session.proposals.set(proposal.value.id, proposal); session.latestProposal = proposal.value.id; session.proposalRevision += 1
        return finish(this.proposalResult(proposal, current))
      }
      // Only read-only operations may enter the physical dispatcher without owner confirmation.
      const result: ToolResult = ['observe_room', 'inspect_object', 'inspect_gate'].includes(request.name)
        ? applyRobotTool(current, request.name, request.arguments, this.now(), request.inspectionScope)
        : { ok: false, code: 'tool_unavailable', recovery: 'observe_room', message: 'That tool is not available. Use an implemented local game tool.' }
      if (result.ok) session.records.event('observation', 'robot', result.message, current.chapter, current.chapterEpoch, result.perception?.origin)
      return finish(result, result.code === 'invalid_arguments' ? 'request_schema' : 'target_resolution')
      } catch (error) { return failed(error) }
    })
    } catch (error) { return failed(error) }
  }

  decideProposal(id: string, input: unknown, owner: string | undefined): Promise<ToolResponse> {
    this.assertOwner(id, owner)
    if (!exactObject(input, ['roundId', 'requestId', 'proposalId', 'decision']) || !identifier(input.roundId) || !identifier(input.requestId)
      || !identifier(input.proposalId) || !['confirm', 'decline'].includes(String(input.decision))) throw new GameError(400, 'Decide one exact proposal using its identifiers and Confirm or Not yet. Replacement arguments are not accepted.')
    const request = input as unknown as ProposalDecisionRequest
    const session = this.session(id, request.roundId)
    return this.once(session, `proposal-decision:${request.requestId}`, request, () => {
      const proposal = session.proposals.get(request.proposalId)
      if (!proposal || proposal.owner !== owner || proposal.value.roundId !== request.roundId) throw new GameError(404, 'That proposal is unavailable in this owning browser and round.')
      if (proposal.decision) {
        if (proposal.decision !== request.decision) throw new GameError(409, 'This proposal already has a different final decision.')
        return proposal.response!
      }
      proposal.decision = request.decision
      proposal.response = Promise.resolve().then(async () => {
        if (request.decision === 'confirm') await this.options.beforeToolCommit?.()
        const current = this.session(id, request.roundId).state
        this.refreshProposal(session)
        let result: ToolResult
        const { chapter, chapterEpoch } = proposal.value
        session.records.event('confirmation', 'human', `${request.decision === 'confirm' ? 'Confirmed' : 'Declined'}: ${proposal.value.label}.`, chapter, chapterEpoch)
        if (proposal.value.status !== 'awaiting_confirmation') result = proposal.value.result ?? { ok: false, code: 'not_executed', message: 'This proposal is no longer awaiting confirmation and was not executed.' }
        else if (request.decision === 'decline') {
          result = { ok: false, code: 'not_executed', message: `Proposal ${proposal.value.id} declined by Mission Control; ${proposal.value.label} was not executed.` }
          proposal.value = { ...proposal.value, status: 'declined', result }
          proposal.outcome = result; session.proposalRevision += 1
        } else {
          const before = current.revision
          const action = proposal.value.action
          result = action.kind === 'interaction'
            ? applyRobotTool(current, 'interact_object', { object: action.object, action: action.action }, this.now())
            : applyRobotTool(current, 'move_to', { target: action.target }, this.now())
          if (!result.ok) result = { ...result, code: 'precondition_failed' }
          proposal.outcome = { ...result }
          proposal.value = { ...proposal.value, status: result.ok ? 'committed' : 'failed', result: result.ok
            ? { ok: true, message: 'Mission Control confirmed this exact action and the server completed it.' }
            : { ok: false, code: 'precondition_failed', message: 'The action was not executed because current conditions did not permit it. Ask Pip to inspect before proposing another action.' } }
          session.proposalRevision += 1
          if (result.ok && current.revision !== before) {
            session.records.event('action', 'robot', result.perception ? `${proposal.value.label}: confirmed and completed.` : result.message, chapter, chapterEpoch)
            this.options.onRobotCommit?.({ sessionId: id, roundId: current.roundId, chapter, chapterEpoch, proposalId: proposal.value.id, revisionBefore: before, revisionAfter: current.revision })
            if (current.chapter !== chapter) {
              session.records.event('checkpoint', 'public', `${chapter === 'cargo' ? 'Cargo Bay' : 'Relay Gallery'} checkpoint confirmed. The rescue continues.`, chapter, chapterEpoch)
            }
            if (action.kind === 'move') session.records.markHistorical()
            if (result.perception) session.records.event('observation', 'robot', result.message, current.chapter, current.chapterEpoch, result.perception.origin)
            if (missionCompleted(current)) session.records.event('completion', 'public', current.missionKind === 'rescue' ? 'Pip returned home. The server confirmed rescue completion.' : 'Pip arrived on the far-side safe platform. The server confirmed completion.', chapter, chapterEpoch)
          }
        }
        const eventText = `${proposal.value.label}: ${proposal.value.status === 'committed' ? 'completed after your confirmation.'
          : proposal.value.status === 'declined' ? 'declined; not executed.'
            : proposal.value.status === 'expired' ? 'expired; not executed.'
              : proposal.value.status === 'failed' ? 'current conditions did not permit it; not executed.'
                : 'no longer available; not executed.'}`
        const decisionEvent = session.records.message({ roundId: current.roundId, messageId: `proposal-${proposal.value.id}`, segmentId: `proposal-${proposal.value.id}`,
          role: 'game', origin: 'game', inputMethod: 'game_event', text: eventText, interrupted: false, chapter, chapterEpoch })
        return { ...result, proposal: structuredClone(proposal.value), decisionEvent, view: this.view(session) }
      })
      return proposal.response
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
        session.proposals.clear(); session.latestProposal = null; session.proposalRevision = 0
      } else {
        if (current.status === 'ended' && action !== 'end') throw new GameError(409, 'The mission has ended. Restart to begin a new round.')
        current.actionEpoch += 1
        current.revision += 1
        if (action !== 'cancel') current.status = action === 'resume' ? 'active' : action === 'end' ? 'ended' : 'stopped'
        if (action !== 'cancel' || request.reason !== 'supersede') current.dock.grant = null
        if (action !== 'cancel' || request.reason !== 'supersede') {
          const pending = this.refreshProposal(session)
          if (pending) this.invalidateProposal(session, pending, 'invalidated', 'Mission Control canceled this proposal before execution. Ask for a new proposal when ready.')
        }
        if (action !== 'cancel' || request.reason !== 'supersede') session.records.markHistorical()
      }
      return this.view(session)
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
      || typeof input.inputMethod !== 'string' || !['typed', 'speech', 'quick_request', 'robot'].includes(input.inputMethod)
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
      return session.records.message({ ...request, chapter, chapterEpoch: epoch }, state.chapter === 'gallery' && chapter === 'gallery' ? state.gallery.relay : undefined)
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
      if (kind === 'relay' && before !== current.revision) {
        const pending = this.refreshProposal(session)
        if (pending) this.invalidateProposal(session, pending, 'invalidated', 'The Relay changed after this proposal. No move was executed; inspect the current gate and ask for a new proposal.')
      }
      if (kind === 'dock' && request.action === 'revoke_return') {
        const pending = this.refreshProposal(session)
        if (pending) this.invalidateProposal(session, pending, 'invalidated', 'Mission Control revoked return authorization. This proposal was not executed and cannot be revived by a later grant.')
      }
      if (before !== current.revision) session.records.markHistorical()
      session.records.event(kind, 'human', result.message, current.chapter, current.chapterEpoch)
      return this.view(session)
    })
  }

  annotate(id: string, input: unknown): Promise<MissionRecord> {
    const common = ['roundId', 'chapterEpoch', 'requestId', 'kind', 'target']
    const room = (value: unknown) => typeof value === 'string' && ['ring', 'fork', 'sail', 'leaf', 'dock'].includes(value)
    const gate = (value: unknown) => typeof value === 'string' && /^g[1-5]$/.test(value)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new GameError(400, 'Choose one private map annotation.')
    const value = input as Record<string, unknown>
    const valid = value.kind === 'clear_plan' ? exactObject(value, ['roundId', 'chapterEpoch', 'requestId', 'kind'])
      : value.kind === 'location' ? exactObject(value, common) && (value.target === null || room(value.target))
      : ['blocked_gate', 'planned_gate', 'explored_gate'].includes(String(value.kind)) ? exactObject(value, [...common, 'marked']) && gate(value.target) && typeof value.marked === 'boolean'
        : ['report_link', 'report_unlink'].includes(String(value.kind)) && exactObject(value, [...common, 'messageId', 'targetKind', ...(value.kind === 'report_link' ? ['dynamic'] : [])])
          && messageIdentifier(value.messageId) && (value.targetKind === 'room' ? room(value.target) : value.targetKind === 'corridor' && gate(value.target))
          && (value.kind === 'report_unlink' || typeof value.dynamic === 'boolean')
    if (!valid || !identifier(value.roundId) || !identifier(value.requestId)) throw new GameError(400, 'Annotate one room, route gate or exact Pip report from your Gallery map. An annotation is your inference, not a sensor reading.')
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
    return this.view(session)
  }
}
