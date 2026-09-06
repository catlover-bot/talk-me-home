/** Browser-safe contracts. Local equipment state belongs only on the server. */
export type SessionStatus = 'active' | 'stopped' | 'ended'
export type Scenario = 'classic' | 'maintenance'

export interface HumanView {
  sessionId: string
  roundId: string
  revision: number
  actionEpoch: number
  powerOn: boolean
  status: SessionStatus
  completed: boolean
  scenario: Scenario
}

export type ToolName = 'observe_room' | 'inspect_object' | 'interact_object' | 'move_to'

export interface ToolRequest {
  roundId: string
  callId: string
  actionEpoch: number
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  ok: boolean
  message: string
}

/** Forward only ok/message to the robot; view belongs to Mission Control. */
export interface ToolResponse extends ToolResult {
  view: HumanView
}

export interface PowerRequest {
  roundId: string
  requestId: string
  revision: number
  powerOn: boolean
}

export interface LifecycleRequest {
  roundId: string
  requestId: string
  scenario?: Scenario
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
}

export interface RecordedMessage extends MessageRequest {
  timestamp: number
}

export type NotebookRequest = {
  roundId: string
  requestId: string
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
}

export interface TimelineEntry {
  id: string
  roundId: string
  timestamp: number
  actor: 'human' | 'robot' | 'mission'
  kind: 'power' | 'action' | 'hint' | 'completion'
  text: string
}

export interface HintResult {
  roundId: string
  level: 1 | 2
  text: string
}

/** Does not contain undisclosed robot observations or the internal event log. */
export interface MissionRecord {
  roundId: string
  messages: RecordedMessage[]
  notebook: NotebookEntry[]
  hintsUsed: (1 | 2)[]
  debrief: null | { timeline: TimelineEntry[]; truncated: boolean }
}

export interface RobotRecap {
  roundId: string
  instruction: string
  entries: {
    kind: 'observation' | 'action' | 'player_quote'
    text: string
    timestamp: number
    origin?: TransportOrigin
    messageId?: string
  }[]
}

export interface ApiErrorResponse {
  error: string
}
