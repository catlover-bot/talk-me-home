import type { RobotCall } from "./api";
import { requestId } from "./api";
import type { Chapter, RobotLocalPerception, ToolResult } from '../shared/contracts';

/** Practice retains only labels in validated local reports, never the human route map. */
export interface PracticeMemory { chapter: Chapter; gates: { id: string; label: string }[]; proposalId?: string }
export function rememberLocalResult(memory: PracticeMemory, message: string, chapter: Chapter, perception?: RobotLocalPerception | null): PracticeMemory {
  // Null means a current result did not carry an eligible local observation.
  // Omission retains the legacy text path used for explicitly historical recap.
  if (chapter === 'gallery' && perception === null) return memory;
  // The caller admits only perception matching the current view. Even a focused
  // inspection contains the complete local set; replace it, never merge visits.
  const gates = perception && chapter === 'gallery'
    ? perception.gates.map(gate => ({ label: gate.direction.toLowerCase(), id: gate.handle }))
    : [...message.matchAll(/\b(Northeast|Northwest|Southeast|Southwest|East|West|North|South) gate \((gallery\.g[1-5])\)/gi)]
      .map(match => ({ label: match[1]!.toLowerCase(), id: match[2]! }));
  return { chapter, gates: perception && chapter === 'gallery' || gates.length ? gates : memory.chapter === chapter ? memory.gates : [],
    ...(memory.chapter === chapter && memory.proposalId ? { proposalId: memory.proposalId } : {}) };
}

export interface MockReply {
  message: string;
  call?: RobotCall;
  cancel?: boolean;
}

/** Practice authors its own dialogue; real provider transcripts are never rewritten. */
export function simulationToolSpeech(result: ToolResult): string {
  if (result.code === 'awaiting_confirmation' && result.proposal?.status === 'awaiting_confirmation') {
    return `I propose: ${result.proposal.label}. Please confirm on the console, or choose Not yet.`;
  }
  return simulationSpeech(result.message);
}

/** An explicit API-free test driver. It never decides whether a game action succeeds. */
export function simulationReply(raw: string, memory?: PracticeMemory): MockReply {
  const text = raw.toLowerCase().trim();
  const call = (
    name: string,
    args: Record<string, string> = {},
  ): MockReply => ({
    message: "",
    call: { callId: requestId(), name, arguments: args },
  });
  if (/\b(?:proposal|action status)\b/.test(text) && /\b(?:status|check|happened|result)\b/.test(text)) {
    return memory?.proposalId ? call('get_action_status', { proposal_id: memory.proposalId })
      : { message: 'I do not have a proposal to check yet. Tell me which local action you want to propose.' };
  }
  if (
    /\b(stop|wait|pause|hold on|cancel)\b/.test(text) ||
    /\b(do not|don't|never)\b.*\b(latch|move|cross|go|pull|engage|use|operate|hold|keep|set|select|release|board|return|confirm)\b/.test(
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
  if (/\blook away\b/.test(text)) return { message: 'Do you want me to look around, or wait? I will keep your words as they were received.' };
  if (memory?.chapter === 'gallery') {
    if (/\b(beacon|harbor|relay|circuit)\b/.test(text) && /\b(switch|set|select|said|turn)\b/.test(text)) return { message: 'Mission Control owns the Relay. Tell me which local gate to check after you set the circuit.' };
    if (/\b(gate|move|go|head|walk|take|cross|backtrack|return)\b/.test(text) && !/\b(see|around|where|describe|observe|surroundings)\b/.test(text)) {
      const normalized = text.replace(/north[ -]east/g, 'northeast').replace(/north[ -]west/g, 'northwest').replace(/south[ -]east/g, 'southeast').replace(/south[ -]west/g, 'southwest');
      const matches = memory.gates.filter(gate => new RegExp(`\\b${gate.label}\\b`).test(normalized) || normalized.includes(gate.id));
      if (matches.length !== 1 || /\b(and|or|then)\b/.test(normalized)) return { message: 'Which gate do you mean? Use one compass label from my local report. I can look around again if needed.' };
      if (/\b(inspect|examine|check|look at)\b/.test(text)) return call('inspect_gate', { direction: matches[0]!.label });
      return call('propose_move', { target: matches[0]!.id });
    }
  }
  if (memory?.chapter === 'return_dock') {
    const localIntents = [/\b(hold|press)\b.*\bcontact\b/, /\b(release|let go)\b/, /\b(board|enter|step into)\b/, /\bconfirm\b.*\breturn\b/].filter(pattern => pattern.test(text));
    if (localIntents.length > 1 && /\b(and|or|then)\b/.test(text)) return { message: 'Which local action should I do first? I will take one step at a time.' };
    if (/\b(inspect|examine|check|look at|tell me about|how does)\b/.test(text)) {
      const contact = /\b(contact|plaque)\b/.test(text), capsule = /\b(capsule|aboard|return)\b/.test(text);
      if (contact && capsule) return { message: 'Should I inspect the contact or the capsule first?' };
      if (contact || capsule) return call('inspect_object', { object: contact ? 'return.contact' : 'return.capsule' });
    }
    if (/\b(release|let go)\b/.test(text) && /\b(contact|it)\b/.test(text)) return call('propose_interaction', { object: 'return.contact', action: 'release_contact' });
    if (/\b(hold|keep|press)\b/.test(text) && /\bcontact\b/.test(text)) return call('propose_interaction', { object: 'return.contact', action: 'hold_contact' });
    if (/\b(board|aboard|enter|step into)\b/.test(text) && /\b(capsule|aboard)\b/.test(text)) return call('propose_move', { target: 'return.aboard' });
    if (/\b(confirm|begin|make)\b.*\breturn\b/.test(text) || /\b(return|go|come) home\b/.test(text)) return call('propose_interaction', { object: 'return.capsule', action: 'confirm_return' });
    if (/\b(charge|store|authorize|revoke)\b/.test(text) && !/\b(see|observe|around)\b/.test(text)) return { message: 'The remote charge controller belongs to Mission Control. I can inspect or operate the local contact and capsule.' };
    if (/^yes[.! ]*$/.test(text)) return { message: 'Please tell me the next local action. A general yes does not confirm the return.' };
  }
  if (/\b(set|select|choose|turn|put)\b/.test(text) && /\b(selector|neutral|anchor|bridge)\b/.test(text)) {
    const positions = ['neutral', 'anchor', 'bridge'].filter(position => new RegExp(`\\b${position}\\b`).test(text));
    if (positions.length !== 1 || /\b(and|or|then)\b/.test(text))
      return { message: 'Which one selector position should I use?' };
    return call('propose_interaction', { object: 'latch', action: `select_${positions[0]}` });
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
      return call("propose_interaction", { object: "latch", action: "latch_open" });
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
        return call("propose_move", { target: "far_side" });
    } else if (
      /\bcross (?:the )?conveyor(?:\s+(?:please|now|when safe))?[.!?]*$/.test(
        text,
      )
    ) {
      return call("propose_move", { target: "far_side" });
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
    .replace(/ \((?:gallery\.g[1-5]|return\.(?:contact|capsule|aboard))\)/g, '')
    .replace(/\b(?:Target|Available (?:action|interaction|movement)s?|Local (?:action|interaction|movement))[^.]*?(?:return\.[a-z_]+|hold_contact|release_contact|confirm_return)[^.]*\./g, '')
    .replace(/ Available interactions? on return\.(?:contact|capsule) (?:are|is) [^.]*\./g, '')
    .replace(' The capsule entrance is the movement target return.aboard.', ' The capsule entrance is within reach.')
    .replace('The capsule entrance is reachable at return.aboard.', 'The capsule entrance is within reach.')
    .replace(' Inspect a reachable gate to check the opening. Use its exact observed gate identifier as a movement target.', ' I can inspect a reachable gate to check the opening.')
    .replace(' You cannot see Mission Control\'s route map.', '')
    .replace(' Inspect the local plaques to learn the available actions.', '')
    .replace(' It is a reachable movement target.', '')
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
    .replace(/\bYou (held|released|boarded|returned|moved|entered|passed|confirmed)\b/g, 'I $1')
    .replace(/\byou remain\b/g, "I remain")
    .replace(/\bYou remain\b/g, "I remain")
    .replace(/\byour safe platform\b/g, "my safe platform")
    .replace(/\byour platform\b/g, "my platform")
    .replace(/\byour current platform\b/g, "my current platform");
}
