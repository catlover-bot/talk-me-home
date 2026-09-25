import type { Page } from '@playwright/test';
export interface QaAudioEvent { atMs: number; type: string; direction?: string; text?: string; final?: boolean; role?: string; callRef?: number; replyRef?: number; [key: string]: unknown }
export interface AudioCounter { chunks: number; samples: number; nonzeroSamples: number; energy: number; lastNonzeroMs?: number; lastChunkMs?: number }
export interface AudioSnapshot { label: string; elapsedMs: number; counters: Record<'input' | 'provider' | 'rendered' | 'postVolume', AudioCounter>; events: QaAudioEvent[]; playbackPending: boolean; activeTracks: number; activeSources: number; openApplicationContexts: number }
export function sanitizeWireEvent(value: unknown, direction: string, references?: Map<string, number>): Record<string, unknown> | null;
export function installAudioInstrumentation(page: Page, options?: { label?: string; onLifecycle?: (event: QaAudioEvent) => unknown }): Promise<void>;
export function queueSpeech(page: Page, fixture: string | { path: string; id: string; text?: string }): Promise<{ id: string; durationSeconds: number }>;
export function audioSnapshot(page: Page): Promise<AudioSnapshot>;
export function cleanupAudioInstrumentation(page: Page): Promise<void>;
export function assembleRecording(chunks: Array<{ atMs: number; sampleRate: number; data: string }>, durationMs: number, sampleRate?: number): Buffer;
export function collectAudioEvidence(page: Page, directory: string): Promise<AudioSnapshot & { media: Record<string, { file: string; chunks: number; sampleRate: number; channels: number; bits: number; durationSeconds: number }> }>;
