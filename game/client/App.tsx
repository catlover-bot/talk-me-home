import { useRef } from 'react';
import { useMission, originLabel } from './useMission';
import { Briefing } from './components/Briefing';
import { MissionDocuments } from './components/MissionDocuments';
import { PipPortrait, type PipState } from './components/PipPortrait';
import { Debrief } from './components/Debrief';
import { Notebook } from './components/Notebook';
import { CommunicationDock, MessageQuote } from './components/CommunicationDock';

export default function App() {
  const m = useMission();
  const restartDialog = useRef<HTMLDialogElement>(null);
  const activeLive = m.segment?.origin !== 'practice' && (m.connected || m.busy) && m.stage !== 'briefing';
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to mission controls</a>
    <header className="topbar">
      <span className="wordmark"><span className="brand-symbol" aria-hidden="true">↗</span>Talk Me Home</span>
      <span className="mission-bar">{m.stage === 'briefing' ? 'Mission Control' : (m.view?.scenario === 'maintenance' ? 'Maintenance' : 'Classic') + ' / Cargo bay'}</span>
      {m.stage !== 'briefing' && <div className="topbar-actions">
        <span className="mode-badge">{m.connected && m.segment ? originLabel[m.segment.origin] : m.segment?.origin === 'practice' ? m.view?.completed ? 'Practice complete' : 'Practice paused' : 'Call ended'}</span>
        {activeLive && <button onClick={() => { void m.stop(); }}>End Call</button>}
        <button onClick={() => restartDialog.current?.showModal()} disabled={m.busy && !m.connected}>Restart</button>
      </div>}
    </header>
    <main id="main" tabIndex={-1}>
      {m.stage === 'briefing' ? <><Briefing scenario={m.scenario} mode={m.mode} onScenario={m.setScenario} onMode={m.chooseMode} onStart={m.start} busy={m.busy} error={m.error}/>{m.busy && <button className="secondary-button setup-cancel" onClick={() => { void m.stop(); }}>Cancel start</button>}</>
        : <>
          {m.error && <div className="error-banner" role="alert"><strong>Connection needs attention.</strong> {m.error} <span>Progress is stored in server memory. If the server restarted, use Restart to begin again.</span></div>}
          {m.warning && <p className="warning-banner" role="status">{m.warning}</p>}
          {m.stage === 'debrief' && m.view?.completed ? <>
            <Debrief scenario={m.view.scenario} record={m.record} onReplay={() => { void m.newBriefing(m.view!.scenario); }} onMaintenance={() => { void m.newBriefing('maintenance'); }} onBriefing={() => { void m.newBriefing(m.scenario); }} busy={m.busy} connectionEnded={!m.connected && !m.busy} practice={m.segment?.origin === 'practice'}/>
            <div className="closing-caption"><span className="source-label">{m.activeCaption ? originLabel[m.activeCaption.origin] : 'Mission'} · {m.activeCaption?.role === 'human' ? 'Mission Control' : 'Pip'}</span><p data-testid="caption" aria-live={m.activeCaption?.final ? 'polite' : 'off'}>{m.activeCaption?.text ?? 'Arrival confirmed.'}</p>{m.activeCaption?.interrupted && <span>Interrupted / incomplete speech</span>}</div>
            <details className="debrief-history"><summary>Conversation & notebook</summary><Notebook record={m.record} onNote={m.note}/>{m.captions.map(item => <MessageQuote key={item.id} item={item} onPin={id => { void m.pin(id); }} historical/>)}</details>
          </> : <div className="mission-layout">
            <div className="mission-desk">
              <MissionDocuments scenario={m.view?.scenario ?? m.scenario}/>
              <section className="power-control" aria-labelledby="power-heading">
                <div><h2 id="power-heading">Remote Power</h2><p>Acknowledged: <strong data-testid="acknowledged-power">{m.view?.powerOn ? 'ON' : 'OFF'}</strong></p></div>
                <div className="power-buttons">{[true, false].map(value => <button key={String(value)} aria-label={'Power ' + (value ? 'ON' : 'OFF')} aria-pressed={m.view?.powerOn === value} disabled={!m.connected || m.busy || m.view?.completed || m.powerPending !== null || m.view?.powerOn === value} onClick={() => { void m.changePower(value); }}>{m.powerPending === value ? 'Sending…' : value ? 'Power ON' : 'Power OFF'}</button>)}</div>
                <p className="power-explanation">{m.powerPending !== null ? 'Waiting for the server to acknowledge your command.' : !m.connected ? 'Resume communication to use remote Power.' : 'Tell Pip when you change Power. Ask for a fresh local check.'}</p>
              </section>
              <Notebook key={m.view?.roundId} record={m.record} onNote={m.note}/>
              <details className="hint-panel"><summary>Need a nudge?</summary><p>Hints are optional. They use the mission guide, with no AI calls.</p><div className="hint-actions"><button onClick={() => { void m.askHint(1); }}>Hint 1</button><button onClick={() => { void m.askHint(2); }}>Hint 2</button></div>{m.hint && <p role="status" className="hint-copy">{m.hint}</p>}</details>
            </div>
            <aside className="companion-console" aria-label="Pip radio console">
              <div className="console-heading"><span className="console-kicker">Your partner</span><span className="unit-label">UNIT 04</span></div>
              <PipPortrait state={m.pipState as PipState} compact/>
              <CommunicationDock key={m.view?.roundId} mission={m}/>
            </aside>
          </div>}
        </>}
    </main>
    <footer className="app-footer"><span>One human. One robot. A shared way home.</span><span>Mission memory lasts while this server is running.</span></footer>
    <dialog ref={restartDialog} className="restart-dialog" aria-labelledby="restart-title">
      <h2 id="restart-title">Restart this mission?</h2><p>This ends the call and clears this round's progress, captions, notes, and context. You will return to the briefing.</p>
      <div className="dialog-actions"><button onClick={() => restartDialog.current?.close()} autoFocus>Keep playing</button><button className="danger-button" onClick={() => { restartDialog.current?.close(); void m.newBriefing(m.view?.scenario ?? m.scenario); }}>Restart mission</button></div>
    </dialog>
  </div>;
}
