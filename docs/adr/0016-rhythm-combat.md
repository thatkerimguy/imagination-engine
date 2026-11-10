# 0016 — Rhythm combat

**Status:** accepted · 2026-11-10

## Context

Phase 5 ends with Milestone B: a conversation, then a choice, then a fight on the author's song,
then a branch on the result. PLAN.md §6.4 describes charts in beats, enemies with movesets, a
fight director, BPM-adaptive density, three modes (call & response, free beat, mixed), judging
windows, typographic choreography, and losing as a story branch. The author must build all of it
without code, and it has to hold 60 fps on the Redmi Note 12 (ADR 0006).

## Decision

**A fight is a story block, its chart is generated, and the fight runs on the stage.**

- **The `fight` block** names an enemy, a track (or none), a mode, a difficulty, a length in bars,
  and an optional number variable for the score. It has `win` and `lose` block lists, like a
  check's success and fail. The runtime waits on a `fight` beat until the host reports the result
  (`resolveFight`), then records a `fought` beat and runs the matching list. Saves and rewind see a
  fight as one step; a fight in progress is not saved.
- **Enemies are project data** (`enemies`): a name in both languages, HP, attack, presence words
  and a moveset. A move is a name, a **pattern preset** (jab, double, flurry, feint, combo, sweep)
  and how the reader answers it (parry or dodge). Authors pick presets in forms; there is no chart
  notation to type. A hand-made chart editor waits for the Sequencer (Phase 8).
- **`packages/rhythm`** holds the logic as pure, seeded, DOM-free code with tests: patterns,
  density, the chart director, the judge and the fight state. The same seed and the same tempo
  always give the same fight. Its `view/` folder is the DOM and stage presenter, with no UI
  framework, and its own EN/TR word catalog. A `FightRunner` mounts a fight when the story waits
  on one and takes it down after a rewind, load or restart; the Player and the Studio's Play view
  both use it. The seed comes from the block and the story step, so a rewound fight replays the
  same moves.
- **Density follows the tempo.** The player's notes use the subdivision whose rate, at the usual
  fill, stays inside the difficulty's band (Easy 1–2.5, Normal 2–4, Hard 3–6 notes a second).
  A note appears two beats before it lands, but never less than 0.7 s or more than 1.6 s ahead.
- **Modes.** Call & response: the enemy attacks for two bars, then the reader strikes for two.
  Free beat: the reader strikes on any grid step for damage, while enemy attacks still come in.
  Mixed: the mode alternates at the song's sections (every 8 bars without analysis).
- **Judging.** Perfect ±35 ms, Great ±70 ms, Good ±110 ms, measured against the conductor's time
  after the device's tap latency (the Studio's tap test; the Player has none yet and uses 0).
  The reader's assist setting widens the windows (×1.6), makes the fight unlosable, or plays it
  automatically.
- **Input by position, not letter.** Keys are read by `KeyboardEvent.code` (F, J or Space to strike
  and parry; D, K or the arrows to dodge), so Turkish Q and F layouts both work. On touch, a tap
  strikes or parries and a swipe dodges. On a gamepad, A or B strikes and parries; X, Y or a
  shoulder button dodges. The phone pulses on hits when vibration is available and the reader
  hasn't turned it off.
- **Music.** The fight plays the chosen track, else the music already playing, else a procedural
  drum loop at 100 BPM with its own exact clock. The loop adds layers as the combo grows; that is
  this phase's adaptive music. Stem-based adaptive music needs stem separation, which stays a
  later, desktop-only feature.
- **Drawing.** The stage gets one new hook, a layer that draws shapes and glyphs each frame in the
  same instanced draw call as everything else. Notes are approach rings that shrink onto their
  mark; strikes are slashes, hits use the existing hit-stop, shake and sparks. The HUD (names, HP,
  combo, judgements) is DOM. Without WebGL2 the fight still plays with a DOM cue.

## Consequences

- A fight is reproducible from its seed, so tests and an auto-playtester can play one.
- The chart note (`{ beat, kind, move, power, x, y }`) is what the Sequencer will later edit by
  hand.
- Phase 6's Data editor and stats can change timing windows and enemy numbers without changing
  the block.
