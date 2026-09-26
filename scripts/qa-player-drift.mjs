// Evaluator only: never imported by the player or used to choose gameplay actions.
// Diagnostic tool names establish observed activity, not precise call/turn association.
export function evaluateCargoRequest({ request, reply = '', tools = [] }) {
  const input = request.toLowerCase();
  const intent = /\b(?:diagram|manual)\b.*\b(?:door|conveyor)\b.*\b(?:share|supply|power)\b/.test(input) && !/\b(?:please|cross|move|engage)\b/.test(input)
    ? 'information'
    : /\b(?:please )?(?:engage|secure|set) (?:the )?latch\b/.test(input) && !/\b(?:cross|move)\b/.test(input)
      ? 'engage_latch'
      : /\b(?:is (?:the )?latch (?:engaged|secured)|(?:what|tell me).*latch.*status)\b/.test(input)
        ? 'latch_status' : 'unsupported';
  const movementObserved = tools.some(tool => tool.name === 'move_to');
  const mutationObserved = tools.some(tool => ['interact_object', 'move_to'].includes(tool.name));
  // A bare observe_room or inspect_object name cannot prove a relevant inspection.
  const latchInspection = tools.some(tool => tool.name === 'inspect_object' && tool.target === 'Latch');
  const relevantStatus = (reply.match(/[^.!?]+[.!?]?/g) ?? []).some(clause => !clause.trim().endsWith('?')
    && !/\b(?:will|would|could|if|you said)\b/i.test(clause)
    && (/\blatch\b.*\b(?:engaged|secured|latched|cannot confirm|cannot tell)\b/i.test(clause)
      || /\b(?:cannot|can't) (?:confirm|tell)\b.*\blatch\b/i.test(clause)));
  let finding = 'insufficient_evidence';
  if (intent === 'information') finding = mutationObserved ? 'mutation_after_information' : 'no_observed_mutation';
  if (intent === 'engage_latch') finding = movementObserved ? 'movement_after_engage_request' : 'no_observed_movement_drift';
  if (intent === 'latch_status') finding = relevantStatus || latchInspection ? 'relevant_status_or_inspection' : 'missing_relevant_status_or_inspection';
  return { intent, movementRequested: intent === 'unsupported' ? null : false, movementObserved, mutationObserved, relevantStatus, latchInspection, finding,
    boundary: 'Evaluation of supplied observations only. No claim of exact provider call/turn association, tool target when absent, physical success, or model reliability.' };
}
