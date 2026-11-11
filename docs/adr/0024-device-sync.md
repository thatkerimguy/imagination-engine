# 0024 — Device sync: three-way merge by id over a small R2 store

**Status:** accepted · 2026-11-11

## Context

The owner writes on a phone and a computer (PLAN §10, "Later": device sync). PLAN named a Yjs CRDT
document plus a small sync store on Cloudflare R2, and ADR 0005 kept storage swappable for it. The
Studio's editing model, though, is immutable snapshots with undo (ADR 0011): every edit makes a new
`StoryProject`. Binding that to a Yjs document means diffing each snapshot into Y types and back,
and a large new dependency, for one author who is rarely typing on two devices at the same second.

## Decision

**No CRDT. A three-way JSON merge by stable id.** `merge3(base, ours, theirs)` in `@ie/core`
keeps what either side changed since the base. Objects merge key by key. Lists whose items all
have a string `id` (passages, blocks, options, tracks, variables…) merge by id: additions from both
sides are kept, a removal wins unless the other side edited the item, and new items land after
their neighbour. A value both sides changed differently is a conflict: **this device's value
wins** and the number of conflicts is shown. Unchanged parts keep object identity.

**One sync** (`syncOnce`): read the store's copy and its ETag, merge it with this device's copy
over the base (the last copy both had, kept in IndexedDB as `sync:<id>`), and write back with
`If-Match`. If another device wrote first (412), start again. A merge that fails the schema keeps
this device's copy whole. The first upload uses `If-None-Match: *`.

**The store** is three routes, the same in both implementations:
`GET /sync/projects` (list), `GET /sync/projects/<id>` (copy + ETag, 204 when none) and
`PUT /sync/projects/<id>` (guarded). The hosted Studio uses a Pages Function on an R2 bucket bound
as `SYNC`, behind Cloudflare Access, and refuses requests without Access's identity header unless
`SYNC_OPEN=1`. Dev and preview use a Vite middleware writing files to `apps/studio/.sync/`
(ignored by git), so two browsers on one machine sync, which the e2e test does.

**When.** Sync is per device and off by default (Settings → Device sync). When on, the open story
syncs on start, when the tab is shown or hidden, when another story is opened, every two minutes
while in view, and on "Sync now". Edits made during a round trip are merged on top, and a pulled
change is an ordinary undoable edit. Stories in the store but not on this device are listed,
newest first, to open here.

## Consequences

- Everything in a project that lives in a list must have a stable `id` (already the rule): lists
  without ids merge as whole values, so both devices editing one is a conflict.
- Deleting a story on one device doesn't delete it in the store; the store is never pruned by the
  Studio.
- Player saves don't sync yet; they can use the same store and merge later (ADR 0009 records
  carry the story id).
- If real-time co-editing is ever wanted, a CRDT is a new ADR; the store routes can stay.
