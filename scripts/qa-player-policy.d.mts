export function communicatedEmblem(text: string, visibleNames: string[]): string | null;
export function communicatedEmblemClaim(text: string, visibleNames: string[]): { mentioned: boolean; value: string | null };
export function communicatedPassability(text: string, target?: string): 'clear' | 'blocked' | null;
export function communicatedPassabilityClaim(text: string, target?: string): { mentioned: boolean; value: 'clear' | 'blocked' | null };
export function communicatedAction(text: string, action: 'latch' | 'contact' | 'crossing'): 'reported_done' | 'not_done' | null;
export function communicatedActionClaim(text: string, action: 'latch' | 'contact' | 'crossing'): { mentioned: boolean; value: 'reported_done' | 'not_done' | null; transition?: boolean };
export function confirmedAction(options: { say(text: string): Promise<string>; request: string; clarify: string; retry: string; action: 'latch' | 'contact'; checkpoint?(): Promise<boolean> }): Promise<boolean>;
export function crossCargoWithRecovery(options: { say(text: string): Promise<unknown>; atGallery(): Promise<boolean> }): Promise<boolean>;
