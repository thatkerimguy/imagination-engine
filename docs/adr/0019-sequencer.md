# 0019 — The sequencer

**Status:** accepted · 2026-11-10

## Context

Phase 8 is done when fight moves and cinematic scenes are authored on a beat-snapped timeline
(PLAN §8.2, §13). Stage effects (ADR 0015) and audio (ADR 0012) are single blocks that fire as
the story reaches them; nothing lines them up with a song's beats. Fight moves are six fixed
pattern presets (ADR 0016), which said a hand-made chart editor waits for the sequencer. ADR 0018
deferred custom reading layouts and the choice-list component to this phase too. The author still
writes no code, and playback has to fit the Redmi Note 12 budget (ADR 0006, PLAN §11.1).

## Decision

**A sequence is project data: tracks of clips placed in beats.** `project.sequences` holds
sequences of two kinds:

- **Scene** sequences are cinematic moments: a song (an audio-library track, or none), a tempo for
  when there is no song, the beats in a bar, a length in bars, and tracks.
- **Move** sequences are one enemy move: one to eight beats of notes, plus the stage and sound
  that go with them. They have no song of their own; they play on the fight's clock.

Tracks are lanes of one kind: **stage** (background, look, shake, flash, freeze, burst,
transition), **text** (stage titles), **sound** (sound effects and ambience) and **notes** (fight
notes: parry, dodge or strike, a power, and a place on the stage). A clip is the same kernel
action and parameters an Action block has (PLAN principle 4, "one mental model"), placed at a beat
with an optional length. A title's length on the timeline sets how long it stays up. Positions
are beats, not seconds, so a sequence follows its song's beat grid, including songs whose tempo
drifts (the analysis's variable `TempoMap`). The editor snaps to a grid from a bar down to a
sixteenth; the data stores any beat, so changing the snap never moves existing clips.

**Sequences never change the story's state.** They hold no Set, Jump or Choice clips. A sequence
is presentation, like a stage block, so saves, rewind and determinism (ADR 0009) are unchanged.
What it leaves behind, its last background and look, is written to the scene state when the
story reaches the block, so a load or a rewind restores the same picture without replaying it.
Action tracks that change variables wait for a later ADR.

**The story plays one with the Sequence block.** It names a sequence and whether the story waits.
Waiting puts a `sequence` beat in the log; the host plays the sequence and moves on when it ends,
and a tap skips it, like a timed pause. Without waiting, the block fires the `sequence.play`
action and the story goes on at once.

**Playback lives in `packages/sequencer`, framework-free.** `compileSequence` turns a sequence
into cues sorted by beat (titles get their seconds from the tempo here, once). A `SequenceCursor`
walks those cues as the clock passes them: an index and a loop, no allocation per frame. Seeking
back or jumping ahead fires nothing in between, but `sceneAt` gives the background and look in
force at any beat, so a scrub shows the right picture. The clock is the audio clock through the
existing `Conductor`: the sequence's track when it has a beat grid, else the song already playing
when it has one, else a steady tempo on the audio context's clock. Beat 0 lands on the next
downbeat. `SequencePlayer` runs the cursor from `requestAnimationFrame` only while a sequence
plays, and hands each cue to a `dispatch(action, params)` the app provides, which runs it through
the kernel's action bus like any block. `SequenceRunner` mounts one for a waiting beat, as
`FightRunner` does for fights, and stops it after a rewind, a load or a restart.

**Fight moves and charts feed the rhythm director.** An enemy move can name a move sequence.
Its notes replace the pattern preset's offsets and answers, its length replaces the preset's span,
and its stage and sound clips play as choreography each time the director picks the move. A Fight
block can also name a scene sequence as its **chart**: its notes become the whole fight bar by
bar (bars with strikes are the reader's turn, others the enemy's), its stage clips play along,
and its song is the fight's song. Generated fights are unchanged, and the same seed still gives
the same fight.

**The Studio's Sequences workspace** lists sequences, edits their settings, and shows the
timeline: a ruler in bars and beats, one row per track, clips as blocks and notes as marks. Tap
an empty spot to add a clip there (snapped), drag a clip to move it, drag its end to trim it, and
select it to edit its settings with the same sentence editors the Manuscript uses. Split cuts the
selected clip at the playhead, and clips can be duplicated or removed. The playhead scrubs by
dragging the ruler. The preview plays the sequence with its song on the Studio's stage panel.
Keys: Space plays and pauses, J and L step back and forward a beat (K stops), arrows nudge the
selected clip by the snap, Delete removes it. Every control is also a button, so the phone works
by touch alone. Edits go through the project store, so they undo like everything else.

## Consequences

- Ripple edits, nested sequences, curve editors for parameters, waveforms and seconds-based
  tracks are not in this phase. Material parameters join the timeline with the material graph
  (Phase 9), as new track kinds.
- Custom reading layouts and the choice-list component (ADR 0018) still wait: a sequence can
  stage a scene, but text layout stays the presenter's job until a layout ADR.
- The chart note shape (`beat`, `kind`, `power`, `x`, `y`) is shared by the director and the
  editor, so a hand-made chart and a generated one play and judge the same way.
- A sequence costs nothing when no story uses one: the player loop runs only while it plays.
