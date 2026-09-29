import type { Page } from '@playwright/test';
export const PHRASES: Record<string, string>;
export interface VisibleConfirmation { proposalId: string; label: string; intendedRequest: string; status: string; confirmationRequestedAtMs: number; confirmedAtMs: number; source: string }
export function proposalLabelForRequest(text: string): string | null;
export function confirmVisibleProposal(page: Page, expectedLabel: string, intendedRequest: string, confirmations?: VisibleConfirmation[], expectedProposalId?: string): Promise<VisibleConfirmation>;
export function confirmProposalForRequest(page: Page, intendedRequest: string, report?: { confirmations?: VisibleConfirmation[] }): Promise<VisibleConfirmation | null>;
export interface MissionPlayerReport { route: string[]; steps: unknown[]; completion?: boolean; communicatedEvidence?: unknown[]; [key: string]: unknown }
export function requestConfirmedAction(options: { page: Page; request: string; exchange(text: string, options?: { terminal?: boolean }): Promise<unknown>; checkScope?(): Promise<void>; report?: { confirmations?: VisibleConfirmation[]; actionRequests?: Array<Record<string, unknown>> }; options?: { terminal?: boolean } }): Promise<VisibleConfirmation>;
export function runRescuePlayer(options: {page: Page; say(text: string, options?: {terminal?: boolean; deadlineAt?: number; context?: {room: string; target: string}}): Promise<unknown>; waitForReady?(): Promise<unknown>; exerciseRecovery?: boolean; screenshot?(name: string): Promise<void>; report?: MissionPlayerReport}): Promise<MissionPlayerReport>;
