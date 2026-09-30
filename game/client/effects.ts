/** Original procedural UI tones. No environmental telemetry or remote assets. */
export type EffectCue = 'acknowledge' | 'connect' | 'disconnect' | 'checkpoint' | 'complete';

const tones: Record<EffectCue, readonly [number, number][]> = {
  acknowledge: [[440, 0.04]],
  connect: [[330, 0.055], [440, 0.07]],
  disconnect: [[330, 0.055], [220, 0.08]],
  checkpoint: [[294, 0.07], [392, 0.12]],
  complete: [[330, 0.10], [440, 0.10], [550, 0.17]],
};

export class LocalEffects {
  private context?: AudioContext;
  private volume = 0.25;
  private voiceActive = false;
  private active = new Set<OscillatorNode>();
  private ambienceVolume = 0;
  private ambienceActive = false;
  private ambience?: { sources: OscillatorNode[]; gain: GainNode };

  setAmbienceVolume(volume: number): void {
    this.ambienceVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    this.syncAmbience();
  }

  /** A local radio bed, never a reading of the station or its hidden state. */
  setAmbienceActive(active: boolean): void {
    this.ambienceActive = active;
    this.syncAmbience();
  }

  private stopAmbience(): void {
    const ambience = this.ambience;
    this.ambience = undefined;
    if (!ambience) return;
    for (const source of ambience.sources) { try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); }
    ambience.gain.disconnect();
  }

  private syncAmbience(): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.ambienceActive || !this.ambienceVolume || this.voiceActive) {
      this.stopAmbience(); return;
    }
    if (this.ambience) { this.ambience.gain.gain.setValueAtTime(this.ambienceVolume * 0.009, context.currentTime); return; }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(this.ambienceVolume * 0.009, context.currentTime + 0.25);
    gain.connect(context.destination);
    const sources = [73, 109.5].map(frequency => {
      const source = context.createOscillator(); source.type = 'sine'; source.frequency.value = frequency;
      source.connect(gain); source.start(); return source;
    });
    this.ambience = { sources, gain };
  }

  /** Call directly from an explicit click/keyboard gesture, never page load. */
  async unlock(): Promise<void> {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.syncAmbience();
    } catch { /* The game remains usable with captions and muted effects. */ }
  }

  setVolume(volume: number): void {
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    if (!this.volume) this.stopTones();
  }

  setVoiceActive(active: boolean): void {
    this.voiceActive = active;
    if (active) this.stop();
    this.syncAmbience();
  }

  play(cue: EffectCue): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.volume || this.voiceActive) return;
    this.stopTones();
    let start = context.currentTime;
    for (const [frequency, duration] of tones[cue]) {
      const source = context.createOscillator();
      const gain = context.createGain();
      source.type = 'sine';
      source.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(this.volume * 0.12, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(gain);
      gain.connect(context.destination);
      this.active.add(source);
      source.onended = () => { this.active.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(start);
      source.stop(start + duration + 0.01);
      start += duration + 0.025;
    }
  }

  private stopTones(): void {
    for (const source of this.active) {
      try { source.stop(); } catch { /* Already ended. */ }
    }
    this.active.clear();
  }

  stop(): void { this.stopTones(); this.stopAmbience(); }

  async close(): Promise<void> {
    this.ambienceActive = false;
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
}
