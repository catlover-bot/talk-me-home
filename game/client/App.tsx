import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HumanView } from "../shared/contracts";
import {
  createSession,
  executeTool,
  getSession,
  lifecycle,
  requestId,
  setPower,
  voiceToken,
  type RobotCall,
} from "./api";
import { simulationReply, simulationSpeech } from "./mock";
import { copy } from "./strings";
import { LiveVoice, type TranscriptEntry, type VoiceStatus } from "./voice";

function MissionMap() {
  return (
    <svg
      className="facility-map"
      viewBox="0 0 800 250"
      role="img"
      aria-labelledby="map-title map-description"
    >
      <title id="map-title">Cargo bay route map</title>
      <desc id="map-description">
        Static floor plan: the cargo platform leads across a Conveyor, through a
        Door, to the far side. This map does not show current equipment
        conditions or the robot's live position.
      </desc>
      <defs>
        <pattern
          id="map-grid"
          width="25"
          height="25"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 25 0 L 0 0 0 25"
            fill="none"
            stroke="currentColor"
            strokeWidth=".6"
            opacity=".1"
          />
        </pattern>
        <pattern
          id="conveyor-lines"
          width="17"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 2 0 V 12"
            stroke="currentColor"
            strokeWidth="1"
            opacity=".3"
          />
        </pattern>
      </defs>
      <rect width="800" height="250" fill="url(#map-grid)" />
      <g className="map-dimension">
        <path d="M 96 31 H 704 M 96 25 V 37 M 704 25 V 37" />
        <text x="400" y="18" textAnchor="middle">
          CARGO TRANSIT / DECK 04
        </text>
      </g>
      <path className="room-fill" d="M 94 55 H 704 V 195 H 94 Z" />
      <path
        className="room-wall"
        d="M 601 55 H 94 V 195 H 601 M 608 55 H 704 V 195 H 608 M 605 55 V 91 M 605 161 V 195"
      />
      <rect
        x="330"
        y="70"
        width="216"
        height="110"
        rx="3"
        className="conveyor-base"
      />
      <rect
        x="336"
        y="76"
        width="204"
        height="98"
        fill="url(#conveyor-lines)"
      />
      <path className="conveyor-edge" d="M 333 83 H 543 M 333 167 H 543" />
      <path className="route-line" d="M 202 126 H 663" />
      <path className="route-arrow" d="m 655 119 8 7 -8 7" />
      <circle cx="202" cy="126" r="6" className="map-point" />
      <circle cx="663" cy="126" r="14" className="destination" />
      <path
        className="door-line"
        d="M 597 96 V 156 M 613 96 V 156 M 592 96 H 618 M 592 156 H 618"
      />
      <g className="map-label">
        <text x="200" y="92" textAnchor="middle">
          Cargo platform
        </text>
        <text x="439" y="109" textAnchor="middle">
          Conveyor
        </text>
        <text x="652" y="92" textAnchor="middle">
          Far side
        </text>
        <text x="605" y="232" textAnchor="middle">
          Door
        </text>
      </g>
      <path className="map-leader" d="M 605 202 V 216" />
      <g className="map-small">
        <text x="200" y="171" textAnchor="middle">
          NEAR SIDE
        </text>
        <text x="438" y="156" textAnchor="middle">
          TRANSIT ROUTE
        </text>
        <text x="667" y="171" textAnchor="middle">
          EXIT
        </text>
      </g>
      <g className="north-mark">
        <path d="M 753 64 V 35 M 746 43 L 753 33 760 43" />
        <text x="753" y="23" textAnchor="middle">
          N
        </text>
      </g>
      <g className="scale-mark">
        <path d="M 39 213 V 219 H 89 V 213 M 64 215 V 219" />
        <text x="39" y="239">
          SCHEMATIC
        </text>
      </g>
    </svg>
  );
}

function WiringDiagram() {
  return (
    <svg
      className="wiring-diagram"
      viewBox="0 0 300 85"
      role="img"
      aria-labelledby="wiring-title"
    >
      <title id="wiring-title">
        One Power supply branches to both the Door and the Conveyor.
      </title>
      <path d="M 150 31 V 42 H 71 V 55 M 150 42 H 229 V 55" className="wire" />
      <circle cx="150" cy="42" r="3" className="wire-node" />
      <rect
        x="92"
        y="1"
        width="116"
        height="30"
        rx="2"
        className="equipment-box"
      />
      <rect
        x="12"
        y="55"
        width="118"
        height="29"
        rx="2"
        className="equipment-box"
      />
      <rect
        x="170"
        y="55"
        width="118"
        height="29"
        rx="2"
        className="equipment-box"
      />
      <text x="150" y="22" textAnchor="middle">
        Power
      </text>
      <text x="71" y="75" textAnchor="middle">
        Door
      </text>
      <text x="229" y="75" textAnchor="middle">
        Conveyor
      </text>
    </svg>
  );
}

function RobotMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M 32 11 V 18 M 15 29 H 9 V 43 H 15 M 49 29 H 55 V 43 H 49"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="32" cy="8" r="3" fill="currentColor" />
      <rect
        x="15"
        y="18"
        width="34"
        height="34"
        rx="9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M 23 42 H 41" stroke="currentColor" strokeWidth="2" />
      <circle cx="25" cy="31" r="3" fill="currentColor" />
      <circle cx="39" cy="31" r="3" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [view, setView] = useState<HumanView | null>(null);
  const viewRef = useRef<HumanView | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ended");
  const [microphone, setMicrophone] = useState(false);
  const [pending, setPending] = useState(false);
  const [powerPending, setPowerPending] = useState(false);
  const [toolPending, setToolPending] = useState(false);
  const [locallyStopped, setLocallyStopped] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const voice = useRef<LiveVoice | null>(null);
  const generation = useRef(0);
  const mockAbort = useRef<AbortController | null>(null);
  const mockTurn = useRef(0);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const messageInput = useRef<HTMLInputElement>(null);

  const applyView = (next: HumanView) => {
    const previous = viewRef.current;
    if (
      previous?.sessionId === next.sessionId &&
      previous.roundId === next.roundId &&
      previous.revision > next.revision
    )
      return;
    viewRef.current = next;
    setView(next);
  };
  const addTranscript = (entry: TranscriptEntry) =>
    setTranscripts((previous) => {
      const index = previous.findIndex(
        (item) => item.id === entry.id && item.role === entry.role,
      );
      if (index < 0) return [...previous, entry].slice(-200);
      const next = [...previous];
      next[index] = entry;
      return next;
    });
  const robotSays = (message: string) =>
    addTranscript({
      id: requestId(),
      role: "robot",
      text: message,
      final: true,
    });
  const showError = (cause: unknown) =>
    setError(
      cause instanceof Error
        ? cause.message
        : "Something went wrong. Please try again.",
    );

  useEffect(() => {
    const closeOnLeave = () => {
      mockAbort.current?.abort();
      const current = viewRef.current;
      if (current)
        fetch(`/api/sessions/${encodeURIComponent(current.sessionId)}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId: current.roundId,
            requestId: requestId(),
          }),
          keepalive: true,
        }).catch(() => {});
      void voice.current?.stop();
    };
    window.addEventListener("pagehide", closeOnLeave);
    return () => {
      window.removeEventListener("pagehide", closeOnLeave);
      closeOnLeave();
    };
  }, []);

  const startMission = async () => {
    setPending(true);
    setError("");
    setWarning("");
    const currentGeneration = ++generation.current;
    try {
      const next = viewRef.current
        ? await lifecycle(viewRef.current, "resume")
        : await createSession();
      if (generation.current !== currentGeneration) return;
      applyView(next);
      setLocallyStopped(false);
      if (mode === "mock") robotSays(copy.greeting);
    } catch (cause) {
      showError(cause);
    } finally {
      if (generation.current === currentGeneration) setPending(false);
    }
  };

  const cancelPending = async (expectedGeneration: number) => {
    if (generation.current !== expectedGeneration || !viewRef.current) return;
    const current = viewRef.current;
    const next = await lifecycle(current, "cancel");
    if (
      generation.current === expectedGeneration &&
      next.roundId === viewRef.current?.roundId
    )
      applyView(next);
  };

  const runTool = async (
    call: RobotCall,
    signal: AbortSignal,
    expectedGeneration: number,
  ) => {
    const current = viewRef.current;
    if (!current || expectedGeneration !== generation.current || signal.aborted)
      throw new DOMException("Canceled", "AbortError");
    const result = await executeTool(current, call, signal);
    if (
      expectedGeneration !== generation.current ||
      signal.aborted ||
      result.view.roundId !== viewRef.current?.roundId
    )
      throw new DOMException("Canceled", "AbortError");
    applyView(result.view);
    // The robot receives only its local result, never the human projection.
    return { ok: result.ok, message: result.message };
  };

  const connectLive = async (useMicrophone: boolean) => {
    if (!viewRef.current || voice.current || pending) return;
    setError("");
    setWarning("");
    setMicrophone(useMicrophone);
    const currentGeneration = ++generation.current;
    const connection = new LiveVoice({
      onTranscript: (entry) => {
        if (generation.current === currentGeneration) addTranscript(entry);
      },
      onStatus: (status) => {
        if (generation.current !== currentGeneration) return;
        setVoiceStatus(status);
        if (status === "ended" || status === "error") {
          voice.current = null;
          const current = viewRef.current;
          if (current)
            void lifecycle(current, "stop")
              .then((next) => {
                if (generation.current === currentGeneration) applyView(next);
              })
              .catch(showError);
        }
      },
      onError: (message) => {
        if (generation.current === currentGeneration) setError(message);
      },
        onWarning: (message) => {
          if (generation.current === currentGeneration) setWarning(message);
        },
        onMicrophone: (active) => {
          if (generation.current === currentGeneration) setMicrophone(active);
        },
    });
    voice.current = connection;
    try {
      // start initializes browser audio within this button's user gesture.
      await connection.start({
        microphone: useMicrophone,
        token: async () => {
          const current = viewRef.current!;
          const active =
            current.status === "active"
              ? current
              : await lifecycle(current, "resume");
          if (generation.current !== currentGeneration)
            throw new DOMException("Canceled", "AbortError");
          applyView(active);
          setLocallyStopped(false);
          return voiceToken(active);
        },
        executeTool: (call, signal) => runTool(call, signal, currentGeneration),
        cancelPending: () => cancelPending(currentGeneration),
        maxSessionSeconds: 600,
      });
    } catch (cause) {
      if (generation.current === currentGeneration) {
        showError(cause);
        voice.current = null;
        setVoiceStatus("error");
      }
    }
  };

  const stopMission = async () => {
    ++generation.current;
    setLocallyStopped(true);
    setPending(true);
    setToolPending(false);
    mockAbort.current?.abort();
    const connection = voice.current;
    voice.current = null;
    const ending = connection?.stop();
    const current = viewRef.current;
    try {
      if (current) applyView(await lifecycle(current, "stop"));
    } catch (cause) {
      showError(cause);
    } finally {
      await ending;
      setVoiceStatus("ended");
      setPending(false);
    }
  };

  const restartMission = async () => {
    restartDialog.current?.close();
    ++generation.current;
    setPending(true);
    setToolPending(false);
    setError("");
    setWarning("");
    mockAbort.current?.abort();
    const connection = voice.current;
    voice.current = null;
    const ending = connection?.stop();
    try {
      if (viewRef.current) applyView(await lifecycle(viewRef.current, "reset"));
      setLocallyStopped(false);
      setTranscripts([]);
      setText("");
      if (mode === "mock") robotSays(copy.greeting);
    } catch (cause) {
      showError(cause);
    } finally {
      await ending;
      setVoiceStatus("ended");
      setPending(false);
    }
  };

  const changePower = async (powerOn: boolean) => {
    const current = viewRef.current;
    if (!current) return;
    const currentGeneration = generation.current;
    setPowerPending(true);
    setError("");
    try {
      const next = await setPower(current, powerOn);
      if (
        generation.current === currentGeneration &&
        next.roundId === viewRef.current?.roundId
      )
        applyView(next);
    } catch (cause) {
      if (generation.current !== currentGeneration) return;
      showError(cause);
      try {
        const next = await getSession(current.sessionId);
        if (
          generation.current === currentGeneration &&
          next.roundId === current.roundId
        )
          applyView(next);
      } catch {
        /* Keep the original actionable error. */
      }
    } finally {
      setPowerPending(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !viewRef.current || viewRef.current.status !== "active")
      return;
    const message = text;
    if (mode === "live") {
      if (voice.current?.sendText(message)) setText("");
      else setError("Connect Voice or Connect Text before sending a message.");
      return;
    }
    setText("");
    setError("");
    addTranscript({
      id: requestId(),
      role: "human",
      text: message,
      final: true,
    });
    const reply = simulationReply(message);
    const currentGeneration = generation.current;
    const currentTurn = ++mockTurn.current;
    const hadPendingTool = Boolean(mockAbort.current);
    mockAbort.current?.abort();
    const abort = new AbortController();
    mockAbort.current = abort;
    setToolPending(true);
    try {
      // Cancel on the server as well as aborting fetch; completed atomic actions remain completed.
      if (hadPendingTool || reply.cancel)
        await cancelPending(currentGeneration);
      if (
        generation.current !== currentGeneration ||
        currentTurn !== mockTurn.current ||
        abort.signal.aborted
      )
        return;
      if (!reply.call) {
        robotSays(reply.message);
        return;
      }
      const result = await runTool(reply.call, abort.signal, currentGeneration);
      if (currentTurn === mockTurn.current)
        robotSays(simulationSpeech(result.message));
    } catch (cause) {
      if (
        generation.current === currentGeneration &&
        currentTurn === mockTurn.current &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      )
        showError(cause);
    } finally {
      if (
        generation.current === currentGeneration &&
        currentTurn === mockTurn.current
      ) {
        setToolPending(false);
        mockAbort.current = null;
      }
    }
  };

  const liveConnected = !["ended", "error"].includes(voiceStatus);
  const simulationConnected =
    mode === "mock" && view?.status === "active" && !locallyStopped;
  const connected = mode === "live" ? liveConnected : simulationConnected;
  const canSend = Boolean(
    view &&
    view.status === "active" &&
    connected &&
    !pending &&
    (mode === "mock" || voiceStatus !== "connecting"),
  );
  const latest = transcripts.at(-1);
  const missionStatus = view?.completed
    ? "Complete"
    : !view
      ? "Awaiting Mission Control"
      : view.status === "active"
        ? "Mission in progress"
        : "Mission stopped";
  const communicationStatus = toolPending
    ? "Robot checking equipment"
    : mode === "mock"
      ? simulationConnected
        ? "Simulation · text only"
        : "Simulation ready"
      : voiceStatus === "connecting"
        ? "Connecting to AssemblyAI"
        : voiceStatus === "speaking"
          ? "Robot speaking"
          : voiceStatus === "responding"
            ? "Robot responding"
            : liveConnected
              ? microphone
                ? "Voice connected · microphone on"
                : "Text connected · microphone off"
              : "Call disconnected · microphone off";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#mission-controls">
        Skip to mission controls
      </a>
      <header className="topbar">
        <a className="wordmark" href="#" aria-label="Talk Me Home home">
          <span className="brand-symbol" aria-hidden="true">
            ↗
          </span>
          <span>
            {copy.title}
            <small>MISSION CONTROL</small>
          </span>
        </a>
        <div className="connection-mode">
          <label htmlFor="mode">Connection mode</label>
          <select
            id="mode"
            value={mode}
            disabled={Boolean(connected || pending)}
            onChange={(event) => {
              setMode(event.target.value as "mock" | "live");
              setError("");
              setWarning("");
            }}
          >
            <option value="mock">Mock / Simulation</option>
            <option value="live">Live AssemblyAI</option>
          </select>
        </div>
        <span className="edition">
          FIRST DOOR<span>01 / 01</span>
        </span>
      </header>

      <main>
        <section className="mission-intro" aria-labelledby="mission-heading">
          <div>
            <p className="eyebrow">ONE HUMAN. ONE ROBOT. ONE WAY HOME.</p>
            <h1 id="mission-heading">A way through, together.</h1>
            <p className="premise">{copy.premise}</p>
          </div>
          <div className="mission-brief">
            <span className="brief-number">01</span>
            <p>{copy.mission}</p>
          </div>
        </section>

        <section className="workspace" aria-label="Mission Control desk">
          <div className="map-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">FACILITY DOCUMENT / 04-A</span>
                <h2>Cargo bay</h2>
              </div>
              <span className="document-tag">STATIC MAP</span>
            </div>
            <MissionMap />
            <div className="map-footer">
              <span>
                <span className="legend-route" aria-hidden="true" />
                Documented route
              </span>
              <span>Local conditions via radio</span>
            </div>
            <div
              className={`mission-status ${view?.completed ? "complete" : ""}`}
              role="status"
            >
              <span className="status-marker" aria-hidden="true">
                {view?.completed ? "✓" : "○"}
              </span>
              <span>
                {view?.completed ? copy.complete : missionStatus}
                <small>
                  {view?.completed
                    ? copy.completeDetail
                    : "Your map is a reference, not a live camera."}
                </small>
              </span>
              {view?.completed && (
                <button
                  className="text-button"
                  onClick={() => restartDialog.current?.showModal()}
                >
                  Play again <span aria-hidden="true">↗</span>
                </button>
              )}
            </div>
          </div>

          <aside
            className="equipment-panel"
            aria-labelledby="equipment-heading"
          >
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">FOR MISSION CONTROL</span>
                <h2 id="equipment-heading">Equipment notes</h2>
              </div>
              <span className="document-number">02</span>
            </div>
            <WiringDiagram />
            <p className="equipment-note">
              The Door and Conveyor share one Power supply. Your robot cannot
              see this document.
            </p>
            <section className="power-control" aria-labelledby="power-heading">
              <div className="power-title">
                <h3 id="power-heading">Remote Power</h3>
                <span className={`power-state ${view?.powerOn ? "on" : ""}`}>
                  {view ? (view.powerOn ? "ON" : "OFF") : "—"}
                </span>
              </div>
              <p>Commanded state</p>
              <div
                className="power-buttons"
                role="group"
                aria-label="Set shared Power"
              >
                <button
                  aria-label="Power ON"
                  aria-pressed={view ? view.powerOn : false}
                  className={view?.powerOn ? "selected" : ""}
                  disabled={
                    !view ||
                    view.status !== "active" ||
                    view.completed ||
                    pending ||
                    powerPending
                  }
                  onClick={() => void changePower(true)}
                >
                  <span aria-hidden="true">I</span>ON
                </button>
                <button
                  aria-label="Power OFF"
                  aria-pressed={view ? !view.powerOn : false}
                  className={view && !view.powerOn ? "selected" : ""}
                  disabled={
                    !view ||
                    view.status !== "active" ||
                    view.completed ||
                    pending ||
                    powerPending
                  }
                  onClick={() => void changePower(false)}
                >
                  <span aria-hidden="true">○</span>OFF
                </button>
              </div>
              <p className="power-hint">
                {powerPending
                  ? "Sending Power command…"
                  : "Coordinate with your partner before changing Power."}
              </p>
            </section>
          </aside>
        </section>

        <section
          className="communications"
          aria-labelledby="comms-heading"
          id="mission-controls"
        >
          <div className="comms-upper">
            <div className="robot-avatar">
              <RobotMark />
            </div>
            <div className="caption-area">
              <div className="caption-heading">
                <h2 id="comms-heading">
                  {latest?.role === "human"
                    ? "Mission Control"
                    : "Robot channel"}
                </h2>
                <span
                  className={`comms-status ${connected ? "connected" : ""}`}
                >
                  <i aria-hidden="true" />
                  {communicationStatus}
                </span>
              </div>
              <p
                className="caption"
                aria-live="polite"
                aria-atomic="true"
                data-testid="caption"
              >
                {latest?.text ||
                  (view ? copy.idleCaption : copy.initialInstructions)}
                {latest && !latest.final && (
                  <span className="transcribing"> …</span>
                )}
              </p>
            </div>
            <button
              className="history-button"
              onClick={() => historyDialog.current?.showModal()}
              aria-label="Open transcript history"
            >
              Transcript <span aria-hidden="true">↗</span>
              <small>{transcripts.length} messages</small>
            </button>
          </div>
          <div className="comms-lower">
            <div className="call-controls">
              {!view && (
                <button
                  className="primary-button"
                  onClick={() => void startMission()}
                  disabled={pending}
                >
                  {pending ? "Starting…" : "Start Mission"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              )}
              {view &&
                mode === "mock" &&
                (view.status !== "active" || locallyStopped) && (
                  <button
                    className="primary-button"
                    onClick={() => void startMission()}
                    disabled={pending}
                  >
                    Resume Mission
                  </button>
                )}
              {view && mode === "live" && !liveConnected && (
                <>
                  <button
                    className="primary-button"
                    onClick={() => void connectLive(true)}
                    disabled={pending || view.completed}
                  >
                    Connect Voice
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void connectLive(false)}
                    disabled={pending || view.completed}
                  >
                    Connect Text
                  </button>
                </>
              )}
              {liveConnected && (
                <button
                  className="secondary-button"
                  onClick={() => void stopMission()}
                  disabled={pending}
                >
                  End Call
                </button>
              )}
              {view && (simulationConnected || liveConnected) && (
                <button
                  className="text-button stop-button"
                  onClick={() => void stopMission()}
                  disabled={pending}
                >
                  Stop Mission
                </button>
              )}
              {view && (
                <button
                  className="text-button"
                  onClick={() => restartDialog.current?.showModal()}
                  disabled={pending}
                >
                  Restart
                </button>
              )}
            </div>
            <form
              className="message-form"
              onSubmit={(event) => void sendMessage(event)}
            >
              <label className="sr-only" htmlFor="message">
                Type a message
              </label>
              <input
                ref={messageInput}
                id="message"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type a message to your robot…"
                autoComplete="off"
                maxLength={2000}
                disabled={!canSend}
              />
              <button
                aria-label="Send message"
                type="submit"
                disabled={!canSend || !text.trim()}
              >
                Send <span aria-hidden="true">↗</span>
              </button>
            </form>
          </div>
        </section>
        {error && (
          <div className="notice error-notice" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {warning && (
          <div className="notice warning-notice" role="status">
            <span>{warning}</span>
            <button aria-label="Dismiss notice" onClick={() => setWarning("")}>
              Dismiss
            </button>
          </div>
        )}
        <footer className="footer">
          <p>
            <strong>
              {mode === "mock" ? "SIMULATION" : "LIVE ASSEMBLYAI"}
            </strong>
            {mode === "mock" ? copy.mockNotice : copy.liveNotice}
          </p>
          <span>Listen. Share. Find a way.</span>
        </footer>
      </main>

      <dialog
        ref={restartDialog}
        className="confirm-dialog"
        aria-labelledby="restart-title"
      >
        <form method="dialog">
          <p className="eyebrow">NEW ROUND</p>
          <h2 id="restart-title">{copy.resetTitle}</h2>
          <p>{copy.resetBody}</p>
          <div className="dialog-actions">
            <button className="secondary-button" value="cancel">
              Keep playing
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void restartMission()}
            >
              Restart mission
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={historyDialog}
        className="history-dialog"
        aria-labelledby="history-title"
      >
        <div className="history-heading">
          <div>
            <p className="eyebrow">COMMUNICATION LOG</p>
            <h2 id="history-title">Transcript history</h2>
          </div>
          <button
            className="secondary-button"
            onClick={() => historyDialog.current?.close()}
          >
            Close
          </button>
        </div>
        <p className="history-note">
          {mode === "mock"
            ? "Simulation messages. No audio is recorded."
            : "Transcripts from this browser session. Player words are shown as received."}
        </p>
        <ol className="transcript-list">
          {transcripts.map((entry) => (
            <li key={`${entry.role}-${entry.id}`}>
              <span>
                {entry.role === "human" ? "Mission Control" : "Robot"}
                {!entry.final ? " · transcribing" : ""}
              </span>
              <p>{entry.text}</p>
            </li>
          ))}
        </ol>
        {!transcripts.length && (
          <p className="empty-history">
            Your conversation will appear here after the mission begins.
          </p>
        )}
      </dialog>
    </div>
  );
}
