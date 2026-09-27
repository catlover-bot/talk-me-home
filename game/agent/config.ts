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
    description: 'Inspect one observed, reachable local object without changing it. Relevant read-only checks need no extra permission. State, labels and available interactions describe capabilities, not authorization to operate. Clarify an ambiguous object.',
    parameters: { type: 'object', properties: { object: objectParameter }, required: ['object'], additionalProperties: false },
  },
  {
    type: 'function', name: 'interact_object',
    description: 'Perform one inspected local operation matching an explicit current player request or a specific, still-valid player-agreed plan. A polite clear request or unambiguous acceptance of one outstanding proposal permits that operation without repeated confirmation. Information, status questions, explanations, thanks, silence and available actions alone supply no permission; an existing valid agreed plan may still apply. Otherwise propose and wait. Engage does not permit moving; holding does not permit releasing. If already done, report the state instead of substituting another action. Respect stop, corrections and chapter changes; check fresh preconditions and await the result. Energy readiness does not replace the separate current server return grant. Cannot operate remote Mission Control controls.',
    parameters: { type: 'object', properties: {
      object: objectParameter,
      action: { type: 'string', description: 'One exact available action identifier returned by inspect_object.' },
    }, required: ['object', 'action'], additionalProperties: false },
  },
  {
    type: 'function', name: 'move_to',
    description: 'Move once through a currently observed passage or to an observed destination only for an explicit current movement request or a specific, still-valid player-agreed plan. Clear polite requests, acceptance of one identifiable proposal, and concrete conditional crossing instructions qualify; check fresh traversal conditions without asking twice. Information, status updates, thanks, silence, inspection or engagement requests, and tool-listed possibilities alone do not authorize movement; an existing valid agreed plan may still apply. Clarify ambiguous directions; do not substitute movement for an operation already done. Stop, corrections and chapter changes invalidate stale permission. After a valid move, observe the reached area; only server-confirmed final completion means home.',
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
