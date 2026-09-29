/** Browser-safe contracts. Local equipment state belongs only on the server. */
export type SessionStatus = 'active' | 'stopped' | 'ended'
export type Scenario = 'classic' | 'maintenance'
export type MissionKind = 'training' | 'rescue'
export type OptionalObjective = 'flight_recorder'
export type Chapter = 'cargo' | 'gallery' | 'return_dock'
export type Relay = 'off' | 'beacon' | 'harbor'
export type DockControl = 'charge' | 'store' | 'authorize_return' | 'revoke_return'
export type CancelReason = 'interrupt' | 'supersede' | 'stop'
export type HintLevel = 1 | 2 | 3

export interface HumanView {
  sessionId: string
  roundId: string
  revision: number
  actionEpoch: number
  powerOn: boolean
  status: SessionStatus
  completed: boolean
  scenario: Scenario
  missionKind: MissionKind
  chapter: Chapter
  chapterEpoch: number
  chaptersCleared: Chapter[]
  /** Explicit mission selection, never a live inventory or location instrument. */
  optionalObjective?: OptionalObjective
  /** Published only after server-confirmed home, and only if actually secured. */
  recoveredFlightRecorder?: true
  relay?: Relay
  /** Working Return Dock instruments, not a local room camera. */
  returnDock?: { energy: 'empty' | 'primed' | 'stored'; readyForReturn: boolean; returnAuthorized: boolean }
  /** Pip's communicated intention and verified decision, not equipment telemetry. */
  proposal?: ActionProposal | null
  /** Orders proposal snapshots independently of physical/controller revisions. */
  proposalRevision?: number
}

export type ToolName = 'observe_room' | 'inspect_object' | 'inspect_gate' | 'propose_interaction' | 'propose_move' | 'get_action_status' | 'interact_object' | 'move_to'
export const gateDirections = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const
export type GateDirection = typeof gateDirections[number]
export const toolOutcomeCodes = ['cancelled_before_execution', 'precondition_failed', 'outcome_unknown', 'awaiting_confirmation', 'not_executed',
  'invalid_arguments', 'unknown_target', 'nonlocal_target', 'direction_unavailable', 'direction_ambiguous', 'target_unobserved', 'stale_scope', 'mission_stopped', 'tool_unavailable'] as const
export type ToolOutcomeCode = typeof toolOutcomeCodes[number]
export const toolRecoverySteps = ['observe_room', 'resume_mission', 'wait_for_control'] as const

export type ProposedAction = { kind: 'interaction'; object: string; action: string } | { kind: 'move'; target: string }
export interface ActionProposal {
  id: string
  roundId: string
  chapter: Chapter
  chapterEpoch: number
  action: ProposedAction
  label: string
  status: 'awaiting_confirmation' | 'committed' | 'declined' | 'expired' | 'invalidated' | 'failed'
  expiresAt: number
  result?: ActionOutcome
}
export interface ProposalDecisionRequest {
  roundId: string
  requestId: string
  proposalId: string
  decision: 'confirm' | 'decline'
}

export interface ToolRequest {
  roundId: string
  callId: string
  actionEpoch: number
  name: string
  arguments: Record<string, unknown>
  chapterEpoch?: number
  /** Captured by the application at tool receipt, never supplied by model arguments or HumanView. */
  inspectionScope?: { visitId: string }
}

export interface ActionOutcome {
  ok: boolean
  message: string
  code?: ToolOutcomeCode
}
/** Robot-local facts only. Never place this payload in HumanView or a public proposal. */
export interface RobotLocalPerception {
  origin: 'local_survey' | 'gate_inspection' | 'confirmed_arrival'
  roundId: string
  chapter: 'gallery'
  chapterEpoch: number
  visitId: string
  observationRevision: number
  stateRevision: number
  actionEpoch: number
  observedAt: number
  emblem: 'Ring' | 'Fork' | 'Sail' | 'Leaf'
  compass: 'north'
  gates: {
    handle: string
    direction: 'East' | 'West' | 'Northeast' | 'Southwest' | 'Southeast' | 'Northwest'
    power: 'powered' | 'unpowered'
    door: 'open' | 'closed'
    passage: 'clear' | 'blocked' | 'unchecked'
  }[]
}
export interface ToolResult extends ActionOutcome { proposal?: ActionProposal; perception?: RobotLocalPerception; recovery?: typeof toolRecoverySteps[number] }

/** Forward only ok/message and a recognized outcome code; view stays human-only. */
export interface ToolResponse extends ToolResult {
  view: HumanView
  decisionEvent?: RecordedMessage
}

export interface PowerRequest {
  roundId: string
  requestId: string
  revision: number
  powerOn: boolean
  chapterEpoch?: number
}

export interface LifecycleRequest {
  roundId: string
  requestId: string
  scenario?: Scenario
  missionKind?: MissionKind
  /** Omission on Restart starts a core mission; the old modifier never carries over. */
  optionalObjective?: OptionalObjective | null
  chapterEpoch?: number
  reason?: CancelReason
}

export type TransportOrigin = 'practice' | 'live_voice' | 'live_text' | 'game'
export type InputMethod = 'typed' | 'speech' | 'quick_request' | 'robot' | 'game_event'

/** Communicated text is a reported claim, never a physical-state update. */
export interface MessageRequest {
  roundId: string
  messageId: string
  segmentId: string
  role: 'human' | 'robot' | 'game'
  text: string
  origin: TransportOrigin
  inputMethod: InputMethod
  interrupted: boolean
  chapter?: Chapter
  chapterEpoch?: number
}

export interface RecordedMessage extends MessageRequest {
  timestamp: number
  /** Human controller context at record receipt; never an inferred room or gate fact. */
  reportContext?: { relay: Relay; earlier: boolean }
}

export type NotebookRequest = {
  roundId: string
  requestId: string
  chapterEpoch?: number
} & ({ kind: 'report'; messageId: string } | { kind: 'note'; text: string })

export interface NotebookEntry {
  id: string
  roundId: string
  kind: 'report' | 'note'
  text: string
  timestamp: number
  messageId?: string
  segmentId?: string
  origin?: TransportOrigin
  reportedAt?: number
  interrupted?: boolean
  earlier: boolean
  chapter?: Chapter
  chapterEpoch?: number
}

export interface TimelineEntry {
  id: string
  roundId: string
  timestamp: number
  actor: 'human' | 'robot' | 'mission'
  kind: 'power' | 'relay' | 'dock' | 'action' | 'confirmation' | 'hint' | 'checkpoint' | 'completion'
  text: string
  chapter?: Chapter
  chapterEpoch?: number
}

export interface HintResult {
  roundId: string
  level: HintLevel
  text: string
  chapter?: Chapter
  chapterEpoch?: number
}

export interface GalleryAnnotation {
  chapter: 'gallery'
  location: 'ring' | 'fork' | 'sail' | 'leaf' | 'dock' | null
  blockedGates: string[]
  plannedGates?: string[]
  exploredGates?: string[]
  reportLinks?: GalleryReportLink[]
}

export interface GalleryReportLink {
  messageId: string
  target: string
  targetKind: 'room' | 'corridor'
  dynamic: boolean
  associatedAt: number
  reportedAt: number
  text: string
  origin: TransportOrigin
  chapter: 'gallery'
  interrupted: boolean
  relayAtReport?: Relay
  earlier: boolean
}

export type AnnotationRequest = { roundId: string; chapterEpoch: number; requestId: string } & (
  { kind: 'clear_plan' } |
  { kind: 'location'; target: GalleryAnnotation['location'] } |
  { kind: 'blocked_gate' | 'planned_gate' | 'explored_gate'; target: string; marked: boolean } |
  { kind: 'report_link'; messageId: string; target: string; targetKind: 'room' | 'corridor'; dynamic: boolean } |
  { kind: 'report_unlink'; messageId: string; target: string; targetKind: 'room' | 'corridor' }
)

/** Does not contain undisclosed robot observations or the internal event log. */
export interface MissionRecord {
  roundId: string
  messages: RecordedMessage[]
  notebook: NotebookEntry[]
  hintsUsed: HintLevel[]
  hintUses?: { chapter: Chapter; level: HintLevel }[]
  annotations?: GalleryAnnotation
  debrief: null | { timeline: TimelineEntry[]; truncated: boolean }
}

export interface RobotRecap {
  roundId: string
  instruction: string
  chapter?: Chapter
  chapterEpoch?: number
  entries: {
    kind: 'observation' | 'action' | 'player_quote'
    text: string
    timestamp: number
    origin?: TransportOrigin
    messageId?: string
    chapter?: Chapter
    chapterEpoch?: number
    observationOrigin?: RobotLocalPerception['origin']
  }[]
}

export interface ApiErrorResponse {
  error: string
  code?: ToolOutcomeCode
  recovery?: typeof toolRecoverySteps[number]
}
