# 0031 — Rooms on a map, and spaces beside the story

**Status:** accepted · 2026-11-11

## Context

Explorer-style novels were built from choices that jump between passages. That works, but the
author keeps the layout of the place in their head, every room repeats its "go north / go
east" options, and the reader has no map. We also wanted views beside the story that a reader
reaches by swiping (or, on a computer, by clicking the edge of the screen): a map first, and the
story's own panel screens (notes, a journal) without opening a menu.

## Decision

**Rooms are a layer over passages, not a new kind of passage.** `project.world.rooms` places
each room on a grid square (x, y within ±64; y grows south) and names the passage that plays
there. Entering a room's passage by any route (a jump, a choice, a load) puts the reader in that
room. The runtime keeps `state.room` and the rooms visited (`state.rooms`). This keeps rooms
optional: a novel without `world` behaves exactly as before, and every block, rule and routine
works inside a room's passage.

**Exits belong to rooms; an Exits block offers them.** An exit has a direction (eight compass
points, then up, down, in, out), a target room, optional words, and `visibleIf` / `enabledIf` /
`lockedText` like a choice option. The Exits block waits with an `exits` beat. Walking records a
`went` beat, clears temporary values, leaves any routine call, and enters the room's passage.
`advance()` refuses to run past a waiting Exits block, like a choice.

**The map is computed, not drawn.** `runtime.map()` returns the rooms the reader may see
(`reveal`: visited only, visited plus where their exits lead (the default), or every room that
isn't secret), the links between them, and which rooms can be walked to now. With `fastTravel`,
any visited room can be reached from an Exits block. Rooms are buttons, so the map works with a
keyboard and a screen reader.

**Spaces wrap the story pane in `@ie/present`.** `project.spaces` (at most six) each sit left or
right of the story and show the map or one panel screen. `SpaceDeck` puts the story and the
spaces on one sliding track. A touch or pen swipe moves after a 12 px sideways slop, while
vertical scrolling stays the page's own (`touch-action: pan-y`). A mouse uses the edge buttons.
Panes that aren't on screen are `inert`. Once the deck follows a finger it cancels `touchmove`,
so the browser can't also turn the swipe into Back. The click that ends a mouse drag is
swallowed, and the flag is cleared on the next `pointerdown`, because a touch swipe fires no
click. Escape returns to the story. The reading clocks (auto-advance, timers) hold while a
space is shown.

**The Studio edits rooms on a grid.** The World workspace adds a room by tapping an empty square.
A square next to the selected room adds a room joined to it both ways, with a new passage that
already ends in an Exits block. Room-specific problems (two rooms on one passage, an exit to
nowhere, an Exits block outside a room, a map space with no rooms) come from the analyzer.

## Consequences

- Saves gain `room` and `rooms`; older saves load without them.
- Deleting a room removes the exits into it, but keeps its passage (it may still be played by a
  jump).
- A walk turns to a new page in page layout, like a choice that jumps; the backlog keeps the
  `went` line.
- Future kinds of space (a journal, an inventory grid) add a `kind` and a branch in
  `SpaceDeck.draw`, never a second deck.
- The edge buttons and swipes run on the reader's main thread only on input; nothing is added
  per frame.
