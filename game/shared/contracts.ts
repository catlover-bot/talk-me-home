/** Browser-safe contracts. Local equipment state belongs only on the server. */
export type SessionStatus = 'active' | 'stopped' | 'ended'

export interface HumanView {
  sessionId: string
  roundId: string
  revision: number
  actionEpoch: number
  powerOn: boolean
  status: SessionStatus
  completed: boolean
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
}

export interface ApiErrorResponse {
  error: string
}
