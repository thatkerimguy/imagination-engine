# 11. Beatmaps and the Rhythm block

A **Rhythm block** stops the story for an aim-and-tap game. Circles appear on the beat, and the
reader taps each one as its ring closes. **Sliders** are held along their path. **Spinners** are
spun round. The game is played to a **beatmap**: a chart of notes timed to a song. You can import
charts made for other games as `.osu` or `.osz` files, or place the notes yourself.

## Importing a chart

1. Open **Beatmaps** from the left rail (on the phone: **More → Beatmaps**).
2. Press **Import .osu or .osz** and pick:
   - an `.osz` file (one song with all its charts), or
   - one or more `.osu` files, with the song file picked alongside them.

   You can also drop the files onto the page.
3. Each chart in standard mode becomes a beatmap. Charts for other modes are skipped, and the
   status line says how many.

The song is added to **Sound** with an unknown licence, because it came with someone else's
chart. Set its licence there before you publish (see [chapter 8](08-library-publish-play.md)).
If the song wasn't found, choose one in the beatmap's **Settings**.

Picking only a song makes a new, empty beatmap for it.

## Placing notes

Press **New beatmap**, or open one from the list. Then choose its song in **Settings** (see
below). The **Notes** tab has three parts:

- **The field** shows the notes as a reader sees them at the playhead.
- **The timeline** runs under the field. It shows the song's waveform, the beat grid (bars are
  the strongest lines) and every note, with the playhead in the middle.
- **The inspector** on the right edits the selected notes.

Pick a tool, or press 1–4:

| Tool        | What a click on the field does                                                         |
| ----------- | -------------------------------------------------------------------------------------- |
| **Select**  | Selects a note (Shift adds more). Drag to move. A selected slider shows square handles. |
| **Circle**  | Places a circle at the playhead.                                                         |
| **Slider**  | Starts a slider. Each further click adds a bend; **Finish slider** (or Enter, or a double-click) ends it. |
| **Spinner** | Places a spinner that lasts one bar.                                                     |

The placing tools place even over a note that is still showing; switch to **Select** (press 1) to
move notes. Notes go on the playhead, snapped to the grid. **Snap** sets how fine the grid is: 1/4 beat
suits most songs, and 1/3 or 1/6 suit swing and triplets. To place notes in time:

- Move the playhead with the arrow keys (one grid line; Shift moves a whole beat).
- **Page Up** and **Page Down** move a bar. **Home** and **End** go to the start and the last
  note.
- Turn the mouse wheel over the timeline. Ctrl and the wheel zoom.
- Click the timeline to jump there, or drag it to scroll.

On the timeline, drag a note sideways to move it in time. Drag the end of a slider or spinner to
make it longer or shorter.

**Play** plays the song from the playhead, with a click on every note it passes. **Space** does
the same. Slider ticks and turns aren't placed by hand: they follow from the slider's length and
the beatmap's **slider ticks**.

The inspector edits:

- the selected note's **time**;
- a slider or spinner's **length in beats**;
- a slider's **curve** (straight, curved, arc or smooth) and **crossings** (2 goes there and
  back);
- **New combo** (or press **Q**), which starts counting from 1 again.

Delete selected notes with **Delete notes** or the Delete key. **Ctrl+C** and **Ctrl+V** copy
notes to the playhead, keeping their spacing. **Ctrl+A** selects all. **Ctrl+Z** undoes, and each
drag is one step.

**Test from here** plays the beatmap from the playhead, exactly as a reader would. Pick **Watch**
on the start card to see it played perfectly. That's a quick way to check a pattern.

## Timing

The **Timing** tab lists the tempo changes the grid snaps to: a time, beats per minute and beats
per bar.

- **Use the song's analysed beat** fills in the tempo found in **Sound**. Analyse the song there
  first.
- **Add a tempo change at the cursor** adds a change at the playhead, for songs that speed up or
  slow down.
- **Move the whole chart** shifts every note and tempo by a few milliseconds. Use it when a song
  file starts a little sooner or later than the one the chart was made for.

## Settings

- **Name** in English and Turkish, as the reader sees it.
- **Song**. With no song, a click track keeps the time.
- **Silence before the song**. Give the reader a moment before the first note.
- **Slider ticks per beat**.
- The four dials, from 0 to 10:
  - **Circle size**: higher makes smaller circles.
  - **Approach speed**: higher makes circles appear later.
  - **Timing strictness**: higher makes the timing windows narrower.
  - **Health drain**: higher makes health fall faster and misses cost more.
- **Credits**. Imported charts fill these in. Keep them when you publish someone else's chart.
- **Download .osu** writes the beatmap as an `.osu` file that other editors can open.

## The Rhythm block

In **Write**, add a **Rhythm** block (it's with the games). Choose:

- the **beatmap** to play;
- what it takes **to win**: just finishing, or an accuracy such as 80%;
- where to **save the accuracy**, if anywhere (a number variable from 0 to 100);
- what happens **if you pass** and **if you fail**.

**Edit beatmap** opens it in **Beatmaps**.

## What readers get

Before playing, the reader sees the beatmap's name, credits, dials and length. They can turn on
**changes**:

- **Easy**: larger circles and wider timing.
- **Hard**: the opposite of Easy.
- **Fade**: circles fade out before they're due.
- **Slow** and **Fast**: the song at three quarters or one and a half speed.
- **Can't fail**: health never runs out.
- **Watch**: it plays itself.

Settings kept on each device:

- **Timing offset** for late or early taps. After a round, the results offer to correct it from
  the reader's own taps.
- **Dim the story behind**.
- **Hit sounds**.

While playing, the reader can:

- pause (the button or Escape);
- skip the quiet start (the Skip button or Space);
- tap with a finger, a mouse button, or **Z** and **X** on a keyboard.

On a phone held upright, the field turns a quarter so it fills the screen.

The Player's help settings carry over: **wide** timing turns on Easy, **no fail** turns on Can't
fail, and **auto** turns on Watch.
