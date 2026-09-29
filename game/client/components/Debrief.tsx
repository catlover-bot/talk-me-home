import type { HumanView, MissionRecord, Scenario } from "../../shared/contracts";
import type { ReactNode } from 'react';
import { PipPortrait } from "./PipPortrait";
import { Homecoming } from './Homecoming';
import { chapterNames } from './ChapterHeader';

export interface DebriefProps {
  scenario: Scenario;
  view?: HumanView;
  record: MissionRecord | null;
  onReplay(): void;
  onMaintenance(): void;
  onBriefing(): void;
  busy?: boolean;
  connectionEnded?: boolean;
  practice?: boolean;
  closingCaption?: ReactNode;
}

/** Mount only after the authoritative human projection confirms arrival. */
export function Debrief({
  scenario,
  view,
  record,
  onReplay,
  onMaintenance,
  onBriefing,
  busy = false,
  connectionEnded = false,
  practice = false,
  closingCaption,
}: DebriefProps) {
  const timeline = record?.debrief?.timeline ?? [];
  const rescue = view?.missionKind === 'rescue';
  const humanActions = timeline.filter(
    (entry) => entry.actor === "human" && ['power', 'relay', 'dock'].includes(entry.kind),
  ).length;
  const robotActions = timeline.filter(
    (entry) => entry.actor === "robot" && entry.kind === "action",
  ).length;
  const eventList = timeline.length ? <ol className="collaboration-timeline" tabIndex={0} aria-label="Confirmed collaboration events. Scroll for a longer timeline.">{timeline.map(entry => <li key={entry.id}><span className={`timeline-actor actor-${entry.actor}`}>{entry.actor === 'human' ? 'You' : entry.actor === 'robot' ? 'Pip' : 'Mission'}</span><div>{rescue && entry.chapter && <span className="timeline-chapter">{chapterNames[entry.chapter]}</span>}<p>{entry.actor === 'robot' ? entry.text.replace(/^You\b/, 'Pip') : entry.text}</p></div></li>)}</ol> : <p className="debrief-loading">Loading this round’s confirmed record…</p>;
  return (
    <section className={`debrief ${rescue ? 'rescue-debrief' : ''}`} aria-labelledby="debrief-title">
      <div className="debrief-companion">
        <span className="arrival-stamp">
          <span aria-hidden="true">✓</span>Arrival confirmed
        </span>
        {rescue && view.completed ? <Homecoming chaptersCleared={view.chaptersCleared} recoveredFlightRecorder={view.recoveredFlightRecorder === true} /> : <PipPortrait state="success" />}
        <p>
          {rescue ? 'One small robot. Two good partners.' : 'A safe crossing. A shared effort.'}
        </p>
        <span className="debrief-connection" role="status">
          {practice ? 'Practice complete · no provider connection' : connectionEnded
            ? "Call ended · microphone released"
            : "Closing the connection…"}
        </span>
      </div>
      <div className="debrief-paper">
        <p className="section-kicker">
          {rescue ? 'Rescue Mission' : `${scenario === "classic" ? "Classic" : "Maintenance"} Training`} · Mission debrief
        </p>
        <h1 id="debrief-title">{rescue ? 'You brought Pip home.' : 'You got Pip through.'}</h1>
        <p className="debrief-intro">
          {rescue ? 'The station is behind you. Your partner is home.' : 'You brought the documents and remote controls. Pip brought local eyes and hands. This is what you did together.'}
        </p>
        {rescue && <p className="home-story" data-testid="home-story"><span>Recovery bay · story</span>{view?.recoveredFlightRecorder ? 'And on the shelf: the flight recorder you chose to bring back.' : 'A safe arrival. That was always enough.'}</p>}
        {closingCaption}
        <details className="debrief-record" open={rescue ? undefined : true}><summary>{rescue ? 'Remember the journey' : 'Your collaboration record'}</summary>
        <div className="contribution-strip" aria-label="Retained collaboration record counts">
          <span>
            <strong>{record?.debrief ? humanActions : '—'}</strong>acknowledged remote{" "}
            {humanActions === 1 ? "command" : "commands"}
          </span>
          <span>
            <strong>{record?.debrief ? robotActions : '—'}</strong>completed local{" "}
            {robotActions === 1 ? "action" : "actions"}
          </span>
          <span>
            <strong>{record?.debrief ? record.hintUses?.length ?? record.hintsUsed.length : '—'}</strong>
            {(record?.hintUses?.length ?? record?.hintsUsed.length) === 1 ? "hint used" : "hints used"}
          </span>
        </div>
        <h2>{rescue ? 'Your journey together' : 'Your collaboration'}</h2>
        {rescue ? <><p className="journey-source">From this mission’s retained record. Your controls and Pip’s actions made the journey possible.</p><ol className="journey-summary">{(['cargo', 'gallery', 'return_dock'] as const).map((chapter, index) => {
          const last = timeline.findLast(entry => entry.chapter === chapter && entry.actor === 'robot' && entry.kind === 'action');
          const sentence = last?.text.replace(/^You\b/, 'Pip').split(/(?<=[.!?])\s+/)[0];
          return <li key={chapter}><span className="journey-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h3>{chapterNames[chapter]}</h3><p>{sentence ?? (record?.debrief ? 'No local action is retained in this chapter’s record.' : 'Loading the confirmed record…')}</p></div></li>;
        })}</ol><details className="full-timeline"><summary>Full collaboration record ({timeline.length} events)</summary>{eventList}</details></> : eventList}
        {record?.debrief?.truncated && (
          <p className="timeline-footnote">
            The newest events are shown. This round’s record exceeded its
            history limit.
          </p>
        )}
        </details>
        <div className="debrief-actions">
          <button className={rescue ? 'secondary-button' : 'primary-button'} onClick={onReplay} disabled={busy}>
            {rescue ? 'Start another rescue' : `Play ${scenario === "classic" ? "Classic" : "Maintenance"} again`}
            <span aria-hidden="true">↗</span>
          </button>
          {rescue && <button className="secondary-button" onClick={onMaintenance} disabled={busy}>Try Training</button>}
          {!rescue && scenario === "classic" && (
            <button
              className="secondary-button"
              onClick={onMaintenance}
              disabled={busy}
            >
              Try Maintenance
            </button>
          )}
          <button className="text-button" onClick={onBriefing} disabled={busy}>Return to briefing</button>
        </div>
        <p className="replay-note">
          Choose how to connect before the next mission. No Live call starts
          automatically.
        </p>
      </div>
    </section>
  );
}
