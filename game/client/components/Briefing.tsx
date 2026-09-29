import type { HumanView, MissionKind, Scenario, TransportOrigin } from '../../shared/contracts';
import { PipPortrait } from './PipPortrait';

export interface BriefingProps {
  scenario: Scenario; missionKind: MissionKind; mode: TransportOrigin;
  onScenario(scenario: Scenario): void; onMissionKind(kind: MissionKind): void;
  onMode(mode: TransportOrigin): void; onStart(): void; onVoice(): void;
  optionalObjective?: HumanView['optionalObjective']; onOptionalObjective(value: HumanView['optionalObjective']): void;
  busy?: boolean; error?: string;
}

export function Briefing({ scenario, missionKind, mode, onScenario, onMissionKind, onMode, onStart, onVoice, optionalObjective, onOptionalObjective, busy = false, error }: BriefingProps) {
  return <section className="briefing release-briefing" aria-labelledby="briefing-title">
    <div className="title-scene">
      <img className="title-landscape" src="/art/mission-control.svg" alt="Illustration of Mission Control overlooking a warmly lit, isolated station in a rocky landscape." width="1600" height="780" fetchPriority="high" />
      <div className="title-copy">
        <p className="title-eyebrow">A voice co-op rescue game · One human, one robot</p>
        <h1 id="briefing-title">A little guidance.<br/><em>A long way home.</em></h1>
        <p className="briefing-premise">You have the map. Pip has eyes and hands.<br/>Neither can get home alone.</p>
        <span className="title-frequency"><span aria-hidden="true"/>Begin with a question: “Pip, what can you see?”</span>
      </div>
      <div className="title-pip"><PipPortrait state="offline"/><span>PIP / UNIT 04</span></div>
      <span className="illustration-label">Title illustration</span>
    </div>
    <div className="briefing-paper">
      <div className="setup-columns">
        <fieldset className="setup-fieldset">
          <legend>01 / Choose your mission</legend>
          <div className="scenario-choices">
            <label className="scenario-choice" data-selected={missionKind === 'rescue'}>
              <input type="radio" name="mission-kind" checked={missionKind === 'rescue'} onChange={() => onMissionKind('rescue')} disabled={busy}/>
              <span><strong>Rescue Mission</strong><small>Three chapters. Bring Pip home.</small></span>
            </label>
            <label className="scenario-choice" data-selected={missionKind === 'training'}>
              <input type="radio" name="mission-kind" checked={missionKind === 'training'} onChange={() => onMissionKind('training')} disabled={busy}/>
              <span><strong>Training</strong><small>One room. A shorter first step.</small></span>
            </label>
          </div>
          {missionKind === 'training' ? <div className="training-choice"><label htmlFor="training-scenario">Training exercise</label><select id="training-scenario" value={scenario} onChange={event => onScenario(event.target.value as Scenario)} disabled={busy}><option value="classic">Classic — the first Door</option><option value="maintenance">Maintenance — a module clue</option></select></div>
            : <><ol className="briefing-journey" aria-label="Rescue Mission chapters"><li><span>01</span>Cargo Bay</li><li><span>02</span>Relay Gallery</li><li><span>03</span>Return Dock</li></ol>
              <label className="recorder-choice"><input type="checkbox" aria-label="Bring back the flight recorder" checked={optionalObjective === 'flight_recorder'} onChange={event => onOptionalObjective(event.target.checked ? 'flight_recorder' : undefined)} disabled={busy} aria-describedby="recorder-choice-detail"/><span><strong>Bring back the flight recorder</strong><small id="recorder-choice-detail">Optional · archive at Leaf. A direct rescue is complete too.</small></span></label></>}
        </fieldset>
        <fieldset className="setup-fieldset">
          <legend>02 / Choose your connection</legend>
          <div className="mode-choices">
            {([['practice', 'Practice', 'Simulation · type to play'], ['live_voice', 'Live Voice', 'Speak with AssemblyAI'], ['live_text', 'Live Text', 'Type with AssemblyAI']] as const).map(([value, name, copy]) =>
              <label key={value} className="mode-choice" data-selected={mode === value}><input type="radio" name="connection-mode" checked={mode === value} onChange={() => onMode(value)} disabled={busy}/><span><strong>{name}</strong><small>{copy}</small></span></label>)}
          </div>
          <p className="connection-explanation" id="connection-explanation">{mode === 'practice' ? <><strong>Practice is free of API calls.</strong> Deterministic, offline conversation. No microphone.</> : <><strong>{mode === 'live_voice' ? 'Microphone and text go to AssemblyAI.' : 'Text goes to AssemblyAI. No microphone.'}</strong> Live uses provider time. Calls last at most 10 minutes; Pause ends the call.</>}</p>
        </fieldset>
      </div>
      {error && <p className="briefing-error" role="alert">{error}</p>}
      <div className="launch-row">
        <div className="briefing-action">
          {mode === 'practice' && <button className="primary-button voice-launch" onClick={onVoice} disabled={busy}>Play with voice <span aria-hidden="true">↗</span></button>}
          <button className={mode === 'practice' ? 'secondary-button' : 'primary-button'} onClick={onStart} disabled={busy} aria-describedby="connection-explanation">{busy ? 'Preparing mission…' : mode === 'practice' ? 'Start Practice' : mode === 'live_voice' ? 'Start with Voice' : 'Start with Text'}</button>
        </div>
        <p className="launch-note">Talk with Pip. Confirm proposed actions on the console.<br/>Spoken “yes” is not a confirmation.</p>
        <details className="quick-guide">
          <summary>Quick guide <span>Optional</span></summary>
          <p>You have the plans and remote switches. Pip sees and handles nearby equipment.</p>
          <ol>
            <li><strong>Ask, then decide</strong><p>Try “What can you see?” Compare Pip’s report with your document. Your route marks stay private.</p></li>
            <li><strong>Confirm one action</strong><p>Read Pip’s proposal and confirm it on the console. Looking and inspecting need no confirmation.</p></li>
            <li><strong>Pause when needed</strong><p>Pause keeps progress and ends any Live call. Resume explicitly. Refresh or server restart loses this mission.</p></li>
          </ol>
        </details>
      </div>
    </div>
  </section>;
}
