export function communicatedEmblem(text: string, visibleNames: string[]): string | null;
export function communicatedPassability(text: string): 'clear' | 'blocked' | null;
export function communicatedAction(text: string, action: 'latch' | 'contact'): 'done' | 'not_done' | null;
export function confirmedAction(options: { say(text: string): Promise<string>; request: string; clarify: string; retry: string; action: 'latch' | 'contact'; checkpoint?(): Promise<boolean> }): Promise<boolean>;
export function crossCargoWithRecovery(options: { say(text: string): Promise<unknown>; atGallery(): Promise<boolean> }): Promise<boolean>;
