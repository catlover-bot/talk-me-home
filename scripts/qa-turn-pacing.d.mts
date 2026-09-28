import type { Page } from '@playwright/test';
import type { AudioSnapshot } from './qa-browser-instrumentation.mjs';
export interface CycleOptions { afterMs?: number; mode?: 'voice' | 'text'; requireReply?: boolean; quietMs?: number }
export function turnCycleStatus(snapshot: AudioSnapshot, options?: CycleOptions): { settled: boolean; reason: string; asrItems?: number };
export interface PreSubmitOptions { mode?: 'voice' | 'text'; confirmation?: { confirmationRequestedAtMs: number; confirmedAtMs: number } }
export function preSubmitStatus(snapshot: AudioSnapshot, options?: PreSubmitOptions): { settled: boolean; reason: string; asrItems?: number; fatal?: boolean };
export function waitBeforePlayerTurn(page: Page, options?: PreSubmitOptions & { timeoutMs?: number }): Promise<{ settled: boolean; reason: string; asrItems?: number; startedAtMs: number; endedAtMs: number; waitedMs: number }>;
export function waitForTurn(page: Page, options?: CycleOptions & { timeoutMs?: number }): Promise<{ settled: boolean; reason: string; asrItems?: number }>;
export function submitPlayerTurn(page: Page, options: { mode: 'voice' | 'text'; text: string; fixture?: { path: string; id: string; text?: string } }): Promise<void>;
