# 0029 — Bookshelf: drag and tap only, optional cover pictures

**Status:** accepted · 2026-11-11

## Context

The bookshelf (ADR 0022) had arrow buttons under the row and a Read button under each book. On a
phone the row already slides with a finger, so the buttons were clutter. On a desktop the row
only moved with the wheel, keys or the arrows. Covers were always drawn from the title, so a
novel couldn't have its own art.

## Decision

**No buttons to move the shelf.** A finger scrolls the row natively. A mouse or pen drags it,
with snapping off while it moves and the nearest book gliding to the middle on release. A tap on
a book at the side brings it to the middle, and a tap on the book in the middle opens it. A short
line under that book says what the tap does (Read or Continue). The wheel and arrow keys still
work. Removing a novel you added keeps its two-step button, because that isn't navigation.

**Optional cover picture.** A project may have `cover`, a `MediaSource` (a web address, or a
small picture kept in the novel as a data URL, ADR 0026). The Studio sets it in the project sheet
and shrinks the picture like a picture block's. The shelf shows the picture in place of the drawn
cover. A broken or invalid picture falls back to the drawn cover rather than hiding the novel.

## Consequences

- The cover counts toward the novel file's size. Each published novel is fetched to build the
  shelf, so a large cover slows the shelf down a little.
- Screen readers still hear the title and the action, from the cover's label.
