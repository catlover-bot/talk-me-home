import { useEffect, useRef, useState } from 'react';
import { protectedLiveStopped, rememberProtectedLiveStop } from './release-stop';
import type { HumanView, MissionRecord, MissionKind, Scenario, TransportOrigin, InputMethod, Chapter, Relay, DockControl, HintLevel, CancelReason, RecordedMessage, ToolResult } from '../shared/contracts';
import * as api from './api';
import { LiveVoice, type TranscriptEntry, type VoiceInputState, type VoiceStatus } from './voice';
import { simulationReply, simulationToolSpeech, rememberLocalResult, rememberPracticeReport, forgetSwitchyardVisit, switchyardIntentChoices, type PracticeMemory } from './mock';
import { LocalEffects } from './effects';
import { copy } from './strings';
import { acceptsHumanViewSnapshot } from './view-order';
import { currentRobotPerception } from './robot-perception';
import { REMIX_CODE_PATTERN, type RemixAvailability, type RemixSetup } from '../shared/remix';
import { clearJourneyHistory, readJourneyHistory, saveJourneyHistory, SWITCHYARD_HISTORY_KEY, type JourneyEntry } from './switchyard-history';

export interface Caption extends TranscriptEntry {
  origin: TransportOrigin;
  inputMethod: InputMethod;
  roundId: string;
  segmentId: string;
  timestamp: number;
  saved: boolean;
  chapter: Chapter;
  chapterEpoch: number;
  /** Original communicated local report context, never refreshed by a panel edit. */
  switchyardContext?: SwitchyardCaptionContext;
  /** Public panel revision when this Practice robot message was displayed; not a local machinery observation. */
  switchyardPanelRevisionAtDisplay?: number;
}
export interface SwitchyardCaptionContext {
  visitId: string;
  stateRevision: number;
  panelRevision: number;
  locationLabel: string;
}
export interface SwitchyardCurrentVisit { roundId: string; visitId: string; locationLabel: string }

/** Attribute only an actual displayed Practice report, not inferred or raw provider speech. */
export function switchyardCaptionContext(result: ToolResult | undefined, view: HumanView | null, origin: TransportOrigin, message: string): SwitchyardCaptionContext | undefined {
  const observation = result?.switchyardObservation;
  if (origin !== 'practice' || !observation || !result.ok || view?.chapter !== 'switchyard' || view.status !== 'active'
    || observation.stateRevision !== view.revision || !view.switchyardPanel
    || /^(?:historical|earlier)\b/i.test(message)
    || !message.toLowerCase().includes(observation.location.label.toLowerCase())) return;
  return { visitId: observation.visitId, stateRevision: observation.stateRevision,
    panelRevision: view.switchyardPanel.panelRevision, locationLabel: observation.location.label };
}
export const originLabel: Record<TransportOrigin, string> = {
  practice: 'Practice', live_voice: 'Live Voice', live_text: 'Live Text', game: 'Game event',
};
type Segment = { id: string; origin: TransportOrigin };
const emptyRecord = (roundId: string): MissionRecord => ({ roundId, messages: [], notebook: [], hintsUsed: [], debrief: null });

/** Owns one mission checkpoint and at most one communication transport. */
export function useMission() {
  const [stage, setStage] = useState<'briefing' | 'mission' | 'debrief'>('briefing');
  const [scenario, setScenario] = useState<Scenario>('classic');
  const [missionKind, setMissionKind] = useState<MissionKind>('rescue');
  const [remixSetup, setRemixSetup] = useState<RemixSetup>();
  const [intendedApproach, setIntendedApproach] = useState<'lift' | 'bypass'>();
  const [journeys, setJourneys] = useState(readJourneyHistory);
  const journeyRounds = useRef(new Map<string, JourneyEntry>());
  const [dispatchAvailability, setDispatchAvailability] = useState<RemixAvailability | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchCheck, setDispatchCheck] = useState(0);
  const [optionalObjective, setOptionalObjective] = useState<HumanView['optionalObjective']>();
  const chooseMissionKind = (kind: MissionKind) => { setMissionKind(kind); setOptionalObjective(undefined); };
  const [mode, setMode] = useState<TransportOrigin>('practice');
  const [view, setView] = useState<HumanView | null>(null);
  const viewRef = useRef<HumanView | null>(null);
  const [record, setRecord] = useState<MissionRecord | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [switchyardCurrentVisit, setSwitchyardCurrentVisit] = useState<SwitchyardCurrentVisit | null>(null);
  const captionsRef = useRef<Caption[]>([]);
  const [segment, setSegment] = useState<Segment | null>(null);
  const segmentRef = useRef<Segment | null>(null);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [powerPending, setPowerPending] = useState<boolean | null>(null);
  const [controlPending, setControlPending] = useState<string | null>(null);
  const controlBusy = useRef(false);
  const [toolPending, setToolPending] = useState(false);
  const [proposalConfirming, setProposalConfirming] = useState<string | null>(null);
  const [proposalFailure, setProposalFailure] = useState<string | null>(null);
  const proposalDecisionBusy = useRef(false);
  const [status, setStatus] = useState<VoiceStatus>('ended');
  const [microphone, setMicrophone] = useState(false);
  const [inputState, setInputState] = useState<VoiceInputState>('inactive');
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [interrupted, setInterrupted] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [recapNotice, setRecapNotice] = useState('');
  const [hint, setHint] = useState('');
  const hintRequest = useRef(0);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [effectsVolume, setEffectsVolume] = useState(0);
  const [ambienceVolume, setAmbienceVolume] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [readinessMode, setReadinessMode] = useState<'live_voice' | 'live_text' | null>(null);
  const [providerAccountStopped, setProviderAccountStopped] = useState(protectedLiveStopped);
  const effects = useRef(new LocalEffects());
  const voice = useRef<LiveVoice | null>(null);
  const stopping = useRef<Promise<void> | null>(null);
  const generation = useRef(0);
  const lastCancellation = useRef<Pick<HumanView, 'roundId' | 'chapterEpoch' | 'actionEpoch'> | null>(null);
  const mockTurn = useRef(0);
  const mockAbort = useRef<AbortController | null>(null);
  const writes = useRef(new Set<Promise<unknown>>());
  const recordRequest = useRef(0);
  const closingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingGrace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingReplyDone = useRef(false);
  const completionRound = useRef('');
  const [seconds, setSeconds] = useState(0);
  const [connectionLimitSeconds, setConnectionLimitSeconds] = useState(600);
  const liveStarted = useRef(0);
  const practiceMemory = useRef<PracticeMemory>({ chapter: 'cargo', gates: [] });
  // Retain only transport scope, not a human location or navigation belief.
  // A missed arrival leaves an old visit which the server rejects, never retargets.
  const inspectionVisit = useRef<{ roundId: string; chapterEpoch: number; visitId: string } | null>(null);
  const captureToolContext = (): api.RobotToolContext | undefined => {
    const current = viewRef.current;
    if (!current) return;
    const known = inspectionVisit.current;
    return { ...current, ...(current.status === 'active' && (current.chapter === 'gallery' || current.chapter === 'switchyard') && known?.roundId === current.roundId
      && known.chapterEpoch === current.chapterEpoch ? { inspectionScope: { visitId: known.visitId } } : {}) };
  };

  const clearSwitchyardObservation = () => {
    if (practiceMemory.current.chapter === 'switchyard') practiceMemory.current = { ...practiceMemory.current, switchyard: forgetSwitchyardVisit(practiceMemory.current.switchyard) };
    if (viewRef.current?.chapter === 'switchyard') inspectionVisit.current = null;
    setSwitchyardCurrentVisit(null);
  };
  const clearRejectedSwitchyardVisit = (captured: api.RobotToolContext) => {
    // A delayed failure from a departed visit must not erase a newer communicated arrival.
    if (viewRef.current?.chapter === 'switchyard' && currentRound(captured.roundId)
      && inspectionVisit.current?.visitId === captured.inspectionScope?.visitId) clearSwitchyardObservation();
  };
  // The server validates the visit; transport revision guards keep a delayed report
  // from seeding current choices after a different response has advanced the view.
  const currentSwitchyardResult = (result: ToolResult, responseView?: HumanView): ToolResult => {
    const observation = result.switchyardObservation;
    if (!observation) return result;
    const current = viewRef.current;
    if (current?.chapter === 'switchyard' && observation.stateRevision === current.revision && current.status === 'active'
      && (!responseView || responseView.roundId === current.roundId && responseView.chapterEpoch === current.chapterEpoch
        && responseView.revision === observation.stateRevision)) return result;
    const { switchyardObservation: _historical, ...rest } = result;
    return { ...rest, message: `Historical local report, not a current reading. ${rest.message}` };
  };
  const captureSwitchyardVisit = (result: ToolResult) => {
    const observation = result.switchyardObservation; const current = viewRef.current;
    if (observation && current?.chapter === 'switchyard') inspectionVisit.current = { roundId: current.roundId, chapterEpoch: current.chapterEpoch, visitId: observation.visitId };
  };

  const setBusyNow = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const setConnectedNow = (value: boolean) => { connectedRef.current = value; setConnected(value); };
  const showError = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'The request failed. Please try again.');
  const currentRound = (roundId: string) => viewRef.current?.roundId === roundId;
  const applyView = (next: HumanView) => {
    const previous = viewRef.current;
    if (!acceptsHumanViewSnapshot(previous, next)) return;
    viewRef.current = next; setView(next);
    // Routing changes do not erase already communicated local targets or this visit's inspections.
    // Their original report revisions remain historical; the server invalidates physical proposals separately.
    if (next.chapter === 'switchyard' && (previous?.roundId !== next.roundId || previous?.chapter !== 'switchyard'
      || next.status !== 'active' || previous?.status !== 'active')) clearSwitchyardObservation();
    if (previous && previous.roundId === next.roundId && previous.chapterEpoch !== next.chapterEpoch) {
      setHint('');
      effects.current.play('checkpoint');
      setRecapNotice('Checkpoint confirmed. Earlier reports remain in history with their original chapter.');
      practiceMemory.current = { chapter: next.chapter, gates: [], ...(practiceMemory.current.recorder === 'secured' ? { recorder: 'secured' } : {}) };
      void refreshRecord(next).catch(showError);
    }
    if (next.completed) {
      setStage('debrief');
      // Any authoritative response can reveal a commit whose tool delivery was
      // interrupted. Completion and the closing deadline still happen once.
      if (completionRound.current !== next.roundId) {
        completionRound.current = next.roundId;
        effects.current.play('complete');
        void refreshRecord(next).catch(showError);
        if (voice.current) closingTimer.current = setTimeout(() => { void stop(); }, 8000);
        else setConnectedNow(false);
      }
    }
  };
  const refreshRecord = async (current = viewRef.current) => {
    if (!current || !currentRound(current.roundId)) return;
    const sequence = ++recordRequest.current;
    const next = await api.missionRecord(current);
    if (sequence === recordRequest.current && currentRound(next.roundId)) setRecord(next);
  };
  const addCaption = (entry: TranscriptEntry, source: Segment, roundId: string, captured?: HumanView, switchyardContext?: SwitchyardCaptionContext) => {
    if (!currentRound(roundId)) return;
    const id = source.id + ':' + entry.id;
    const previous = captionsRef.current.find(item => item.id === id);
    const panelRevisionAtDisplay = previous?.switchyardPanelRevisionAtDisplay
      ?? (source.origin === 'practice' && entry.role === 'robot' && (captured?.chapter ?? viewRef.current?.chapter) === 'switchyard'
        ? viewRef.current?.switchyardPanel?.panelRevision : undefined);
    const item: Caption = {
      ...entry, id, origin: source.origin, segmentId: source.id, roundId,
      inputMethod: entry.role === 'robot' ? 'robot' : entry.id.startsWith('quick:') ? 'quick_request' : entry.id.startsWith('typed:') || source.origin === 'practice' ? 'typed' : 'speech',
      timestamp: previous?.timestamp ?? Date.now(), saved: previous?.saved ?? false,
      chapter: previous?.chapter ?? captured?.chapter ?? viewRef.current!.chapter,
      chapterEpoch: previous?.chapterEpoch ?? captured?.chapterEpoch ?? viewRef.current!.chapterEpoch,
      ...(previous?.switchyardContext ? { switchyardContext: previous.switchyardContext }
        : source.origin === 'practice' && entry.role === 'robot' && switchyardContext ? { switchyardContext: { ...switchyardContext } } : {}),
      ...(panelRevisionAtDisplay === undefined ? {} : { switchyardPanelRevisionAtDisplay: panelRevisionAtDisplay }),
    };
    const update = (next: Caption) => {
      const items = captionsRef.current.filter(value => value.id !== id);
      // Updating a partial must not move it behind newer replies.
      const index = captionsRef.current.findIndex(value => value.id === id);
      if (index >= 0) items.splice(index, 0, next); else items.push(next);
      captionsRef.current = items.slice(-200); setCaptions(captionsRef.current);
    };
    update(item);
    if (!entry.final || !entry.text.trim()) return;
    const current = viewRef.current!;
    const promise = api.recordMessage(current, {
      roundId, messageId: id, segmentId: source.id, role: entry.role, text: entry.text,
      origin: source.origin, inputMethod: item.inputMethod, interrupted: !!entry.interrupted,
      chapter: item.chapter, chapterEpoch: item.chapterEpoch,
    }).then(saved => {
      if (!currentRound(roundId)) return;
      const latest = captionsRef.current.find(value => value.id === id);
      if (latest) update({ ...latest, timestamp: saved.timestamp, saved: true });
      // The field report uses persisted spoken records and their server-stamped
      // control context. A new caption must not wait for an unrelated control click.
      if (entry.role === 'robot') return refreshRecord();
    }).catch(cause => { if (currentRound(roundId)) showError(cause); });
    writes.current.add(promise); void promise.finally(() => writes.current.delete(promise));
  };
  const robotSays = (message: string, source = segmentRef.current, localResult?: ToolResult) => {
    const current = viewRef.current;
    if (source && current) {
      const context = switchyardCaptionContext(localResult, current, source.origin, message);
      addCaption({ id: api.requestId(), role: 'robot', text: message, final: true }, source, current.roundId, current, context);
      if (context) setSwitchyardCurrentVisit({ roundId: current.roundId, visitId: context.visitId, locationLabel: context.locationLabel });
    }
  };
  const addGameEvent = (event: RecordedMessage) => {
    if (!currentRound(event.roundId) || event.role !== 'game' || event.origin !== 'game' || event.inputMethod !== 'game_event'
      || !event.chapter || !Number.isSafeInteger(event.chapterEpoch)) return;
    if (captionsRef.current.some(item => item.id === event.messageId)) return;
    const item: Caption = { id: event.messageId, role: 'game', text: event.text, final: true,
      origin: 'game', inputMethod: 'game_event', roundId: event.roundId,
      segmentId: segmentRef.current?.id ?? event.segmentId, timestamp: event.timestamp, saved: true,
      chapter: event.chapter!, chapterEpoch: event.chapterEpoch! };
    captionsRef.current = [...captionsRef.current, item].slice(-200); setCaptions(captionsRef.current);
  };
  const clearClosing = () => {
    if (closingTimer.current) clearTimeout(closingTimer.current);
    if (closingGrace.current) clearTimeout(closingGrace.current);
    closingTimer.current = null; closingGrace.current = null; closingReplyDone.current = false;
  };

  const cancelPending = async (expected = generation.current, reason: CancelReason = 'interrupt') => {
    const current = viewRef.current;
    if (!current || expected !== generation.current) return;
    const next = await api.lifecycle(current, 'cancel', { reason });
    if (expected === generation.current && currentRound(next.roundId)) {
      lastCancellation.current = { roundId: next.roundId, chapterEpoch: next.chapterEpoch, actionEpoch: next.actionEpoch };
      applyView(next);
    }
  };

  const stopOperation = async () => {
    // Close partial quotes using only delivered text before invalidating callbacks.
    for (const item of captionsRef.current.filter(item => !item.final && item.segmentId === segmentRef.current?.id)) {
      addCaption({ ...item, id: item.id.slice(item.segmentId.length + 1), final: true, interrupted: true }, segmentRef.current!, item.roundId);
    }
    const lastSpoken = captionsRef.current.filter(item => item.role === 'robot' && item.segmentId === segmentRef.current?.id).at(-1);
    if (playingRef.current && lastSpoken) addCaption({ ...lastSpoken, id: lastSpoken.id.slice(lastSpoken.segmentId.length + 1), final: true, interrupted: true }, segmentRef.current!, lastSpoken.roundId);
    ++generation.current; ++mockTurn.current;
    clearSwitchyardObservation();
    setBusyNow(true); setConnectedNow(false); setToolPending(false); setPowerPending(null); setControlPending(null); controlBusy.current = false;
    setProposalConfirming(null); setProposalFailure(null);
    mockAbort.current?.abort(); mockAbort.current = null;
    clearClosing();
    const connection = voice.current; voice.current = null;
    const ending = connection?.stop();
    const current = viewRef.current;
    try {
      if (current) {
        const next = await api.lifecycle(current, 'stop');
        if (currentRound(next.roundId)) applyView(next);
      }
      await Promise.allSettled([...writes.current]);
      await refreshRecord();
    } catch (cause) { showError(cause); }
    finally {
      await ending; setMicrophone(false); setInputState('inactive'); setPlaying(false); playingRef.current = false;
      setStatus('ended'); effects.current.setVoiceActive(false); effects.current.play('disconnect');
      if (effectsVolume > 0) await new Promise(resolve => setTimeout(resolve, 240));
      await effects.current.close(); setBusyNow(false);
    }
  };

  const stop = (): Promise<void> => {
    if (stopping.current) return stopping.current;
    const operation = stopOperation();
    stopping.current = operation;
    void operation.finally(() => { if (stopping.current === operation) stopping.current = null; });
    return operation;
  };

  const runTool = async (call: api.RobotCall, signal: AbortSignal, expected: number, captured?: api.RobotToolContext) => {
    const current = captured ?? captureToolContext();
    if (!current || expected !== generation.current || signal.aborted) throw new DOMException('Canceled', 'AbortError');
    let result;
    try { result = await api.executeTool(current, call, signal); }
    catch (cause) {
      // A classified validation rejection is different from a lost transport.
      if (cause instanceof api.MissionServiceError && cause.code) {
        if (expected === generation.current && currentRound(current.roundId) && current.chapter === 'switchyard'
          && ['stale_scope', 'target_unobserved'].includes(cause.code)) clearRejectedSwitchyardVisit(current);
        return { ok: false, code: cause.code, recovery: cause.recovery, message: cause.message };
      }
      throw cause;
    }
    if (expected !== generation.current || !currentRound(result.view.roundId)) throw new DOMException('Canceled', 'AbortError');
    // A received authoritative result remains true even if the input changed.
    // The cancellation response owns the newer human view; do not overwrite it.
    if (signal.aborted) return { ok: result.ok, message: result.message, code: result.code, proposal: result.proposal };
    applyView(result.view);
    if (!result.ok && ['stale_scope', 'target_unobserved'].includes(result.code ?? '')) clearRejectedSwitchyardVisit(current);
    if (call.name === 'get_action_status' && result.proposal) setProposalFailure(previous => previous === result.proposal!.id ? null : previous);
    const perception = currentRobotPerception(result.perception, viewRef.current ?? undefined);
    if (perception) inspectionVisit.current = { roundId: perception.roundId, chapterEpoch: perception.chapterEpoch, visitId: perception.visitId };
    if (result.ok && result.view.chapter !== 'switchyard') practiceMemory.current = rememberLocalResult(practiceMemory.current, result.message, result.view.chapter, perception ?? null);
    if (result.proposal) practiceMemory.current = { ...practiceMemory.current, proposalId: result.proposal.id };
    const eligible = currentSwitchyardResult({ ok: result.ok, message: result.message, code: result.code, recovery: result.recovery, proposal: result.proposal,
      ...(perception ? { perception } : {}), ...(result.switchyardObservation ? { switchyardObservation: result.switchyardObservation } : {}) }, result.view);
    captureSwitchyardVisit(eligible);
    return eligible;
  };

  const start = (connectionMode: TransportOrigin = mode) => {
    if (connectionMode === 'game') return;
    if (connectionMode !== 'practice' && providerAccountStopped) { setError('Live remains stopped after an account or credit refusal. Contact the owner; Practice is available.'); return; }
    if (busyRef.current || connectedRef.current || voice.current) return;
    setBusyNow(true); setError(''); setWarning(''); setInterrupted(false); setSeconds(0); setConnectionLimitSeconds(600);
    // Both audio paths begin in this user gesture; no capture happens on page load.
    if (effectsVolume > 0 || ambienceVolume > 0) void effects.current.unlock();
    const expected = ++generation.current;
    const source: Segment = { id: api.requestId(), origin: connectionMode };
    segmentRef.current = source; setSegment(source);
    const prepareMission = async () => {
      let current = viewRef.current;
      const retained = !!current && !current.completed && current.status !== 'ended' && stage !== 'briefing';
      const remix = missionKind === 'switchyard' && remixSetup
        ? remixSetup.kind === 'new' ? { ...remixSetup, recent: journeys.map(item => item.code) } : remixSetup : undefined;
      if (!retained) current = current ? await api.lifecycle(current, 'reset', { scenario: missionKind !== 'training' ? 'classic' : scenario, missionKind, ...(missionKind === 'rescue' && optionalObjective ? { optionalObjective } : {}), ...(remix ? { remix } : {}) }) : await api.createSession(missionKind !== 'training' ? 'classic' : scenario, missionKind, missionKind === 'rescue' ? optionalObjective : undefined, remix);
      else current = await api.lifecycle(current!, 'resume');
      if (expected !== generation.current) {
        await api.lifecycle(current!, 'stop');
        throw new DOMException('Canceled', 'AbortError');
      }
      applyView(current!); setStage('mission');
      if (!retained) { captionsRef.current = []; setCaptions([]); setRecord(emptyRecord(current!.roundId)); practiceMemory.current = { chapter: current!.chapter, gates: [] }; }
      if (current!.chapter === 'switchyard') clearSwitchyardObservation();
      await Promise.allSettled([...writes.current]);
      const recap = await api.robotRecap(current!);
      if (expected !== generation.current) throw new DOMException('Canceled', 'AbortError');
      setRecapNotice(retained ? 'Earlier reports are historical. Pip can recheck local conditions.' : '');
      // Practice remembers only locally reported targets from allowed historical context.
      for (const entry of recap.entries) if (entry.kind !== 'player_quote' && entry.chapter === current!.chapter) practiceMemory.current = rememberLocalResult(practiceMemory.current, entry.text, current!.chapter);
      await refreshRecord(current!);
      return { current: current!, recap: recap.entries.length ? JSON.stringify(recap) : undefined, retained };
    };
    if (connectionMode === 'practice') {
      void prepareMission().then(({ retained }) => {
        if (expected !== generation.current) return;
        setConnectedNow(true); setStatus('listening'); effects.current.play('connect');
        robotSays(retained ? "I'm back, Mission Control. My earlier reports may be out of date. What should we check?"
          : viewRef.current?.chapter === 'switchyard' ? "I'm ready, Mission Control. Ask me to look around while you study the routing panel." : copy.greeting, source);
      }).catch(cause => { if (expected === generation.current) { showError(cause); setStatus('error'); } })
        .finally(() => { if (expected === generation.current) setBusyNow(false); });
      return;
    }
    // Provider call identifiers belong to one connection, not the entire retained mission.
    const localCallIds = new Map<string, string>();
    let issuedReleaseView: HumanView | undefined;
    let protectedConnectionRefused = false;
    const connection = new LiveVoice({
      onTranscript: (entry, context) => {
        const captured = context as HumanView | undefined;
        if (expected === generation.current && viewRef.current) addCaption(entry, source, captured?.roundId ?? viewRef.current.roundId, captured);
      },
      onStatus: next => {
        if (expected !== generation.current) return;
        setStatus(next);
        if (next === 'ended' || next === 'error') {
          setConnectedNow(false); if (next === 'ended') voice.current = null; setMicrophone(false); setInputState('inactive'); setToolPending(false); setPlaying(false);
          playingRef.current = false; effects.current.setVoiceActive(false); clearClosing();
          if (next === 'ended') void effects.current.close();
          const current = viewRef.current;
          if (current) void api.lifecycle(current, 'stop').then(result => {
            if (expected === generation.current && currentRound(result.roundId)) applyView(result);
          }).catch(cause => { if (expected === generation.current && !protectedConnectionRefused) showError(cause); });
        }
      },
      onError: message => { if (expected === generation.current) setError(message); },
      onWarning: message => { if (expected === generation.current) setWarning(message); },
      onSessionLimit: () => { if (expected === generation.current) void stop(); },
      onProviderAccountRefusal: reason => {
        if (!issuedReleaseView) return;
        protectedConnectionRefused = true;
        setProviderAccountStopped(true);
        rememberProtectedLiveStop();
        void api.reportLiveRefusal(issuedReleaseView, reason).catch(() => {
          if (expected === generation.current) setWarning('The Live stop could not be recorded. Do not reconnect; contact the owner.');
        });
      },
      onMicrophone: value => { if (expected === generation.current) { setMicrophone(value); effects.current.setVoiceActive(value || playingRef.current); } },
      onInputState: value => { if (expected === generation.current) { setInputState(value); if (value === 'receiving') setInterrupted(false); } },
      onToolState: value => { if (expected === generation.current) setToolPending(value); },
      onPlayback: value => {
        if (expected !== generation.current) return;
        setPlaying(value); playingRef.current = value; effects.current.setVoiceActive(value || source.origin === 'live_voice');
        if (!value && closingReplyDone.current && viewRef.current?.completed) void stop();
      },
      onReplyDone: reply => {
        if (expected !== generation.current || !viewRef.current?.completed || reply.hasTools || reply.status !== 'completed') return;
        voice.current?.finishReply(reply.id);
        closingReplyDone.current = true;
        // Let the worklet start queued final audio before deciding it was text-only.
        closingGrace.current = setTimeout(() => { if (!playingRef.current && expected === generation.current) void stop(); }, 300);
      },
    });
    connection.setVolume(voiceVolume);
    voice.current = connection;
    void connection.start({
      microphone: connectionMode === 'live_voice',
      token: async () => {
        const { current, recap } = await prepareMission();
        const token = await api.voiceToken(current, connectionMode === 'live_voice' ? 'voice' : 'text');
        if (token.protectedRelease) issuedReleaseView = current;
        if (expected !== generation.current) throw new DOMException('Canceled', 'AbortError');
        // Mirror the supported server limit for display; LiveVoice still validates and enforces it.
        setConnectionLimitSeconds(token.maxSessionSeconds === 900 ? 900 : 600);
        return { ...token, recap };
      },
      captureToolContext,
      executeTool: (call, signal, context) => {
        let id = localCallIds.get(call.callId);
        if (!id) { id = api.requestId(); localCallIds.set(call.callId, id); }
        const captured = context as api.RobotToolContext | undefined;
        const cancellation = lastCancellation.current;
        // A new-input cancellation may settle after receipt. Old protocol work is aborted;
        // fresh work may adopt only that acknowledged cancellation epoch. A later room
        // movement must not revive queued intent captured in the previous room.
        const bound = captured && cancellation && captured.roundId === cancellation.roundId
          && captured.chapterEpoch === cancellation.chapterEpoch && cancellation.actionEpoch > captured.actionEpoch
          ? { ...captured, actionEpoch: cancellation.actionEpoch } : captured;
        return runTool({ ...call, callId: id }, signal, expected, bound);
      },
      cancelPending: reason => cancelPending(expected, reason),
    }).then(() => {
      if (expected === generation.current && voice.current === connection) {
        setConnectedNow(true); liveStarted.current = Date.now(); effects.current.play('connect');
      }
    }).catch(cause => {
      if (expected === generation.current) {
        // A refused startup also rejects start(); retain its specific stop warning.
        if (!protectedConnectionRefused) showError(cause);
        voice.current = null; setConnectedNow(false); setStatus('error');
      }
    }).finally(() => { if (expected === generation.current) setBusyNow(false); });
  };

  const interrupt = async () => {
    if (!connectedRef.current) return;
    setInterrupted(true); setToolPending(false); effects.current.stop();
    mockAbort.current?.abort(); ++mockTurn.current; mockAbort.current = null;
    try { if (voice.current) await voice.current.interrupt(); else await cancelPending(); }
    catch (cause) { showError(cause); }
  };

  const send = async (text: string, inputMethod: 'typed' | 'quick_request' = 'typed') => {
    if (!text.trim() || text.length > 2000 || !connectedRef.current || busyRef.current || viewRef.current?.status !== 'active') return false;
    setInterrupted(false); setError('');
    if (voice.current) return voice.current.sendText(text, inputMethod);
    const source = segmentRef.current!;
    addCaption({ id: (inputMethod === 'quick_request' ? 'quick:' : '') + api.requestId(), role: 'human', text, final: true }, source, viewRef.current.roundId);
    const reply = simulationReply(text, practiceMemory.current);
    const expected = generation.current;
    const turn = ++mockTurn.current;
    const hadPending = !!mockAbort.current;
    mockAbort.current?.abort();
    const abort = new AbortController(); mockAbort.current = abort;
    setToolPending(!!reply.call);
    try {
      if (hadPending || reply.cancel) await cancelPending(expected, reply.cancel ? 'interrupt' : 'supersede');
      if (expected !== generation.current || turn !== mockTurn.current || abort.signal.aborted) return true;
      if (reply.cancel) setInterrupted(true);
      const result = reply.call ? currentSwitchyardResult(await runTool(reply.call, abort.signal, expected)) : undefined;
      const message = result ? simulationToolSpeech(result, practiceMemory.current) : reply.message;
      if (expected === generation.current && turn === mockTurn.current) {
        robotSays(message, source, result);
        if (result && viewRef.current?.chapter === 'switchyard') practiceMemory.current = rememberPracticeReport(practiceMemory.current, result, 'switchyard', message);
        else if (reply.nextMemory) practiceMemory.current = reply.nextMemory;
      }
    } catch (cause) {
      if (expected === generation.current && turn === mockTurn.current && !(cause instanceof DOMException && cause.name === 'AbortError')) showError(cause);
    } finally {
      if (expected === generation.current && turn === mockTurn.current) { setToolPending(false); mockAbort.current = null; }
    }
    return true;
  };

  const quickRequest = (kind: 'surroundings' | 'repeat_report') => send(kind === 'surroundings'
    ? viewRef.current?.chapter === 'switchyard' ? 'Please look around.' : viewRef.current?.chapter === 'gallery' ? 'Please look around and report the current emblem and reachable gates.' : 'Please look around and report what you can see within reach.'
    : 'Please repeat your last report, noting if it may be out of date.', 'quick_request');
  const chooseSwitchyardIntent = (request: string) => send(request, 'quick_request');

  const changePower = async (powerOn: boolean) => {
    const current = viewRef.current;
    if (!current || controlBusy.current || busyRef.current || !connectedRef.current) return;
    const expected = generation.current; controlBusy.current = true; setControlPending(powerOn ? 'power_on' : 'power_off'); setPowerPending(powerOn); setError('');
    try {
      const next = await api.setPower(current, powerOn);
      if (expected === generation.current && currentRound(next.roundId)) {
        applyView(next); effects.current.play('acknowledge'); await refreshRecord(next);
      }
    } catch (cause) {
      if (expected !== generation.current) return;
      showError(cause);
      try {
        const latest = await api.getSession(current.sessionId);
        if (currentRound(latest.roundId)) applyView(latest);
      } catch { /* Keep the original recovery instruction. */ }
    } finally { if (expected === generation.current) { setPowerPending(null); setControlPending(null); controlBusy.current = false; } }
  };

  const changeControl = async (pending: string, command: (current: HumanView) => Promise<HumanView>) => {
    const current = viewRef.current;
    if (!current || controlBusy.current || busyRef.current || !connectedRef.current) return;
    const expected = generation.current; controlBusy.current = true; setControlPending(pending); setError('');
    try {
      const next = await command(current);
      if (expected === generation.current && currentRound(next.roundId)) { applyView(next); effects.current.play('acknowledge'); await refreshRecord(next); }
    } catch (cause) {
      if (expected !== generation.current) return;
      showError(cause);
      try { const latest = await api.getSession(current.sessionId); if (currentRound(latest.roundId)) applyView(latest); } catch { /* Preserve the original control error. */ }
    } finally { if (expected === generation.current) { controlBusy.current = false; setControlPending(null); } }
  };
  const changeRelay = (relay: Relay) => changeControl(relay, current => api.setRelay(current, relay));
  const dockControl = (action: DockControl) => changeControl(action, current => api.dockControl(current, action));

  const applyRouting = async (rotations: number[]): Promise<boolean> => {
    const current = viewRef.current;
    if (!current || current.chapter !== 'switchyard' || current.status !== 'active' || !current.switchyardPanel
      || controlBusy.current || busyRef.current || !connectedRef.current) return false;
    const expected = generation.current; controlBusy.current = true; setControlPending('routing_panel'); setError('');
    try {
      const next = await api.applyRouting(current, rotations);
      if (expected !== generation.current || !currentRound(next.roundId)) return false;
      applyView(next); effects.current.play('acknowledge');
      // The authoritative apply is complete. History cannot undo that success.
      void refreshRecord(next).catch(cause => { if (expected === generation.current && currentRound(next.roundId)) showError(cause); });
      return true;
    } catch (cause) {
      if (expected !== generation.current) return false;
      showError(cause);
      try { const latest = await api.getSession(current.sessionId); if (expected === generation.current && currentRound(latest.roundId)) applyView(latest); } catch { /* Preserve the original routing error and the editable draft. */ }
      return false;
    } finally { if (expected === generation.current) { controlBusy.current = false; setControlPending(null); } }
  };

  const decideProposal = async (decision: 'confirm' | 'decline') => {
    const current = viewRef.current; const proposal = current?.proposal;
    if (!current || !proposal || proposal.status !== 'awaiting_confirmation' || proposalDecisionBusy.current
      || busyRef.current || !connectedRef.current || current.status !== 'active') return;
    const expected = generation.current; const connection = voice.current;
    const decisionInput = connection?.beginGameDecision();
    proposalDecisionBusy.current = true; setProposalConfirming(proposal.id); setProposalFailure(null); setError('');
    let recordView: HumanView | null = null;
    try {
      const result = await api.decideProposal(current, proposal.id, decision, api.requestId());
      if (expected !== generation.current || !currentRound(result.view.roundId)) return;
      // A newer chapter/result owns the view; old decisions cannot seed it.
      if (viewRef.current!.chapterEpoch > result.view.chapterEpoch) return;
      applyView(result.view);
      const perception = currentRobotPerception(result.perception, viewRef.current ?? undefined);
      if (perception) inspectionVisit.current = { roundId: perception.roundId, chapterEpoch: perception.chapterEpoch, visitId: perception.visitId };
      const localResult = currentSwitchyardResult(result, result.view);
      captureSwitchyardVisit(localResult);
      if (result.decisionEvent) {
        addGameEvent(result.decisionEvent);
        if (connection && voice.current === connection && connectedRef.current) {
          // Keep the source chapter and robot-eligible result of this exact commit.
          // A bounded acknowledgement cannot authorize another physical operation.
          if (!result.proposal || !connection.sendGameEvent({ event: result.decisionEvent, proposal: result.proposal,
            result: { ok: result.ok, message: result.message, ...(result.code ? { code: result.code } : {}) },
            perception: currentRobotPerception(result.perception, viewRef.current ?? undefined),
            checkpoint: { chapter: result.view.chapter, chapterEpoch: result.view.chapterEpoch, completed: result.view.completed },
          }, decisionInput?.inputTurn)) {
            if (!connection.hasConnectionLimitWarning) setWarning('The decision is saved, but its delivery to Pip was not confirmed. Ask Pip to check the proposal status before continuing.');
          }
        }
      }
      if (result.ok && result.proposal?.status === 'committed') {
        if (result.view.chapter !== 'switchyard') practiceMemory.current = rememberLocalResult(practiceMemory.current, result.message, result.view.chapter,
          currentRobotPerception(result.perception, viewRef.current ?? undefined) ?? null);
        effects.current.play('acknowledge');
      }
      if (result.view.chapter === 'switchyard' && segmentRef.current?.origin === 'practice') {
        const message = simulationToolSpeech(localResult, practiceMemory.current);
        robotSays(message, segmentRef.current, localResult);
        practiceMemory.current = rememberPracticeReport(practiceMemory.current, localResult, 'switchyard', message);
      }
      recordView = result.view;
    } catch (cause) {
      if (expected !== generation.current || !currentRound(current.roundId)) return;
      setProposalFailure(proposal.id); showError(cause);
      // One explicit decision recovery read, never an autonomous status loop.
      try {
        const latest = await api.getSession(current.sessionId);
        if (expected === generation.current && currentRound(latest.roundId)) {
          applyView(latest);
          if (latest.proposal?.id === proposal.id && latest.proposal.status !== 'awaiting_confirmation') setProposalFailure(null);
        }
      } catch { /* Keep the unconfirmed state and visible recovery instruction. */ }
    } finally {
      decisionInput?.finish();
      proposalDecisionBusy.current = false;
      if (expected === generation.current) setProposalConfirming(null);
    }
    // History is auxiliary: it cannot extend or overturn the authoritative decision.
    if (recordView && expected === generation.current && currentRound(recordView.roundId)) {
      try { await refreshRecord(recordView); }
      catch (cause) { if (expected === generation.current && currentRound(recordView.roundId)) showError(cause); }
    }
  };

  const newBriefing = async (nextScenario: Scenario = scenario, nextKind: MissionKind = missionKind) => {
    setOptionalObjective(undefined);
    await stop();
    setBusyNow(true);
    try {
      const current = viewRef.current;
      if (current && !current.switchyardPanel?.dispatch && !(nextKind === 'switchyard' && remixSetup)) {
        const reset = await api.lifecycle(current, 'reset', { scenario: nextKind !== 'training' ? 'classic' : nextScenario, missionKind: nextKind });
        applyView(reset); applyView(await api.lifecycle(reset, 'stop'));
      }
      captionsRef.current = []; setCaptions([]); setRecord(null); setSegment(null); segmentRef.current = null;
      setScenario(nextScenario); setMissionKind(nextKind); setStage('briefing'); setHint(''); setRecapNotice(''); setError(''); setWarning('');
      practiceMemory.current = { chapter: 'cargo', gates: [] };
      setInterrupted(false); setPowerPending(null); completionRound.current = ''; setSeconds(0);
    } catch (cause) {
      // Expired server memory can only be recovered by explicitly starting fresh.
      showError(cause); viewRef.current = null; setView(null); setStage('briefing');
      captionsRef.current = []; setCaptions([]); setRecord(null); setSegment(null); segmentRef.current = null;
    } finally { setBusyNow(false); }
  };

  const prepareDispatch = async (choice: 'same' | 'other' | 'new') => {
    const current = viewRef.current; const dispatch = current?.switchyardPanel?.dispatch;
    if (!dispatch || busyRef.current) return;
    setRemixSetup(choice === 'new' ? { kind: 'new', assignment: dispatch.assignment, recent: [] } : { kind: 'replay', code: dispatch.code });
    setIntendedApproach(choice === 'other' ? current.switchyardApproach === 'lift' ? 'bypass' : 'lift' : undefined);
    await newBriefing('classic', 'switchyard');
  };

  const pin = async (messageId: string) => {
    const current = viewRef.current; if (!current) return;
    try {
      await api.addNotebook(current, { roundId: current.roundId, requestId: api.requestId(), kind: 'report', messageId });
      await refreshRecord(current);
    } catch (cause) { if (currentRound(current.roundId)) showError(cause); }
  };
  const note = async (text: string) => {
    const current = viewRef.current; if (!current || !text.trim()) return false;
    try {
      await api.addNotebook(current, { roundId: current.roundId, requestId: api.requestId(), kind: 'note', text });
      await refreshRecord(current); return true;
    } catch (cause) { if (currentRound(current.roundId)) showError(cause); return false; }
  };
  const askHint = async (level: HintLevel) => {
    const current = viewRef.current; if (!current) return;
    const sequence = ++hintRequest.current;
    const acceptsHint = () => sequence === hintRequest.current && currentRound(current.roundId)
      && viewRef.current?.chapterEpoch === current.chapterEpoch;
    try {
      const next = await api.requestHint(current, level);
      // A slower earlier tier must not replace the player's more recent selection.
      if (acceptsHint() && next.roundId === current.roundId) { setHint(next.text); await refreshRecord(current); }
    } catch (cause) { if (acceptsHint()) showError(cause); }
  };
  const annotate = async (change: api.AnnotationChange) => {
    const current = viewRef.current; if (!current) return;
    try {
      await api.annotate(current, change);
      if (currentRound(current.roundId) && viewRef.current?.chapterEpoch === current.chapterEpoch) await refreshRecord(viewRef.current);
    } catch (cause) {
      if (currentRound(current.roundId) && viewRef.current?.chapterEpoch === current.chapterEpoch) showError(cause);
      throw cause; // The private-map editor must not record an undo for a rejected write.
    }
  };
  const chooseMode = (next: TransportOrigin) => {
    if (next === 'game') return;
    if (connectedRef.current || voice.current || busyRef.current) return;
    setMode(next); setError(''); setWarning('');
    // Selection never relabels old captions as a different transport.
    segmentRef.current = null; setSegment(null); setStatus('ended');
  };
  const changeVoiceVolume = (value: number) => { setVoiceVolume(value); voice.current?.setVolume(value); };
  const changeEffectsVolume = (value: number) => { setEffectsVolume(value); effects.current.setVolume(value); if (value > 0) void effects.current.unlock(); else if (ambienceVolume === 0) void effects.current.close(); };
  const changeAmbienceVolume = (value: number) => { setAmbienceVolume(value); effects.current.setAmbienceVolume(value); if (value > 0) { effects.current.setAmbienceActive(connectedRef.current && !viewRef.current?.completed); void effects.current.unlock(); } else if (effectsVolume === 0) void effects.current.close(); };

  const requestStart = (next: TransportOrigin = mode) => {
    if (next === 'game') return;
    if (next !== 'practice' && providerAccountStopped) { setError('Live remains stopped after an account or credit refusal. Contact the owner; Practice is available.'); return; }
    if (busyRef.current || connectedRef.current || voice.current) return;
    if (stage === 'briefing' && missionKind === 'switchyard' && remixSetup
      && (!dispatchAvailability?.available || dispatchLoading || remixSetup.kind === 'replay' && !REMIX_CODE_PATTERN.test(remixSetup.code))) {
      setError(remixSetup.kind === 'replay' && !REMIX_CODE_PATTERN.test(remixSetup.code) ? 'Enter a complete supported mission code before starting.' : dispatchAvailability?.message ?? 'Wait for dispatch availability before starting. Original is still available.'); return;
    }
    chooseMode(next);
    if (next === 'practice') start(next);
    else setReadinessMode(next);
  };
  const confirmReady = () => {
    if (!readinessMode) return;
    const ready = readinessMode;
    setReadinessMode(null);
    start(ready);
  };
  const cancelReadiness = () => setReadinessMode(null);
  const readinessText = () => { chooseMode('live_text'); setReadinessMode('live_text'); };
  const readinessPractice = () => { setReadinessMode(null); requestStart('practice'); };
  const remixSelected = missionKind === 'switchyard' && !!remixSetup;
  useEffect(() => {
    if (!remixSelected || stage !== 'briefing') return;
    const abort = new AbortController(); setDispatchLoading(true);
    void api.remixAvailability(abort.signal).then(setDispatchAvailability).catch(cause => {
      if (!abort.signal.aborted) setDispatchAvailability({ available: false, message: cause instanceof Error ? cause.message : 'Dispatch availability could not be checked. Original remains available.' });
    }).finally(() => { if (!abort.signal.aborted) setDispatchLoading(false); });
    return () => abort.abort();
  }, [remixSelected, stage, dispatchCheck]);
  useEffect(() => {
    const synchronize = (event: StorageEvent) => { if (event.key === SWITCHYARD_HISTORY_KEY || event.key === null) setJourneys(readJourneyHistory()); };
    window.addEventListener('storage', synchronize); return () => window.removeEventListener('storage', synchronize);
  }, []);
  useEffect(() => {
    const dispatch = view?.switchyardPanel?.dispatch; const source = segmentRef.current?.origin;
    if (!view || !dispatch || !source || source === 'game' || stage === 'briefing') return;
    const old = journeyRounds.current.get(view.roundId);
    const now = Date.now();
    const initial: JourneyEntry = old ?? { id: api.requestId(), code: dispatch.code, recentToken: dispatch.recentToken,
      startedAt: now, updatedAt: now, outcome: 'started', assignment: dispatch.assignment, provenance: source };
    const next: JourneyEntry = old && old.provenance !== source && old.provenance !== 'mixed'
      ? { ...initial, provenance: 'mixed', updatedAt: now } : initial;
    if (!old) journeyRounds.current.clear();
    const journey = view.switchyardPanel?.journey;
    if (view.completed && view.switchyardApproach && journey && next.outcome !== 'home') {
      const completed: JourneyEntry = { ...next, updatedAt: now, outcome: 'home', approach: view.switchyardApproach, assignmentStatus: journey.status };
      journeyRounds.current.set(view.roundId, completed); setJourneys(previous => saveJourneyHistory([completed, ...previous]));
    } else if (!old || next !== old) { journeyRounds.current.set(view.roundId, next); setJourneys(previous => saveJourneyHistory([next, ...previous])); }
  }, [view, stage]);
  useEffect(() => { effects.current.setAmbienceActive(connected && stage === 'mission'); }, [connected, stage]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    return () => { delete document.documentElement.dataset.reducedMotion; };
  }, [reducedMotion]);

  useEffect(() => {
    if (!connected || segment?.origin === 'practice') return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - liveStarted.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [connected, segment?.id]);
  useEffect(() => {
    effects.current.setVolume(0);
    const leave = () => {
      ++generation.current; mockAbort.current?.abort(); clearClosing();
      const current = viewRef.current;
      if (current) void fetch('/api/sessions/' + encodeURIComponent(current.sessionId) + '/stop', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roundId: current.roundId, chapterEpoch: current.chapterEpoch, requestId: api.requestId() }), keepalive: true,
      }).catch(() => {});
      void voice.current?.stop(); void effects.current.close();
    };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); leave(); };
  }, []);

  const activeCaption = segment ? captions.filter(item => item.segmentId === segment.id).at(-1) : undefined;
  const switchyardIntents = segment?.origin === 'practice' && view?.chapter === 'switchyard' ? switchyardIntentChoices(practiceMemory.current) : [];
  const pipState = view?.completed ? 'success' : error ? 'error' : interrupted ? 'interrupted'
    : !connected ? busy ? 'considering' : view ? 'paused' : 'offline'
      : toolPending ? 'checking' : playing ? 'speaking' : status === 'responding' || status === 'awaiting_reply' ? 'considering'
        : view?.proposal?.status === 'awaiting_confirmation' ? 'awaiting_confirmation' : inputState !== 'inactive' ? 'listening' : 'ready';
  return {
    stage, scenario, setScenario, missionKind, setMissionKind: chooseMissionKind, optionalObjective, setOptionalObjective, mode, chooseMode, view, record, captions, segment, activeCaption,
    connected, busy, powerPending, toolPending, status, microphone, inputState, playing, interrupted,
    proposalConfirming, proposalFailure, decideProposal,
    switchyardIntents, chooseSwitchyardIntent, applyRouting, switchyardCurrentVisit,
    remixSetup, chooseRemix: (value?: RemixSetup) => { setRemixSetup(value); setIntendedApproach(undefined); setError(''); },
    intendedApproach, prepareDispatch, journeys, clearJourneys: () => { clearJourneyHistory(); setJourneys([]); },
    remixProvenance: view ? journeyRounds.current.get(view.roundId)?.provenance : undefined,
    dispatchAvailability, dispatchLoading, refreshDispatch: () => setDispatchCheck(value => value + 1),
    dispatchStartBlocked: remixSelected && (dispatchLoading || !dispatchAvailability?.available || remixSetup?.kind === 'replay' && !REMIX_CODE_PATTERN.test(remixSetup.code)),
    error, warning, recapNotice, hint, seconds, connectionLimitSeconds, voiceVolume, effectsVolume, ambienceVolume, reducedMotion, pipState,
    requestStart, confirmReady, cancelReadiness, readinessMode, readinessText, readinessPractice, changeReducedMotion: setReducedMotion,
    start: () => requestStart(), stop, interrupt, send, quickRequest, changePower, changeRelay, dockControl, controlPending, annotate, newBriefing, pin, note, askHint, changeVoiceVolume, changeEffectsVolume, changeAmbienceVolume,
  };
}
