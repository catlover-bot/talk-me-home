import { useEffect, useRef, useState, type FormEvent } from 'react';
import { originLabel, type Caption, type useMission } from '../useMission';
import type { TransportOrigin } from '../../shared/contracts';
import { chapterNames } from './ChapterHeader';
import { PipPortrait, type PipState } from './PipPortrait';

type Mission = ReturnType<typeof useMission>;
export function MessageQuote({ item, onPin, historical = false }: { item: Caption; onPin(id: string): void; historical?: boolean }) {
  return <article className="history-message">
    <div className="caption-meta"><strong>{item.role === 'human' ? 'Mission Control' : 'Pip'}</strong>
      <span className="source-label">{originLabel[item.origin]}{item.inputMethod === 'typed' ? ' · Typed' : item.inputMethod === 'speech' ? ' · Speech' : ''}</span>
      {historical && <span className="earlier">Previous call</span>}
      {item.chapter && <span className="source-label chapter-source">{chapterNames[item.chapter]}</span>}
      <time dateTime={new Date(item.timestamp).toISOString()}>{new Date(item.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</time>
    </div>
    <p>{item.text}</p>
    {!item.final && <span className="source-label">Partial transcript</span>}
    {item.interrupted && <span className="earlier">Interrupted / incomplete speech</span>}
    {item.role === 'robot' && item.final && <button className="text-button" disabled={!item.saved} onClick={() => onPin(item.id)}>{item.saved ? 'Pin report' : 'Saving report…'}</button>}
  </article>;
}
export function CommunicationDock({ mission: m }: { mission: Mission }) {
  const [text, setText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [captionOverflow, setCaptionOverflow] = useState(false);
  const [historyOverflow, setHistoryOverflow] = useState(false);
  const captionText = useRef<HTMLParagraphElement>(null);
  const historyList = useRef<HTMLDivElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const closeHistory = () => { setHistoryOpen(false); historyTrigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!historyOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setHistoryOpen(false); historyTrigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [historyOpen]);
  useEffect(() => {
    const measure = () => {
      setCaptionOverflow(Boolean(captionText.current && captionText.current.scrollHeight > captionText.current.clientHeight + 1));
      setHistoryOverflow(Boolean(historyList.current && historyList.current.scrollHeight > historyList.current.clientHeight + 1));
    };
    const observer = new ResizeObserver(measure);
    if (captionText.current) observer.observe(captionText.current);
    if (historyList.current) observer.observe(historyList.current);
    measure();
    return () => observer.disconnect();
  }, [m.activeCaption?.text, m.captions.length, historyOpen, m.connected]);
  const send = (event: FormEvent) => {
    event.preventDefault(); const message = text; if (!message.trim()) return;
    // Clear immediately so fast Practice replies do not make typing feel blocked.
    setText(''); void m.send(message).then(sent => { if (!sent) setText(message); });
  };
  const origin = m.segment?.origin;
  const live = origin && origin !== 'practice';
  const connectionText = m.busy ? 'Connecting…' : !m.connected ? 'Disconnected · microphone off'
    : origin === 'practice' ? 'Practice simulation · text only'
      : m.playing ? 'Playing Pip’s reply' : m.toolPending ? 'Pip is checking equipment'
        : m.status === 'responding' ? 'Pip is responding'
          : m.microphone ? m.inputState === 'receiving' ? 'Receiving microphone input' : 'Connected · microphone ready' : 'Connected · microphone off';
  const canSend = m.connected && !m.busy && !m.view?.completed;
  return <section className="communication-dock" aria-label="Communication with Pip">
    <div className="connection-readout"><span className="mode-badge">{m.connected ? originLabel[origin!] : 'No active call'}</span>
      <span role="status">{connectionText}</span></div>
    {live && (m.connected || m.seconds > 0) && <p className="call-time">{m.seconds}s connected · 10-minute limit · provider usage</p>}
    <div className="caption-panel">
      <div className="caption-speaker"><strong>{m.activeCaption?.role === 'human' ? 'Mission Control' : 'Pip'}</strong>
        {m.activeCaption && <span className="source-label">{originLabel[m.activeCaption.origin]}{!m.connected ? ' · Previous call' : ''}{m.activeCaption.inputMethod === 'typed' ? ' · Typed' : ''}</span>}</div>
      <div className="caption-reading" data-overflow={captionOverflow}><p ref={captionText} className="caption-text" data-testid="caption" tabIndex={0} title="Scroll for longer replies. History keeps the full text." aria-live={m.activeCaption?.final ? 'polite' : 'off'}>{m.activeCaption?.text ?? (m.connected ? m.toolPending ? 'Pip is checking local equipment.' : 'Connected. Say hello or type a message.' : m.captions.length ? 'Earlier conversations are in history. Choose how to reconnect.' : 'Your partner is waiting for a connection.')}</p>{captionOverflow && <span className="caption-scroll-cue" title="Scroll this caption for more" aria-hidden="true">↕</span>}</div>
      <div className="caption-meta">{m.activeCaption?.interrupted ? <span>Interrupted / incomplete speech</span> : m.activeCaption && !m.activeCaption.final ? <span>Partial transcript</span> : null}
        {m.activeCaption?.role === 'robot' && m.activeCaption.final && <button className="text-button" disabled={!m.activeCaption.saved} onClick={() => { void m.pin(m.activeCaption!.id); }}>Pin report</button>}
        <button ref={historyTrigger} className="text-button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen} aria-controls="conversation-history" aria-label="Open transcript history">History ({m.captions.length})</button>
      </div>
    </div>
    <form className="message-form" onSubmit={send}>
      <label htmlFor="message">Type a message</label>
      <div className="input-row"><input id="message" value={text} maxLength={2000} onChange={event => setText(event.target.value)} disabled={!canSend} placeholder="Talk it through with Pip…" autoComplete="off" />
        <button type="submit" aria-label="Send message" disabled={!canSend || !text.trim()}>Send</button></div>
    </form>
    <div className="communication-actions">
      {m.connected || m.busy ? <><button onClick={() => { void m.interrupt(); }} disabled={!m.connected}>Interrupt</button>
        <button className="secondary-button" onClick={() => { void m.stop(); }}>{live ? 'Pause / End call' : 'Pause mission'}</button></>
        : <button className="primary-button" onClick={m.start} disabled={m.busy || m.view?.completed}>Resume {originLabel[m.mode]}</button>}
    </div>
    {m.interrupted && <p className="notice">{live && m.connected ? 'Interrupted. The call is still connected and uses provider time. Pause / End call to disconnect.' : 'Pip is waiting. Completed actions remain completed.'}</p>}
    {m.recapNotice && <p className="recap-notice">{m.recapNotice}</p>}
    <details className="call-settings"><summary>Connection & sound</summary>
      <div className="mode-choice"><label htmlFor="next-mode">Next connection</label>
        <select id="next-mode" disabled={m.connected || m.busy} value={m.mode} onChange={event => m.chooseMode(event.target.value as TransportOrigin)}>
          <option value="practice">Practice</option><option value="live_voice">Live Voice</option><option value="live_text">Live Text</option>
        </select>
        <p>{m.connected || m.busy ? 'End this connection before changing modes.' : 'Changing this choice does not start a call or change history.'}</p>
      </div>
      <div className="sound-controls"><label>Voice volume <input type="range" min="0" max="1" step="0.05" value={m.voiceVolume} onChange={event => m.changeVoiceVolume(Number(event.target.value))} /></label>
        <label>Effects volume <input type="range" min="0" max="1" step="0.05" value={m.effectsVolume} onChange={event => m.changeEffectsVolume(Number(event.target.value))} /></label>
        <button onClick={() => { m.changeVoiceVolume(0); m.changeEffectsVolume(0); }}>Mute all audio</button></div>
      {m.voiceVolume === 0 && <p className="notice">Voice output is muted. Captions remain available. Muting does not end the call.</p>}
      <p className="muted">{m.mode === 'practice' ? 'Practice uses deterministic text matching, with no AI or microphone.' : 'Live Voice and Live Text both use AssemblyAI. No raw microphone audio is recorded by this app.'}</p>
    </details>
    {historyOpen && <section id="conversation-history" className="history-panel" aria-labelledby="history-title">
      <div className="dialog-heading"><div className="history-partner"><PipPortrait state={m.pipState as PipState} mini /><div><h2 id="history-title">Conversation history</h2><span>{historyOverflow ? 'Pip · Scroll entries ↕' : 'Pip · UNIT 04'}</span></div></div><button onClick={closeHistory}>Close history</button></div>
      <p>Original transcripts, grouped by source. A report is a claim, not a current reading.</p>
      <div ref={historyList} className="history-list" tabIndex={0} aria-label="Conversation history entries. Scroll for earlier reports.">{m.captions.map(item => <MessageQuote key={item.id} item={item} onPin={id => { void m.pin(id); }} historical={!m.connected || item.segmentId !== m.segment?.id} />)}</div>
      <p className="history-help">Escape closes history. Your map and call controls remain available.</p>
    </section>}
  </section>;
}
