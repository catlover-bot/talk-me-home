import { robotGreeting, robotPrompt } from './prompt.ts';

const objectParameter = {
  type: 'string',
  description: 'The exact local object identifier returned by observe_room. Inspect to learn its available actions. Ask the player if their intended object is ambiguous.',
};

// Function tools run through the browser and the authoritative game server.
// Schemas deliberately contain no undiscovered object names or solution path.
// https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools
export const robotTools = [
  {
    type: 'function', name: 'observe_room',
    description: 'Observe your current location. Use before describing local facts, or when equipment may have changed. Returns only what you can currently observe.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function', name: 'inspect_object',
    description: 'Inspect one observed, reachable local object. Use to learn its current state and available interactions. Do not guess an ambiguous object.',
    parameters: { type: 'object', properties: { object: objectParameter }, required: ['object'], additionalProperties: false },
  },
  {
    type: 'function', name: 'interact_object',
    description: 'Attempt one local interaction learned by inspection. A successful server result is required before saying you acted. This cannot operate remote Mission Control equipment.',
    parameters: { type: 'object', properties: {
      object: objectParameter,
      action: { type: 'string', description: 'One exact available action identifier returned by inspect_object.' },
    }, required: ['object', 'action'], additionalProperties: false },
  },
  {
    type: 'function', name: 'move_to',
    description: 'Attempt a move to one destination returned by observation. Current traversal conditions are checked by the server. Never claim arrival before a successful result.',
    parameters: { type: 'object', properties: {
      target: { type: 'string', description: 'One exact destination identifier returned by observe_room or inspect_object.' },
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
