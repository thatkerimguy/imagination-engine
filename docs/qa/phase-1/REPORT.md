## Implementation Report

### Summary of Changes

- `packages/modules/bl-dice-3d/handoff.ts` (new): shared settle → hold → fade lifecycle helpers (`holdOrTap`, `fadeProgress`, `shadowFor`, `FADE_SECONDS`).
- `packages/modules/bl-dice-3d/shadow.ts` (new): per-die soft contact shadow blobs that react to height. They replace the shadow-map catcher plane.
- `packages/modules/bl-dice-3d/high.ts`: rewritten as a phase machine (`roll → hold → fade → done`). It drops shadow mapping and releases the lease only after the fade.
- `packages/modules/bl-dice-3d/lite.ts`: the 2D tier now follows the same hold, tap-to-skip and cross-fade lifecycle.
- `packages/modules/bl-dice-3d/renderer.ts`: the inline result chip is created only at handoff, never while dice are rolling or holding.
- `packages/modules/bl-dice-3d/palette.ts`, `dice-mesh.ts`: ivory albedo `#e6dfd1` with tuned roughness, clearcoat and environment-map intensity.
- `packages/modules/bl-dice-3d/schema.ts`: `holdSeconds` default changed from 2.5 to 1.5 (step 0.25), with help text.
- `packages/modules/bl-dice-3d/styles.ts`: chip fade-in shortened to 0.45 s to match the overlay fade.
- `apps/reader/src/runtime/stage-gl.ts`: ACES filmic tone mapping, context loss and restore handling, and `lost` / `stale` flags. The unused shadow map is removed.
- `apps/reader/src/runtime/stage.ts`: rejects acquiring the GPU stage while the context is lost, and replaces a stale context once no leases remain. Adds `contextLost` to the stats.
- `apps/reader/src/styles.css`: header fade scrim (`.kn-bar::after`), solid bar background, and `scroll-margin-top` on blocks and the continue cue.
- `apps/reader/src/sandbox/*`: the last ×20 verdict stays pinned above the live telemetry. The sandbox header gets the same scrim.
- `sample-novels/.../ch01.json`: both dice beats use `holdSeconds: 1.5`.
- `scripts/smoke.mjs`: produces this screenshot pack. It also checks determinism, tap-to-skip, context-loss recovery and ×20 telemetry on every tier.
- `handoff.test.ts` (new): fade curve and shadow height curve.

### How Each Key Function Works

**`bl-dice-3d/high.ts` → `HighDice.play(signal, onHandoff)`** (dice roll controller and handoff)

- **How it works:**
  - Pre-simulates the throw (`recordThrow`), picks the face values and computes a remap quaternion per die.
  - Replays the recorded frames through the stage's `onFrame`.
  - When playback reaches the settle frame, it enters `hold` and starts `holdOrTap()`.
  - When the hold ends, it enters `fade`, calls `onHandoff(values)` (the inline chip fades in), then fades the dice and shadows to 0 over `FADE_SECONDS`.
  - At the end of the fade it calls `dispose()`, which frees GPU resources, then releases the lease, then resolves the promise.
- **Tunables:**
  - `holdSeconds` = 1.5 (schema; the Author can set 0.5–8)
  - `FADE_SECONDS` = 0.45
  - `KEY_LIGHT` = 1.7, at (−3.5, 5, 13)
  - `AMBIENT_LIGHT` = 0.32
  - Lift during the fade: +0.02·k per frame
- **Edge cases:**
  - Navigating away mid-roll: `dispose()` is idempotent, unsubscribes the frame callback, stops scheduled sound, releases the lease and resolves the pending promise.
  - Background tab: `dt` is clamped to 1/20 s per frame.
  - A hold that resolves after dispose is ignored by the phase guard.

**`bl-dice-3d/handoff.ts` → `holdOrTap(seconds, signal)`**

- **How it works:**
  - Resolves on whichever comes first: the timer, a `pointerdown` on the window (`{ once: true }`), or the abort signal.
  - All three are registered under one local `AbortController`, which is aborted when the hold ends, so no listener or timer outlives the hold.
  - The tap listener is attached on the next animation frame, so the tap that started a tap-to-throw cannot also skip the hold.
- **Edge cases:** rapid taps (the first one wins, the rest find no listener); disposal during the hold; a signal that is already aborted.

**`bl-dice-3d/lite.ts` → `LiteDice.play(signal, onHandoff)`**

- Same phase flow on a 2D canvas: roll, settle, hold or tap, `onHandoff`, fade over `FADE_SECONDS`, then dispose (canvas removed) and resolve.
- Scripted values are fixed before the throw, and each die snaps to its target once its speed drops below 120 px/s.

**`bl-dice-3d/renderer.ts` → `trigger()`**

- **Reduced:** no overlay. The chip is shown immediately with no animation.
- **High:** uses `HighDice`; if WebGL is unavailable or the context is lost, it falls back to the lite tier.
- **Lite:** `LiteDice`.
- The chip is rendered only from `onHandoff`, so it can never overlap rolling or holding dice.
- The promise resolves after the overlay is gone. The reader's "Tap to continue" cue therefore appears only once the prose is clear.

**`bl-dice-3d/remap.ts` → `remapRotation(value, landedFace)` + `simulate.ts` → `recordThrow()`** (deterministic face targeting)

- cannon-es simulates the throw invisibly at a fixed 1/60 s step and records every frame until all dice have been still for 12 frames.
- `topFaceIndex` finds the physical face pointing toward the reader (+Z).
- `remapRotation` returns the cube-symmetry rotation that carries the target value's face onto that landed face. It is identity, a 90° turn about the axis given by the cross product of the two face normals, or 180° about a perpendicular face axis.
- The visible orientation is the body's orientation multiplied by that rotation. Because a cube-symmetry rotation leaves the cube's shape unchanged, the silhouette and contacts are identical, and the target face finishes on top.
- If any die lands leaning (top-face alignment < 0.995), it re-throws with a new seed, up to 8 tries, and keeps the flattest result.

**`bl-dice-3d/shadow.ts` → `updateShadow()` + `handoff.ts` → `shadowFor(height)`** (height-scaled shadows)

- Each die has a soft radial blob (a 128 px canvas texture) on the page plane at z = 0.002. It is offset away from the key light and updated every frame from the die's height h above the plane.
- `opacity = 0.5 / (1 + 1.4h)`: faint in the air, firm on landing. Multiplied by the fade factor during handoff.
- `scale = DIE_SIZE · (1.25 + 0.55h)`: larger, so softer, the higher the die.
- `offset = 0.45h` world units, down and to the right.

**`apps/reader/src/runtime/stage.ts` → `createStage().acquireGL()`** (WebGL lease manager)

- The three.js chunk and the single renderer are created lazily on the first acquire; concurrent first acquires share one promise.
- Each lease tracks its own frame subscriptions, and `release()` is idempotent.
- When leases reach 0, the GL stage is disposed after `IDLE_DISPOSE_MS` = 8000, or immediately if the context is stale.
- **Edge cases:**
  - An acquire during context loss rejects, so the module falls back to lite.
  - A stale (once lost) context is replaced on the next acquire after all leases are gone.

**`apps/reader/src/runtime/stage-gl.ts` → `createGLStage()`** (context-loss handler and renderer)

- **How it works:**
  - On `webglcontextlost`: calls `event.preventDefault()`, sets `lost = stale = true`, and logs a warning.
  - On `webglcontextrestored`: clears `lost`.
  - While lost, the frame loop keeps calling subscribers but skips `render()`. Every running spectacle therefore completes its timeline, hands off to its inline chip and releases its lease.
- **Tunables:**
  - `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1`
  - Pixel ratio capped at 2
  - Die size: 15% of the screen's short edge, clamped to 56–96 px
- **Edge cases:** the `forceContextLoss()` that `dispose()` triggers is ignored by a `disposing` flag.

**`apps/reader/src/styles.css`** (header fade and scroll margin)

- `.kn-bar` has a solid `var(--bg)` background.
- `.kn-bar::after` is a `var(--scrim-h)` = 1.75rem gradient from `var(--bg)` to transparent, with `pointer-events: none`.
- `.kn-block` and `.kn-continue` have `scroll-margin-top: calc(var(--bar-h) + 24px)`, where `--bar-h` = `env(safe-area-inset-top) + 3.6rem`.

### Reliability Audit Results

- **Deterministic outcomes:**
  - Faces come from the remap after pre-simulation, not from chance.
  - The unit tests check every value (1–6) against every possible landed face. They also run 54 recorded throws (3 layouts × 1–3 dice × 6 seeds); every one lands on its scripted value, flat and inside the screen bounds.
  - In the browser: reader beat 1 landed [1,1] and beat 3 landed [6,6], and 10 out of 10 consecutive sandbox throws landed [1,1].
  - Lite fixes its values before the throw. Reduced shows them directly.
- **×20 stress test** (headless Chromium with SwiftShader, 390×844):

  | Tier    | Before                                                                       | During      | After all fades (+2 s)                                                                                         |
  | ------- | ---------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
  | High    | `GL contexts made 1 · live yes · leases 1 · geo 0 · tex 2 · overlay nodes 0` | `Run 1/20…` | `✅ No leaks · new GL contexts 0 · GL contexts made 1 · live yes · leases 0 · geo 0 · tex 1 · overlay nodes 0` |
  | Lite    | `GL contexts made 0 · live no · leases 0 · geo 0 · tex 0 · overlay nodes 0`  | `Run 1/20…` | same as before, `✅ No leaks`                                                                                  |
  | Reduced | `GL contexts made 0 · live no · leases 0 · geo 0 · tex 0 · overlay nodes 0`  | `Run 3/20…` | same as before, `✅ No leaks`                                                                                  |
  - High "before" holds 1 lease and 2 textures because the sandbox pre-mounts the module (environment map + lookup table).
  - The `tex 1` that remains on High is three.js's renderer-wide DFG lookup table (a singleton used by PBR materials). It is freed when the idle stage disposes the context.
  - The sampled "during" values are progress text only, not telemetry.

- **Context loss recovery:** tested by calling `WEBGL_lose_context.loseContext()` mid-throw.
  - The beat still finished and the chip appeared, with leases back to 0.
  - The next trigger built a fresh context (`GL contexts made 2 · leases 0 · geo 0 · tex 1`) and played normally.
  - No console errors (the loss is logged as a warning).
- **Tap to skip:** with a 6 s hold, a tap right after settling started the handoff within 15–81 ms across runs.

### Sample Chapter Authoring Snippet

From `sample-novels/vertical-slice/seasons/s01/ch01.json`. The Author never types this: the Phase 2 writer generates it from each module's schema form.

```json
{
  "id": "01M7WD7TG3C1Z266E87HFD27KR",
  "kind": "module",
  "moduleId": "gits-cyberbrain-chat",
  "moduleVersion": 1,
  "props": {
    "senderId": "KESTREL-9",
    "encryption": "AES-Q",
    "side": "right",
    "messages": [
      "Dealer's cup is weighted. Left side.",
      "He rolls snakes when he wants the room to relax.",
      "Don't relax."
    ],
    "chime": true,
    "lineDelay": 1.4
  }
},
{
  "id": "01M7WD7TG54FMBWYMZM8XKD1V7",
  "kind": "module",
  "moduleId": "bl-dice-3d",
  "moduleVersion": 1,
  "props": {
    "count": 2,
    "material": "ivory",
    "outcomeMode": "scripted",
    "scriptedNumbers": [1, 1],
    "trigger": "auto",
    "holdSeconds": 1.5,
    "sound": true
  },
  "beatStop": true
}
```

### Screenshot Pack Notes

- The PNGs were attached to the Pass 1 handoff and removed from the tree in Pass 2. Regenerate them with
  `node scripts/smoke.mjs --shots qa-shots` (that folder is git-ignored).

- Shots 01–05 and 08 are at 390×844 @2×. Shots 06–07 are at @1×, because the 20-throw runs are too slow on a software GPU at 2×.
- For shot 04, the smoke script adds temporary bottom padding to the page. This lets the end of a revealed segment scroll far enough to sit under the bar.
- The dark theme hides most of the contact shadows by design (black on near-black). They read clearly on the Warm theme.
- Not yet verified on a physical phone: frame rate and lighting on a real mobile GPU (the Redmi-class reference device).
