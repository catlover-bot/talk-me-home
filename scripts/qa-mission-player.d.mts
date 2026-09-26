import type { Page } from '@playwright/test';
export const PHRASES: Record<string, string>;
export interface MissionPlayerReport { route: string[]; steps: unknown[]; completion?: boolean; communicatedEvidence?: unknown[]; [key: string]: unknown }
export function runRescuePlayer(options: {page: Page; say(text: string, options?: {terminal?: boolean; context?: {room: string; target: string}}): Promise<unknown>; screenshot?(name: string): Promise<void>; report?: MissionPlayerReport}): Promise<MissionPlayerReport>;
