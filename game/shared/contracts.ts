/** Browser-safe contracts. Local equipment state belongs only on the server. */
export type SessionStatus = 'active' | 'stopped' | 'ended'
export type Scenario = 'classic' | 'maintenance'
export type MissionKind = 'training' | 'rescue'
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
  relay?: Relay
  /** Working Return Dock instruments, not a local room camera. */
  returnDock?: { energy: 'empty' | 'primed' | 'stored'; readyForReturn: boolean; returnAuthorized: boolean }
}

export type ToolName = 'observe_room' | 'inspect_object' | 'interact_object' | 'move_to'

export interface ToolRequest {
  roundId: string
  callId: string
  actionEpoch: number
  name: string
  arguments: Record<string, unknown>
  chapterEpoch?: number
}

export interface ToolResult {
  ok: boolean
  message: string
  code?: 'cancelled_before_execution' | 'precondition_failed' | 'outcome_unknown'
}

/** Forward only ok/message and a recognized outcome code; view stays human-only. */
export interface ToolResponse extends ToolResult {
  view: HumanView
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
  chapterEpoch?: number
  reason?: CancelReason
}

export type TransportOrigin = 'practice' | 'live_voice' | 'live_text'
export type InputMethod = 'typed' | 'speech' | 'robot'

/** Communicated text is a reported claim, never a physical-state update. */
export interface MessageRequest {
  roundId: string
  messageId: string
  segmentId: string
  role: 'human' | 'robot'
  text: string
  origin: TransportOrigin
  inputMethod: InputMethod
  interrupted: boolean
  chapter?: Chapter
  chapterEpoch?: number
}

export interface RecordedMessage extends MessageRequest {
  timestamp: number
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
  kind: 'power' | 'relay' | 'dock' | 'action' | 'hint' | 'checkpoint' | 'completion'
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
}

export type AnnotationRequest = { roundId: string; chapterEpoch: number; requestId: string } & (
  { kind: 'location'; target: GalleryAnnotation['location'] } |
  { kind: 'blocked_gate'; target: string; marked: boolean }
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
  }[]
}

export interface ApiErrorResponse {
  error: string
}
