import { spawn } from 'node:child_process';

// Direct child processes allow one Ctrl+C to stop both development servers.
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'game/server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(process.argv.includes('--preview') ? ['preview'] : [])], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 3000);
  deadline.unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', code => stop(code || 0));
}
