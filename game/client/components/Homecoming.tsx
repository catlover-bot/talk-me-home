import { useId } from 'react';
import type { Chapter } from '../../shared/contracts';
import { chapterNames } from './ChapterHeader';

/** Only mounted for server-confirmed home arrival. The route is an illustration, not telemetry. */
export function Homecoming({ chaptersCleared }: { chaptersCleared: Chapter[] }) {
  const id = useId().replace(/:/g, '');
  return <figure className="homecoming" aria-label="Pip’s confirmed journey home">
    <svg className="homecoming-art" viewBox="0 0 600 210" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>A small capsule returns home</title>
      <desc id={`${id}-desc`}>An original illustration celebrating the server-confirmed rescue. A capsule travels from the station toward a welcoming home beacon. This is not a recording or live camera.</desc>
      <defs><radialGradient id={`${id}-home`}><stop stopColor="#f6dfaf" stopOpacity=".18" /><stop offset="1" stopColor="#f6dfaf" stopOpacity="0" /></radialGradient></defs>
      <circle cx="476" cy="99" r="106" fill={`url(#${id}-home)`} />
      <g stroke="#bbc3a4" opacity=".5" strokeWidth="1.3"><path d="M 226 35 v 8 m-4-4 h8 M 345 39 v7 m-3-3h6 M 383 171v8m-4-4h8 M 567 58 v8m-4-4h8 M 144 155v6m-3-3h6" /><circle cx="286" cy="178" r="1" /><circle cx="532" cy="167" r="1" /><circle cx="163" cy="59" r="1" /></g>
      <g transform="translate(75 105)" fill="none" stroke="#aab69a" strokeWidth="2"><circle r="39" /><circle r="26" /><path d="M -55 -11 H -39 M 39 -11 H 55 M -55 11 H -39 M 39 11 H 55 M -13 -39 V -55 M 13 -39 V -55 M -13 39 V 55 M 13 39 V 55" /><path d="M -62 -25 H -50 V 25 H -62Z M 50 -25 H 62 V 25 H 50Z M -25 -62 H 25 V -50 H -25Z M -25 50 H 25 V 62 H -25Z" /><rect x="-11" y="-11" width="22" height="22" rx="5" /></g>
      <path className="homecoming-route" d="M 137 105 C 225 55 314 149 427 100" fill="none" stroke="#b8c29f" strokeWidth="2" strokeDasharray="4 7" />
      <g className="homecoming-capsule" transform="translate(320 110) rotate(8)"><path d="M -21 -17 Q 8 -25 26 0 Q 8 25 -21 17Z" fill="#eee3c7" stroke="#beae8d" strokeWidth="2" /><rect x="-11" y="-9" width="18" height="18" rx="7" fill="#344c3e" /><path d="M -5 -2 V 3 M 1 -2 V 3" stroke="#e3d8ac" strokeWidth="2" strokeLinecap="round" /><path d="M -20 -17 -30 -23 -26 -8 M -20 17 -30 23 -26 8" fill="#b7815a" stroke="#d0a37c" strokeWidth="1.5" /><path d="M -27 -5 -39 0 -27 5" fill="#ddc297" /></g>
      <g transform="translate(476 99)"><circle r="39" fill="#425b43" stroke="#cfcb9f" strokeWidth="2" /><circle r="49" fill="none" stroke="#94a080" strokeDasharray="2 7" /><path d="M -20 -4 0 -23 20 -4 V 21 H -20Z" fill="none" stroke="#ecddb1" strokeWidth="2.5" strokeLinejoin="round" /><path d="M -6 21 V 4 H 6 V 21" fill="none" stroke="#ecddb1" strokeWidth="2.5" /></g>
      <g fill="#d4d6bd" fontFamily="inherit" fontSize="13" textAnchor="middle"><text x="75" y="193">Station</text><text x="476" y="174">Home</text></g>
    </svg>
    <figcaption><span className="source-label">Confirmed checkpoints</span><ol className="homecoming-checkpoints">{(['cargo', 'gallery', 'return_dock'] as const).map(chapter => <li key={chapter}><span aria-hidden="true">{chaptersCleared.includes(chapter) ? '✓' : '○'}</span>{chapterNames[chapter]}<span className="sr-only">{chaptersCleared.includes(chapter) ? 'cleared' : 'not confirmed'}</span></li>)}</ol></figcaption>
  </figure>;
}
