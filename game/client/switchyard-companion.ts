import type { ToolResult } from '../shared/contracts';
import type { SwitchyardApproach, SwitchyardLocalObservation } from '../shared/switchyard';
import { requestId, type RobotCall } from './api';

export const SWITCHYARD_REACTIONS = {
  introduction: 'I can report the equipment within reach. Your drawing supplies the circuit rules I cannot see.',
  first_shared_success: 'The transfer table holds its new alignment. We have a useful step to build on.',
  plan_revision: 'We can change the plan. Completed work stays completed; I will check the new approach locally.',
  recoverable_experiment: 'That action did not go through. We can revise the setup without starting the mission again.',
  lift_test: 'The lift test gives us a local result to compare with your circuit note.',
  bypass_ready: 'The service bridge is deployed. I can check the crossing from here.',
  lift_home: 'The direct lift brought us home. The setup we checked made that short route possible.',
  bypass_home: 'The maintenance bypass brought us home. We made the longer route work together.',
} as const;
type Reaction = keyof typeof SWITCHYARD_REACTIONS;

/** Only communicated robot reports and explicit player discussion; no panel or hidden state. */
export interface SwitchyardCompanionMemory {
  observation?: SwitchyardLocalObservation;
  lastReport?: string;
  knownApproaches: SwitchyardApproach[];
  discussedApproach?: SwitchyardApproach;
  reactions: Reaction[];
}
export interface SwitchyardIntentChoice {
  id: string;
  label: string;
  request: string;
  kind: 'question' | 'discussion' | 'action';
}
export interface SwitchyardReply {
  message: string;
  call?: RobotCall;
  cancel?: boolean;
  memory?: SwitchyardCompanionMemory;
}
const emptyMemory = (): SwitchyardCompanionMemory => ({ knownApproaches: [], reactions: [] });
const normalize = (text: string) => text.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const requestText = (text: string) => normalize(text).replace(/^pip[, ]+/, '').replace(/^(?:please|could you|can you|would you) /, '');
const names = (label: string) => { const plain = normalize(label).replace(/^the /, ''); return [plain, `the ${plain}`]; };
const planLabels: Record<SwitchyardApproach, string> = { lift: 'direct lift', bypass: 'maintenance bypass' };
const tool = (name: string, args: Record<string, string> = {}): SwitchyardReply => ({ message: '', call: { callId: requestId(), name, arguments: args } });
const movementLabel = (label: string) => /^(?:go to|return to|ride|cross)\b/i.test(label) ? label : `Go to ${label}`;
function movementRequests(label: string): string[] {
  const exact = normalize(movementLabel(label));
  const destination = exact.replace(/^(?:go to|return to) /, '');
  return destination === exact ? [exact] : [exact, ...names(destination).flatMap(name => [`go to ${name}`, `move to ${name}`, `walk to ${name}`, `return to ${name}`])];
}

/** Payload fields alone cannot disclose targets: their labels must also be in the report. */
function communicatedObservation(observation: SwitchyardLocalObservation, message: string): SwitchyardLocalObservation | undefined {
  const words = (value: string) => normalize(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const report = ` ${words(message)} `;
  const disclosed = (label: string) => Boolean(words(label)) && report.includes(` ${words(label)} `);
  if (!observation.visitId || !disclosed(observation.location.label)) return undefined;
  return {
    visitId: observation.visitId, stateRevision: observation.stateRevision, location: { ...observation.location },
    devices: observation.devices.filter(device => disclosed(device.label)).map(device => ({ id: device.id, label: device.label,
      ...(device.actions ? { actions: device.actions.filter(action => disclosed(action.label)).map(action => ({ ...action })) } : {}) })),
    exits: observation.exits.filter(exit => disclosed(exit.label)).map(exit => ({ ...exit })),
  };
}

function reactionForResult(memory: SwitchyardCompanionMemory, result: ToolResult): Reaction | undefined {
  if (/^historical\b/i.test(result.message)) return undefined;
  let reaction: Reaction | undefined;
  const action = result.proposal?.status === 'committed' && result.ok ? result.proposal.action : undefined;
  if (action?.kind === 'interaction') {
    if (action.object === 'switchyard.return' && action.action === 'depart') {
      const report = normalize(result.message);
      if (report.includes('direct lift')) reaction = 'lift_home';
      else if (report.includes('maintenance bypass')) reaction = 'bypass_home';
    } else if (action.object === 'switchyard.turntable' && action.action === 'align_turntable') reaction = 'first_shared_success';
    else if (action.object === 'switchyard.lift' && action.action === 'test_lift') reaction = 'lift_test';
    else if (action.object === 'switchyard.winch' && action.action === 'deploy_bridge') reaction = 'bypass_ready';
  }
  if (!reaction && !result.ok && result.code === 'precondition_failed') reaction = 'recoverable_experiment';
  if (!reaction && result.switchyardObservation && communicatedObservation(result.switchyardObservation, result.message)) reaction = 'introduction';
  return reaction && !memory.reactions.includes(reaction) ? reaction : undefined;
}

/** Local authored narration only; never substitute this for raw provider speech. */
export function switchyardReaction(memory: SwitchyardCompanionMemory | undefined, result: ToolResult): string | undefined {
  const reaction = reactionForResult(memory ?? emptyMemory(), result);
  return reaction ? SWITCHYARD_REACTIONS[reaction] : undefined;
}

/** Call only after this eligible result has actually been communicated to the player. */
export function rememberSwitchyardReport(previous: SwitchyardCompanionMemory | undefined, result: ToolResult): SwitchyardCompanionMemory {
  const memory = previous ?? emptyMemory();
  const observation = result.switchyardObservation && communicatedObservation(result.switchyardObservation, result.message);
  const moved = result.ok && result.proposal?.status === 'committed' && result.proposal.action.kind === 'move';
  const changedVisit = result.switchyardObservation && result.switchyardObservation.visitId !== memory.observation?.visitId;
  const reaction = reactionForResult(memory, result);
  const report = normalize(result.message);
  const learnedPlans = (Object.keys(planLabels) as SwitchyardApproach[]).filter(plan => report.includes(planLabels[plan]));
  return { ...memory, lastReport: result.message, observation: observation || (moved || changedVisit ? undefined : memory.observation),
    knownApproaches: [...new Set([...memory.knownApproaches, ...learnedPlans])],
    reactions: reaction ? [...memory.reactions, reaction] : [...memory.reactions] };
}

export function forgetSwitchyardVisit(memory: SwitchyardCompanionMemory | undefined): SwitchyardCompanionMemory {
  return { ...(memory ?? emptyMemory()), observation: undefined };
}

export function localSwitchyardIntentChoices(memory: SwitchyardCompanionMemory | undefined): SwitchyardIntentChoice[] {
  const choices: SwitchyardIntentChoice[] = [{ id: 'surroundings', label: 'Look around', request: 'Please look around.', kind: 'question' }];
  const observation = memory?.observation;
  for (const device of observation?.devices ?? []) {
    choices.push({ id: `inspect:${device.id}`, label: `Inspect ${device.label}`, request: `Please inspect ${device.label}.`, kind: 'question' });
    for (const action of device.actions ?? []) choices.push({ id: `action:${device.id}:${action.action}`, label: action.label,
      request: `Please ${action.label} on ${device.label}.`, kind: 'action' });
  }
  for (const exit of observation?.exits ?? []) choices.push({ id: `move:${exit.target}`, label: movementLabel(exit.label), request: `Please ${movementLabel(exit.label)}.`, kind: 'action' });
  for (const plan of memory?.knownApproaches ?? []) choices.push({ id: `discuss:${plan}`, label: `Discuss the ${planLabels[plan]}`, request: `Let's discuss the ${planLabels[plan]}.`, kind: 'discussion' });
  return choices;
}

/** A finite intent grammar over observed labels, not a general language model or solver. */
export function switchyardReply(raw: string, previous?: SwitchyardCompanionMemory, proposalId?: string): SwitchyardReply {
  const memory = previous ?? emptyMemory(); const text = requestText(raw);
  if (['wait', 'stop', 'pause', 'cancel', 'hold on'].includes(text) || text.startsWith('do not ') || text.startsWith("don't ")) {
    return { message: 'I will wait. Completed work remains completed.', cancel: true };
  }
  if (['look around', 'observe the room', 'what can you see', 'what is nearby', 'where are you', 'describe your surroundings', 'report your surroundings'].includes(text)) return tool('observe_room');
  if (['repeat your last report', 'repeat your last report, noting if it may be out of date'].includes(text)) {
    return { message: memory.lastReport ? `Earlier local report, not a current reading: ${memory.lastReport}`
      : 'I have not made a local report yet. You can choose Look around.' };
  }
  if (['check the proposal status', 'check action status'].includes(text)) return proposalId ? tool('get_action_status', { proposal_id: proposalId })
    : { message: 'I do not have a proposal to check yet. I can look around.' };
  for (const plan of memory.knownApproaches) {
    if (![ `let's discuss the ${planLabels[plan]}`, `discuss the ${planLabels[plan]}`, `let's use the ${planLabels[plan]}`, `change the plan to the ${planLabels[plan]}` ].includes(text)) continue;
    const revised = memory.discussedApproach && memory.discussedApproach !== plan && !memory.reactions.includes('plan_revision');
    const message = revised ? SWITCHYARD_REACTIONS.plan_revision
      : `We can investigate the ${planLabels[plan]}. I can check its local equipment while you compare the reports with your drawing.`;
    return { message, memory: { ...memory, discussedApproach: plan, reactions: revised ? [...memory.reactions, 'plan_revision'] : [...memory.reactions] } };
  }
  const observation = memory.observation;
  const candidates: { name: string; args: Record<string, string> }[] = [];
  for (const device of observation?.devices ?? []) {
    if (names(device.label).some(label => [`inspect ${label}`, `check ${label}`, `tell me about ${label}`, `what does ${label} show`].includes(text))) {
      candidates.push({ name: 'inspect_object', args: { object: device.id } });
    }
    for (const action of device.actions ?? []) {
      if (text === normalize(action.label) || names(device.label).some(label => text === `${normalize(action.label)} on ${label}`)) {
        candidates.push({ name: 'propose_interaction', args: { object: device.id, action: action.action } });
      }
    }
  }
  for (const exit of observation?.exits ?? []) {
    if (movementRequests(exit.label).includes(text)) {
      candidates.push({ name: 'propose_move', args: { target: exit.target } });
    }
  }
  if (candidates.length === 1) return tool(candidates[0]!.name, candidates[0]!.args);
  if (candidates.length > 1) return { message: 'That names more than one local operation. Choose one target and one action.' };
  return { message: observation ? 'Choose one request beside my report, or ask me to look around again. I will not substitute a different target.'
    : 'I need a fresh look before naming equipment or a route. You can choose Look around.' };
}
