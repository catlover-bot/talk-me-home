import type { Caption } from './useMission';

export type SwitchyardReference = 'lift' | 'service';
/** An exact excerpt of communicated words, never a device state or a manual answer. */
export function latestSwitchyardPlate(captions: readonly Caption[], roundId: string, reference: SwitchyardReference) {
  const phrase = reference === 'lift' ? /The Lift console plate reads [^.]+\./ : /The (?:Bridge winch|Transfer turntable service) plate reads [^.]+\./;
  let historical: { caption: Caption; quote: string } | undefined;
  for (let index = captions.length - 1; index >= 0; index--) {
    const caption = captions[index]!;
    if (caption.roundId !== roundId || caption.chapter !== 'switchyard' || caption.role !== 'robot' || !caption.final || caption.interrupted) continue;
    const quote = caption.text.match(phrase)?.[0];
    if (!quote) continue;
    // A delayed result or an explicit repeat stays historical; prefer its original source.
    if (/^(Historical|Earlier)\b/i.test(caption.text)) { historical ??= { caption, quote }; continue; }
    return { caption, quote };
  }
  return historical;
}

export function switchyardReportAge(caption: Caption, currentVisit: { visitId: string } | null, panelRevision: number, stateRevision: number) {
  const context = caption.switchyardContext;
  if (!context) return 'Visit not recorded. This is a quoted report, not a current equipment reading.';
  if (!currentVisit || context.visitId !== currentVisit.visitId) return 'Earlier visit. The plate quote is retained; ask Pip to check local conditions again.';
  if (context.panelRevision !== panelRevision) return "Routing changed since this report. The plate label is retained; see Pip's latest report for readiness.";
  if (context.stateRevision !== stateRevision) return 'Earlier conditions in this visit. The plate label is retained; later reports describe readiness.';
  return 'Reported on this visit. A plate identifies equipment; it does not prove power or readiness.';
}
