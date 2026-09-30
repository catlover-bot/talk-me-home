import type { Chapter, HumanView } from '../../shared/contracts';

export const chapterNames: Record<Chapter, string> = {
  switchyard: 'The Switchyard', cargo: 'Cargo Bay', gallery: 'Relay Gallery', return_dock: 'Return Dock',
};
const objectives: Record<Chapter, string> = {
  switchyard: 'Rewire the panel together. Restore the lift or prepare the maintenance bypass.',
  cargo: 'Find a safe way through the first Door.',
  gallery: 'Match your map with Pip’s local clues to find the Dock.',
  return_dock: 'Prepare the return capsule and bring Pip home.',
};
const chapters: Chapter[] = ['cargo', 'gallery', 'return_dock'];

export function ChapterHeader({ view, presentation, onPresentation }: {
  view?: HumanView | null; presentation: boolean; onPresentation(): void;
}) {
  if (!view) return null;
  const rescue = view.missionKind === 'rescue';
  return <section className="chapter-header" aria-label="Mission progress">
    <div className="chapter-objective"><p className="section-kicker">{view.missionKind === 'switchyard' ? 'Two ways home' : rescue ? 'Rescue Mission' : `${view.scenario === 'classic' ? 'Classic' : 'Maintenance'} Training`}</p><h1>{chapterNames[view.chapter]}</h1><p>{objectives[view.chapter]}</p></div>
    {rescue && <ol className="chapter-progress" aria-label="Public chapter checkpoints">{chapters.map((chapter, index) => {
      const cleared = view.chaptersCleared.includes(chapter);
      const current = view.chapter === chapter && !view.completed;
      return <li key={chapter} data-cleared={cleared} aria-current={current ? 'step' : undefined}><span className="checkpoint-number" aria-hidden="true">{cleared ? '✓' : String(index + 1).padStart(2, '0')}</span><span>{chapterNames[chapter]}<small>{cleared ? 'Cleared' : current ? 'Current chapter' : 'Ahead'}</small></span></li>;
    })}</ol>}
    <button className="presentation-toggle secondary-button" aria-pressed={presentation} onClick={onPresentation}>{presentation ? 'Standard layout' : 'Presentation layout'}</button>
  </section>;
}
