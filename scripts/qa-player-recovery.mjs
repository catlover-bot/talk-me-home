/** One acquisition subgoal: at most four purposeful exchanges and 120 seconds.
 * Inputs are communicated reports/public UI only. No route or desired answer is supplied.
 */
export async function acquirePlayerReport({ subject, read, exchange, requests, checkScope = async () => {},
  report = {}, now = () => performance.now(), timeoutMs = 120_000 }) {
  if (!Array.isArray(requests) || !requests.length || requests.length > 4 || timeoutMs > 120_000 || timeoutMs <= 0) throw new Error('Invalid bounded recovery policy.');
  report.acquisitions ??= [];
  const startedAt = now();
  const record = { subject, startedAt, deadlineAt: startedAt + timeoutMs, strictFirstResponse: false, recovered: false, outcome: 'pending', exchanges: [] };
  report.acquisitions.push(record);
  let lastReply = '';
  try {
    await checkScope();
    let value = await read();
    if (value != null) { record.outcome = 'already_reported'; record.strictFirstResponse = true; record.value = value; return value; }
    for (let index = 0; index < requests.length; index++) {
      await checkScope();
      const request = typeof requests[index] === 'function' ? requests[index](lastReply) : requests[index];
      if (!request?.text || !request.reason) throw new Error('Recovery needs an explicit progress reason.');
      const remaining = record.deadlineAt - now();
      if (remaining <= 0) throw new Error(`QA ${subject} recovery exceeded 120 seconds.`);
      const step = { ...request, startedAt: now(), outcome: 'pending' }; record.exchanges.push(step);
      let timer;
      try {
        lastReply = String(await Promise.race([
          exchange(request.text, { deadlineAt: record.deadlineAt }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`QA ${subject} recovery exceeded 120 seconds.`)), remaining); }),
        ]) ?? '');
      } finally { clearTimeout(timer); }
      await checkScope();
      step.endedAt = now(); step.reply = lastReply;
      if (step.endedAt > record.deadlineAt) throw new Error(`QA ${subject} recovery exceeded 120 seconds.`);
      value = await read();
      step.outcome = value == null ? 'needs_fresh_report' : 'acquired';
      if (value != null) {
        record.value = value; record.outcome = 'acquired'; record.strictFirstResponse = index === 0; record.recovered = index > 0;
        return value;
      }
    }
    throw new Error(`QA ${subject} remained unknown after ${requests.length} purposeful exchanges.`);
  } catch (error) { record.outcome = 'failed'; record.failure = error.message; throw error; }
  finally { record.endedAt = now(); }
}

export const LOCATION_REQUESTS = [
  { text: 'Please look around and report the emblem in your current room.', reason: 'obtain a fresh local survey' },
  { text: 'Please observe the room now and tell me which emblem is beside you.', reason: 'explicitly perform the offered read-only check' },
  { text: 'Which one emblem marks your current platform? Please distinguish it from the room you left.', reason: 'resolve the current-room referent' },
  { text: 'Please check the local emblem once more and say its name clearly. I need your current observation.', reason: 'repair an unclear or misrecognized report' },
];

export const passageRequests = direction => [
  { text: `Please inspect the ${direction} gate and tell me whether anything blocks it.`, reason: 'inspect the selected local passage' },
  { text: `Is the opening of the ${direction} gate physically clear or blocked?`, reason: 'separate passage obstruction from gate power' },
  { text: `Please check the ${direction} gate again and report whether cargo blocks passage.`, reason: 'perform the requested read-only obstruction check' },
  { text: `Please inspect the ${direction} opening now. Tell me whether cargo obstructs it, even if the gate is open.`, reason: 'resolve the specific opening without assuming passability' },
];
