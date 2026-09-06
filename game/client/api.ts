import type { HumanView, ToolResponse } from "../shared/contracts";

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
export const createSession = () => request<HumanView>("/sessions", {});
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
) {
  return request<HumanView>(
    `/sessions/${encodeURIComponent(view.sessionId)}/${action}`,
    {
      roundId: view.roundId,
      requestId: requestId(),
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
  return { token: data.token, config: data.sessionConfig };
}
