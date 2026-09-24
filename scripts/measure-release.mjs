import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const paths = [
  ...readdirSync('dist/client/assets').map(name => `dist/client/assets/${name}`),
  'game/client/public/art/mission-control.svg', 'game/client/public/icon.svg',
  ...['PipPortrait', 'MissionDocuments', 'GalleryDocument', 'ReturnDockDocument', 'Homecoming'].map(name => `game/client/components/${name}.tsx`),
];
const entries = paths.map(path => { const source = readFileSync(path); return { path, bytes: source.byteLength, gzipBytes: gzipSync(source, { level: 9 }).byteLength }; });
const report = {
  environment: `Node ${process.version}, ${process.platform}/${process.arch}, gzip level 9; theoretical compressed sizes, not a network-speed benchmark`,
  note: 'Inline vector artwork is included in bundled JavaScript; TSX source rows are provenance/size context and must not be added again to first-load totals. Debrief is loaded only after completion. PNG submission captures are not game downloads.',
  entries,
};
writeFileSync('docs/goal-004-asset-sizes.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
