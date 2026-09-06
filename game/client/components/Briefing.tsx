import type { Scenario, TransportOrigin } from "../../shared/contracts";
import { PipPortrait } from "./PipPortrait";

export interface BriefingProps {
  scenario: Scenario;
  mode: TransportOrigin;
  onScenario(scenario: Scenario): void;
  onMode(mode: TransportOrigin): void;
  onStart(): void;
  busy?: boolean;
  error?: string;
}

export function Briefing({
  scenario,
  mode,
  onScenario,
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
            Help a stranded maintenance robot through a cargo bay. Read your
            documents, share clues, and coordinate your next move.
          </p>
        </div>
        <fieldset className="setup-fieldset">
          <legend>Choose your mission</legend>
          <div className="scenario-choices">
            <label
              className="scenario-choice"
              data-selected={scenario === "classic"}
            >
              <input
                type="radio"
                name="scenario"
                value="classic"
                checked={scenario === "classic"}
                onChange={() => onScenario("classic")}
                disabled={busy}
              />
              <span>
                <strong>Classic</strong>
                <small>Start with the first Door.</small>
              </span>
              <span className="choice-index" aria-hidden="true">
                01
              </span>
            </label>
            <label
              className="scenario-choice"
              data-selected={scenario === "maintenance"}
            >
              <input
                type="radio"
                name="scenario"
                value="maintenance"
                checked={scenario === "maintenance"}
                onChange={() => onScenario("maintenance")}
                disabled={busy}
              />
              <span>
                <strong>Maintenance</strong>
                <small>A new clue in the same room.</small>
              </span>
              <span className="choice-index" aria-hidden="true">
                02
              </span>
            </label>
          </div>
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
              <b>You</b> Documents &amp; remote Power
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
