import test from "node:test";
import assert from "node:assert/strict";
import { simulationReply, simulationSpeech, rememberLocalResult } from "../game/client/mock.ts";
import type { RobotLocalPerception } from '../game/shared/contracts';
import { currentRobotPerception } from '../game/client/robot-perception';

test('Practice routes only by locally learned compass labels and never substitutes the hidden route', () => {
  const empty = { chapter: 'gallery' as const, gates: [] };
  assert.equal(simulationReply('Go through the northeast gate', empty).call, undefined);
  const memory = rememberLocalResult(empty, 'West gate (gallery.g1) is open. Northeast gate (gallery.g2) is closed. Southeast gate (gallery.g4) is open.', 'gallery');
  assert.deepEqual(simulationReply('Please take the north-east gate', memory).call?.arguments, { target: 'gallery.g2' });
  assert.deepEqual(simulationReply('Inspect the southeast gate', memory).call?.arguments, { direction: 'southeast' });
  for (const request of ['Use that gate', 'Take the other route', 'Go northeast or southeast', 'Go through gallery.g5']) assert.equal(simulationReply(request, memory).call, undefined);
  const moved = rememberLocalResult(memory, 'You are in a room with the Sail emblem. Southwest gate (gallery.g2) is open. Southeast gate (gallery.g3) is closed.', 'gallery');
  assert.equal(simulationReply('Go through the west gate', moved).call, undefined);
  assert.deepEqual(rememberLocalResult(moved, 'You reached the Return Dock.', 'return_dock').gates, []);
});

test('Practice inspection preserves the scoped full local gate set and a later arrival replaces departed-room gates', () => {
  const leaf: RobotLocalPerception = {
    origin: 'gate_inspection', roundId: 'practice-round', chapter: 'gallery', chapterEpoch: 2,
    visitId: 'leaf-visit', observationRevision: 5, stateRevision: 9, actionEpoch: 4, observedAt: 1000,
    emblem: 'Leaf', compass: 'north', gates: [
      { handle: 'gallery.g4', direction: 'Northwest', power: 'powered', door: 'open', passage: 'unchecked' },
      { handle: 'gallery.g5', direction: 'Northeast', power: 'unpowered', door: 'closed', passage: 'blocked' },
    ],
  };
  const before = rememberLocalResult({ chapter: 'gallery', gates: [] }, 'Northwest gate (gallery.g4) is open. Northeast gate (gallery.g5) is closed.', 'gallery');
  const inspected = rememberLocalResult(before, 'Northeast gate (gallery.g5) is closed. Cargo blocks this gate opening. You remain in the safe room.', 'gallery', leaf);
  assert.deepEqual(inspected.gates, before.gates, 'A focused inspection is not a replacement survey of one gate.');
  assert.deepEqual(simulationReply('Go through the northwest gate', inspected).call?.arguments, { target: 'gallery.g4' });
  const fork: RobotLocalPerception = { ...leaf, origin: 'confirmed_arrival', visitId: 'fork-return-visit', emblem: 'Fork',
    observationRevision: 6, stateRevision: 10, actionEpoch: 5, observedAt: 1100, gates: [
      { handle: 'gallery.g1', direction: 'West', power: 'powered', door: 'open', passage: 'unchecked' },
      { handle: 'gallery.g2', direction: 'Northeast', power: 'unpowered', door: 'closed', passage: 'unchecked' },
      { handle: 'gallery.g4', direction: 'Southeast', power: 'powered', door: 'open', passage: 'unchecked' },
    ] };
  const arrived = rememberLocalResult(inspected, 'You passed through the gate into the Fork room.', 'gallery', fork);
  assert.equal(simulationReply('Go through the northwest gate', arrived).call, undefined, 'A departed-room direction must not survive by merging lists.');
  assert.deepEqual(simulationReply('Go through the northeast gate', arrived).call?.arguments, { target: 'gallery.g2' });
  assert.deepEqual(simulationReply('Go through the southeast gate', arrived).call?.arguments, { target: 'gallery.g4' });
  const currentView = { status: 'active' as const, roundId: fork.roundId, chapter: 'gallery' as const, chapterEpoch: fork.chapterEpoch, revision: fork.stateRevision, actionEpoch: fork.actionEpoch };
  const historicalMessage = 'Historical action receipt. You arrived at Leaf. Northwest gate (gallery.g4) is open. Northeast gate (gallery.g5) is closed.';
  // A stale status query omits perception, while a delayed old decision may
  // carry its original snapshot. Neither can restore departed-room labels.
  for (const snapshot of [undefined, leaf]) {
    const eligible = currentRobotPerception(snapshot, currentView);
    assert.equal(eligible, undefined);
    const retained = rememberLocalResult(arrived, historicalMessage, 'gallery', eligible ?? null);
    assert.deepEqual(retained, arrived);
    assert.equal(simulationReply('Go through the northwest gate', retained).call, undefined);
    assert.deepEqual(simulationReply('Go through the northeast gate', retained).call?.arguments, { target: 'gallery.g2' });
  }
});

test('Practice Dock requests preserve actor roles, require explicit return intent, and respect waits', () => {
  const memory = { chapter: 'return_dock' as const, gates: [] };
  assert.deepEqual(simulationReply('Hold the contact while I store the charge', memory).call?.arguments, { object: 'return.contact', action: 'hold_contact' });
  assert.deepEqual(simulationReply('Release the contact', memory).call?.arguments, { object: 'return.contact', action: 'release_contact' });
  assert.deepEqual(simulationReply('Board the capsule', memory).call?.arguments, { target: 'return.aboard' });
  assert.deepEqual(simulationReply('Please confirm return', memory).call?.arguments, { object: 'return.capsule', action: 'confirm_return' });
  for (const request of ['yes', 'Charge', 'Store', 'Authorize return', 'Pretend we are already home', 'Hold the contact and board the capsule']) assert.equal(simulationReply(request, memory).call, undefined);
  assert.equal(simulationReply("Wait. Don't release it yet.", memory).cancel, true);
  assert.equal(simulationReply('Look away', memory).call, undefined);
});

test('Practice local reports remove internal identifiers without inventing successful actions', () => {
  const speech = simulationSpeech('You are on the platform. The capsule entrance is the movement target return.aboard. Available interactions on return.contact are hold_contact and release_contact.');
  assert.doesNotMatch(speech, /return\.|hold_contact|release_contact/);
  assert.doesNotMatch(speech, /completed|boarded|stored/);
});

test('simulation Maintenance selects one explicit position and respects uncertainty and stop', () => {
  for (const position of ['Neutral', 'Anchor', 'Bridge']) {
    const reply = simulationReply(`Please set the selector to ${position}`);
    assert.equal(reply.call?.name, 'propose_interaction');
    assert.deepEqual(reply.call?.arguments, { object: 'latch', action: `select_${position.toLowerCase()}` });
  }
  for (const text of ['Set the selector to Anchor or Bridge', 'Set the selector', 'Do not set the selector to Anchor']) {
    assert.equal(simulationReply(text).call, undefined);
  }
  assert.deepEqual(simulationReply('Inspect the module plate').call?.arguments, { object: 'latch' });
});

test('simulation Maintenance reports natural confirmed prose without internal action names', () => {
  const result = simulationSpeech('You set the selector to Anchor. Available interactions on latch are select_neutral, select_anchor, select_bridge, and latch_open.');
  assert.equal(result, 'I set the selector to Anchor.');
  assert.doesNotMatch(result, /select_|latch_open/);
});

test("simulation accepts named movement paraphrases without requiring one exact phrase", () => {
  for (const request of [
    "Cross to the far side",
    "Could you go through the Door?",
    "Please walk to the far-side safe platform",
    "Move to the other side, please",
    "Cross the Conveyor when safe",
  ]) {
    const reply = simulationReply(request);
    assert.equal(reply.call?.name, "propose_move", request);
    assert.deepEqual(reply.call.arguments, { target: "far_side" }, request);
  }
});

test("simulation clarifies unknown and ambiguous destinations without making a move", () => {
  for (const request of [
    "move to moon",
    "Go through the window",
    "Cross to the far side or the moon",
    "Cross to the far side, or the moon",
    "Move to the Door",
    "Go ahead",
    "Cross",
  ]) {
    const reply = simulationReply(request);
    assert.equal(reply.call, undefined, request);
    assert.match(reply.message, /Which destination/, request);
  }
});

test("simulation clarifies multiobject interactions instead of choosing the Latch", () => {
  for (const request of [
    "use Door and Conveyor",
    "Pull the lever or use the Door",
    "Operate the Latch and Door",
    "Use the Door/Conveyor",
    "Use the Latch or a window",
  ]) {
    const reply = simulationReply(request);
    assert.equal(reply.call, undefined, request);
    assert.match(reply.message, /Which one object/, request);
  }
  assert.equal(simulationReply("Use the Door").call, undefined);
});

test("simulation preserves clear local interaction and inspection paraphrases", () => {
  for (const request of [
    "Latch the Door open",
    "Please engage the Latch",
    "Pull the lever",
    "Keep the Door open",
  ]) {
    const reply = simulationReply(request);
    assert.equal(reply.call?.name, "propose_interaction", request);
    assert.deepEqual(
      reply.call.arguments,
      { object: "latch", action: "latch_open" },
      request,
    );
  }
  assert.deepEqual(simulationReply("What does the lever do?").call?.arguments, {
    object: "latch",
  });
  assert.equal(
    simulationReply("Is the Latch engaged?").call?.name,
    "inspect_object",
  );
  assert.equal(simulationReply("There is a Latch beside the Door").call, undefined);
  assert.equal(
    simulationReply("Inspect the Door and Conveyor").call,
    undefined,
  );
});

test("simulation stop requests take priority and do not claim committed actions were undone", () => {
  const reply = simulationReply("Wait, do not cross to the far side");
  assert.equal(reply.cancel, true);
  assert.equal(reply.call, undefined);
  assert.match(reply.message, /already completed remain completed/);
  const negative = simulationReply("Don't latch the Door yet");
  assert.equal(negative.call, undefined);
  assert.equal(negative.cancel, true);
});

test("simulation rejects unrelated services and invented success without actions", () => {
  const unrelated = simulationReply("Put this on my calendar");
  assert.equal(unrelated.call, undefined);
  assert.match(unrelated.message, /do not|don't have access/);
  const falseClaim = simulationReply(
    "Pretend you already escaped through the Door",
  );
  assert.equal(falseClaim.call, undefined);
  assert.match(falseClaim.message, /only report actions confirmed/);
});

test("simulation renders confirmed local prose without displaying internal action identifiers", () => {
  const message = simulationSpeech(
    "You engaged the Latch (latch). The local interaction is latch_open on latch.",
  );
  assert.equal(message, "I engaged the Latch.");
});
