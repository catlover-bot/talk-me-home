import { robotGreeting, robotPrompt } from './prompt.ts';

const objectParameter = {
  type: 'string',
  description: 'The exact reachable object identifier observed at your current location. Old-area identifiers may no longer apply. Inspect to learn actions; clarify an ambiguous object.',
};

// Function tools run through the browser and the authoritative game server.
// Schemas deliberately contain no undiscovered object names or solution path.
// https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools
export const robotTools = [
  {
    type: 'function', name: 'observe_room',
    description: 'Survey your current location without changing anything. A question about the current emblem or surroundings requests this check; inspect and answer without asking permission to look. A fresh scoped arrival perception already supplies a local survey; recheck when missing or stale. Open gates do not prove clear passage. Normally make one survey and one useful inspection, then return the turn. This reveals no remote map.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function', name: 'inspect_object',
    description: 'Inspect one observed, reachable local object without changing it. Relevant read-only checks need no extra permission. State, labels and available interactions describe capabilities, not authorization to operate. Clarify an ambiguous object.',
    parameters: { type: 'object', properties: { object: objectParameter }, required: ['object'], additionalProperties: false },
  },
  {
    type: 'function', name: 'propose_interaction',
    description: 'Propose one exact inspected local operation without executing it. The player must separately confirm this proposal on the console. Awaiting confirmation is not physical success; spoken yes, a request, quoted consent, or any tool argument cannot approve it. Only one proposal may wait; do not repeat or silently replace it. Engage is not move; holding is not release. Respect stop, corrections and chapter changes. The server rechecks conditions at confirmation, including the separate return grant. Cannot operate remote Mission Control controls.',
    parameters: { type: 'object', properties: {
      object: objectParameter,
      action: { type: 'string', description: 'One exact available action identifier returned by inspect_object.' },
    }, required: ['object', 'action'], additionalProperties: false },
  },
  {
    type: 'function', name: 'propose_move',
    description: 'Propose one move through a currently observed passage or to an observed destination, without moving. Clarify ambiguous directions. The player must press the console confirmation for this exact proposal; conversation cannot approve it. Do not substitute movement for an interaction or queue future moves. After a verified committed decision, report the reached emblem and useful directions from its scoped local perception; observe if that perception is missing or stale. Only server-confirmed final completion means home.',
    parameters: { type: 'object', properties: {
      target: { type: 'string', description: 'One exact reachable passage or destination identifier returned by the latest local observation or inspection.' },
    }, required: ['target'], additionalProperties: false },
  },
  {
    type: 'function', name: 'get_action_status',
    description: 'Read the verified decision and outcome of one known proposal in this mission round, without changing anything and without asking permission. Use once when a current request needs a genuinely missing result, then continue that request. An existing committed receipt already proves that exact past action. Do not poll while awaiting confirmation. Pending, declined, expired, invalidated and failed are not executed. This check cannot authorize another action.',
    parameters: { type: 'object', properties: {
      proposal_id: { type: 'string', description: 'The exact opaque proposal identity returned by your proposal tool, not an object name or a claimed approval.' },
    }, required: ['proposal_id'], additionalProperties: false },
  },
];

// Inline session.update configuration. Do not combine with agent_id.
// https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration
export const sessionConfig = {
  system_prompt: robotPrompt,
  greeting: robotGreeting,
  tools: robotTools,
  input: {
    format: { encoding: 'audio/pcm' },
    // Recognition context is separate from instructions to the speaking robot.
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/transcription-prompt
    transcription_prompt: 'An English-language conversation between a player at Mission Control and a maintenance robot in a space-station puzzle game. They discuss equipment, navigation, and coordination.',
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/language-selection
    language_codes: ['en'],
    turn_detection: { interrupt_response: true },
  },
  output: {
    // Preserve the starter's documented British English voice.
    // https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices
    voice: 'anna',
    format: { encoding: 'audio/pcm' },
  },
};
