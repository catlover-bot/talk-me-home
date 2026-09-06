import { spawn } from 'node:child_process';

export interface AccountedAttempt {
  reservedSeconds?: number;
  accountedSeconds?: number;
  endedAcknowledged: boolean;
  connectedSeconds: number;
  providerSessionSeconds: number | null;
}

/** Keep original reservations for audit; settle only explicitly acknowledged ends. */
export function settleAttempts(attempts: AccountedAttempt[]): number {
  let total = 0;
  for (const attempt of attempts) {
    attempt.reservedSeconds ??= 90;
    if (!Number.isFinite(attempt.reservedSeconds) || attempt.reservedSeconds < 1) throw new Error('Invalid live-test attempt reservation.');
    const clean = attempt.endedAcknowledged === true
      && Number.isFinite(attempt.connectedSeconds) && attempt.connectedSeconds >= 0
      && typeof attempt.providerSessionSeconds === 'number'
      && Number.isFinite(attempt.providerSessionSeconds) && attempt.providerSessionSeconds >= 0;
    // Ceiling plus one second covers timestamp precision and a conservative local margin.
    attempt.accountedSeconds = clean
      ? Math.ceil(Math.max(attempt.connectedSeconds, attempt.providerSessionSeconds!)) + 1
      : attempt.reservedSeconds;
    total += attempt.accountedSeconds;
  }
  return total;
}

/** Captions may finalize before or after reply.done; require both for one reply. */
export class ProbeReplyTracker {
  private started = new Set<string>();
  private finalized = new Set<string>();
  private done = new Set<string>();
  markStarted(id: string): void { this.started.add(id); }
  markFinal(id: string): void { if (this.started.has(id)) this.finalized.add(id); }
  markDone(id: string): void { if (this.started.has(id)) this.done.add(id); }
  get finalCount(): number { return this.finalized.size; }
  get complete(): boolean { return [...this.finalized].some((id) => this.done.has(id)); }
}

export interface ProbeSupervisor { stop(): Promise<void> }

/**
 * Independent process watchdog: works even if the probe's event loop stalls.
 * Production uses 49s SIGTERM / 50s SIGKILL, armed before opening the socket.
 * IPC disconnection also reaps the supervisor if its parent exits unexpectedly.
 */
export async function startProbeSupervisor(targetPid: number, hardLimitMs = 50_000, terminateGraceMs = 1000): Promise<ProbeSupervisor> {
  if (!Number.isInteger(targetPid) || targetPid <= 1 || hardLimitMs <= terminateGraceMs || terminateGraceMs < 1) throw new Error('Invalid probe supervisor settings.');
  const program = `
    const target = Number(process.argv[1]);
    const hard = Number(process.argv[2]);
    const grace = Number(process.argv[3]);
    const signal = name => { try { process.kill(target, name); } catch { process.exit(0); } };
    process.once('disconnect', () => process.exit(0));
    setTimeout(() => signal('SIGTERM'), hard - grace);
    setTimeout(() => { signal('SIGKILL'); process.exit(0); }, hard);
    process.send('armed');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program, String(targetPid), String(hardLimitMs), String(terminateGraceMs)], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {},
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('The independent probe watchdog did not start.')); }, 3000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('The independent probe watchdog could not start.')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('The independent probe watchdog exited before it was ready.')); });
    child.once('message', (message) => {
      if (message === 'armed') { clearTimeout(timer); resolve(); }
    });
  });
  let stopping: Promise<void> | undefined;
  return {
    stop() {
      stopping ??= new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
        const timer = setTimeout(() => child.kill('SIGKILL'), 1000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        if (child.connected) child.disconnect();
        else child.kill();
      });
      return stopping;
    },
  };
}
