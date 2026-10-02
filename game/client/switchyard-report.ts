import type { Caption } from './useMission';

export type SwitchyardReference = 'lift' | 'service';
interface PlateQuote { caption: Caption; quote: string; procedureQuote?: string }

/** Recognize an explicit reported declaration, not a quoted instruction or a manual inference. */
function reportedServiceProcedure(text: string, plateQuote: string): string | undefined {
  // Mask quoted examples without changing offsets into the original speech.
  const unquoted = text.replace(/"[^"]*(?:"|$)|“[^”]*(?:”|$)|`[^`]*(?:`|$)|(?:^|[\s:(])'[^']*(?:'|$)/g, words => ' '.repeat(words.length));
  const plates = [...unquoted.matchAll(/The (?:Bridge winch|Transfer turntable service) plate reads [^.]+\./g)]
    .filter(match => match.index === 0 || /[.!?]\s+$/.test(unquoted.slice(0, match.index)));
  if (plates.length !== 1 || plates[0]![0] !== plateQuote) return;
  const declarations = [...unquoted.matchAll(/(?:^|[.!?]\s+)This is (?:an (Alignment-first service module)(?=:(?:\s|$))|a (Detent-first service module)(?=\.(?:\s|$)))/g)];
  if (declarations.length !== 1) return;
  const declaration = declarations[0]!;
  const label = declaration[1] ?? declaration[2]!;
  const start = declaration.index! + declaration[0].indexOf(label);
  if (start <= unquoted.indexOf(plateQuote) + plateQuote.length) return;
  return text.slice(start, start + label.length);
}

/** An exact excerpt of communicated words, never a device state or a manual answer. */
export function latestSwitchyardPlate(captions: readonly Caption[], roundId: string, reference: SwitchyardReference) {
  const phrase = reference === 'lift' ? /The Lift console plate reads [^.]+\./ : /The (?:Bridge winch|Transfer turntable service) plate reads [^.]+\./;
  let historical: PlateQuote | undefined;
  for (let index = captions.length - 1; index >= 0; index--) {
    const caption = captions[index]!;
    if (caption.roundId !== roundId || caption.chapter !== 'switchyard' || caption.role !== 'robot' || !caption.final || caption.interrupted) continue;
    const quote = caption.text.match(phrase)?.[0];
    if (!quote) continue;
    const procedureQuote = reference === 'service' ? reportedServiceProcedure(caption.text, quote) : undefined;
    const selected: PlateQuote = { caption, quote, ...(procedureQuote ? { procedureQuote } : {}) };
    // A delayed result or an explicit repeat stays historical; prefer its original source.
    if (/^(Historical|Earlier)\b/i.test(caption.text)) { historical ??= selected; continue; }
    return selected;
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
