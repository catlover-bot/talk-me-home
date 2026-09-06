import type { HumanView, ToolResponse, Scenario, MessageRequest, RecordedMessage, NotebookRequest, NotebookEntry, MissionRecord, RobotRecap, HintResult } from "../shared/contracts";

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
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "The request could not be completed. Please try again.",
    );
  return data as T;
}

export const requestId = () => crypto.randomUUID();
export const createSession = (scenario: Scenario = 'classic') => request<HumanView>("/sessions", { scenario });
export const getSession = (sessionId: string) =>
  request<HumanView>(`/sessions/${encodeURIComponent(sessionId)}`);

export function setPower(view: HumanView, powerOn: boolean) {
  return request<HumanView>(
    `/sessions/${encodeURIComponent(view.sessionId)}/power`,
    {
      roundId: view.roundId,
      revision: view.revision,
      requestId: requestId(),
      powerOn,
    },
  );
}

export function lifecycle(
  view: HumanView,
  action: "stop" | "resume" | "reset" | "end" | "cancel",
  scenario?: Scenario,
) {
  return request<HumanView>(
    `/sessions/${encodeURIComponent(view.sessionId)}/${action}`,
    {
      roundId: view.roundId,
      requestId: requestId(),
      ...(scenario ? { scenario } : {}),
    },
  );
}

export interface RobotCall {
  callId: string;
  name: string;
  arguments: unknown;
}

export function executeTool(
  view: HumanView,
  call: RobotCall,
  signal?: AbortSignal,
) {
  return request<ToolResponse>(
    `/sessions/${encodeURIComponent(view.sessionId)}/tools`,
    {
      roundId: view.roundId,
      actionEpoch: view.actionEpoch,
      callId: call.callId,
      name: call.name,
      arguments: call.arguments,
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
export const addNotebook = (view: HumanView, entry: NotebookRequest) => request<NotebookEntry>(path(view, 'notebook'), entry);
export const requestHint = (view: HumanView, level: 1 | 2) => request<HintResult>(path(view, 'hint'), { roundId: view.roundId, requestId: requestId(), level });
