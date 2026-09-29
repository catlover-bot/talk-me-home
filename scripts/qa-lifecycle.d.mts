import type { Page } from '@playwright/test';
export function waitForTerminalObservation(page: Page, options?: { timeoutMs?: number }): Promise<{ observation: 'provider_ack' | 'socket_close_without_ack'; endAcknowledged: boolean; atMs: number }>;
export function createLifecycleJournal(path: string): { record(type: string, detail?: Record<string, unknown>): Record<string, unknown>; snapshot(): Array<Record<string, unknown>> };
