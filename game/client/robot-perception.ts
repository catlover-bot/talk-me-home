import type { HumanView, RobotLocalPerception } from '../shared/contracts';

/** Robot transport projection only. Never feed this into the map or captions. */
export function currentRobotPerception(value: RobotLocalPerception | undefined, current: Partial<HumanView> | undefined): RobotLocalPerception | undefined {
  if (!value || !current || current.status !== 'active'
    || value.roundId !== current.roundId || value.chapter !== 'gallery' || current.chapter !== 'gallery'
    || value.chapterEpoch !== current.chapterEpoch || value.stateRevision !== current.revision
    || value.actionEpoch !== current.actionEpoch
    || !['local_survey', 'gate_inspection', 'confirmed_arrival'].includes(value.origin)
    || typeof value.visitId !== 'string' || !value.visitId || value.visitId.length > 150
    || !Number.isSafeInteger(value.observationRevision) || value.observationRevision < 0
    || !Number.isFinite(value.observedAt) || value.observedAt < 0
    || !['Ring', 'Fork', 'Sail', 'Leaf'].includes(value.emblem) || value.compass !== 'north'
    || !Array.isArray(value.gates) || value.gates.length > 4
    || value.gates.some(gate => !gate || typeof gate.handle !== 'string' || !gate.handle || gate.handle.length > 100
      || !/^(?:North|South|East|West|Northeast|Northwest|Southeast|Southwest)$/i.test(gate.direction)
      || !['powered', 'unpowered'].includes(gate.power) || !['open', 'closed'].includes(gate.door)
      || !['clear', 'blocked', 'unchecked'].includes(gate.passage))) return undefined;
  // Reconstruct rather than spread: private extras cannot ride through transport.
  return { origin: value.origin, roundId: value.roundId, chapter: value.chapter, chapterEpoch: value.chapterEpoch,
    visitId: value.visitId, observationRevision: value.observationRevision, stateRevision: value.stateRevision,
    actionEpoch: value.actionEpoch, observedAt: value.observedAt, emblem: value.emblem, compass: value.compass,
    gates: value.gates.map(gate => ({ handle: gate.handle, direction: gate.direction, power: gate.power, door: gate.door, passage: gate.passage })) };
}
