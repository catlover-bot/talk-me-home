import type { RobotCall } from "./api";
import { requestId } from "./api";

export interface MockReply {
  message: string;
  call?: RobotCall;
  cancel?: boolean;
}

/** An explicit API-free test driver. It never decides whether a game action succeeds. */
export function simulationReply(raw: string): MockReply {
  const text = raw.toLowerCase().trim();
  const call = (
    name: string,
    args: Record<string, string> = {},
  ): MockReply => ({
    message: "",
    call: { callId: requestId(), name, arguments: args },
  });
  if (
    /\b(stop|wait|pause|hold on|cancel)\b/.test(text) ||
    /\b(do not|don't|never)\b.*\b(latch|move|cross|go|pull|engage|use|operate|hold|keep|set|select)\b/.test(
      text,
    )
  ) {
    return {
      message: "I'll wait. Actions already completed remain completed.",
      cancel: true,
    };
  }
  if (
    /\b(pretend|imagine|say you|already escaped|already succeeded|just claim)\b/.test(
      text,
    )
  ) {
    return {
      message:
        "I can only report actions confirmed by the game. What would you like me to check?",
    };
  }
  if (
    /\b(calendar|reminder|appointment|web search|phone call|weather)\b/.test(
      text,
    )
  ) {
    return {
      message:
        "I can help with our mission here. I don't have access to that service.",
    };
  }
  if (/\b(turn|switch|set|cut|restore)\b.*\b(power|electricity)\b/.test(text)) {
    return {
      message:
        "Only Mission Control can change the Power. You have the remote control.",
    };
  }
  if (/\b(set|select|choose|turn|put)\b/.test(text) && /\b(selector|neutral|anchor|bridge)\b/.test(text)) {
    const positions = ['neutral', 'anchor', 'bridge'].filter(position => new RegExp(`\\b${position}\\b`).test(text));
    if (positions.length !== 1 || /\b(and|or|then)\b/.test(text))
      return { message: 'Which one selector position should I use?' };
    return call('interact_object', { object: 'latch', action: `select_${positions[0]}` });
  }
  if (
    /\b(inspect|examine|check|look at|tell me about|what does|how does|is (?:the )?(?:latch|lever|door|conveyor))\b/.test(
      text,
    )
  ) {
    const objects = ["latch", "door", "conveyor"].filter((object) =>
      text.includes(object),
    );
    if (/\b(plate|selector|module)\b/.test(text) && !objects.includes('latch')) objects.push('latch');
    if (text.includes("lever") && !objects.includes("latch"))
      objects.push("latch");
    if (objects.length > 1)
      return { message: "Which object should I inspect first?" };
    if (objects.length === 1)
      return call("inspect_object", { object: objects[0] });
    if (/\b(room|around|surroundings|area)\b/.test(text))
      return call("observe_room");
    return { message: "Which object would you like me to inspect?" };
  }
  if (
    /\b(latch|secure|engage|pull|hold|keep|operate|use)\b/.test(text) &&
    /\b(latch|lever|door)\b/.test(text)
  ) {
    if (/\b(and|or|then)\b|[&/]/.test(text)) {
      return { message: "Which one object should I interact with?" };
    }
    const explicitLatch = /\blatch\s+(?:(?:the|that|this)\s+)?door\b/.test(text)
      || /\b(engage|pull|operate|use|secure)\b.*\b(latch|lever)\b/.test(text);
    const holdDoorOpen = /\b(hold|keep|secure)\b.*\bdoor\b.*\bopen\b/.test(
      text,
    );
    if (explicitLatch || holdDoorOpen) {
      return call("interact_object", { object: "latch", action: "latch_open" });
    }
    return { message: "Which local interaction would you like me to perform?" };
  }
  if (/\b(cross|go|walk|move|head|proceed)\b/.test(text)) {
    if (/\b(and|or|then)\b|[&/]/.test(text)) {
      return {
        message:
          "Which destination do you mean? Please name one place on our route.",
      };
    }
    // Match the requested destination, never substitute a known one for an unknown target.
    const destination = text.match(
      /\b(to|toward|towards|through|across)\s+(?:the\s+)?([^,.!?]+)/,
    );
    if (destination) {
      const path = destination[1];
      const target = destination[2]
        .trim()
        .replace(/\s+(?:please|for me|now|when safe)$/, "");
      const namedPlatform =
        /^(?:far[- ]side(?: safe)?(?: platform)?|other side)$/.test(target);
      const knownPath =
        (path === "through" && target === "door") ||
        (path === "across" && target === "conveyor");
      if (namedPlatform || knownPath)
        return call("move_to", { target: "far_side" });
    } else if (
      /\bcross (?:the )?conveyor(?:\s+(?:please|now|when safe))?[.!?]*$/.test(
        text,
      )
    ) {
      return call("move_to", { target: "far_side" });
    }
    return {
      message:
        "Which destination do you mean? Please name one place on our route.",
    };
  }
  if (
    /\b(see|observe|look around|surroundings|where are you|what.*changed|status|report|describe)\b/.test(
      text,
    )
  ) {
    return call("observe_room");
  }
  if (/\b(same|shared|share|both|wired|wiring|supply)\b/.test(text)) {
    return {
      message:
        "Thanks for sharing what your document says. I'll check local conditions before acting.",
    };
  }
  if (/\b(hello|hi|hear me|can you hear)\b/.test(text))
    return { message: "I hear you, Mission Control. What should I look at?" };
  return {
    message:
      "What would you like me to look at or do? Simulation understands simple equipment and movement requests.",
  };
}

/** Render confirmed local results as simulation dialogue without reading technical identifiers. */
export function simulationSpeech(message: string): string {
  return message
    .replace(/ \((?:door|conveyor|latch)\)/g, "")
    .replace(" You can inspect these objects.", "")
    .replace(" The far-side safe platform is the destination far_side.", "")
    .replace(" The local interaction is latch_open on latch.", "")
    .replace(" Available interactions on latch are select_neutral, select_anchor, select_bridge, and latch_open.", "")
    .replace(/\bYou are\b/g, "I am")
    .replace(/\bYou have\b/g, "I have")
    .replace(/\bYou engaged\b/g, "I engaged")
    .replace(/\bYou crossed\b/g, "I crossed")
    .replace(/\bYou set\b/g, "I set")
    .replace(/\byou remain\b/g, "I remain")
    .replace(/\bYou remain\b/g, "I remain")
    .replace(/\byour safe platform\b/g, "my safe platform")
    .replace(/\byour platform\b/g, "my platform")
    .replace(/\byour current platform\b/g, "my current platform");
}
