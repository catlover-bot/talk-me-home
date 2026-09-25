import type { Page } from '@playwright/test';
import type { AudioSnapshot } from './qa-browser-instrumentation.mjs';
export interface CycleOptions { afterMs?: number; mode?: 'voice' | 'text'; requireReply?: boolean; quietMs?: number }
export function turnCycleStatus(snapshot: AudioSnapshot, options?: CycleOptions): { settled: boolean; reason: string; asrItems?: number };
export function waitForTurn(page: Page, options?: CycleOptions & { timeoutMs?: number }): Promise<{ settled: boolean; reason: string; asrItems?: number }>;
export function submitPlayerTurn(page: Page, options: { mode: 'voice' | 'text'; text: string; fixture?: { path: string; id: string; text?: string } }): Promise<void>;
