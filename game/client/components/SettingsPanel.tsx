import type { useMission } from '../useMission';

export function SettingsPanel({ mission: m }: { mission: ReturnType<typeof useMission> }) {
  return <details className="shell-panel settings-panel"><summary>Settings</summary><div className="shell-panel-content">
    <h2>Make yourself comfortable</h2>
    <label>Voice volume <output>{Math.round(m.voiceVolume * 100)}%</output><input aria-label="Voice volume" type="range" min="0" max="1" step="0.05" value={m.voiceVolume} onChange={event => m.changeVoiceVolume(Number(event.target.value))} /></label>
    <label>Effects volume <output>{Math.round(m.effectsVolume * 100)}%</output><input aria-label="Effects volume" type="range" min="0" max="1" step="0.05" value={m.effectsVolume} onChange={event => m.changeEffectsVolume(Number(event.target.value))} /></label>
    <p>Effects start muted. They stay quiet while the Live Voice microphone is active or Pip is speaking.</p>
    <label className="checkbox-label"><input type="checkbox" checked={m.reducedMotion} onChange={event => m.changeReducedMotion(event.target.checked)} /> Reduce motion</label>
    <button onClick={() => { m.changeVoiceVolume(0); m.changeEffectsVolume(0); }}>Mute output</button>
    <p>Muting output keeps captions available. It does not mute your microphone or end a call. Pause ends the connection.</p>
  </div></details>;
}
