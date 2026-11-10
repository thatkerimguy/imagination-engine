# 0015 — The GPU stage: own WebGL2 renderer

**Status:** accepted · 2026-11-10

## Context

Phase 4 puts a GPU stage over the reader: glyph particles, titles, screen effects, looks and
transitions. PLAN.md planned three.js with its WebGPU renderer and TSL, and MSDF glyphs made with
msdf-atlas-gen. Phase 4 is done when a cinematic scene holds 60 fps on the Redmi Note 12 within the
§11.1 budget: under 6 ms of JavaScript and 10 ms of GPU per frame, under 100 draw calls, and a reader
shell under 250 KB gzipped.

What the stage draws in this phase is narrow: many small textured quads (glyphs, discs, rings,
slashes) and one full-screen pass. WebGL2 is the baseline every scene must meet (ADR 0006).

## Decision

**`packages/stage` is our own small WebGL2 renderer, with no three.js.**

- **Two draw calls a frame.** One instanced call draws every sprite (SDF glyphs and analytic shapes)
  from one interleaved buffer. One full-screen pass draws the look (vignette, grain, scanlines,
  tint), the flash and the transition cover, and it is skipped when none of them shows. There are no
  render targets, so nothing is drawn twice and post-FX costs one pass at any tier.
- **DOM text stays DOM.** The reader's text is never drawn on the GPU. Camera shake and zoom move it
  with a CSS transform on the compositor, and titles are also announced in a live region for screen
  readers.
- **Single-channel SDF glyphs, made at runtime.** Glyphs are drawn from the page's own font into a
  canvas, turned into a distance field (Felzenszwalb's transform, as TinySDF does), and packed into
  an R8 atlas that grows up to 4096 px, the phone's texture limit. Only the characters a scene uses
  are made, at a few milliseconds each, so nothing is baked yet. MSDF (sharper corners at very large
  sizes) can replace the generator later without changing the renderer.
- **Rendering on demand.** The canvas draws only while something moves, at half rate when only an
  ambient background moves, and stops on a still page.
- **Quality tiers.** Low, medium and high set the pixel ratio (1, 1.5, 2), the particle cap (800,
  3,000, 6,000) and whether grain, scanlines and aberration run. The starting tier comes from the GPU
  name and device; a frame governor steps down after 5 s of slow frames and back up after 30 s of
  fast ones. The Studio's Stage view can pin a tier to preview it.
- **Safety and comfort.** Flashes are limited to two a second whatever the story asks for.
  Reduced motion turns shake, zoom and beat pulses off, and makes every transition a dissolve.
- **Scene state.** Background and look are scene state (they persist and come back on load and
  rewind). Shakes, flashes, bursts, titles and transitions are moments that play once.
- **The stage is optional.** Without WebGL2, or after a lost context, the novel plays on without it.

## Consequences

- The stage adds about the size of a small module to the Player instead of three.js's hundreds of
  kilobytes, and it is created only when a scene first uses it.
- The material graph (a later phase) needs a shader compile target. When it arrives it can generate
  GLSL for this renderer, or bring in three.js and TSL behind the same stage actions. That choice
  needs its own ADR. The story's stage actions do not depend on the renderer.
- WebGPU is not used by the stage. It stays in use for beat analysis (ADR 0013).
- Glyph atlases are cheap enough to make on the phone, so ADR 0014's "prepare on desktop" does not
  apply to them yet. It will if MSDF or baked effect textures arrive.
