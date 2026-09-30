import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocalAudioCheck, microphoneError } from '../audio';
import { demoAccess, unlockDemo, type DemoAccess } from '../api';

interface Props {
  mode: 'live_voice' | 'live_text';
  voiceVolume: number;
  onReady(): void;
  onCancel(): void;
  onPractice(): void;
  onText(): void;
}

export function LocalReadiness({ mode, voiceVolume, onReady, onCancel, onPractice, onText }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const check = useRef<LocalAudioCheck | null>(null);
  const [microphone, setMicrophone] = useState<'idle' | 'checking' | 'ready' | 'denied'>('idle');
  const [level, setLevel] = useState(0);
  const [output, setOutput] = useState(false);
  const [captionsOnly, setCaptionsOnly] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<DemoAccess | null>(null);
  const [accessError, setAccessError] = useState('');
  const [code, setCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const alive = useRef(true);
  const closeCheck = () => { check.current?.close(); check.current = null; };
  const finish = (action: () => void) => { closeCheck(); action(); };
  const refreshAccess = () => {
    setAccessError('');
    void demoAccess().then(value => { if (alive.current) setAccess(value); })
      .catch(cause => { if (alive.current) setAccessError(cause instanceof Error ? cause.message : 'The service is unavailable. Retry or choose Practice.'); });
  };
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    refreshAccess();
    return () => { alive.current = false; closeCheck(); };
  }, []);
  useEffect(() => {
    closeCheck(); setMicrophone('idle'); setLevel(0); setError('');
  }, [mode]);
  const testMicrophone = async () => {
    closeCheck(); setError(''); setMicrophone('checking');
    const local = new LocalAudioCheck(); check.current = local;
    try {
      await local.microphone(setLevel);
      if (check.current === local) setMicrophone('ready');
    } catch (cause) {
      if (check.current !== local) return;
      closeCheck(); setMicrophone('denied'); setError(microphoneError(cause));
    }
  };
  const testOutput = async () => {
    setError('');
    const local = check.current ?? new LocalAudioCheck(); check.current = local;
    try { await local.output(voiceVolume || 0.6); if (check.current === local) setOutput(true); }
    catch (cause) { if (check.current === local) setError(cause instanceof Error ? cause.message : 'Check your output device or use captions.'); }
  };
  const unlock = async (event: FormEvent) => {
    event.preventDefault(); if (!code.trim() || unlocking) return;
    const submitted = code; setCode(''); setUnlocking(true); setAccessError('');
    try { const value = await unlockDemo(submitted); if (alive.current) setAccess(value); }
    catch (cause) { if (alive.current) setAccessError(cause instanceof Error ? cause.message : 'Access could not be confirmed. Retry or choose Practice.'); }
    finally { if (alive.current) setUnlocking(false); }
  };
  const connectionLimitSeconds = access && 'maxSessionSeconds' in access && access.maxSessionSeconds === 900 ? 900 : 600;
  const modeMismatch = !!access?.allowedMode && access.allowedMode !== (mode === 'live_voice' ? 'voice' : 'text');
  const ready = (mode === 'live_text' || microphone === 'ready') && (output || captionsOnly)
    && access?.liveEnabled && access.authorized && access.available && !modeMismatch;
  return <dialog ref={dialog} className="readiness-dialog" aria-labelledby="readiness-title" onCancel={event => { event.preventDefault(); finish(onCancel); }}>
    <div className="dialog-heading"><div><span className="eyebrow">Before we call Pip</span><h2 id="readiness-title">Check your connection</h2></div><button aria-label="Close connection check" onClick={() => finish(onCancel)}>Close</button></div>
    <p className="readiness-intro">{mode === 'live_voice' ? 'Live Voice sends your microphone and typed messages to AssemblyAI.' : 'Live Text sends typed messages to AssemblyAI and can play Pip’s replies.'} These checks stay in your browser. No provider call has started.</p>
    <p className="readiness-cooperation"><strong>You hold the documents; Pip sees the station.</strong> Ask a question, compare the report with your plans, then confirm only the proposed action you intend. Looking needs no confirmation. Spoken “yes” does not press Confirm.</p>
    <div className="readiness-steps">
      {mode === 'live_voice' && <section aria-label="Local microphone check">
        <div className="readiness-step-label"><span>01</span><h3>Microphone</h3><strong>{microphone === 'ready' ? 'Input connected' : microphone === 'checking' ? 'Waiting for permission' : 'Not checked'}</strong></div>
        <p>Use headphones if possible. Speak a few words and watch the level.</p>
        <div className="microphone-meter" role="meter" aria-label="Local microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}><span style={{ transform: `scaleX(${level})` }} /></div>
        <button onClick={() => { void testMicrophone(); }} disabled={microphone === 'checking'}>{microphone === 'ready' ? 'Check microphone again' : microphone === 'denied' ? 'Retry microphone' : 'Enable microphone check'}</button>
        <span className="check-hint">Local input only. Closing this check releases the microphone.</span>
      </section>}
      <section aria-label="Local output check">
        <div className="readiness-step-label"><span>{mode === 'live_voice' ? '02' : '01'}</span><h3>Sound & captions</h3><strong>{output ? 'Tone played locally' : captionsOnly ? 'Captions selected' : 'Choose an output'}</strong></div>
        <p>Play a quiet local tone to check your speakers. Pip is not speaking yet.</p>
        <button onClick={() => { void testOutput(); }}>Play test tone</button>
        <label className="captions-choice"><input type="checkbox" checked={captionsOnly} onChange={event => setCaptionsOnly(event.target.checked)} /> I will follow captions if sound is unavailable</label>
      </section>
    </div>
    {error && <p className="readiness-error" role="alert">{error}</p>}
    <section className="demo-access" aria-label="Demo access">
      <h3>Live demo access</h3>{access && <p className="readiness-limit" data-testid="readiness-limit"><strong>Up to {connectionLimitSeconds / 60} minutes per Live connection.</strong> Pause ends it; Resume uses a new launch.</p>}<p role="status">{access?.message ?? (accessError ? 'Live availability could not be checked.' : 'Checking service availability…')}</p>
      {modeMismatch && <p className="readiness-error" role="alert">This access code allows Live {access?.allowedMode === 'voice' ? 'Voice' : 'Text'}. Close this check to choose that mode, or enter a matching code.</p>}
      {access?.liveEnabled && (!access.authorized || modeMismatch) && <form onSubmit={event => { void unlock(event); }}><label htmlFor="demo-code">Demo access code</label><div className="input-row"><input id="demo-code" type="password" value={code} autoComplete="off" maxLength={200} onChange={event => setCode(event.target.value)} /><button disabled={unlocking || !code.trim()}>{unlocking ? 'Checking…' : 'Unlock Live'}</button></div><p>The host supplies this code. It stays out of links and recordings.</p></form>}
      {accessError && <p className="readiness-error" role="alert">{accessError}</p>}
      {(accessError || (access && !access.available)) && <button className="text-button" onClick={refreshAccess}>Check availability again</button>}
    </section>
    <div className="readiness-actions"><button className="primary-button" disabled={!ready} onClick={() => finish(onReady)}>Connect {mode === 'live_voice' ? 'Live Voice' : 'Live Text'}</button><button onClick={() => finish(onPractice)}>Choose Practice</button>{mode === 'live_voice' && <button onClick={() => finish(onText)}>Use Live Text</button>}</div>
    <p className="readiness-footnote">Live uses provider time and has a time limit shown during the call. Practice is deterministic and needs no provider. This app does not record microphone audio.</p>
  </dialog>;
}
