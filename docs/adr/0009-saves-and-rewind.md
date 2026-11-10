# 0009 — Saves, autosave and rewind

**Status:** accepted · 2026-11-09

## Context

HyperOS closes background tabs freely (PLAN §11.1), so the reader must resume exactly where it
was after any reload, including the way back. Saves must stay valid while the author keeps editing
the story (ADR 0007 reconciles states by block ID). Storage is local-first (ADR 0005).

## Decision

**Everything goes through the kernel store in IndexedDB**, one key per record, validated with Zod
on every read. A damaged or outdated record reads as empty with a warning; the reader always starts.
Without IndexedDB (some private windows) the Player plays from memory.

| Key                     | Holds                                        | Written                   |
| ----------------------- | -------------------------------------------- | ------------------------- |
| `save:<story>:auto`     | the current state                            | after every reader action |
| `save:<story>:1…3`      | manual slots                                 | from the Saves sheet      |
| `persist:<story>`       | persistent variables and the endings reached | when they change          |
| `history:<story>:<seq>` | one rewind step each                         | when the step is taken    |

Writes run one after another, so an older state never lands after a newer one.

**Rewind is a list of whole states.** Before each reader action (tap, choice, answer) the session
keeps a snapshot; Back restores the last one. The backlog offers "go back to this choice" for
choices still in the history. Memory keeps 100 steps; storage keeps the newest 30.

**History is written step by step, not at page hide.** Unloading a page aborts IndexedDB
transactions still in flight, so a write in `pagehide` doesn't survive a reload. Each step is
written once, under its own key, as it is taken: one extra small write per tap. On open, only steps
that lead to the autosave are kept: every action adds beats, so an ancestor's log is a shorter
prefix of the current one. Steps from an abandoned branch (a rewind whose clean-up didn't reach
storage) are dropped and deleted.

**Persistent values live outside saves.** Loading a slot or starting over never rolls back
playthrough counters or unlocked endings.

## Consequences

- Rewind cost grows with the log (capped at 400 beats per state by the runtime); if late-game
  states get large, store history as diffs against the autosave instead.
- Cloud sync (later) syncs these same records; slot and history files carry the story ID.
- Starting over asks twice in the Saves sheet, since the place is lost unless saved.
