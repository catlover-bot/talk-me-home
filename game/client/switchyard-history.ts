import { REMIX_CODE_PATTERN, REMIX_HISTORY_LIMIT, REMIX_RECENT_PATTERN } from '../shared/remix';
import type { SwitchyardAssignment, SwitchyardApproach } from '../shared/switchyard';

export const SWITCHYARD_HISTORY_KEY = 'talk-me-home.remix-history.v1';
export interface JourneyEntry {
  id: string; code: string; recentToken?: string; startedAt: number; updatedAt: number;
  outcome: 'started' | 'home'; approach?: SwitchyardApproach;
  assignment: SwitchyardAssignment; assignmentStatus?: 'completed' | 'skipped';
  provenance: 'practice' | 'live_voice' | 'live_text' | 'mixed';
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const assignments = ['rescue', 'lift_survey', 'service_restoration'];

/** Accept a small allowlist only. Local history is convenience, never mission authority. */
function entry(value: unknown): JourneyEntry | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !/^[\w-]{1,80}$/.test(v.id)
    || typeof v.code !== 'string' || !REMIX_CODE_PATTERN.test(v.code)
    || !Number.isSafeInteger(v.startedAt) || Number(v.startedAt) < 0
    || !Number.isSafeInteger(v.updatedAt) || Number(v.updatedAt) < Number(v.startedAt)
    || !['started', 'home'].includes(String(v.outcome))
    || !assignments.includes(String(v.assignment))
    || !['practice', 'live_voice', 'live_text', 'mixed'].includes(String(v.provenance))) return;
  if (v.outcome === 'home' && (!['lift', 'bypass'].includes(String(v.approach))
    || !['completed', 'skipped'].includes(String(v.assignmentStatus)))) return;
  return { id: v.id, code: v.code, startedAt: Number(v.startedAt), updatedAt: Number(v.updatedAt),
    outcome: v.outcome as JourneyEntry['outcome'], assignment: v.assignment as SwitchyardAssignment,
    provenance: v.provenance as JourneyEntry['provenance'],
    ...(typeof v.recentToken === 'string' && REMIX_RECENT_PATTERN.test(v.recentToken) ? { recentToken: v.recentToken } : {}),
    ...(v.outcome === 'home' ? { approach: v.approach as SwitchyardApproach, assignmentStatus: v.assignmentStatus as 'completed' | 'skipped' } : {}) };
}
export function mergeJourneyHistory(...histories: readonly JourneyEntry[][]): JourneyEntry[] {
  const byId = new Map<string, JourneyEntry>();
  for (const candidate of histories.flat()) {
    const next = entry(candidate); if (!next) continue;
    const old = byId.get(next.id);
    if (!old || (old.outcome !== 'home' && next.outcome === 'home')
      || (old.outcome === next.outcome && next.updatedAt > old.updatedAt)) byId.set(next.id, next);
  }
  return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id)).slice(0, REMIX_HISTORY_LIMIT);
}
export function readJourneyHistory(storage?: Store): JourneyEntry[] {
  try {
    const raw = (storage ?? window.localStorage).getItem(SWITCHYARD_HISTORY_KEY);
    if (!raw || raw.length > 32_000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > REMIX_HISTORY_LIMIT) return [];
    return mergeJourneyHistory(parsed as JourneyEntry[]);
  } catch { return []; }
}
export function saveJourneyHistory(entries: JourneyEntry[], storage?: Store): JourneyEntry[] {
  const target = (() => { try { return storage ?? window.localStorage; } catch { return undefined; } })();
  const merged = mergeJourneyHistory(readJourneyHistory(target), entries);
  try { target?.setItem(SWITCHYARD_HISTORY_KEY, JSON.stringify(merged)); } catch { /* Play still works when storage is blocked or full. */ }
  return merged;
}
export function clearJourneyHistory(storage?: Store): void {
  try { (storage ?? window.localStorage).removeItem(SWITCHYARD_HISTORY_KEY); } catch { /* Clearing unavailable local storage has no mission effect. */ }
}
