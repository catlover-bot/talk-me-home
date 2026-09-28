export function playerSpeechTexts(): string[];
export function speechFixtureId(text: string): string;
export function readFrozenSpeechFixture(text: string, fixtureFiles: Record<string, string>, directory?: string): Promise<{ path: string; id: string; text: string }>;
export function validateFrozenPlayerSpeech(fixtureFiles: Record<string, string>, directory?: string): Promise<void>;
