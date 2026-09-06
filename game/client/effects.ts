/** Original procedural UI tones. No environmental telemetry or remote assets. */
export type EffectCue = 'acknowledge' | 'connect' | 'disconnect' | 'complete';

const tones: Record<EffectCue, readonly [number, number][]> = {
  acknowledge: [[440, 0.04]],
  connect: [[330, 0.055], [440, 0.07]],
  disconnect: [[330, 0.055], [220, 0.08]],
  complete: [[330, 0.10], [440, 0.10], [550, 0.17]],
};

export class LocalEffects {
  private context?: AudioContext;
  private volume = 0.25;
  private voiceActive = false;
  private active = new Set<OscillatorNode>();

  /** Call directly from an explicit click/keyboard gesture, never page load. */
  async unlock(): Promise<void> {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch { /* The game remains usable with captions and muted effects. */ }
  }

  setVolume(volume: number): void {
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    if (!this.volume) this.stop();
  }

  setVoiceActive(active: boolean): void {
    this.voiceActive = active;
    if (active) this.stop();
  }

  play(cue: EffectCue): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.volume || this.voiceActive) return;
    this.stop();
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

  stop(): void {
    for (const source of this.active) {
      try { source.stop(); } catch { /* Already ended. */ }
    }
    this.active.clear();
  }

  async close(): Promise<void> {
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
}
