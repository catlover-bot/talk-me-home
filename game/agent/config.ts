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
    description: 'Survey your current location without changing anything. Use before describing unfamiliar surroundings or after relevant changes. Normally make one survey and one useful inspection, then return the turn. This reveals no remote map.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function', name: 'inspect_object',
    description: 'Inspect one observed, reachable local object. Check relevant details without unnecessary permission questions. Learn its current state, labels, and available interactions. Do not guess an ambiguous object.',
    parameters: { type: 'object', properties: { object: objectParameter }, required: ['object'], additionalProperties: false },
  },
  {
    type: 'function', name: 'interact_object',
    description: 'Attempt one inspected local action following clear player intent or an agreed plan. Do not ask permission twice or guess an uncertain setting. Act sequentially and await a valid result. This cannot operate remote Mission Control controls.',
    parameters: { type: 'object', properties: {
      object: objectParameter,
      action: { type: 'string', description: 'One exact available action identifier returned by inspect_object.' },
    }, required: ['object', 'action'], additionalProperties: false },
  },
  {
    type: 'function', name: 'move_to',
    description: 'Attempt one move through a currently observed passage or to an observed destination, following the player\'s intent. Clarify ambiguous directions. The server checks current traversal conditions. A successful move can reach a new area without completing the mission; observe there before another move.',
    parameters: { type: 'object', properties: {
      target: { type: 'string', description: 'One exact reachable passage or destination identifier returned by the latest local observation or inspection.' },
    }, required: ['target'], additionalProperties: false },
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
