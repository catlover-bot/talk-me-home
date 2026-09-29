export interface RecoveryRequest { text: string; reason: string }
export const LOCATION_REQUESTS: RecoveryRequest[];
export function passageRequests(direction: string): RecoveryRequest[];
export function acquirePlayerReport<T>(options: {subject: string; read(): T | null | Promise<T | null>; exchange(text: string, options?: {deadlineAt?: number}): Promise<unknown>; requests: Array<RecoveryRequest | ((lastReply: string) => RecoveryRequest)>; checkScope?(): Promise<void>; report?: Record<string, unknown>; now?(): number; timeoutMs?: number}): Promise<T>;
