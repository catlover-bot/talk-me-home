import type { Page } from '@playwright/test';
export function parseHostedArgs(args: string[]): Record<string, unknown>;
export function main(args?: string[]): Promise<void>;
export function captureHostedHttp(page: Page, origin: string): { decisions: Array<Record<string, unknown>>; views: Array<Record<string, unknown>>; records: Array<Record<string, unknown>>; refusals: Array<Record<string, unknown>>; allocation: { value: unknown; failureAttempt: unknown }; errors: string[]; settle(): Promise<void>; close(): void };
