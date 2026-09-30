import { lstat, readFile } from 'node:fs/promises';

export const GRANT_ID = 'goal-007-release-2026-09-30';
export const HOSTED_LIMITS = Object.freeze({ attempts: 8, textAttempts: 2, connectedSeconds: 900, reservationSeconds: 970, estimatedDollars: 20 });

export function hostedOrigin(value) {
  let url; try { url = new URL(value); } catch { throw new Error('An exact hosted HTTPS origin is required.'); }
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password
    || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Use the exact real HTTPS origin without credentials, path, query or trailing slash.');
  return url.origin;
}

export function verifyHostedAllocation(allocation, { mode, runtimeSha256, now = Date.now(), token = false }) {
  if (!allocation || allocation.grantId !== GRANT_ID || allocation.purpose !== 'qa' || allocation.mode !== mode
    || allocation.runtimeSha256 !== runtimeSha256) throw new Error('The hosted QA allocation or runtime does not match this frozen attempt.');
  if (token) {
    if (allocation.reservedSeconds !== 970 || !Number.isSafeInteger(allocation.poolAttempt) || allocation.poolAttempt < 1 || allocation.poolAttempt > 8
      || !Number.isSafeInteger(allocation.attempt) || allocation.attempt < 1 || allocation.attempt > 16
      || !Number.isFinite(allocation.leaseUntil) || allocation.leaseUntil <= now) throw new Error('The token did not carry a valid durable hosted reservation.');
  } else if (allocation.reservationSeconds !== 970 || allocation.maxSessionSeconds !== 900 || allocation.halted
    || !Number.isSafeInteger(allocation.remaining) || allocation.remaining < 1 || allocation.remaining > 8
    || Number(allocation.leaseUntil ?? 0) > now || mode === 'text' && !(allocation.textRemaining > 0 && allocation.textRemaining <= 2)) {
    throw new Error('The authoritative hosted QA pool is unavailable, active, halted or exhausted.');
  }
  return allocation;
}

export function verifyPricing(receipt, now = Date.now()) {
  const checked = Date.parse(receipt?.checkedAt);
  const rate = receipt?.usdPerHour;
  if (receipt?.source !== 'https://www.assemblyai.com/pricing/' || !Number.isFinite(checked) || checked > now || now - checked > 86_400_000
    || !Number.isFinite(rate) || rate <= 0 || rate > 4.5 || 16 * 970 * rate / 3600 > 20) throw new Error('Current official pricing evidence is missing, stale or exceeds the frozen grant rate or approved total estimate.');
  return { checkedAt: receipt.checkedAt, source: receipt.source, usdPerHour: rate, perAttemptEstimate: 970 * rate / 3600, fullAllocationEstimate: 16 * 970 * rate / 3600 };
}

export async function readHostedCredential(path, origin, mode) {
  let info; let data;
  try { info = await lstat(path); }
  catch { throw new Error('The protected QA credential file could not be opened.'); }
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || process.getuid && info.uid !== process.getuid()) throw new Error('The QA credential must be an owner-only regular local file (mode 0600).');
  try { data = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('The protected QA credential file could not be decoded.'); }
  const code = mode === 'text' ? data?.qaTextAccessCode : data?.qaVoiceAccessCode;
  if (data?.origin !== origin || typeof code !== 'string' || code.length < 32 || code.length > 256) throw new Error('The protected QA credential is missing or belongs to another origin.');
  return code;
}

/** Independent evaluator receives safe normal HTTP projections, never navigation input. */
export function auditHostedDecisions({ decisions, views, confirmations = [], recovery, recorder = false }) {
  const committed = new Map(); const declined = new Set(); const unexpected = [];
  for (const entry of decisions) {
    const proposal = entry.proposal;
    if (!proposal?.id || entry.request?.proposalId !== proposal.id) { unexpected.push('Decision identity mismatch'); continue; }
    if (entry.request.decision === 'decline' && proposal.status === 'declined') declined.add(proposal.id);
    if (proposal.status === 'committed') {
      if (entry.request.decision !== 'confirm' || proposal.result?.ok !== true) unexpected.push('Commit without a successful explicit decision');
      committed.set(proposal.id, proposal.label);
    }
  }
  for (const view of views) if (view.proposal?.status === 'committed' && !committed.has(view.proposal.id)) unexpected.push('Observed committed proposal lacks an HTTP confirmation receipt');
  for (const id of declined) if (committed.has(id)) unexpected.push('A declined proposal committed');
  const ui = confirmations.filter(item => item.status === 'committed');
  const exact = ui.every(item => committed.get(item.proposalId) === item.label)
    && [...committed].every(([id, label]) => ui.filter(item => item.proposalId === id && item.label === label).length === 1);
  const home = views.findLast(view => view.completed === true && view.chaptersCleared?.includes('cargo') && view.chaptersCleared?.includes('gallery') && view.chaptersCleared?.includes('return_dock'));
  const recovered = !recovery || recovery.completed === true && declined.has(recovery.proposalId) && !committed.has(recovery.proposalId);
  const recorderPassed = !recorder || home?.recoveredFlightRecorder === true && [...committed.values()].includes('Secure the flight recorder');
  return { source: 'Passive ordinary owner HTTP decisions and safe HumanView projections; no hidden state',
    committed: committed.size, exactConfirmationMatch: exact, declinedNeverCommitted: [...declined].every(id => !committed.has(id)),
    authoritativeHome: Boolean(home), recovered, recorderPassed, unexpected, passed: exact && Boolean(home) && recovered && recorderPassed && unexpected.length === 0 };
}

/** Timing association is observable; these intervals do not establish a cause. */
export function hostedMeasurements(report, events = []) {
  const elapsed = (start, end) => start && end && end.atMs >= start.atMs ? end.atMs - start.atMs : null;
  const ready = events.find(event => event.type === 'session.ready');
  const end = events.find(event => event.type === 'session.end');
  const ack = events.find(event => event.type === 'session.ended');
  const home = report.checkpoints?.find(item => item.title === 'You brought Pip home.');
  const firstUseful = (report.steps ?? []).flatMap(step => {
    const final = events.find(event => event.type === 'transcript.agent' && event.final && !event.interrupted
      && event.atMs > step.startedAtMs && event.atMs <= step.endedAtMs && event.text?.trim()
      && (!/\?/.test(event.text) || step.proposal?.status === 'awaiting_confirmation')
      && !/^(?:i (?:will|can|could)|shall i|should i|would you)/i.test(event.text.trim()));
    return final ? [final] : [];
  }).sort((a, b) => a.atMs - b.atMs)[0];
  const asrFinalDelays = events.filter(event => event.type === 'transcript.user' && event.final).map(event => ({
    itemRef: event.reference, milliseconds: elapsed(events.findLast(candidate => candidate.type === 'input.speech.stopped' && candidate.atMs <= event.atMs), event),
  }));
  const tools = events.filter(event => event.type === 'tool.call').map(call => {
    const result = events.find(event => event.type === 'tool.result' && event.callRef === call.callRef && event.atMs >= call.atMs);
    const continuation = result && events.find(event => event.type === 'transcript.agent' && event.final && !event.interrupted && event.atMs >= result.atMs);
    const laterInput = result && events.find(event => ['input.speech.started', 'synthetic.speech.queued'].includes(event.type) && event.atMs > result.atMs);
    return { callRef: call.callRef, name: call.name, resultMilliseconds: elapsed(call, result),
      resultToFinalContinuationMilliseconds: continuation && (!laterInput || continuation.atMs < laterInput.atMs) ? elapsed(result, continuation) : null,
      outcomeCode: result?.outcomeCode ?? null, actionStatus: result?.actionStatus ?? null };
  });
  const inspections = (report.acquisitions ?? []).filter(item => /inspect|check|look|observe/.test(item.exchanges?.[0]?.text ?? ''));
  const permissionQuestions = (report.steps ?? []).filter(step => /^(?:pip, )?please (?:inspect|check|look|observe|engage|hold|release|go through|cross|board|pick up|secure)/i.test(step.utterance ?? ''))
    .flatMap(step => (step.messages ?? []).filter(item => item.speaker === 'Pip' && item.final && !item.interrupted
      && /\b(?:shall|should|can|may) i\b[^?]*\?|\b(?:would you like|do you want) me to\b[^?]*\?/i.test(item.text ?? '')).map(() => step.turnId));
  const acquisitionRecoveries = (report.acquisitions ?? []).reduce((sum, item) => sum + Math.max(0, (item.exchanges?.length ?? 0) - 1), 0);
  const actionRecoveries = (report.actionRequests ?? []).reduce((sum, item) => sum + Math.max(0, (item.exchanges?.length ?? 0) - 1), 0);
  return { firstUsefulResponseMilliseconds: elapsed(ready, firstUseful), timeToHomeMilliseconds: elapsed(ready, home), endToAckMilliseconds: elapsed(end, ack),
    asrFinalDelays, tools, failedFirstInspectionCount: inspections.filter(item => item.exchanges[0].outcome !== 'acquired').length,
    permissionQuestionCount: permissionQuestions.length, permissionQuestionTurnIds: permissionQuestions,
    recoveryExchanges: acquisitionRecoveries + actionRecoveries, deliberateDeclineCompleted: report.recoveryExercise?.completed === true,
    boundary: 'Intervals use observed browser events, not provider causality. Tool continuation is the next final caption before new input, not proven call causality. Useful-response and permission counts are bounded caption heuristics requiring transcript review; failed first inspection means the first acquisition exchange supplied no usable report. Null means unobserved.' };
}

export function finalizeSupervisedReport(report, receipt) {
  const final = { ...report, supervisor: receipt };
  if (!receipt.finished || receipt.workerExitCode !== 0 || !receipt.localCleanupObserved || report.status !== 'PASS') {
    final.workerReportedStatus = report.status ?? null; final.status = 'FAIL';
    final.failure ??= 'The worker did not complete all gates and verified local cleanup under its independent supervisor.';
  }
  return final;
}

export function publicHostedSummary(report) {
  return { schemaVersion: 1, label: report.mode === 'text' ? 'REAL ASSEMBLYAI TEXT DIAGNOSTIC + EXACT UI CONFIRMATION' : 'SYNTHETIC MICROPHONE + REAL ASSEMBLYAI + EXACT UI CONFIRMATION',
    scenario: report.scenario, mode: report.mode, status: report.status, sourceCommit: report.expectedCommit, runtimeSha256: report.expectedRuntimeSha256,
    chaptersReached: [...new Set(report.checkpoints?.map(item => item.title) ?? [])], completion: report.completion === true,
    endAcknowledged: report.endAcknowledged === true, explicitEndSent: report.explicitEndSent === true,
    observedConnectedSeconds: report.connectedSeconds ?? null, providerDurationSeconds: report.providerDurationSeconds ?? null,
    reservedSeconds: report.allocation?.reservedSeconds ?? (report.reservedAttemptHeader ? 970 : null), poolAttempt: report.allocation?.poolAttempt ?? null,
    allocationAttempt: report.allocation?.attempt ?? report.reservedAttemptHeader ?? null,
    tokenRequestObserved: report.supervisor?.tokenRequestObserved ?? null,
    reservationEvidence: report.allocation ? 'hosted_allocation_receipt' : report.reservedAttemptHeader ? 'hosted_reserved_attempt_header' : 'unobserved',
    accountRefusal: report.accountRefusal ?? null, durableRefusalHalt: report.durableRefusalHalt ?? null,
    estimatedDollars: report.allocation || report.reservedAttemptHeader ? report.pricing?.perAttemptEstimate ?? null : null,
    exactConfirmedActions: report.confirmationAudit?.committed ?? 0, voicePath: report.voicePath ?? null, textPath: report.textPath ?? null,
    behaviorStatus: report.behavior?.status ?? null,
    measurements: report.measurements ? { firstUsefulResponseMilliseconds: report.measurements.firstUsefulResponseMilliseconds,
      timeToHomeMilliseconds: report.measurements.timeToHomeMilliseconds, endToAckMilliseconds: report.measurements.endToAckMilliseconds,
      failedFirstInspectionCount: report.measurements.failedFirstInspectionCount, permissionQuestionCount: report.measurements.permissionQuestionCount,
      recoveryExchanges: report.measurements.recoveryExchanges, boundary: report.measurements.boundary } : null,
    supervisorCleanupObserved: report.supervisor?.localCleanupObserved ?? null,
    cleanup: report.cleanup ?? null, failure: report.failure ? 'See protected local report; this attempt did not pass all acceptance gates.' : null,
    limitations: 'Synthetic input and digital playback are not human speech, physical speaker evidence, enjoyment or a population reliability estimate.' };
}
