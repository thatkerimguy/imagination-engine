import type { TitleActor } from './actors.ts';
import type { GlyphAtlas } from './atlas.ts';
import type { SpriteBatch } from './batch.ts';
import type { StageMaterials } from './materials.ts';
import type { Camera, MaterialFrame, Renderer } from './renderer.ts';
import { pushTitle } from './title-draw.ts';

export interface MaterialDraw {
  readonly renderer: Renderer;
  readonly materials: StageMaterials;
  readonly titles: readonly TitleActor[];
  /** Reused for one material title at a time. */
  readonly batch: SpriteBatch;
  readonly atlas: GlyphAtlas;
  /** Reused each frame, so drawing allocates nothing. */
  readonly frame: { -readonly [K in keyof MaterialFrame]: MaterialFrame[K] };
  readonly view: { w: number; h: number };
  /** Canvas size in device pixels. */
  readonly size: { w: number; h: number };
  readonly camera: Camera;
  readonly time: number;
  readonly beat: { beat: number; beatsPerBar: number } | null;
  readonly phase: number | null;
  readonly pulse: number;
  readonly glow: number;
  readonly reducedMotion: boolean;
}

/**
 * Material titles (one instanced draw each) and the post material (one full-screen pass), after
 * the sprites and before the overlay (ADR 0020). Without music, Beat counts two a second from the
 * stage's clock so beat-driven materials still move in the Studio.
 */
export function drawMaterials(d: MaterialDraw): void {
  const post = d.materials.postEntry;
  if (!post && !d.titles.some((t) => t.material !== null)) return;
  const { frame, beat } = d;
  frame.time = d.time;
  frame.beat = beat?.beat ?? d.time * 2;
  frame.beatPhase = d.phase ?? frame.beat - Math.floor(frame.beat);
  const bar = beat?.beatsPerBar ?? 4;
  frame.barPhase = (((frame.beat % bar) + bar) % bar) / bar;
  // Without a song the stage's own beat pulses too, so a preview shows the motion.
  frame.pulse = d.phase === null && !d.reducedMotion ? (1 - frame.beatPhase) ** 3 : d.pulse;
  for (const title of d.titles) {
    const entry = d.materials.get(title.material, 'text');
    const program = entry ? d.renderer.materialProgram(entry.compiled) : null;
    if (!entry || !program) continue;
    d.batch.count = 0;
    pushTitle(d.batch, d.atlas, title, d.reducedMotion, d.pulse, d.glow);
    d.renderer.materialSprites(
      program,
      d.batch.data,
      d.batch.count,
      d.view,
      d.camera,
      frame,
      entry.values,
    );
  }
  const program = post ? d.renderer.materialProgram(post.compiled) : null;
  if (post && program) d.renderer.materialPass(program, d.size, frame, post.values);
}
