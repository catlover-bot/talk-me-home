// Each viewport gets a fresh production server and its own in-memory session capacity.
// Explicit CI project/shard arguments retain their existing single Playwright invocation.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const args = process.argv.slice(2);
const selected = args.some(arg => arg === '--project' || arg.startsWith('--project='));
const runs = selected ? [args] : ['chromium-1280', 'chromium-1440'].map(project => [...args, `--project=${project}`]);
for (const run of runs) {
  const child = spawn(process.execPath, [cli, 'test', ...run], { stdio: 'inherit', env: process.env });
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  if (code !== 0) { process.exitCode = code; break; }
}
