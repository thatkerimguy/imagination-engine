# 0020 — The material graph

**Status:** accepted · 2026-11-10

## Context

Phase 9 is done when text and post effects are built from nodes and animated by the sequencer
(PLAN §8.2, §13). The stage is our own WebGL2 renderer (ADR 0015): one instanced draw for every
sprite and one full-screen overlay, with no render targets, because a second full-resolution pass
is the most expensive thing the Adreno 610 could do. ADR 0015 left open whether the material graph
generates GLSL for this renderer or brings in three.js and TSL. The author writes no code, so a
material has to be built from nodes in the Studio, on a phone as well as a desktop.

## Decision

**Materials generate GLSL for our own renderer; no three.js, no TSL.** A material graph compiles
to a GLSL ES 3.0 shader that slots into the stage's existing programs. Bringing in three.js would
add hundreds of kilobytes and a second renderer for the same quads. The node set is small, so a
compiler of our own is a few hundred lines and fully under test.

**A material is project data.** `project.materials` holds materials of two **domains**:

- **Text** materials colour and move a title's glyphs. A title names one (`stage.title` gains
  `material`). Its glyphs are drawn in one extra instanced draw with the material's program, so a
  material title costs one draw call.
- **Post** materials draw over the whole screen, like a look. `stage.post.set` picks one (or none)
  and is scene state, so it comes back after a load or a rewind. It is one more full-screen pass,
  drawn after the sprites and before the overlay (so flashes and transitions stay on top).

Because the stage has no render targets, a post material cannot read the picture under it. It
draws a premultiplied colour over the screen, DOM text included, the way looks do. Distortions of
what is underneath wait for render targets, which wait for a measurement on the phone.

**The graph:** nodes with a type, a position, literal values for unconnected inputs, and input
links (each input names the node and output port it reads). Links live on the input side, so an
input has at most one source and there is no separate edge list. Each material has exactly one
output node. **Inputs** are `Time`, `Beat`, `Beat phase`, `Bar phase` and `Pulse` (from the
conductor, as the stage's beat pulse), `UV`, material **parameters**, and constants. Text adds
`Glyph index`, `Glyph count`, `Shape` (the glyph's own coverage) and `Ink` (the title's colour).
Math, vector, noise and colour nodes do the rest. Types are float, vec2 and vec3, and the compiler
converts between them (a float spreads across a vector; a vector is cut or padded with zeros), so a
link never fails to compile. A cycle is cut where it closes and reported.

**Text outputs** are colour, alpha and offset. Offset moves each glyph in CSS pixels and runs in
the vertex shader, once per glyph corner. It may only use inputs that exist per glyph (not `UV` or
`Shape`). The compiler reports such a link and drops it. **Post outputs** are colour and alpha.

**`packages/material` compiles; `packages/stage` draws.** `compileMaterial(def)` returns the GLSL,
the uniform list and problems. It is pure and framework-free, so the Studio, the stage and tests
share it. The stage caches one program per material and recompiles only when the generated source
changes, so editing in the Studio rebuilds a program once per edit, not per frame. A material that
fails to link (a driver bug) falls back to the plain glyph shader or no pass, and the novel goes on.

**Parameters are what the sequencer animates.** A material declares up to eight named number
parameters with a default and a range. `stage.material.param` sets one, or ramps it to a value over
some seconds. The sequencer gains a **material** track whose clips are that action. A clip's
length on the timeline sets the ramp's seconds, worked out from the tempo when the sequence
compiles, as a title's time on screen is. Parameter values are presentation: they are not saved,
and a load or a rewind starts them from their defaults, while the post material itself is restored.

**The Studio's Materials workspace** lists materials and shows the graph: nodes as cards on a
canvas that scrolls both ways, wires drawn between ports, and a live preview on the stage panel (a
sample title for text, the whole panel for post). Connecting is **tap to connect**: tap an output,
then an input. Tapping a linked input unlinks it. Nodes are added from a menu, moved by dragging
their header or with the arrow buttons, and edited in an inspector. Problems from the compiler show
on the nodes they belong to. Edits go through the project store, so they undo.

## Consequences

- Per-node previews, material functions and instances, and the surface, particle, background and
  transition domains are not in this phase. The compiler's domain table is where they will go.
- A post material adds one full-screen pass. Like grain and scanlines on the low tier, it must be
  measured on the phone with the HUD before a published novel leans on it.
- Up to eight parameters per material keeps the uniform block small and fixed. More waits for a need.
- Glyph index uses the sprite's spare fourth parameter, so the instance layout is unchanged.
