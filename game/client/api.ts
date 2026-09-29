import type { HumanView, ToolResponse, Scenario, MissionKind, Relay, DockControl, CancelReason, AnnotationRequest, MessageRequest, RecordedMessage, NotebookRequest, NotebookEntry, MissionRecord, RobotRecap, HintResult, HintLevel } from "../shared/contracts";
import { toolOutcomeCodes, toolRecoverySteps, type ToolOutcomeCode, type ToolResult } from '../shared/contracts';

/** A public, user-facing response from the game service. */
export class MissionServiceError extends Error {
  constructor(message: string, readonly code?: ToolOutcomeCode, readonly recovery?: ToolResult['recovery']) { super(message); }
}

async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new Error(
        "The game server took too long to respond. Check the connection and try again.",
      );
    throw new Error(
      "Mission Control cannot reach the game server. Check the connection and try again.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new MissionServiceError(
      typeof data.error === "string"
        ? data.error
        : "The request could not be completed. Please try again.",
      toolOutcomeCodes.includes(data.code) ? data.code : undefined,
      toolRecoverySteps.includes(data.recovery) ? data.recovery : undefined,
    );
  return data as T;
}

export const requestId = () => crypto.randomUUID();
export interface DemoAccess { liveEnabled: boolean; authorized: boolean; available: boolean; message: string }
export const demoAccess = (signal?: AbortSignal) => request<DemoAccess>('/access', undefined, signal);
export const unlockDemo = (code: string) => request<DemoAccess>('/access', { code });
export const createSession = (scenario: Scenario = 'classic', missionKind: MissionKind = 'training', optionalObjective?: HumanView['optionalObjective']) => request<HumanView>("/sessions", { scenario, missionKind, ...(optionalObjective ? { optionalObjective } : {}) });
export const getSession = (sessionId: string) =>
  request<HumanView>(`/sessions/${encodeURIComponent(sessionId)}`);

export function setPower(view: HumanView, powerOn: boolean) {
  return request<HumanView>(
    `/sessions/${encodeURIComponent(view.sessionId)}/power`,
    {
      roundId: view.roundId,
      chapterEpoch: view.chapterEpoch,
      revision: view.revision,
      requestId: requestId(),
      powerOn,
    },
  );
}

export function lifecycle(
  view: HumanView,
  action: "stop" | "resume" | "reset" | "end" | "cancel",
  options: { scenario?: Scenario; missionKind?: MissionKind; optionalObjective?: HumanView['optionalObjective']; reason?: CancelReason } = {},
) {
  return request<HumanView>(
    `/sessions/${encodeURIComponent(view.sessionId)}/${action}`,
    {
      roundId: view.roundId,
      chapterEpoch: view.chapterEpoch,
      requestId: requestId(),
      ...options,
    },
  );
}

export interface RobotCall {
  callId: string;
  name: string;
  arguments: unknown;
}

/** App-captured robot transport scope; never part of the human projection or model arguments. */
export type RobotToolContext = HumanView & { inspectionScope?: { visitId: string } };

export function executeTool(
  view: RobotToolContext,
  call: RobotCall,
  signal?: AbortSignal,
) {
  const localObject = call.arguments && typeof call.arguments === 'object' && !Array.isArray(call.arguments)
    ? (call.arguments as Record<string, unknown>).object : undefined;
  const needsVisit = call.name === 'inspect_gate' || (localObject === 'flight_recorder'
    && ['inspect_object', 'propose_interaction', 'interact_object'].includes(call.name));
  return request<ToolResponse>(
    `/sessions/${encodeURIComponent(view.sessionId)}/tools`,
    {
      roundId: view.roundId,
      chapterEpoch: view.chapterEpoch,
      actionEpoch: view.actionEpoch,
      callId: call.callId,
      name: call.name,
      arguments: call.arguments,
      ...(needsVisit && view.inspectionScope ? { inspectionScope: { visitId: view.inspectionScope.visitId } } : {}),
    },
    signal,
  );
}

export async function voiceToken(view: HumanView) {
  const data = await request<{
    token: string;
    sessionConfig: Record<string, unknown>;
    maxSessionSeconds: number;
  }>(`/sessions/${encodeURIComponent(view.sessionId)}/voice-token`, {
    roundId: view.roundId,
  });
  return { token: data.token, config: data.sessionConfig, maxSessionSeconds: data.maxSessionSeconds };
}

const path = (view: HumanView, resource: string) => `/sessions/${encodeURIComponent(view.sessionId)}/${resource}`;
export const missionRecord = (view: HumanView) => request<MissionRecord>(`${path(view, 'record')}?roundId=${encodeURIComponent(view.roundId)}`);
export const robotRecap = (view: HumanView) => request<RobotRecap>(`${path(view, 'recap')}?roundId=${encodeURIComponent(view.roundId)}`);
export const recordMessage = (view: HumanView, message: MessageRequest) => request<RecordedMessage>(path(view, 'messages'), message);
export const addNotebook = (view: HumanView, entry: NotebookRequest) => request<NotebookEntry>(path(view, 'notebook'), { ...entry, chapterEpoch: view.chapterEpoch });
export const requestHint = (view: HumanView, level: HintLevel) => request<HintResult>(path(view, 'hint'), { roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: requestId(), level });

const controlEnvelope = (view: HumanView) => ({ roundId: view.roundId, chapterEpoch: view.chapterEpoch, revision: view.revision, requestId: requestId() });
export const setRelay = (view: HumanView, relay: Relay) => request<HumanView>(path(view, 'relay'), { ...controlEnvelope(view), relay });
export const dockControl = (view: HumanView, action: DockControl) => request<HumanView>(path(view, 'dock-control'), { ...controlEnvelope(view), action });
type AnnotationPayload<T> = T extends unknown ? Omit<T, 'roundId' | 'chapterEpoch' | 'requestId'> : never;
export type AnnotationChange = AnnotationPayload<AnnotationRequest>;
export const annotate = (view: HumanView, change: AnnotationChange) => request<MissionRecord>(path(view, 'annotations'), { roundId: view.roundId, chapterEpoch: view.chapterEpoch, requestId: requestId(), ...change });

/** Confirmation names an immutable server proposal; replacement arguments are never sent. */
export const decideProposal = (view: HumanView, proposalId: string, decision: 'confirm' | 'decline', decisionRequestId: string) =>
  request<ToolResponse>(path(view, 'proposal-decision'), { roundId: view.roundId, requestId: decisionRequestId, proposalId, decision });
