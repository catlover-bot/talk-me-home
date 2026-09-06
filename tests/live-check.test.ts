import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { ProbeReplyTracker, settleAttempts, startProbeSupervisor } from '../scripts/live-check-support.ts';

test('live budget settles acknowledged durations while retaining original attempt reservations', () => {
  const attempts = [
    { endedAcknowledged: true, connectedSeconds: 45.1, providerSessionSeconds: 44.933718 },
    { endedAcknowledged: true, connectedSeconds: 45.1, providerSessionSeconds: 44.969714 },
  ];
  assert.equal(settleAttempts(attempts), 94);
  assert.deepEqual(attempts.map((attempt) => (attempt as { reservedSeconds?: number }).reservedSeconds), [90, 90]);
  assert.equal(settleAttempts([...attempts, { reservedSeconds: 82, endedAcknowledged: false, connectedSeconds: 0, providerSessionSeconds: null }]), 176);
});

test('live budget never releases uncertain or crashed reservations', () => {
  assert.equal(settleAttempts([{ endedAcknowledged: false, connectedSeconds: 5, providerSessionSeconds: 4 }]), 90);
  assert.equal(settleAttempts([{ endedAcknowledged: true, connectedSeconds: 5, providerSessionSeconds: null }]), 90);
  assert.equal(settleAttempts([{ reservedSeconds: 82, endedAcknowledged: false, connectedSeconds: 5, providerSessionSeconds: null }]), 82);
  assert.throws(() => settleAttempts([{ reservedSeconds: -1, endedAcknowledged: false, connectedSeconds: 0, providerSessionSeconds: null }]), /reservation/);
});

test('probe success requires a matched final transcript and completed reply in either order', () => {
  for (const order of ['caption-first', 'done-first']) {
    const tracker = new ProbeReplyTracker();
    tracker.markStarted('robot:verified-reply');
    if (order === 'caption-first') tracker.markFinal('robot:verified-reply');
    else tracker.markDone('robot:verified-reply');
    assert.equal(tracker.complete, false);
    if (order === 'caption-first') tracker.markDone('robot:verified-reply');
    else tracker.markFinal('robot:verified-reply');
    assert.equal(tracker.complete, true);
    assert.equal(tracker.finalCount, 1);
  }
  const tracker = new ProbeReplyTracker();
  tracker.markStarted('robot:first');
  tracker.markStarted('robot:second');
  tracker.markFinal('robot:first');
  tracker.markDone('robot:second');
  assert.equal(tracker.complete, false);
});

test('independent watchdog terminates only its spawned test process and can be reaped', async () => {
  const dummy = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); process.send("ready"); setInterval(() => {}, 1000);'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {} });
  await once(dummy, 'message');
  let supervisor: Awaited<ReturnType<typeof startProbeSupervisor>> | undefined;
  try {
    const exited = once(dummy, 'exit');
    supervisor = await startProbeSupervisor(dummy.pid!, 180, 80);
    const [, signal] = await exited;
    assert.equal(signal, 'SIGKILL');
    await supervisor.stop();
  } finally {
    if (dummy.exitCode === null && dummy.signalCode === null) { const exit = once(dummy, 'exit'); dummy.kill('SIGKILL'); await exit; }
    await supervisor?.stop();
  }
});

test('normal probe cleanup disarms the independent watchdog without killing its test process', async () => {
  const dummy = spawn(process.execPath, ['-e', 'process.send("ready"); setInterval(() => {}, 1000);'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {} });
  await once(dummy, 'message');
  const supervisor = await startProbeSupervisor(dummy.pid!, 180, 80);
  try {
    await supervisor.stop();
    await new Promise((resolve) => setTimeout(resolve, 220));
    assert.equal(dummy.exitCode, null);
    assert.equal(dummy.signalCode, null);
  } finally {
    const exit = once(dummy, 'exit'); dummy.kill('SIGKILL'); await exit;
    await supervisor.stop();
  }
});
