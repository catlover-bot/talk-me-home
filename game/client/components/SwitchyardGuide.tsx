import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Caption } from '../useMission';

type GuideStage = 'observe' | 'draft' | 'apply' | 'ready' | 'skipped';
type Guide = { enabled: boolean; stage: GuideStage; practice: boolean; toggle(): void; markTurn(): void; markApplied(): void };
const Context = createContext<Guide | null>(null);

/** Only actually displayed words can advance the opening. No tool state, manual row or hidden installation. */
export function isSwitchyardGuideReport(caption: Caption, captions: readonly Caption[], roundId: string) {
  if (caption.roundId !== roundId || caption.chapter !== 'switchyard' || caption.role !== 'robot' || !caption.final || caption.interrupted) return false;
  if (caption.origin === 'practice') return Boolean(caption.switchyardContext);
  // Raw Live speech stays verbatim. A reply is a reported claim, never proof of ready machinery.
  return caption.origin !== 'game' && captions.some(item => item.roundId === roundId && item.role === 'human' && item.timestamp <= caption.timestamp);
}

/** This state is private presentation only. It owns no mission, provider or persistence API. */
export function SwitchyardGuideProvider({ active, roundId, captions, practice, enabled, onEnabledChange, children }: {
  active: boolean; roundId: string; captions: readonly Caption[]; practice: boolean; children: ReactNode;
  enabled: boolean; onEnabledChange(enabled: boolean): void;
}) {
  // The app retains the reading preference; this keyed provider still resets each round's actual steps.
  const [reportSeen, setReportSeen] = useState(false);
  const [turned, setTurned] = useState(false);
  const [applied, setApplied] = useState(false);
  const [earlierReports, setEarlierReports] = useState(() => new Set(captions.map(item => item.id)));
  useEffect(() => {
    if (active && enabled && captions.some(item => !earlierReports.has(item.id) && isSwitchyardGuideReport(item, captions, roundId))) setReportSeen(true);
  }, [active, enabled, captions, earlierReports, roundId]);
  const markTurn = useCallback(() => { if (enabled) setTurned(true); }, [enabled]);
  const markApplied = useCallback(() => { if (enabled) setApplied(true); }, [enabled]);
  const toggle = () => {
    if (enabled) onEnabledChange(false);
    else {
      setEarlierReports(new Set(captions.map(item => item.id)));
      setReportSeen(false); setTurned(false); setApplied(false); onEnabledChange(true);
    }
  };
  const stage: GuideStage = !enabled ? 'skipped' : !reportSeen ? 'observe' : !turned ? 'draft' : !applied ? 'apply' : 'ready';
  return <Context.Provider value={active ? { enabled, stage, practice, toggle, markTurn, markApplied } : null}>{children}</Context.Provider>;
}
export const useSwitchyardGuide = () => useContext(Context);

export function SwitchyardGuideControls() {
  const guide = useSwitchyardGuide();
  if (!guide) return null;
  const stageLabel = { observe: 'Ask and compare', draft: 'Try a draft', apply: 'Apply when ready', ready: 'Keep working together', skipped: 'Guidance skipped' }[guide.stage];
  return <section className="switchyard-opening" aria-label="Optional first steps" data-testid="switchyard-guidance" data-stage={guide.stage}>
    <div><strong>First steps / optional</strong><button type="button" className="text-button" onClick={guide.toggle}>{guide.enabled ? 'Skip guidance' : 'Replay guidance'}</button></div>
    {guide.enabled && <><p>Bring Pip home. You route power and read the documents; Pip inspects and handles local equipment.</p><span className="switchyard-guide-stage" role="status">{stageLabel}</span></>}
  </section>;
}

export function SwitchyardGuideCue({ where }: { where: 'radio' | 'document' | 'panel' | 'proposal' }) {
  const guide = useSwitchyardGuide();
  if (!guide?.enabled) return null;
  let copy = '';
  if (where === 'radio' && guide.stage === 'observe') copy = guide.practice
    ? 'Use Look around below, then choose an inspection from the items Pip reports. These are selected text requests.'
    : 'Ask Pip for a local look, then an inspection. Your documents supply the circuit rules Pip cannot see.';
  if (where === 'document' && guide.stage !== 'observe' && guide.stage !== 'ready') copy = "Compare Pip's reported words with your documents. Plate quotes stay beside both manual rows; a private plan sends no instruction.";
  if (where === 'panel') copy = guide.stage === 'apply'
    ? 'Compare the draft prediction with Applied. When they differ and you want the layout acknowledged, use Apply routing. Undo and Reset change only the draft.'
    : guide.stage === 'ready' ? 'You have tried Apply. Check the current Applied column; each new draft still needs its own Apply. Pip checks machinery, and physical proposals need a separate exact confirmation.'
    : 'Try turning any piece and watch the draft prediction. Applied power stays unchanged until you deliberately Apply. No route is chosen for you.';
  if (where === 'proposal') copy = 'A request is not an action. Confirm only this exact proposal if you intend it; Not yet leaves it unexecuted.';
  return copy ? <p className={'switchyard-guide-cue switchyard-guide-' + where} data-testid={'switchyard-guide-' + where}>{copy}</p> : null;
}
