import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { LiveVoice, type VoiceSocket, type VoiceStartOptions, type TranscriptEntry } from '../game/client/voice.ts';
import type { VoiceAudio } from '../game/client/audio.ts';
import { decisionReceipt } from './fixtures/decision-receipt.ts';

const pause = (ms = 25) => new Promise<void>(resolve => setTimeout(resolve, ms));

function galleryArrivalReceipt() {
  const receipt = decisionReceipt();
  receipt.event.chapter = receipt.proposal.chapter = 'gallery';
  receipt.event.chapterEpoch = receipt.proposal.chapterEpoch = 2;
  receipt.proposal.action = { kind: 'move', target: 'gallery.g1' };
  receipt.proposal.label = 'Move through the east gate';
  receipt.result.message = 'You passed through the open gate. You are on a safe platform marked with the Fork emblem.';
  receipt.checkpoint = { chapter: 'gallery', chapterEpoch: 2, completed: false };
  return Object.assign(receipt, { perception: {
    origin: 'confirmed_arrival' as const, roundId: 'round-1', chapter: 'gallery' as const, chapterEpoch: 2,
    visitId: 'visit-2', observationRevision: 3, stateRevision: 7, actionEpoch: 4, observedAt: 1000,
    emblem: 'Fork' as const, compass: 'north' as const,
    gates: [{ handle: 'gallery.g1', direction: 'West' as const, power: 'powered' as const, door: 'open' as const, passage: 'unchecked' as const }],
  } });
}

test('Goal005 arrival perception survives the shipped adapter and requests one orientation report', async t => {
  const peer = await connection(t, { scope: () => ({ roundId: 'round-1', chapter: 'gallery', chapterEpoch: 2, revision: 7, actionEpoch: 4, status: 'active' }) });
  const receipt = galleryArrivalReceipt();
  assert.equal(peer.live.sendGameEvent(receipt), true);
  await pause();
  const context = JSON.parse(String(peer.sent.find(event => event.type === 'conversation.message')?.content).split('\n')[1]);
  assert.equal(context.perception?.emblem, 'Fork', 'The move already supplied actual local perception; the adapter must retain it.');
  assert.equal(context.perception.gates[0].passage, 'unchecked');
  assert.match(String(peer.acknowledgements()[0]?.instructions), /arrival|orientation/i);
  assert.match(String(peer.acknowledgements()[0]?.instructions), /emblem/);
  const responseFacts = JSON.parse(String(peer.acknowledgements()[0]?.instructions).split('\nVerified response facts: ')[1]);
  assert.equal(responseFacts.arrival.emblem, 'Fork', 'The one-shot request must carry actual facts, not require an opaque proposal lookup.');
  assert.deepEqual(responseFacts.arrival.gates, [{ direction: 'West', power: 'powered', door: 'open', passage: 'unchecked' }]);
  assert.doesNotMatch(JSON.stringify(responseFacts), /gallery\.g1|hiddenTopology/);
  assert.equal(peer.live.sendGameEvent(receipt), true);
  await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.equal(peer.sent.filter(event => event.type === 'tool.result').length, 0);
});

test('arrival scope changes retain the committed receipt but suppress stale local orientation', async t => {
  let revision = 7;
  const peer = await connection(t, { scope: () => ({ roundId: 'round-1', chapter: 'gallery', chapterEpoch: 2, revision, actionEpoch: 4, status: 'active' }) });
  peer.live.sendGameEvent(galleryArrivalReceipt());
  revision++;
  await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.match(String(peer.acknowledgements()[0].instructions), /historical/);
  assert.doesNotMatch(String(peer.acknowledgements()[0].instructions), /say the current emblem/);
  assert.doesNotMatch(String(peer.acknowledgements()[0].instructions), /Fork|West|unchecked/);
  const stale = await connection(t, { scope: () => ({ roundId: 'round-1', chapter: 'gallery', chapterEpoch: 2, revision: 8, actionEpoch: 4, status: 'active' }) });
  stale.live.sendGameEvent(galleryArrivalReceipt());
  assert.doesNotMatch(String(stale.sent.find(event => event.type === 'conversation.message')?.content), /"perception":/);
});

test('arrival observation survives the real tool-result projection with no human or private extras', async t => {
  const receipt = galleryArrivalReceipt();
  const peer = await connection(t, { scope: () => ({ roundId: 'round-1', chapter: 'gallery', chapterEpoch: 2, revision: 7, actionEpoch: 4, status: 'active' }),
    executeTool: async () => ({ ok: true, message: 'Local survey.', perception: { ...receipt.perception, hiddenTopology: 'NEVER_FORWARD' }, view: { privateNote: 'NEVER_FORWARD' } }) });
  peer.emit({ type: 'reply.started', reply_id: 'survey' });
  peer.emit({ type: 'tool.call', call_id: 'survey-call', name: 'observe_room', arguments: {} });
  peer.emit({ type: 'reply.done', reply_id: 'survey', status: 'completed' });
  await pause();
  const result = peer.sent.find(event => event.type === 'tool.result');
  assert.ok(result);
  assert.equal(JSON.parse(String(result.result)).perception.emblem, 'Fork');
  assert.doesNotMatch(String(result.result), /NEVER_FORWARD|privateNote|hiddenTopology|"view"/);
});

test('new speech consumes arrival context in the ordinary turn without a second arrival response', async t => {
  const peer = await connection(t, { scope: () => ({ roundId: 'round-1', chapter: 'gallery', chapterEpoch: 2, revision: 7, actionEpoch: 4, status: 'active' }) });
  peer.live.sendGameEvent(galleryArrivalReceipt());
  peer.live.sendText('What emblem is here?'); await pause();
  const messages = peer.sent.filter(event => event.type === 'conversation.message');
  assert.deepEqual(messages.map(event => event.role), ['system', 'user']);
  assert.match(String(messages[0].content), /"emblem":"Fork"/);
  assert.equal(peer.acknowledgements().length, 0);
  assert.equal(peer.sent.filter(event => event.type === 'reply.create').length, 1);
});

test('a selected quick request has its own transcript provenance and never masquerades as microphone speech', async t => {
  const peer = await connection(t);
  peer.live.sendText('Please check the room.', 'quick_request'); await pause();
  assert.equal(peer.transcripts[0].id, 'quick:1');
  assert.equal(peer.transcripts[0].text, 'Please check the room.');
  assert.equal(peer.sent.some(event => event.type === 'input.audio'), false);
});

async function connection(t: TestContext, options: { executeTool?: VoiceStartOptions['executeTool']; scope?: () => unknown; expiryMs?: number; decisionMs?: number; greeting?: boolean; serverCap?: number; clientCap?: number } = {}) {
  const sent: Record<string, unknown>[] = []; const transcripts: TranscriptEntry[] = []; const warnings: string[] = [];
  let playback!: (active: boolean) => void; let drained!: () => void; let input!: (data: string) => void;
  const socket: VoiceSocket = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send: data => { const event = JSON.parse(data); sent.push(event); if (event.type === 'session.end') queueMicrotask(() => emit({ type: 'session.ended' })); },
    close() { this.readyState = 3; },
  };
  const emit = (event: Record<string, unknown>) => socket.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
  const audio: VoiceAudio = { async prepare(_microphone, onInput, _warning, onDrained, _microphoneState, onPlayback) { input = onInput; drained = onDrained; playback = onPlayback!; },
    play() { playback(true); }, stopPlayback() { playback(false); }, async close() {} };
  const live = new LiveVoice({ onTranscript: entry => transcripts.push(entry), onStatus() {}, onWarning: message => warnings.push(message), onError: message => assert.fail(message) },
    { createAudio: () => audio, createSocket: () => { queueMicrotask(() => { socket.onopen?.(new Event('open')); emit({ type: 'session.ready' }); }); return socket; },
      endGraceMs: 25, acknowledgementIdleMs: 5, acknowledgementExpiryMs: options.expiryMs ?? 1000, decisionInputGraceMs: options.decisionMs ?? 1500 });
  t.after(() => live.stop());
  await live.start({ token: options.serverCap === undefined ? 'offline-placeholder' : async () => ({ token: 'offline-placeholder', config: {}, maxSessionSeconds: options.serverCap }), config: {}, microphone: true,
    maxSessionSeconds: options.clientCap,
    executeTool: options.executeTool ?? (async () => assert.fail('Acknowledgement is not an action.')),
    captureToolContext: options.scope, cancelPending: async () => {} });
  if (options.greeting !== false) { emit({ type: 'reply.started', reply_id: 'greeting' }); emit({ type: 'reply.done', reply_id: 'greeting', status: 'completed' }); }
  return { live, sent, transcripts, warnings, emit, input: (data: string) => input(data),
    drain: () => { playback(false); drained(); },
    acknowledgements: () => sent.filter(event => event.type === 'reply.create' && typeof event.instructions === 'string') };
}

test('a verified confirmation gets one acknowledgement only after the existing reply and playback drain', async () => {
  const sent: Record<string, unknown>[] = [];
  let playback!: (active: boolean) => void;
  let drained!: () => void;
  const socket: VoiceSocket = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send: data => { const event = JSON.parse(data); sent.push(event); if (event.type === 'session.end') queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ type: 'session.ended' }) } as MessageEvent)); },
    close() { this.readyState = 3; },
  };
  const emit = (event: Record<string, unknown>) => socket.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
  const audio: VoiceAudio = { async prepare(_microphone, _input, _warning, onDrained, _microphoneState, onPlayback) { drained = onDrained; playback = onPlayback!; },
    play() { playback(true); }, stopPlayback() { playback(false); }, async close() {} };
  const live = new LiveVoice({ onTranscript() {}, onStatus() {}, onError: message => assert.fail(message) },
    { createAudio: () => audio, createSocket: () => { queueMicrotask(() => { socket.onopen?.(new Event('open')); emit({ type: 'session.ready' }); }); return socket; }, endGraceMs: 25 });
  try {
    await live.start({ token: 'offline-placeholder', config: {}, microphone: false, executeTool: async () => assert.fail('Acknowledgement is not an action.'), cancelPending: async () => {} });
    emit({ type: 'reply.started', reply_id: 'prior' });
    emit({ type: 'reply.audio', data: 'offline-pcm' });
    assert.equal(live.sendGameEvent(decisionReceipt()), true);
    assert.equal(live.sendGameEvent(decisionReceipt()), true);
    await pause(); assert.equal(sent.filter(event => event.type === 'reply.create').length, 0);
    emit({ type: 'reply.done', reply_id: 'prior', status: 'completed' });
    await pause(); assert.equal(sent.filter(event => event.type === 'reply.create').length, 0);
    playback(false); drained(); await pause(300);
    assert.equal(sent.filter(event => event.type === 'conversation.message').length, 1);
    assert.equal(sent.filter(event => event.type === 'reply.create').length, 1, 'The shipped adapter must request the missing acknowledgement after a safe boundary.');
    assert.equal(sent.filter(event => event.type === 'tool.result').length, 0);
  } finally { await live.stop(); }
});

test('only server-selected 900 seconds extends the local cap; warning and End remain finite', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const peer = await connection(t, { serverCap: 900, greeting: false });
  t.mock.timers.tick(600_000);
  assert.equal(peer.sent.some(event => event.type === 'session.end'), false);
  t.mock.timers.tick(240_000);
  assert.match(peer.warnings.at(-1)!, /end in 60 seconds/);
  t.mock.timers.tick(60_000);
  await peer.live.stop();
  assert.equal(peer.sent.filter(event => event.type === 'session.end').length, 1);
  assert.equal(peer.live.endAcknowledged, true);
  const unapproved = await connection(t, { clientCap: 900, greeting: false });
  t.mock.timers.tick(600_000); await unapproved.live.stop();
  assert.equal(unapproved.sent.filter(event => event.type === 'session.end').length, 1, 'A client-only option cannot extend the default cap.');
});

test('receipt serialization carries only the exact robot result and known action; one idle request cannot become a second tool result', async t => {
  const peer = await connection(t);
  const receipt = decisionReceipt();
  Object.assign(receipt, { view: { privateManual: 'do-not-forward' } });
  Object.assign(receipt.proposal.action, { privateNote: 'do-not-forward' });
  Object.assign(receipt.result, { view: { hiddenRoom: 'do-not-forward' } });
  peer.live.sendGameEvent(receipt); receipt.result.message = 'changed after delivery';
  await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.match(String(peer.sent.find(event => event.type === 'conversation.message')?.content), /holding the Door open/);
  assert.doesNotMatch(JSON.stringify(peer.sent), /do-not-forward|privateManual|privateNote|hiddenRoom|round-1|chapterEpoch|changed after delivery/);
  assert.match(String(peer.acknowledgements()[0].instructions), /Do not call tools/);
  peer.emit({ type: 'reply.started', reply_id: 'ack' });
  peer.emit({ type: 'transcript.agent', reply_id: 'ack', text: 'The Latch is holding the Door open.' });
  peer.emit({ type: 'reply.done', reply_id: 'ack', status: 'completed' });
  peer.live.sendGameEvent(decisionReceipt()); await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.equal(peer.sent.filter(event => event.type === 'conversation.message').length, 1);
  assert.equal(peer.sent.some(event => event.type === 'tool.result'), false);
  assert.deepEqual(peer.transcripts.map(entry => entry.text), ['The Latch is holding the Door open.']);
});

test('an immediate typed turn follows receipt context and suppresses the separate acknowledgement without losing input', async t => {
  const peer = await connection(t);
  peer.live.sendGameEvent(decisionReceipt());
  assert.equal(peer.live.sendText('  Please cross to the far side.  '), true);
  await pause();
  const messages = peer.sent.filter(event => event.type === 'conversation.message');
  assert.deepEqual(messages.map(event => event.role), ['system', 'user']);
  assert.equal(messages[1].content, 'Please cross to the far side.');
  assert.equal(peer.acknowledgements().length, 0);
  assert.equal(peer.sent.filter(event => event.type === 'reply.create').length, 1, 'Only the ordinary typed-turn request remains.');
  assert.equal(peer.transcripts[0].text, '  Please cross to the far side.  ');
});

test('immediate microphone speech cancels queued acknowledgement and keeps its audio and raw transcript', async t => {
  const peer = await connection(t);
  peer.live.sendGameEvent(decisionReceipt());
  peer.input('captured-input'); peer.emit({ type: 'input.speech.started' });
  peer.emit({ type: 'transcript.user', item_id: 'speech-1', text: 'Power is now off.' });
  peer.emit({ type: 'input.speech.stopped' }); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  const context = peer.sent.findIndex(event => event.type === 'conversation.message');
  const audio = peer.sent.findIndex(event => event.type === 'input.audio');
  assert.ok(context >= 0 && audio > context);
  assert.equal(peer.sent[audio].audio, 'captured-input');
  assert.equal(peer.transcripts[0].text, 'Power is now off.');
});

test('speech during the acknowledgement uses existing interruption guards and never requests a replacement acknowledgement', async t => {
  const peer = await connection(t);
  peer.live.sendGameEvent(decisionReceipt()); await pause();
  peer.emit({ type: 'reply.started', reply_id: 'ack' });
  peer.emit({ type: 'transcript.agent.delta', reply_id: 'ack', delta: 'The Latch' });
  peer.emit({ type: 'reply.audio', data: 'offline-pcm' });
  peer.emit({ type: 'input.speech.started' });
  peer.emit({ type: 'transcript.agent', reply_id: 'ack', text: 'The Latch and invented later words.' });
  peer.emit({ type: 'transcript.user', item_id: 'new-input', text: 'Wait. Inspect the Door.' });
  peer.emit({ type: 'input.speech.stopped' });
  peer.emit({ type: 'reply.done', reply_id: 'ack', status: 'interrupted' }); await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.ok(peer.transcripts.some(entry => entry.text === 'The Latch' && entry.interrupted));
  assert.equal(peer.transcripts.some(entry => entry.text.includes('invented later words')), false);
  assert.ok(peer.transcripts.some(entry => entry.text === 'Wait. Inspect the Door.'));
});

test('a player turn racing the owner HTTP receipt suppresses stale acknowledgement but retains the verified context', async t => {
  const peer = await connection(t); const decision = peer.live.beginGameDecision();
  peer.live.sendText('Power is now off.'); await pause();
  assert.equal(peer.sent.some(event => event.type === 'conversation.message'), false, 'Input waits briefly for the pending local decision.');
  assert.equal(peer.live.sendGameEvent(decisionReceipt(), decision.inputTurn), true);
  await pause(); decision.finish();
  assert.deepEqual(peer.sent.filter(event => event.type === 'conversation.message').map(event => event.role), ['system', 'user']);
  peer.emit({ type: 'reply.started', reply_id: 'new-turn' }); peer.emit({ type: 'reply.done', reply_id: 'new-turn', status: 'completed' }); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  assert.equal(peer.sent.filter(event => event.type === 'conversation.message' && event.role === 'system').length, 1);
});

test('a confirmation HTTP race preserves microphone chunks after the receipt without mistaking silence for a user turn', async t => {
  const peer = await connection(t); const decision = peer.live.beginGameDecision();
  peer.input('silent-chunk'); peer.input('speech-chunk');
  assert.equal(peer.sent.some(event => event.type === 'input.audio'), false);
  peer.live.sendGameEvent(decisionReceipt(), decision.inputTurn);
  const relevant = peer.sent.filter(event => event.type === 'conversation.message' || event.type === 'input.audio');
  assert.deepEqual(relevant.map(event => event.type), ['conversation.message', 'input.audio', 'input.audio']);
  assert.deepEqual(relevant.slice(1).map(event => event.audio), ['silent-chunk', 'speech-chunk']);
  peer.emit({ type: 'input.speech.started' }); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  decision.finish();
  const silent = await connection(t); const quietDecision = silent.live.beginGameDecision();
  silent.input('only-silence'); silent.live.sendGameEvent(decisionReceipt(), quietDecision.inputTurn); await pause();
  assert.equal(silent.acknowledgements().length, 1, 'Only semantic speech, not the existence of PCM, cancels acknowledgement.');
});

test('decision input limits release every queued chunk once and a late receipt never requests stale speech', async t => {
  const peer = await connection(t, { decisionMs: 15 }); const decision = peer.live.beginGameDecision();
  peer.input('first-chunk'); peer.input('second-chunk'); peer.live.sendText('Please inspect the Door.');
  await pause(30);
  assert.deepEqual(peer.sent.filter(event => event.type === 'input.audio').map(event => event.audio), ['first-chunk', 'second-chunk']);
  assert.equal(peer.sent.filter(event => event.type === 'conversation.message' && event.role === 'user').length, 1);
  peer.live.sendGameEvent(decisionReceipt(), decision.inputTurn); decision.finish();
  peer.emit({ type: 'reply.started', reply_id: 'answer' }); peer.emit({ type: 'reply.done', reply_id: 'answer', status: 'completed' }); await pause();
  assert.equal(peer.acknowledgements().length, 0); assert.equal(peer.warnings.length, 1);
  const bounded = await connection(t); bounded.live.beginGameDecision();
  const chunks = ['a'.repeat(100_000), 'b'.repeat(100_000)]; chunks.forEach(bounded.input);
  assert.deepEqual(bounded.sent.filter(event => event.type === 'input.audio').map(event => event.audio), chunks);
});

test('session readiness alone cannot race an unfinished greeting; conflicting duplicate receipt content is rejected', async t => {
  const peer = await connection(t, { greeting: false });
  peer.live.sendGameEvent(decisionReceipt()); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  peer.emit({ type: 'reply.started', reply_id: 'greeting' }); peer.emit({ type: 'reply.audio', data: 'greeting-audio' });
  peer.emit({ type: 'reply.done', reply_id: 'greeting', status: 'completed' }); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  peer.drain(); await pause(); assert.equal(peer.acknowledgements().length, 1);
  assert.equal(peer.live.sendGameEvent(decisionReceipt()), true);
  const changed = decisionReceipt(); changed.result.message = 'A different unsupported outcome.';
  assert.equal(peer.live.sendGameEvent(changed), false);
  assert.equal(peer.sent.filter(event => event.type === 'conversation.message').length, 1);
});

test('unresolved tool output and its ordinary continuation both precede a standalone acknowledgement', async t => {
  let resolve!: (value: unknown) => void;
  const peer = await connection(t, { executeTool: async () => new Promise(done => { resolve = done; }) });
  peer.emit({ type: 'reply.started', reply_id: 'tool-reply' });
  peer.emit({ type: 'tool.call', call_id: 'status-call', name: 'get_action_status', arguments: { proposal_id: 'proposal-1' } });
  peer.emit({ type: 'reply.done', reply_id: 'tool-reply', status: 'completed' });
  peer.live.sendGameEvent(decisionReceipt()); await pause();
  assert.equal(peer.acknowledgements().length, 0);
  resolve({ ok: true, message: 'The recorded Latch operation completed.' }); await pause();
  assert.equal(peer.sent.filter(event => event.type === 'tool.result').length, 1);
  assert.equal(peer.acknowledgements().length, 0, 'A tool result normally triggers its own reply.');
  peer.emit({ type: 'reply.started', reply_id: 'tool-continuation' });
  peer.emit({ type: 'reply.done', reply_id: 'tool-continuation', status: 'completed' }); await pause();
  assert.equal(peer.acknowledgements().length, 1);
  assert.equal(peer.sent.filter(event => event.type === 'tool.result').length, 1);
});

test('an unsafe opportunity expires once, with no polling, retry or later acknowledgement', async t => {
  const peer = await connection(t, { expiryMs: 20 });
  peer.emit({ type: 'reply.started', reply_id: 'busy' }); peer.live.sendGameEvent(decisionReceipt());
  await pause(35); peer.emit({ type: 'reply.done', reply_id: 'busy', status: 'completed' }); await pause();
  assert.equal(peer.acknowledgements().length, 0); assert.equal(peer.warnings.length, 1);
  assert.equal(peer.sent.filter(event => event.type === 'conversation.message').length, 1);
});

test('the connection-limit warning survives later decision advisories and the existing cap still closes once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const peer = await connection(t, { greeting: false });
  assert.equal(peer.live.hasConnectionLimitWarning, false);
  t.mock.timers.tick(540_000);
  assert.equal(peer.live.hasConnectionLimitWarning, true);
  assert.match(peer.warnings.at(-1)!, /This Live connection will end in 60 seconds/);
  peer.live.sendGameEvent(decisionReceipt());
  t.mock.timers.tick(1000);
  assert.match(peer.warnings.at(-1)!, /This Live connection will end in 60 seconds/);
  peer.live.beginGameDecision();
  t.mock.timers.tick(1500);
  assert.match(peer.warnings.at(-1)!, /This Live connection will end in 60 seconds/);
  peer.emit({ type: 'reply.started', reply_id: 'late-greeting' });
  peer.emit({ type: 'reply.done', reply_id: 'late-greeting', status: 'completed' });
  t.mock.timers.tick(5);
  assert.equal(peer.acknowledgements().length, 0, 'The expired receipt stays expired despite a later safe boundary.');
  t.mock.timers.tick(60_000 - 2505);
  await peer.live.stop();
  assert.match(peer.warnings.at(-1)!, /connection limit was reached/);
  assert.equal(peer.sent.filter(event => event.type === 'session.end').length, 1);
});

test('Pause, explicit interruption and old-round replacement cancel queued speech without replaying the receipt', async t => {
  const paused = await connection(t); paused.live.sendGameEvent(decisionReceipt()); await paused.live.stop(); await pause();
  assert.equal(paused.acknowledgements().length, 0); assert.equal(paused.live.endAcknowledged, true);
  const interrupted = await connection(t); interrupted.live.sendGameEvent(decisionReceipt()); await interrupted.live.interrupt(); await pause();
  assert.equal(interrupted.acknowledgements().length, 0);
  let roundId = 'round-1'; const replaced = await connection(t, { scope: () => ({ roundId, chapterEpoch: 1 }) });
  replaced.live.sendGameEvent(decisionReceipt()); roundId = 'new-round'; await pause();
  assert.equal(replaced.acknowledgements().length, 0); assert.equal(replaced.live.sendGameEvent(decisionReceipt()), false);
  const fresh = await connection(t); fresh.live.sendGameEvent(decisionReceipt()); await pause();
  assert.equal(fresh.acknowledgements().length, 1, 'Receipt deduplication belongs to one explicit connection.');
});

test('a chapter-advancing receipt retains its source; final-home closing never queues a second farewell', async t => {
  const receipt = decisionReceipt();
  receipt.event.chapter = receipt.proposal.chapter = 'gallery'; receipt.event.chapterEpoch = receipt.proposal.chapterEpoch = 2;
  receipt.proposal.action = { kind: 'move', target: 'gallery.g4' }; receipt.proposal.label = 'Move through the southeast gate';
  receipt.result.message = 'You passed through the gate. Return Dock checkpoint confirmed.';
  receipt.checkpoint = { chapter: 'return_dock', chapterEpoch: 3, completed: false };
  const peer = await connection(t, { scope: () => ({ roundId: 'round-1', chapterEpoch: 3 }) });
  assert.equal(peer.live.sendGameEvent(receipt), true); await pause();
  const context = JSON.parse(String(peer.sent.find(event => event.type === 'conversation.message')?.content).split('\n')[1]);
  assert.equal(context.sourceChapter, 'gallery'); assert.equal(context.checkpoint.chapter, 'return_dock');
  assert.equal(peer.acknowledgements().length, 1);
  const home = decisionReceipt(); home.checkpoint.completed = true;
  const final = await connection(t); final.live.sendGameEvent(home); await pause();
  assert.match(String(final.acknowledgements()[0].instructions), /single closing acknowledgement/);
  final.emit({ type: 'reply.started', reply_id: 'farewell' }); final.live.finishReply('farewell');
  final.emit({ type: 'reply.done', reply_id: 'farewell', status: 'completed' }); final.drain();
  final.live.sendGameEvent(home); await pause(); assert.equal(final.acknowledgements().length, 1);
  await final.live.stop(); assert.equal(final.live.endAcknowledged, true);
});
