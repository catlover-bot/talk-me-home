// Local evidence audit only. This script never initializes or opens an allowance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
assert(existsSync(resolve(root, 'game/server/sessions.ts')), 'Run from the repository root.');
const baselinePath = '.validation/goal-005b/preservation-baseline.json';
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const writeNew = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
};
const walk = (path, result) => {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) {
    for (const child of readdirSync(path).sort()) walk(`${path}/${child}`, result);
  } else result.add(path);
};

if (process.argv[2] === '--capture') {
  assert(!existsSync(baselinePath), 'Refusing to replace the original baseline.');
  const paths = new Set();
  const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', '1949b921fc744dc28d0889ca8d30c9d7d8102bd6'], { encoding: 'utf8' }).trim().split('\n');
  for (const path of tracked) {
    if (path.startsWith('artifacts/') || /^docs\/(?:goal-|validation\.md)/.test(path) || path.startsWith('submission/local-deliverables/') || path.startsWith('submission/goal-005-deliverables/') || /^submission\/Talk_Me_Home.*\.(?:pptx|pdf)$/.test(path)) paths.add(path);
  }
  for (const path of [
    '.validation/goal-004b-live', '.validation/goal-004c-live',
    '.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4',
    'submission/Talk_Me_Home_Demo_Draft.mp4', 'submission/Talk_Me_Home_Goal005_Demo.mp4',
  ]) walk(path, paths);
  for (const required of ['submission/Talk_Me_Home_Goal005_Demo.mp4', 'submission/Talk_Me_Home_Goal005_Pitch.pptx', 'submission/Talk_Me_Home_Goal005_Pitch.pdf', '.validation/goal-005-media/Goal005_Attempt12_Success_Uncut.mp4']) assert(paths.has(required) && existsSync(required), `Missing required preserved file: ${required}`);
  const files = [...paths].sort().map(path => ({ path, bytes: statSync(path).size, sha256: sha(path) }));
  const baseline = { schema: 1, capturedAt: new Date().toISOString(), deliveredCommit: '1949b921fc744dc28d0889ca8d30c9d7d8102bd6', demonstratedRuntimeCommit: '2edf7914a008143843923b04a9bf3a1fe41f1f68', files };
  writeNew(baselinePath, baseline);
  writeNew('artifacts/goal-005b/preservation-baseline.json', { schema: 1, capturedAt: baseline.capturedAt, deliveredCommit: baseline.deliveredCommit, demonstratedRuntimeCommit: baseline.demonstratedRuntimeCommit, baselinePath, baselineSha256: sha(baselinePath), files: files.length, bytes: files.reduce((n, x) => n + x.bytes, 0), scope: 'Delivered historical artifacts/reports, prior media recipes/provenance, all B/C campaign records, Goal005 demonstrated MP4/PPTX/PDF and successful uncut. Hashes only; no original copied or rewritten.', excludedByDesign: 'Current dist build outputs and editable current handoff documents are outside immutable history; the old frozen execution manifests remain included.' });
  console.log(JSON.stringify({ baselinePath, files: files.length }));
} else if (process.argv[2] === '--check') {
  const output = process.argv[3];
  assert(output && /^artifacts\/goal-005b\/[a-z0-9-]+\.json$/.test(output), 'Supply a new artifacts/goal-005b/*.json receipt path.');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const summary = JSON.parse(readFileSync('artifacts/goal-005b/preservation-baseline.json', 'utf8'));
  assert.equal(sha(baselinePath), summary.baselineSha256, 'Original baseline changed.');
  const legacy = JSON.parse(readFileSync('artifacts/goal-005b/historical-budget-anchor.json', 'utf8'));
  const protectedFiles = [...baseline.files, legacy.file];
  const missing = [], changed = [];
  for (const file of protectedFiles) {
    if (!existsSync(file.path)) missing.push(file.path);
    else if (statSync(file.path).size !== file.bytes || sha(file.path) !== file.sha256) changed.push(file.path);
  }
  writeNew(output, { schema: 1, checkedAt: new Date().toISOString(), baselinePath, baselineSha256: summary.baselineSha256, legacyBudgetAnchor: 'artifacts/goal-005b/historical-budget-anchor.json', legacyBudgetAnchorSha256: sha('artifacts/goal-005b/historical-budget-anchor.json'), checkedFiles: protectedFiles.length, unchangedFiles: protectedFiles.length - missing.length - changed.length, missing, changed, excludedPaths: [], passed: !missing.length && !changed.length, providerRequestsMadeByAudit: 0, accountingWritesMadeByAudit: 0 });
  console.log(JSON.stringify({ output, checkedFiles: protectedFiles.length, missing, changed }));
  if (missing.length || changed.length) process.exitCode = 1;
} else throw new Error('Use --capture once, or --check artifacts/goal-005b/<new-receipt>.json.');
