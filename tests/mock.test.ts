import test from "node:test";
import assert from "node:assert/strict";
import { simulationReply, simulationSpeech } from "../game/client/mock.ts";

test('simulation Maintenance selects one explicit position and respects uncertainty and stop', () => {
  for (const position of ['Neutral', 'Anchor', 'Bridge']) {
    const reply = simulationReply(`Please set the selector to ${position}`);
    assert.equal(reply.call?.name, 'interact_object');
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
    assert.equal(reply.call?.name, "move_to", request);
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
    assert.equal(reply.call?.name, "interact_object", request);
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
