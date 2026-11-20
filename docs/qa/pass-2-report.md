# Pass 2 Implementation Report

> Review: "Orchestrator Review (Pass 2) & `main` Branch Sync". This report covers commit `eb6f71e`.
> All of it was verified in headless Chromium with software rendering, not on a physical phone.

## Git & Build Verification

- **Branch pushed:** `main` at `eb6f71e`.
  - `origin/main` was at `0e1da1e`, which is the same commit as the `archive/imagination-engine-v1` backup.
  - The new history sits on top of that commit, so the push was a fast-forward and no force overwrite was needed. I still pushed with `--force-with-lease=main:0e1da1e` as a guard.
  - `ccr-37127553-rz0vdw` points at the same commit.
- **`pnpm check`:** PASS (typecheck, lint with 0 warnings, 37 unit tests).
- **`pnpm build` / `bundle-report.mjs`:**

  ```
  Initial reader JS (gzipped):
    assets/main-BigeVLXC.js              5.6 KB
    assets/lazy/module-host-BGwHWZpo.js 12.4 KB
    total 18.0 KB / budget 40.0 KB ✅
  Lazy chunks (gzipped):
    three.module 128.5 KB · high (dice 3D + cannon-es) 27.2 KB · renderer ×3 4.7/2.2/1.2 KB
    stage-gl 1.0 · bl-dice-3d 1.0 · gits-cyberbrain-chat 0.9 · module-contract 0.9
    core-ambient-bed 0.8 · workbox-window 2.2 · pwa-register 0.6
  ```

  The report confirms that no initial chunk contains three.js or cannon-es code.

- **`node scripts/smoke.mjs --shots qa-shots-pass2`:** exit 0, with zero console errors. Every check passed:
  - KESTREL-9 finished all 3 lines before the dice settled.
  - The scripted rolls landed as written: [1,1] and [6,6] in the reader, and [1,1] in 10 out of 10 sandbox throws.
  - A tap during the hold skipped to the handoff in 14 ms.
  - The beat recovered from a WebGL context loss.
  - The ×20 stress test was clean on all three quality tiers.

## How Each Pass 2 Fix Works

### 1. Frame-rate-independent lift

- **Where:** `packages/modules/bl-dice-3d/high.ts`, in `HighDice.play()`.
- **How it works:**
  - When playback goes from `roll` to `hold`, each die's resting height is saved in `settledZ[i]`.
  - During the fade, the height is set directly as `position.z = settledZ[i] + k * LIFT_HEIGHT`, where `k` is the eased fade progress from 0 to 1.
  - Nothing is added frame by frame, so the lift is identical at 60, 90 and 120 Hz.
- **Tunables:**
  - `LIFT_HEIGHT = 0.65` world units
  - `FADE_SECONDS = 0.45`

### 2. Sequential module queue

- **Where:** `apps/reader/src/reading/pacing.ts`, in `Pacer.fire()` and `Pacer.enqueue()`.
- **How it works:**
  - Module beats run one at a time, in document order, through a single promise chain.
  - When a module scrolls into view, any revealed modules above it that have not played yet go into the queue first. A fast scroll therefore cannot reorder beats or skip them.
  - If the reader leaves the chapter, every remaining queued item does nothing.
- **Tunables and edge cases:**
  - `BEAT_CAP_MS = 12000`: the longest any one beat can hold the queue.
  - A gate's "Tap to continue" cue appears when its beat finishes or when that cap runs out, whichever is first. A stalled module, or a tap-to-throw that nobody taps, can never lock the reader out.
  - The cap's timer is cleared after each beat.
- **`core-ambient-bed`:** its `trigger()` starts the crossfade and returns immediately, so an ambience change never delays the visual beats after it.
- **Result:** KESTREL-9 now plays all 3 lines (about 4.5 s) before the Dealer's dice are thrown. `smoke.mjs` checks this.

### 3. Keyboard guard

- **Where:** `pacing.ts`, in `Pacer.onKey`.
- **How it works:**
  - Enter and → only act while a continue cue is showing.
  - They are ignored while the settings sheet (`.kn-sheet`) or the audio curtain (`.kn-curtain`) is open.
  - They are also ignored when the key press comes from a `button`, `a`, `input`, `select`, `textarea` or editable element.
  - When the shortcut does act, it calls `preventDefault()`.
- **Edge cases:** the listener is removed with the pacer when the reader leaves the chapter.

### 4. Sandbox top-line padding

- **Where:** `apps/reader/src/sandbox/sandbox.css`.
- **How it works:** `.sb .kn-main { padding-top: calc(var(--scrim-h) + 0.75rem) }`, with `--scrim-h` at 1.75rem. Line 1 now starts below the header's fade at scroll position 0, and only dissolves once you scroll up.

## Additional Changes

- **Warm-theme contact shadows** (`bl-dice-3d/handoff.ts`, `shadowFor()`):
  - **Problem:** in the first Warm capture, each shadow blob sat almost entirely under its die, so the shadows barely showed.
  - **Change:**

    | Setting | Before         | After           |
    | ------- | -------------- | --------------- |
    | Scale   | `1.25 + 0.55h` | `1.75 + 0.55h`  |
    | Opacity | `0.5/(1+1.4h)` | `0.55/(1+1.4h)` |
    | Offset  | `0.45h`        | `0.16 + 0.45h`  |

  - **Result:** resting dice now show a soft shadow slightly down and to the right, and dice in mid-air keep a faint one.
- **Screenshots out of the repo:**
  - The Pass 1 PNGs are removed from the file tree. They still exist in git history at `54bb58b`.
  - `qa-shots*/` is now git-ignored. Screenshot packs are attached to handoffs instead of committed.
- **`smoke.mjs` additions:**
  - an assertion that KESTREL-9 finishes before the dice settle
  - the Warm-theme pass
  - the four Pass 2 shots

## Regression Check

Post-×20 telemetry on High:

```
✅ No leaks after 20 runs · new GL contexts 0 · GL contexts made 1 · live yes · leases 0 · geo 0 · tex 1 · overlay nodes 0
```

- Lite and Reduced end at all zeros.
- `gits-cyberbrain-chat` still shows `GL contexts made 0 · live no`.
- The `tex 1` on High is three.js's renderer-wide DFG lookup table. It is freed when the idle stage disposes its context.

## Screenshot Pack (attached to the handoff, not committed)

Generate it with `node scripts/smoke.mjs --shots qa-shots-pass2`.

1. `01-kestrel-complete-before-dice.png`
2. `02-warm-theme-dice-shadows.png`
3. `03-sandbox-top-line-crisp.png`
4. `04-post-x20-high-regression.png`
