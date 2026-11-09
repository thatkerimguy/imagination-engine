# 0005 — Local-first storage

**Status:** accepted · 2026-11-09

## Context

Projects must work offline on phone and desktop, survive aggressive tab killing on HyperOS, and be
exportable as plain files.

## Decision

- Project data and saves live in the browser: **IndexedDB** (via `idb`) for key/value records and
  **OPFS** for files (audio, exports). Desktop Chromium can additionally open a real folder through
  the File System Access API (later phase).
- `@ie/core` exposes storage through small interfaces (`KeyValueStore`, `FileStore`) with IndexedDB,
  OPFS and in-memory implementations, so tests and future sync backends can swap them.
- Apps call `navigator.storage.persist()` at startup to reduce eviction risk.
- `localStorage` is used only for per-device UI preferences, through safe wrappers.

## Consequences

- No server is required to develop or play. Device sync (Yjs + small sync store) can be added later
  behind the same interfaces.
