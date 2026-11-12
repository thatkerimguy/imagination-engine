# 0034 — Autosave keeps only valid projects

**Status:** accepted · 2026-11-12

## Context

The Studio validates every project it reads from storage against `storyProjectSchema` (ADR 0011)
and drops a record that fails: an unreadable record must not reach the runtime. Writes were not
checked. So any editor that let a value past a schema limit (a 13th exit on a room, a note more
than an hour into a beatmap) saved a project that then vanished from the list on the next reload,
with only a console warning. Each editor guarding each limit is still right, but one missed guard
cost the whole novel.

## Decision

- Autosave checks the project against `storyProjectSchema` before it writes. A project that fails
  is not written; the last good copy stays in storage.
- The top bar says **Can't save this change** (with the reason in its tooltip) instead of
  **Saved**. Undoing the change makes the project valid, and the next autosave writes it.
- Editors keep their own guards (`updateBeatmap`'s check, the world's exit and room limits), so a
  limit is normally met by a disabled control, not by this message.

## Consequences

- Storage never holds a project the Studio can't open again.
- Each autosave parses the whole project once. Saves are 500 ms after the last change, so this
  stays off the typing path.
- An edit past a limit is kept in memory and in undo, but not saved, until it is undone.
