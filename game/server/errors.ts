import type { ToolOutcomeCode, ToolResult } from '../shared/contracts.js'
export class GameError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: ToolOutcomeCode, public readonly recovery?: ToolResult['recovery']) { super(message) }
}
