# 0003 — Player is framework-free; Studio uses React

**Status:** accepted · 2026-11-09

## Context

The Player must start fast on an entry-level phone (Redmi Note 12 4G), run inside the Studio
preview, and export as a small standalone bundle. The Studio is a large editor application that
benefits from a mature component ecosystem (graphs, block editor, docking).

## Decision

- `apps/player` and all `packages/*` runtime code are **vanilla TypeScript** with direct DOM, Web
  Audio and WebGL/WebGPU access. No UI framework.
- `apps/studio` uses **React 19 + Zustand**, with headless primitives and our own CSS tokens. Editor
  libraries chosen in PLAN.md (TipTap, React Flow, CodeMirror 6, dockview) live here.
- Shared visual language comes from `@ie/ui-kit` CSS tokens, usable by both.

## Consequences

- Runtime packages expose framework-agnostic APIs (functions, classes, DOM mounting). Studio wraps
  them in React components when needed.
- Reader shell startup budget: < 250 KB gzipped JS (PLAN.md §11.1).
