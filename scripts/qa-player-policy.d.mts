export function communicatedEmblem(text: string, visibleNames: string[]): string | null;
export function communicatedPassability(text: string): 'clear' | 'blocked' | null;
export function crossCargoWithRecovery(options: { say(text: string): Promise<unknown>; atGallery(): Promise<boolean> }): Promise<boolean>;
