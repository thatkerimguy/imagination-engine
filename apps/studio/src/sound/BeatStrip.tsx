import type { TrackAnalysis } from '@ie/story';
import { useEffect, useRef } from 'react';

function token(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * The analysis at a glance: a tick per beat, taller at downbeats, shaded sections, and the
 * playhead. Drawn on a canvas because a song has hundreds of beats.
 */
export function BeatStrip({
  analysis,
  time,
  label,
  onSeek,
}: {
  readonly analysis: TrackAnalysis;
  /** Playhead in seconds, or null when stopped. */
  readonly time: number | null;
  readonly label: string;
  readonly onSeek?: (seconds: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const x = (s: number) => (s / analysis.duration) * width;
    const sections = [...analysis.sections, analysis.duration];
    ctx.fillStyle = token(canvas, '--color-selection');
    for (let i = 0; i < sections.length - 1; i += 2)
      ctx.fillRect(x(sections[i] ?? 0), 0, x(sections[i + 1] ?? 0) - x(sections[i] ?? 0), height);
    const downbeats = new Set(analysis.downbeats);
    ctx.fillStyle = token(canvas, '--color-ink-faint');
    analysis.beats.forEach((b, i) => {
      if (!downbeats.has(i)) ctx.fillRect(Math.round(x(b)), height * 0.55, 1, height * 0.45);
    });
    ctx.fillStyle = token(canvas, '--color-ink');
    for (const i of downbeats) {
      const b = analysis.beats[i];
      if (b !== undefined) ctx.fillRect(Math.round(x(b)), height * 0.15, 1, height * 0.85);
    }
    if (time !== null) {
      ctx.fillStyle = token(canvas, '--color-accent');
      ctx.fillRect(Math.round(x(time)) - 1, 0, 2, height);
    }
  }, [analysis, time]);

  return (
    <canvas
      ref={ref}
      className="beat-strip"
      role="img"
      aria-label={label}
      data-testid="beat-strip"
      onClick={(event) => {
        if (!onSeek) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - rect.left) / rect.width) * analysis.duration);
      }}
    />
  );
}
