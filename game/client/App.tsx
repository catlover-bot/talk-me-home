import { SwitchyardGuideProvider, isSwitchyardGuideReport } from './components/SwitchyardGuide';
import { SwitchyardHelp } from './components/SwitchyardHelp';
import { SwitchyardPanel } from './components/SwitchyardPanel';
import { SwitchyardDocument } from './components/SwitchyardDocument';
import { SwitchyardEnding } from './components/SwitchyardEnding';
import { SwitchyardDispatchSetup, SwitchyardDispatchCard } from './components/SwitchyardDispatch';
import { lazy, Suspense, useRef, useState } from 'react';
import { useMission, originLabel } from './useMission';
import { Briefing } from './components/Briefing';
import { MissionDocuments } from './components/MissionDocuments';
import { PipPortrait, type PipState } from './components/PipPortrait';
import { Notebook } from './components/Notebook';
import { CommunicationDock, MessageQuote } from './components/CommunicationDock';
import { ChapterHeader, chapterNames } from './components/ChapterHeader';
import { HumanControls } from './components/HumanControls';
import { LocalReadiness } from './components/LocalReadiness';
import { SettingsPanel } from './components/SettingsPanel';
import { AboutPanel } from './components/AboutPanel';

const Debrief = lazy(() => import('./components/Debrief').then(module => ({ default: module.Debrief })));

export default function App() {
  const m = useMission();
  const restartDialog = useRef<HTMLDialogElement>(null);
  const [presentation, setPresentation] = useState(false);
  const [switchyardGuidanceEnabled, setSwitchyardGuidanceEnabled] = useState(true);
  const closingCaption = <div className="closing-caption"><span className="source-label">{m.activeCaption?.role === 'game' ? 'Game event' : <>{m.activeCaption ? originLabel[m.activeCaption.origin] : 'Mission'} · {m.activeCaption?.role === 'human' ? 'Mission Control' : 'Pip'}</>}</span><p data-testid="caption" aria-live={m.activeCaption?.final ? 'polite' : 'off'}>{m.activeCaption?.text ?? 'Arrival confirmed.'}</p>{m.activeCaption?.interrupted && <span>Interrupted / incomplete speech</span>}</div>;
  const activeLive = m.segment?.origin !== 'practice' && (m.connected || m.busy) && m.stage !== 'briefing';
  return <SwitchyardGuideProvider key={m.view?.roundId ?? 'briefing'} enabled={switchyardGuidanceEnabled} onEnabledChange={setSwitchyardGuidanceEnabled} active={m.stage === 'mission' && m.view?.missionKind === 'switchyard'} roundId={m.view?.roundId ?? ''} captions={m.captions} practice={m.segment?.origin === 'practice'}><div data-reduced-motion={m.reducedMotion} className={'app-shell' + (presentation && m.stage === 'mission' ? ' presentation-mode' : '')}>
    <a className="skip-link" href="#main">Skip to mission controls</a>
    <header className="topbar">
      <span className="wordmark"><span className="brand-symbol" aria-hidden="true"><img src="/icon.svg" alt=""/></span>Talk Me Home</span>
      <span className="mission-bar">{m.stage === 'briefing' ? 'Mission Control' : m.view?.missionKind === 'switchyard' ? 'The Switchyard' : m.view?.missionKind === 'rescue' ? 'Rescue Mission' : 'Training / ' + (m.view?.scenario === 'maintenance' ? 'Maintenance' : 'Classic')}</span>
      <div className="topbar-tools"><SettingsPanel mission={m}/><AboutPanel/></div>
      {m.stage !== 'briefing' && <div className="topbar-actions">
        <span className="mode-badge">{m.connected && m.segment ? originLabel[m.segment.origin] : m.segment?.origin === 'practice' ? m.view?.completed ? 'Practice complete' : 'Practice paused' : 'Call ended'}</span>
        {activeLive && <button onClick={() => { void m.stop(); }}>End Call</button>}
        <button onClick={() => restartDialog.current?.showModal()} disabled={m.busy && !m.connected}>Restart</button>
      </div>}
    </header>
    <main id="main" tabIndex={-1}>
      {m.stage === 'briefing' ? <><Briefing missionKind={m.missionKind} onMissionKind={m.setMissionKind} optionalObjective={m.optionalObjective} onOptionalObjective={m.setOptionalObjective} scenario={m.scenario} mode={m.mode} onScenario={m.setScenario} onMode={m.chooseMode} onStart={() => m.requestStart()} onVoice={() => m.requestStart('live_voice')} busy={m.busy} error={m.error} startDisabled={m.dispatchStartBlocked} switchyardSetup={<SwitchyardDispatchSetup value={m.remixSetup} onChange={m.chooseRemix} availability={m.dispatchAvailability} loading={m.dispatchLoading} busy={m.busy} history={m.journeys} onClear={m.clearJourneys} onRefresh={m.refreshDispatch}/>}/>{m.busy && <button className="secondary-button setup-cancel" onClick={() => { void m.stop(); }}>Cancel start</button>}</>
        : <>
          {m.error && <div className="error-banner" role="alert"><strong>Mission needs attention.</strong> {m.error} <span>Progress is stored in server memory. If the server restarted, use Restart to begin again.</span></div>}
          {m.warning && <p className="warning-banner" role="status">{m.warning}</p>}
          {m.stage === 'debrief' && m.view?.completed ? <>
            {m.view.missionKind === 'switchyard' ? <SwitchyardEnding provenance={m.remixProvenance} onDispatch={choice => { void m.prepareDispatch(choice); }} onBriefing={() => { void m.newBriefing('classic', 'rescue'); }} practice={m.segment?.origin === 'practice'} view={m.view} record={m.record} closingCaption={closingCaption} onReplay={() => { void m.newBriefing('classic', 'switchyard'); }} busy={m.busy}/> : <Suspense fallback={<p role="status">Arrival confirmed. Opening the recovery bay…</p>}><Debrief view={m.view} scenario={m.view.scenario} record={m.record} closingCaption={closingCaption} onReplay={() => { void m.newBriefing(m.view!.scenario, m.view!.missionKind); }} onMaintenance={() => { void m.newBriefing('maintenance', 'training'); }} onBriefing={() => { void m.newBriefing(m.scenario); }} busy={m.busy} connectionEnded={!m.connected && !m.busy} practice={m.segment?.origin === 'practice'}/></Suspense>}
            <details className="debrief-history"><summary>Conversation & notebook</summary><Notebook record={m.record} onNote={m.note}/>{m.captions.map(item => <MessageQuote key={item.id} item={item} onPin={id => { void m.pin(id); }} historical/>)}</details>
          </> : <>{m.view && <ChapterHeader view={m.view} presentation={presentation} onPresentation={() => setPresentation(value => !value)}/>}<nav className="mission-jump" aria-label="Mission console navigation"><a href="#radio-console">Radio &amp; action</a><a href="#mission-documents">Documents &amp; controls</a></nav><div className={'mission-layout' + (m.view?.missionKind === 'switchyard' ? ' switchyard-layout' : '')}>
            <div className="mission-desk" id="mission-documents" tabIndex={-1}>
              {m.view?.missionKind === 'switchyard' && m.view.switchyardPanel ? <>
                {m.view.switchyardPanel.dispatch && <SwitchyardDispatchCard dispatch={m.view.switchyardPanel.dispatch}/>}
                <SwitchyardDocument key={m.view.roundId} captions={m.captions} roundId={m.view.roundId} currentVisit={m.switchyardCurrentVisit} panelRevision={m.view.switchyardPanel.panelRevision} stateRevision={m.view.revision} panel={m.view.switchyardPanel} initialIntendedApproach={m.intendedApproach}/>
                <SwitchyardPanel roundId={m.view.roundId} applied={m.view.switchyardPanel} enabled={m.connected && !m.busy && m.view.status === 'active' && !m.view.completed} pending={m.controlPending === 'routing_panel'} error={m.error} onApply={m.applyRouting}/>
              </> : <>
              <MissionDocuments key={m.view?.chapter} scenario={m.view?.scenario ?? m.scenario} chapter={m.view?.chapter} returnDock={m.view?.returnDock} optionalObjective={m.view?.optionalObjective} annotation={m.record?.annotations} record={m.record} onAnnotation={m.annotate} onPin={m.pin} onQuickRequest={m.quickRequest} requestEnabled={m.connected && !m.busy && !m.view?.completed} busy={m.busy}/>
              {m.view && <HumanControls view={m.view} connected={m.connected} busy={m.busy} pending={m.controlPending} changePower={m.changePower} changeRelay={m.changeRelay} dockControl={m.dockControl}/>}
              </>}
              <details className="desk-extras"><summary>Field notebook <span>Private notes &amp; pinned reports</span></summary><Notebook key={m.view?.roundId} record={m.record} onNote={m.note}/></details>
              <>{m.view?.missionKind === 'switchyard' ? <SwitchyardHelp hint={m.hint} onHint={level => { void m.askHint(level); }} context={m.view.status !== 'active' ? 'The mission is paused. Reading help does not resume it.' : m.view.proposal?.status === 'awaiting_confirmation' ? 'Your exact proposal is still unexecuted. Help leaves that decision with you.' : m.captions.some(item => isSwitchyardGuideReport(item, m.captions, m.view!.roundId)) ? 'Keep Pip\'s report beside the manual. A connected circuit does not prove machinery ready.' : 'You have the documents. A local report can supply the missing equipment information.'}/> : <details className="hint-panel"><summary>Need a nudge?</summary><p>Hints are optional. They use this chapter's guide, with no AI calls.</p><div className="hint-actions">{([1, 2, 3] as const).map(level => <button key={level} onClick={() => { void m.askHint(level); }}>Hint {level}</button>)}</div>{m.hint && <div><span className="source-label">Mission guide · {chapterNames[m.view?.chapter ?? 'cargo']} · Private</span><p role="status" className="hint-copy">{m.hint}</p></div>}</details>}</>
            </div>
            <aside className="companion-console" id="radio-console" tabIndex={-1} aria-label="Pip radio console">
              <div className="console-heading"><span className="console-kicker">Your partner</span><span className="unit-label">UNIT 04</span></div>
              <PipPortrait state={m.pipState as PipState} compact/>
              <CommunicationDock key={m.view?.roundId} mission={m}/>


            </aside>
          </div></>}
        </>}
    </main>
    {m.readinessMode && <LocalReadiness mode={m.readinessMode} voiceVolume={m.voiceVolume} onReady={m.confirmReady} onCancel={m.cancelReadiness} onPractice={m.readinessPractice} onText={m.readinessText}/>}
    <footer className="app-footer"><span>One human. One robot. A shared way home.</span><span>Mission memory lasts while this server is running.</span></footer>
    <dialog ref={restartDialog} className="restart-dialog" aria-labelledby="restart-title">
      <h2 id="restart-title">Restart this mission?</h2><p>This ends the call and clears this round's progress, captions, notes, and context. You will return to the briefing.</p>
      <div className="dialog-actions"><button onClick={() => restartDialog.current?.close()} autoFocus>Keep playing</button><button className="danger-button" onClick={() => { restartDialog.current?.close(); void m.newBriefing(m.view?.scenario ?? m.scenario); }}>Restart mission</button></div>
    </dialog>
  </div></SwitchyardGuideProvider>;
}
