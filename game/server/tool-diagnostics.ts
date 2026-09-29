import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { gateDirections, type ToolOutcomeCode } from '../shared/contracts.js'

export interface ToolDiagnostic {
  tool: string
  target?: string
  targetSha256?: string
  toolSha256?: string
  sessionSha256: string
  roundSha256?: string
  callSha256?: string
  visitSha256?: string
  scope: { round: boolean | null; chapter: boolean | null; action: boolean | null; visit: boolean | null }
  stage: 'request_schema' | 'scope' | 'target_resolution' | 'tool_validation' | 'complete'
  code: ToolOutcomeCode | 'ok' | 'request_rejected'
  startedAtMs: number
  finishedAtMs: number
  elapsedMs: number
}
const names = ['observe_room', 'inspect_object', 'inspect_gate', 'propose_interaction', 'propose_move', 'get_action_status', 'interact_object', 'move_to']
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** No arbitrary strings, payloads, credentials or human navigation state enter this projection. */
export function toolDiagnosticIdentity(sessionId: string, input: unknown) {
  const value = record(input), args = record(value.arguments), scope = record(value.inspectionScope)
  const target = args.direction ?? args.object ?? args.target
  const admitted = typeof target === 'string' && ([...gateDirections, 'door', 'conveyor', 'latch', 'far_side', 'return.contact', 'return.capsule'].includes(target) || /^gallery\.g[1-5]$/.test(target))
  return {
    tool: typeof value.name === 'string' && names.includes(value.name) ? value.name : 'unrecognized',
    ...(typeof value.name === 'string' && !names.includes(value.name) ? { toolSha256: hash(value.name) } : {}),
    ...(admitted ? { target: target as string } : typeof target === 'string' ? { targetSha256: hash(target) } : {}),
    sessionSha256: hash(sessionId),
    ...(typeof value.roundId === 'string' ? { roundSha256: hash(value.roundId) } : {}),
    ...(typeof value.callId === 'string' ? { callSha256: hash(value.callId) } : {}),
    ...(typeof scope.visitId === 'string' ? { visitSha256: hash(scope.visitId) } : {}),
  }
}

/** Explicit local opt-in only. No public route serves this bounded JSONL diagnostic file. */
export function localToolDiagnosticSink(file: string | undefined, host: string, origin: string): ((event: ToolDiagnostic) => void) | undefined {
  if (!file) return undefined
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) || !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)) throw new Error('Tool diagnostics require a loopback-only server.')
  const root = resolve('.validation'), target = resolve(file), rel = relative(root, target)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel) || !target.endsWith('.jsonl')) throw new Error('Tool diagnostics require a new .validation JSONL path.')
  let cursor = root
  for (const part of ['', ...rel.split(sep)]) {
    if (part) cursor = resolve(cursor, part)
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error('Tool diagnostic paths must not use symbolic links.')
  }
  if (existsSync(target)) throw new Error('Use a new diagnostic file; existing evidence is never overwritten or appended.')
  mkdirSync(dirname(target), { recursive: true })
  if (!realpathSync(dirname(target)).startsWith(`${realpathSync(root)}${sep}`) && realpathSync(dirname(target)) !== realpathSync(root)) throw new Error('Tool diagnostic path escaped .validation.')
  appendFileSync(target, '', { flag: 'wx', mode: 0o600 })
  let count = 0
  return event => { if (count++ < 2000) appendFileSync(target, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 }) }
}
