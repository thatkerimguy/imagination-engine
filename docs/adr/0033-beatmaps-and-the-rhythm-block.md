# 0033 — Beatmaps and the Rhythm block

**Status:** accepted · 2026-11-12

## Context

The fight rhythm game (ADR 0016) taps lanes to the beat. The owner wanted an aim-and-tap game in
the manner of the well-known circle-clicking genre, with that genre's conveniences, charts
imported from its open `.osu` text format, and a way to make and edit charts in the Studio. The
game must stay our own: no borrowed name, art, sounds or skin. It also has to run at 60 fps on the
reference phone (PLAN.md §11.1) and work without a song.

## Decision

**A beatmap is story data.** `StoryProject.beatmaps` holds up to 64 `BeatmapDef`s, checked by Zod
(`packages/story/src/beatmap.ts`):

- Times are milliseconds from the start of the audio file. That is how songs and imported charts
  measure time.
- Positions are on a field 1 wide and `FIELD_HEIGHT` (0.75) tall. An imported `.osu` position is
  divided by 512.
- Notes are circles, sliders (`line`, `bezier`, `arc` or `smooth` curves, a path, an optional
  length, crossings and an end time) and spinners (an end time).
- Tempo comes from timing points `{t, bpm, meter?}`.
- Four 0–10 dials: size, approach, accuracy and drain.
- Optional slider ticks per beat, a lead-in and credits.

**The Rhythm block plays a beatmap** and waits like a fight or a minigame. It has an optional
accuracy needed to win, an optional number variable for the accuracy, and win and lose lists.
`runtime.resolveRhythm` records a `played` beat, so the result reads as a line in the story.

**Rules are ours, in one tested module** (`packages/rhythm/src/beatmap/rules.ts`):

- Circle radius and approach time follow the dials.
- Judgements are Perfect, Great and Good, with windows that narrow as accuracy rises. A miss
  breaks the combo.
- Health drains and refills by `healthChange`. Gaps over 4 s are rests with no drain.
- Ranks are S+, S, A, B, C and D.
- Only the earliest unjudged note can be hit (note lock).
- Sliders judge by the share of head, ticks, turns and end that were held.
- Spinners need a number of turns, capped at 8 per second.

**Changes ("mods") have plain names:** Easy, Hard, Fade, Slow, Fast, Can't fail and Watch. Easy
and Hard rule each other out, as do Slow and Fast. The reader's help setting in the Player forces
some of them on: wide gives Easy, no-fail gives Can't fail, auto gives Watch.

**Conveniences:**

- Each device keeps its own timing offset, background dim, hit sounds and last mods
  (`ie.player.rhythm` and `ie.studio.rhythm` in localStorage, through the ui-kit helpers).
- After a round of at least 10 taps, the results offer "use as offset".
- A hit-error bar, key counters (Z/X and both mouse buttons), skipping the intro, and pause with a
  one-second rewind on resume.
- The game pauses when the tab is hidden, and judges taps by their event time rather than the
  frame time.

**On a tall screen the field turns a quarter clockwise.** A phone held upright then uses its whole
height, and every pattern keeps its shape and handedness.

**The clock is the audio.** A decoded song plays from an `AudioBuffer`, so the audio clock is the
game clock, corrected by the output timestamp. A song that can't be decoded (cross-origin with no
CORS) plays in a media element, and the clock re-anchors when it drifts more than 40 ms. A beatmap
without a song gets a click track scheduled ahead on the audio clock.

**Import and export.** `parseOsu` reads standard-mode `.osu` files:

- Slider end times come from the slider multiplier, the speed of inherited points (which resets
  at each tempo change) and the beat length.
- Charts for other modes are refused.
- `.osz` archives are read with a small zip reader that inflates through `DecompressionStream`.
- The song inside an archive is imported as a track whose licence is left unknown.
- `writeOsu` writes v14, adding an inherited point per slider so imported and edited sliders keep
  their timing.

**The Studio's Beatmaps workspace** follows the "no code" rule (CLAUDE.md):

- Import: pick or drop files.
- Notes tab: the field at the playhead, a timeline with the waveform and beat grid, an inspector,
  keyboard shortcuts, copy and paste, the song playing with hit sounds, and test play from the
  playhead.
- Timing tab: tempo changes, taking the tempo from the song's analysis, and moving the whole
  chart.
- Settings tab: name, song, dials, credits, `.osu` download and delete.

All edits go through pure functions in `beatmap-edit.ts` and `note-tools.ts`, and each drag is
one undo step.

## Consequences

- Beatmaps are part of the novel file. One song's chart is usually 20–200 KB of JSON, so files
  grow with each chart. The 64-map and 6000-note limits keep that bounded.
- Only standard-mode charts import. Storyboards, skins, hit-sound sample sets and video in `.osu`
  files are ignored on purpose.
- The fight rhythm game stays as it is. The two games share audio and haptics but not rules.
