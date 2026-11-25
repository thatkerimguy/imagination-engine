# Kinetic Novel Platform

Linear kinetic novels (`Book → Season → Chapter → Block`) read in any browser, with lazy-loaded
3D/VFX/audio spectacles in the open space around the prose. Read `CLAUDE.md` (the constitution)
and the active directive brief (attached to the session; past briefs in `docs/directives/`,
reports in `docs/handoffs/`) before changing anything. `PROJECT_PLAN.md` is a menu, not
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

### Writer (`apps/writer`, Expo)

```bash
pnpm writer           # Expo dev server: scan the QR code with Expo Go / a dev build
pnpm writer:web       # the writer in a browser (localStorage instead of SQLite)
pnpm writer:export    # static Expo Web export into apps/writer/dist
pnpm writer:shots     # Playwright QA pack for the writer (needs pnpm build + writer:export)
pnpm build:preview-bundle   # rebuild the built-in offline reader (apps/writer/assets/reader-preview.html)
pnpm android:apk            # local Gradle release APK -> apps/writer/dist/kinetic-writer.apk (Windows)
```

**Live Preview** defaults to the **built-in offline reader**: `pnpm build:preview-bundle` compiles
`apps/reader` in `?preview=1` mode into one self-contained HTML file (all JS, CSS, starter modules,
three.js and cannon-es inlined) at `apps/writer/assets/reader-preview.html`. Metro ships it as a
static asset (`html` is in `metro.config.js` `assetExts`), so it never enters the Hermes bundle.
The file is generated, not committed (git-ignored): `pnpm writer`, `pnpm writer:web`,
`pnpm writer:export`, `pnpm android:prebuild` and `pnpm android:apk` all rebuild it first when any
reader / core / module source is newer (`--if-stale`). The public reader build (`pnpm build`) is
untouched and keeps its lazy-chunk budget.

Settings → Live preview → **Custom URL** switches back to a reader server (default
`http://127.0.0.1:5173/`, e.g. `pnpm dev --host` on your LAN, `adb reverse tcp:5173 tcp:5173`, or
`pnpm preview` behind an HTTPS tunnel; audio and motion sensors need a secure context).

### Android APK (local Gradle, no EAS)

On Windows, one command checks / installs everything and builds a release APK signed with a
local, git-ignored keystore (`apps/writer/.keystore/`; keep it, updates must use the same key):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -InstallTools -Install
```

`-InstallTools` installs Temurin JDK 17 (winget) and the Android command-line tools + SDK
packages (`platform-tools`, `platforms;android-35`, `build-tools;35.0.0`); `-Install` runs
`adb install -r` (automatic when exactly one device is attached); `-Abi arm64-v8a` (or
`armeabi-v7a`, `x86_64`, `x86`) builds a single ABI for a much faster rebuild and smaller APK —
the default `-Abi all` keeps the universal 4-ABI build:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -Abi arm64-v8a -Install
```

`-Variant debug` builds a debug
APK; `-SkipPrebuild` reuses `apps/writer/android/`; `-ToolsOnly` stops after the toolchain check.
`apps/writer/android/`, `apps/writer/dist/` (APK) and `apps/writer/dist-web/` (web export) are generated and git-ignored. Native C++ builds are staged under `C:\knx\` and pnpm keeps short `.pnpm/_<hash>` folders (`virtualStoreDirMaxLength: 30`) so CMake/ninja stay under the Windows 260-character path limit. The first build takes ~20–40 min (Gradle, NDK); later ones are much faster.

## Layout

```
packages/core                 frozen schema (zod), module contract, ULIDs; `@kn/core/renderer` is the web-only half
packages/modules/<id>/        one folder per gimmick: schema.ts · card.ts · renderer.ts · index.ts
apps/reader                   vanilla TS + Vite PWA reader, shared stage, audio bus, /sandbox, ?preview=1
apps/writer                   Expo + Expo Router authoring app (SQLite store, schema forms, live preview)
sample-novels/vertical-slice  the 12-block demo chapter
scripts/                      bundle report, smoke test, writer QA shots
docs/qa/                      one report per review pass
docs/directives/              archived directives
```

## Adding a module

Create `packages/modules/<genre>-<name>/` with the four files and a `package.json`. The reader
and sandbox discover it automatically (`import.meta.glob`); no edits to `packages/core` or the
reader shell. The writer needs one line in `apps/writer/src/modules/registry.ts` plus the
`@kn/module-<id>` dependency in `apps/writer/package.json` (see the Phase 2 report).
Enable it per novel through `novel.json` → `enabledModules`.
