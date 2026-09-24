export interface SpeechFixture { id: string; text: string; path: string; durationSeconds: number; [key: string]: unknown }
export const DEFAULT_MEDIA_DIRECTORY: string;
export const SPEECH_FIXTURES: Array<{ id: string; text: string }>;
export function encodePcmWav(samples: ArrayLike<number>, sampleRate?: number): Buffer;
export function parsePcmWav(bytes: Uint8Array): { encoding: number; channels: number; sampleRate: number; bits: number; samples: Int16Array };
export function validateSpeechWav(bytes: Uint8Array): { sampleRate: number; channels: number; bits: number; durationSeconds: number; speechStartSeconds: number; speechEndSeconds: number; nonzeroSamples: number; rms: number; cleanStart: boolean; cleanEnd: boolean; sha256: string };
export function ensureSpeechFixture(input: { text: string; id: string; directory?: string }): Promise<SpeechFixture>;
