export function createLifecycleJournal(path: string): { record(type: string, detail?: Record<string, unknown>): Record<string, unknown>; snapshot(): Array<Record<string, unknown>> };
