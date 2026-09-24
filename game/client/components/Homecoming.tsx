import { useId } from 'react';
import type { Chapter } from '../../shared/contracts';
import { chapterNames } from './ChapterHeader';
import { PipPortrait } from './PipPortrait';

/** Only mounted for server-confirmed home. This recovery bay is an ending illustration. */
export function Homecoming({ chaptersCleared }: { chaptersCleared: Chapter[] }) {
  const id = useId().replace(/:/g, '');
  return <figure className="homecoming" aria-label="Pip’s confirmed journey home">
    <div className="homecoming-scene">
      <svg className="homecoming-art" viewBox="0 0 600 530" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Welcome home, Pip</title>
        <desc id={`${id}-desc`}>Original ending illustration: Pip has arrived in a warmly lit recovery bay. An open capsule rests behind the little robot. This celebrates confirmed arrival; it is not a recording of the mission’s route.</desc>
        <defs>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#293c36" /><stop offset="1" stopColor="#43584a" /></linearGradient>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e8c894" stopOpacity=".24" /><stop offset="1" stopColor="#e8c894" stopOpacity="0" /></linearGradient>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#aba98c" /><stop offset=".42" stopColor="#e0d6b7" /><stop offset="1" stopColor="#afa98c" /></linearGradient>
          <linearGradient id={`${id}-deck`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4b5d4d" /><stop offset="1" stopColor="#233b33" /></linearGradient>
          <pattern id={`${id}-vents`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 4H7" stroke="#243e33" strokeWidth="2" /></pattern>
        </defs>
        <rect width="600" height="530" fill={`url(#${id}-wall)`} />
        <path d="M0 394H600V530H0Z" fill={`url(#${id}-deck)`} />
        <g fill="none" stroke="#83917a" strokeWidth="1" opacity=".36"><path d="M0 394H600 M0 443H600 M0 510H600 M83 394 0 530 M214 394 178 530 M380 394 437 530 M512 394 600 483" /><path d="M28 22V374H572V22 M30 94H570 M477 95V373" /></g>
        <path d="M60 376V102L112 44H364L417 102V376Z" fill="#233c33" stroke="#788772" strokeWidth="3" />
        <path d="M81 364V109L123 64H352L396 109V364Z" fill="#142d28" stroke="#455d4d" strokeWidth="6" />
        <path d="M98 352V115L132 81H342L378 115V352Z" fill="#122821" />
        <path d="M118 50H358" stroke="#dfc695" strokeWidth="7" strokeLinecap="round" /><path d="M112 62 42 392H441L366 62Z" fill={`url(#${id}-light)`} />
        <g stroke="#c1caab" opacity=".55"><circle cx="129" cy="132" r="1" /><circle cx="331" cy="112" r="1" /><circle cx="357" cy="190" r="1" /><circle cx="130" cy="276" r="1" /><path d="M346 147V153 M343 150H349" strokeWidth="1" /></g>
        <g className="homecoming-capsule" transform="translate(227 273)">
          <ellipse cx="0" cy="115" rx="116" ry="19" fill="#142b23" opacity=".5" />
          <path d="M-83 78V-107Q-77-160 0-180Q77-160 83-107V78Z" fill={`url(#${id}-shell)`} stroke="#8b9278" strokeWidth="3" />
          <path d="M-69 80V-102Q-61-146 0-163Q61-146 69-102V80" fill="none" stroke="#f6e7bf" strokeWidth="2" opacity=".56" />
          <path d="M-55 72V-85Q-53-119 0-132Q53-119 55-85V72Z" fill="#2a4337" stroke="#787f66" strokeWidth="5" />
          <path d="M-44 69V-80Q-39-106 0-116Q39-106 44-80V69" fill="#1c342b" stroke="#122a24" strokeWidth="2" />
          <path d="M-35 14V-33Q-33-48-19-48H19Q33-48 35-33V14Z" fill="#52614b" stroke="#75826a" /><path d="M-35 16H35V37H-35Z" fill="#3b5341" stroke="#6e7b5f" />
          <path d="M-72 78H72L97 107H-97Z" fill="#a3a58a" stroke="#465d48" strokeWidth="3" /><path d="M-70 87H70 M-79 98H79" stroke="#d4d0aa" strokeWidth="2" />
          <path d="M-82 57H-56 M56 57H82" stroke="#9b6646" strokeWidth="10" /><path d="M-80 85-91 101 M80 85 91 101" stroke="#2a4132" strokeWidth="7" />
          <path d="M-6-169H6" stroke="#f9ecc9" strokeWidth="4" /><path d="M-59-113-52-127 M59-113 52-127" stroke="#d6a170" strokeWidth="3" />
        </g>
        <g transform="translate(486 123)">
          <rect width="66" height="115" rx="3" fill="#465b49" stroke="#809077" /><rect x="8" y="10" width="50" height="43" rx="2" fill="#263f31" stroke="#929879" />
          <path d="M20 31 30 40 48 22" fill="none" stroke="#d8d0a2" strokeWidth="3" /><rect x="10" y="69" width="46" height="30" fill={`url(#${id}-vents)`} />
          <path d="M19 115V171H-8" stroke="#1c382b" strokeWidth="7" fill="none" /><path d="M19 115V171H-8" stroke="#75816b" strokeWidth="2" fill="none" />
        </g>
        <g fill="#283f33" stroke="#7c886f" strokeWidth="1.5"><path d="M36 361H98V414H36Z" /><path d="M36 372H98 M48 361V414 M86 361V414" /></g>
        <path d="M14 463H192L211 478H395L414 463H585" fill="none" stroke="#b28d57" strokeWidth="3" opacity=".75" />
        <path d="M454 392 481 417H542L565 392" fill="none" stroke="#a0aa84" strokeWidth="2" />
        <g fill="#b9c0a1"><circle cx="46" cy="43" r="2.5" /><circle cx="553" cy="43" r="2.5" /><circle cx="46" cy="343" r="2.5" /><circle cx="553" cy="343" r="2.5" /></g>
      </svg>
      <div className="homecoming-pip"><PipPortrait state="success" /></div>
      <div className="homecoming-welcome" aria-hidden="true"><span>RECOVERY BAY</span><strong>Welcome home.</strong></div>
    </div>
    <figcaption><span className="homecoming-source">Arrival illustration · confirmed home</span><ol className="homecoming-checkpoints">{(['cargo', 'gallery', 'return_dock'] as const).map(chapter => <li key={chapter}><span aria-hidden="true">{chaptersCleared.includes(chapter) ? '✓' : '○'}</span>{chapterNames[chapter]}<span className="sr-only">{chaptersCleared.includes(chapter) ? 'cleared' : 'not confirmed'}</span></li>)}</ol></figcaption>
  </figure>;
}
