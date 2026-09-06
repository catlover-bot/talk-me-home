import type { MissionRecord, Scenario } from "../../shared/contracts";
import { PipPortrait } from "./PipPortrait";

export interface DebriefProps {
  scenario: Scenario;
  record: MissionRecord | null;
  onReplay(): void;
  onMaintenance(): void;
  onBriefing(): void;
  busy?: boolean;
  connectionEnded?: boolean;
  practice?: boolean;
}

/** Mount only after the authoritative human projection confirms arrival. */
export function Debrief({
  scenario,
  record,
  onReplay,
  onMaintenance,
  onBriefing,
  busy = false,
  connectionEnded = false,
  practice = false,
}: DebriefProps) {
  const timeline = record?.debrief?.timeline ?? [];
  const humanActions = timeline.filter(
    (entry) => entry.actor === "human" && entry.kind === "power",
  ).length;
  const robotActions = timeline.filter(
    (entry) => entry.actor === "robot" && entry.kind === "action",
  ).length;
  return (
    <section className="debrief" aria-labelledby="debrief-title">
      <div className="debrief-companion">
        <span className="arrival-stamp">
          <span aria-hidden="true">✓</span>Arrival confirmed
        </span>
        <PipPortrait state="success" />
        <p>
          A safe arrival.
          <br />A shared effort.
        </p>
        <span className="debrief-connection" role="status">
          {practice ? 'Practice complete · no provider connection' : connectionEnded
            ? "Call ended · microphone released"
            : "Closing the connection…"}
        </span>
      </div>
      <div className="debrief-paper">
        <p className="section-kicker">
          {scenario === "classic" ? "Classic" : "Maintenance"} · Mission debrief
        </p>
        <h1 id="debrief-title">You got Pip through.</h1>
        <p className="debrief-intro">
          You brought the documents and remote Power. Pip brought local eyes and
          hands. This is what you did together.
        </p>
        <div className="contribution-strip">
          <span>
            <strong>{record?.debrief ? humanActions : '—'}</strong>acknowledged Power{" "}
            {humanActions === 1 ? "command" : "commands"}
          </span>
          <span>
            <strong>{record?.debrief ? robotActions : '—'}</strong>completed local{" "}
            {robotActions === 1 ? "action" : "actions"}
          </span>
          <span>
            <strong>{record?.debrief ? record.hintsUsed.length : '—'}</strong>
            {record?.hintsUsed.length === 1 ? "hint used" : "hints used"}
          </span>
        </div>
        <h2>Your collaboration</h2>
        {timeline.length ? (
          <ol className="collaboration-timeline" tabIndex={0} aria-label="Confirmed collaboration events. Scroll for a longer timeline.">
            {timeline.map((entry) => (
              <li key={entry.id}>
                <span className={`timeline-actor actor-${entry.actor}`}>
                  {entry.actor === "human"
                    ? "You"
                    : entry.actor === "robot"
                      ? "Pip"
                      : "Mission"}
                </span>
                <p>{entry.actor === 'robot' ? entry.text.replace(/^You\b/, 'Pip') : entry.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="debrief-loading">
            Loading this round’s confirmed record…
          </p>
        )}
        {record?.debrief?.truncated && (
          <p className="timeline-footnote">
            The newest events are shown. This round’s record exceeded its
            history limit.
          </p>
        )}
        <div className="debrief-actions">
          <button className="primary-button" onClick={onReplay} disabled={busy}>
            Play {scenario === "classic" ? "Classic" : "Maintenance"} again
            <span aria-hidden="true">↗</span>
          </button>
          {scenario === "classic" && (
            <button
              className="secondary-button"
              onClick={onMaintenance}
              disabled={busy}
            >
              Try Maintenance
            </button>
          )}
          <button className="text-button" onClick={onBriefing} disabled={busy}>
            Return to briefing
          </button>
        </div>
        <p className="replay-note">
          Choose how to connect before the next mission. No Live call starts
          automatically.
        </p>
      </div>
    </section>
  );
}
