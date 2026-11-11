# 5. Stage, Sequences and Materials

These three workspaces make the screen move. They all run on the graphics card (WebGL2) and
follow the reader's **quality tier**, so the same novel stays smooth on a cheap phone and rich
on a desktop. If a browser has no WebGL2, the novel still plays, just without these effects.

## The Stage workspace: try things out

**Stage** is a sandbox, not part of your novel. Use it to see what each effect looks like before
you add a block for it.

- **Scene**: pick a background and a look and watch them together.
- **Moments**: fire a shake, flash, freeze, particles, a title or a transition.
- **Quality**: Automatic, Low, Medium or High, to see what a weaker phone will show.
- The small line of stats (sprites, draw calls, milliseconds) tells you how heavy it is.

## Stage blocks (in Write)

| Block         | Sentence it reads as                     | Choices                                                                                                       |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Background    | Set the background to _rain_ at _amount_ | rain, embers, stars, snow, falling leaves, petals, fireflies, ash, bubbles, dust in the light, or nothing     |
| Look          | Set the look to _film_                   | plain, film, CRT screen, noir, dream, sepia, old tape, night, dread                                           |
| Screen effect | Shake / Flash / Freeze                   | shake strength light, medium, heavy; flash colour; freeze seconds                                             |
| Particles     | Throw _a burst_ in _gold_                | a burst, sparks, confetti, hearts, a puff of smoke, magic; colours ink, accent, white, red, gold, blue        |
| Title         | Large text across the stage              | the words in each language, how long it shows, then _fade it out_ or _shatter it_; optionally a text material |
| Transition    | _Dissolve_ over _N_ s                    | Dissolve, Ink spread, Wipe, Fade, Blinds, Iris                                                                |

Backgrounds and looks stay until another block changes them. A Background of **nothing** or a
Look of **plain** clears them.

## Pictures and video

- **Picture** block: a picture behind the text. Choose a file (it's shrunk and kept in the
  novel) or give a **Web address** (`https://` only).
  - **Size**: Fill the screen, or Show it whole.
  - **Fade behind the text**: dims it so the words stay readable.
  - **Words for readers who can't see it**: a description for screen readers.
  - A Picture block with no picture takes away the one that is showing.
- **Video** block: a muted video behind the text, with **Play again when it ends**. Use Music or
  Ambience blocks for sound. A Video block with no video stops the one playing.

Pictures kept in the novel make the file bigger; readers on mobile data will wait longer. Publish
warns you when the novel gets large.

## Sequences: timelines on the beat

A **sequence** is a short timeline of effects, titles, sounds and fight notes that snaps to the
music's beat. There are two kinds:

- **Scene**: a cinematic moment, played from a **Sequence** block in Write.
- **Fight move**: an enemy attack whose notes (parries and dodges) replace the move's simple
  rhythm (chapter 6).

### Making one

1. **Sequences → New scene** (or **New move**).
2. **Settings**: a name in each language, and the **Song**. Pick an analysed song and the
   timeline follows its tempo and bars. Without a song, set **Tempo (BPM)**, **Beats in a bar**
   and the **Length**.
3. **Add a track**:
   - **Stage** — the stage effects above;
   - **Titles**;
   - **Sound** — music and effects;
   - **Notes** — fight notes: Parry, Dodge, Strike;
   - **Materials** — set or ramp a material parameter.
4. **Tap an empty spot on a track** to add a clip there. Tap a clip to select it and change it in
   the inspector: **Starts at beat**, **Length in beats**, its kind and settings.
5. **Snap** sets the grid (bar, beat, 1/2 … 1/16). Drag a clip's edge to change its length.
   **Split at the playhead**, **Duplicate** and **Remove** are in the inspector.

### Playing it

The transport has **Play**/**Pause**, **Back to the start**, and the position as bar and beat.
Drag the ruler to move the playhead. **Mute** a track to hear the rest without it.

Keys: `Space` plays and pauses. `J` and `L` step a beat. `K` stops. The arrow keys nudge the
selected clip. `Delete` removes it.

### Using it in the story

Add a **Sequence** block and pick the scene. Tick **Wait until it ends** to hold the story until
it finishes; readers can tap to skip a sequence the story waits for. **Edit in Sequences** jumps
to it.

## Materials: effects from nodes

A **material** is a small graph of nodes that the Studio turns into a GPU effect. You connect
boxes; no code is involved.

- **Text materials** colour and move a title's letters. Pick one in a Title block, or on a
  title clip in a sequence.
- **Post materials** draw over the whole screen. Turn one on with a **Post material** block.

### Building a graph

1. **Materials → New text material** (or **New post material**). It starts from a template.
2. **Add a node** from the groups:
   - **Inputs** — Time, Beat, Beat phase, Bar phase, Pulse, UV, Aspect ratio, Parameter, Number,
     Vector, Colour; plus Glyph index, Glyph count, Glyph shape and Ink for text materials.
   - **Math** — Add, Subtract, Multiply, Divide, One minus, Absolute, Fraction, Floor, Sine,
     Cosine, Power, Minimum, Maximum, Clamp, Mix, Step, Smooth step.
   - **Vectors** — Length, Distance, Dot product, Split, Combine.
   - **Patterns and colour** — Noise; Hue, saturation, value.
   - **Output** — exactly one, where the result goes (colour, opacity, offset).
3. **Connect**: tap an output dot, then an input dot. `Esc` or right-click lets go of a wire.
   **Unlink** removes a connection.
4. Tap a node to edit its values in the inspector.
5. **Preview** shows it live on a sample word; **Replay** restarts it. **Problems** tells you if
   the graph doesn't compile, for example with no output or a loop.

The beat inputs make an effect pulse with the music.

### Parameters

**Parameters** are named numbers (with default, min and max) that the story can change while it
plays:

- a **Material parameter** block: "Set _glow_ of _Neon_ to 0.8, then ramp to 0 over 2 s";
- a clip on a sequence's **Materials** track, which can ramp across the clip.

**Try** on a parameter shows the effect at that value.
