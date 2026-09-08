import type { MissionKind, Scenario, TransportOrigin } from "../../shared/contracts";
import { PipPortrait } from "./PipPortrait";

export interface BriefingProps {
  scenario: Scenario;
  missionKind: MissionKind;
  mode: TransportOrigin;
  onScenario(scenario: Scenario): void;
  onMissionKind(kind: MissionKind): void;
  onMode(mode: TransportOrigin): void;
  onStart(): void;
  busy?: boolean;
  error?: string;
}

export function Briefing({
  scenario,
  missionKind,
  mode,
  onScenario,
  onMissionKind,
  onMode,
  onStart,
  busy = false,
  error,
}: BriefingProps) {
  return (
    <section className="briefing" aria-labelledby="briefing-title">
      <div className="briefing-paper">
        <p className="section-kicker">
          <span className="paper-marker" aria-hidden="true" />
          Mission briefing
        </p>
        <h1 id="briefing-title">
          A little guidance.
          <br />A long way home.
        </h1>
        <p className="briefing-premise">
          You have the map. Pip has eyes and hands.
          <br className="desktop-break" /> Neither can escape alone.
        </p>
        <div className="role-note">
          <span aria-hidden="true">↗</span>
          <p>
            Bring a stranded maintenance robot home. Read your documents,
            share what each of you knows, and find the next step together.
          </p>
        </div>
        <fieldset className="setup-fieldset">
          <legend>Choose your mission</legend>
          <div className="scenario-choices">
            <label
              className="scenario-choice"
              data-selected={missionKind === "rescue"}
            >
              <input
                type="radio"
                name="mission-kind"
                value="rescue"
                checked={missionKind === "rescue"}
                onChange={() => onMissionKind("rescue")}
                disabled={busy}
              />
              <span>
                <strong>Rescue Mission <span className="recommended-label">Recommended</span></strong>
                <small>Three chapters. One way home.</small>
              </span>
              <span className="choice-index" aria-hidden="true">
                03
              </span>
            </label>
            <label
              className="scenario-choice"
              data-selected={missionKind === "training"}
            >
              <input
                type="radio"
                name="mission-kind"
                value="training"
                checked={missionKind === "training"}
                onChange={() => onMissionKind("training")}
                disabled={busy}
              />
              <span>
                <strong>Training</strong>
                <small>One room. A shorter first step.</small>
              </span>
              <span className="choice-index" aria-hidden="true">
                01
              </span>
            </label>
          </div>
          {missionKind === "training" ? <div className="training-choice"><label htmlFor="training-scenario">Training exercise</label><select id="training-scenario" value={scenario} onChange={event => onScenario(event.target.value as Scenario)} disabled={busy}><option value="classic">Classic — the first Door</option><option value="maintenance">Maintenance — a module clue</option></select></div> : <ol className="briefing-journey" aria-label="Rescue Mission chapters"><li><span>01</span>Cargo Bay</li><li><span>02</span>Relay Gallery</li><li><span>03</span>Return Dock</li></ol>}
        </fieldset>
        <fieldset className="setup-fieldset">
          <legend>How would you like to talk?</legend>
          <div className="mode-choices">
            <label className="mode-choice" data-selected={mode === "practice"}>
              <input
                type="radio"
                name="connection-mode"
                value="practice"
                checked={mode === "practice"}
                onChange={() => onMode("practice")}
                disabled={busy}
              />
              <span>
                <strong>Practice</strong>
                <small>Simulation · type to play</small>
              </span>
            </label>
            <label
              className="mode-choice"
              data-selected={mode === "live_voice"}
            >
              <input
                type="radio"
                name="connection-mode"
                value="live_voice"
                checked={mode === "live_voice"}
                onChange={() => onMode("live_voice")}
                disabled={busy}
              />
              <span>
                <strong>Live Voice</strong>
                <small>Speak with AssemblyAI</small>
              </span>
            </label>
            <label className="mode-choice" data-selected={mode === "live_text"}>
              <input
                type="radio"
                name="connection-mode"
                value="live_text"
                checked={mode === "live_text"}
                onChange={() => onMode("live_text")}
                disabled={busy}
              />
              <span>
                <strong>Live Text</strong>
                <small>Type with AssemblyAI</small>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="connection-explanation" id="connection-explanation">
          {mode === "practice" ? (
            <p>
              <strong>Practice is free of API calls.</strong> Pip uses
              deterministic replies. No microphone, speech recognition, or AI
              conversation.
            </p>
          ) : (
            <p>
              <strong>
                {mode === "live_voice"
                  ? "Your microphone and typed messages go to AssemblyAI."
                  : "Your typed messages go to AssemblyAI. No microphone is used."}
              </strong>{" "}
              Live uses provider time, including text. Calls end after at most
              10 minutes. Pause ends the call.
            </p>
          )}
        </div>
        {error && (
          <p className="briefing-error" role="alert">
            {error}
          </p>
        )}
        <div className="briefing-action">
          <button
            className="primary-button"
            onClick={onStart}
            disabled={busy}
            aria-describedby="connection-explanation"
          >
            {busy
              ? "Preparing mission…"
              : mode === "practice"
                ? "Start Practice"
                : mode === "live_voice"
                  ? "Start with Voice"
                  : "Start with Text"}
            <span aria-hidden="true">↗</span>
          </button>
          <span>No countdown. Take your time.</span>
        </div>
        <details className="quick-guide">
          <summary>Quick guide <span>Optional · how the desk works</span></summary>
          <p>The remote sensors are damaged. You have the plans; Pip supplies the local checks.</p>
          <ol>
            <li><strong>Your map</strong><p>Read the static documents and compare them with what Pip reports. They are not a live camera.</p></li>
            <li><strong>Your controls</strong><p>You handle remote equipment. Tell Pip when you change it; Pip performs the local actions.</p></li>
            <li><strong>Talk with Pip</strong><p>Speak in Live Voice or type a message. Captions and history keep both sides of the conversation.</p></li>
            <li><strong>Pause when needed</strong><p>Pause keeps this mission’s progress and ends any Live call. Resume explicitly when you are ready.</p></li>
          </ol>
        </details>
      </div>
      <aside className="briefing-companion" aria-label="Meet your partner">
        <div className="companion-intro">
          <span className="console-kicker">Your partner on the other end</span>
          <span className="unit-label">04</span>
        </div>
        <PipPortrait state="offline" />
        <div className="companion-intro-copy">
          <h2>Meet Pip.</h2>
          <p>
            A practical little robot,
            <br />
            with a way home to figure out.
          </p>
          <div className="partner-roles">
            <span>
              <b>You</b> Documents &amp; remote controls
            </span>
            <span>
              <b>Pip</b> Local eyes &amp; hands
            </span>
          </div>
        </div>
        <span className="console-footnote">
          One human. One robot. A shared plan.
        </span>
      </aside>
    </section>
  );
}
