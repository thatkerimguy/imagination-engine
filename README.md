# Kinetic Novel Platform

Linear kinetic novels (`Book → Season → Chapter → Block`) read in any browser, with lazy-loaded
3D/VFX/audio spectacles in the open space around the prose. Read `CLAUDE.md` (the constitution)
and `DIRECTIVE.md` (the active scope) before changing anything. `PROJECT_PLAN.md` is a menu, not
a to-do list.

The previous engine (Studio, story graphs, rhythm, minigames…) is archived on the
`archive/imagination-engine-v1` branch.

## Commands

```bash
pnpm install
pnpm dev          # reader on http://127.0.0.1:5173, sandbox on http://127.0.0.1:5173/sandbox/
pnpm check        # typecheck + lint + unit tests
pnpm build        # production build + bundle budget gate (initial JS < 40 KB gz, 3D only lazy)
pnpm preview      # serve the build on http://127.0.0.1:4173
pnpm smoke        # browser smoke test against the build (needs Playwright + Chromium);
                  # `node scripts/smoke.mjs --shots qa-shots` writes a QA pack (git-ignored)
```

To try it on a phone, forward the port (`adb reverse tcp:5173 tcp:5173` on Android) or run
`pnpm preview` behind any HTTPS tunnel. Audio and motion sensors need a secure context.

## Layout

```
packages/core                 frozen schema (zod), module contract, ULIDs; `@kn/core/renderer` is the web-only half
packages/modules/<id>/        one folder per gimmick: schema.ts · card.ts · renderer.ts · index.ts
apps/reader                   vanilla TS + Vite PWA reader, shared stage, audio bus, /sandbox
sample-novels/vertical-slice  the 12-block demo chapter
scripts/                      bundle report, smoke test
docs/qa/                      one report per review pass (pass-<n>-report.md)
```

## Adding a module

Create `packages/modules/<genre>-<name>/` with the four files and a `package.json`. The reader
and sandbox discover it automatically (`import.meta.glob`); no edits to `packages/core`, the
reader shell, or (later) the writer. Enable it per novel through `novel.json` → `enabledModules`.
