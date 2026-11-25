// One AudioContext for the whole reader: ambient bed (crossfaded, duckable) + one-shot SFX.
// Created only inside a user gesture (the chapter curtain), which is what iOS Safari and
// Android Chrome require before any sound may play.
import type { AmbientOptions, AmbientSource, AudioBusAccess } from '@kn/core/renderer';
import { LIFECYCLE_EVENT, isAppActive } from './lifecycle.ts';

type Build = (ctx: AudioContext, out: AudioNode) => AmbientSource;

interface Bed {
  key: string;
  gain: GainNode;
  source: AmbientSource;
}

export interface AudioBus extends AudioBusAccess {
  /** Call from a click/tap handler. `sound: false` keeps the reader silent. */
  unlock(sound: boolean): void;
  readonly unlocked: boolean;
  setSound(on: boolean): void;
}

export function createAudioBus(): AudioBus {
  let ctx: AudioContext | null = null;
  let sound = true;
  let unlocked = false;
  let master: GainNode | null = null;
  let ambientBus: GainNode | null = null;
  let sfx: GainNode | null = null;
  let bed: Bed | null = null;
  // The latest ambient request while silent, so turning sound on picks up the right bed.
  let wanted: { key: string; build: Build; options: AmbientOptions } | null = null;

  const active = (): AudioContext | null => (sound && unlocked ? ctx : null);

  const startBed = (key: string, build: Build, { volume, fadeSeconds }: AmbientOptions): void => {
    const c = active();
    if (!c || !ambientBus) return;
    const now = c.currentTime;
    const fade = Math.max(0.05, fadeSeconds);
    if (bed?.key === key) {
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setTargetAtTime(volume, now, fade / 3);
      return;
    }
    fadeOut(fade);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + fade);
    gain.connect(ambientBus);
    bed = { key, gain, source: build(c, gain) };
  };

  const fadeOut = (seconds: number): void => {
    const c = ctx;
    if (!c || !bed) return;
    const old = bed;
    bed = null;
    const now = c.currentTime;
    const end = now + Math.max(0.05, seconds);
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, end);
    old.source.stop(end + 0.05);
    window.setTimeout(() => old.gain.disconnect(), (end - now) * 1000 + 200);
  };

  // Suspended whenever the page is hidden, torn down (pagehide) or the host app is backgrounded.
  // Resumes only when visible, lifecycle-active, sound on and unlocked.
  const syncPlayback = (): void => {
    if (!ctx) return;
    if (document.hidden || !isAppActive()) void ctx.suspend().catch(() => undefined);
    else if (sound && unlocked) void ctx.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', syncPlayback);
  window.addEventListener('pagehide', () => {
    if (ctx) void ctx.suspend().catch(() => undefined);
  });
  window.addEventListener(LIFECYCLE_EVENT, syncPlayback);

  return {
    get context() {
      return active();
    },
    get sfx() {
      return active() ? sfx : null;
    },
    get unlocked() {
      return unlocked;
    },
    unlock(withSound) {
      sound = withSound;
      unlocked = true;
      if (!withSound) return;
      if (!ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        master = ctx.createGain();
        master.connect(ctx.destination);
        ambientBus = ctx.createGain();
        ambientBus.connect(master);
        sfx = ctx.createGain();
        sfx.connect(master);
      }
      if (!document.hidden && isAppActive()) void ctx.resume().catch(() => undefined);
      // A one-sample silent buffer started inside the gesture fully unlocks iOS.
      const blip = ctx.createBufferSource();
      blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      blip.connect(ctx.destination);
      blip.start();
      if (wanted) startBed(wanted.key, wanted.build, wanted.options);
    },
    setSound(on) {
      if (on && !ctx && unlocked) return this.unlock(true);
      sound = on;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08);
      if (on && wanted && !bed) startBed(wanted.key, wanted.build, wanted.options);
    },
    setAmbient(key, build, options) {
      wanted = { key, build, options };
      startBed(key, build, options);
    },
    stopAmbient(fadeSeconds) {
      wanted = null;
      fadeOut(fadeSeconds);
    },
    duck(amount, seconds) {
      const c = active();
      if (!c || !ambientBus) return;
      const g = ambientBus.gain;
      const now = c.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(1 - Math.min(0.9, amount), now, 0.05);
      g.setTargetAtTime(1, now + seconds, 0.4);
    },
  };
}
