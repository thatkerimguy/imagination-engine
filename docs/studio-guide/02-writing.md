# 2. Writing

**Write** is where the story lives. It looks like a document, but every paragraph, line of
dialogue and choice is a **block**.

## Passages

The **Passages** list (left on a computer, a menu on the phone) shows every passage. The one
marked **Start** is where the story begins.

- **New passage** adds one. Passages are also made for you whenever you pick **New passage…** in
  a choice or a jump.
- **Passage settings** (the gear next to the passage name):
  - **Passage name**.
  - **Layout**: same as the novel, **Page**, **Text box** (visual-novel style) or **Chat**
    (message bubbles).
  - **Continue on the same page**: don't clear the screen when this passage starts.
  - **Start the story here**.
  - **Play from here**: opens Play at this passage.
  - **Delete passage**. The start passage can't be deleted; make another one the start first.
- Under the name you'll see the **word count** and roughly how long the passage takes to read.

## Blocks

### Adding blocks

- In an empty narration line, type `/` to open the **block picker**. Type a few letters
  ("dia", "sha", "mus") and press Enter. Arrow keys move through the list; Escape closes it.
- Or click the **+** button between blocks.
- Pressing **Enter** at the end of a narration or dialogue line starts a new line below.

### Moving and changing blocks

Each block has a **⋯ menu**: **Move up** / **Move down** (`Alt+↑` / `Alt+↓`), **Duplicate**,
**Delete**, and **Turn into…**, which changes narration into dialogue and so on, keeping the text.

### The blocks, by group

**Writing**

| Block          | What it does                                                                     |
| -------------- | -------------------------------------------------------------------------------- |
| Narration      | A paragraph of the story                                                         |
| Dialogue       | A character speaks. Pick the speaker; their name colour and voice come from Data |
| Ask the reader | The reader types a name or answer; it's saved in a text variable                 |
| Pause          | Wait for a tap, or for a number of seconds                                       |
| Note           | A note only you can see. Readers never see it                                    |

**Choices and logic**

| Block             | What it does                                                                           |
| ----------------- | -------------------------------------------------------------------------------------- |
| Choice            | The reader picks an option (see below)                                                 |
| If                | Only when something is true. Add **Else, if** and **Otherwise** branches               |
| Dice check        | Roll dice (like `2d6` plus 1) against a target, with **On success** and **On failure** |
| Random            | One of several paths by chance. Each path has a weight; the percentages show           |
| Change a variable | Set, add, subtract, flip (yes↔no), add to a list, remove from a list                   |

**Flow**

| Block         | What it does                                                                              |
| ------------- | ----------------------------------------------------------------------------------------- |
| Go to passage | Continue in another passage                                                               |
| Visit passage | Play a passage, then come back here (good for a shared scene or a menu)                   |
| Return        | Go back to where the visit started                                                        |
| End           | The story ends here. Tick **This is a named ending** and name it to count it as an ending |
| Run routine   | Run a routine from the Logic workspace (chapter 3)                                        |

**Game** — Fight, Battle, Shop, Item, Quest, Minigame (chapter 6).

**Sound** — Music, Sound effect, Ambience (chapter 4).

**Stage and pictures** — Background, Look, Screen effect, Particles, Title, Transition,
Picture, Video, Sequence, Post material, Material parameter (chapter 5).

## Text tools

Select text in a narration or dialogue line, or put the cursor where you want something, and use
the small **text tools** bar:

- **Variable** — insert a variable's value, like the reader's name or their gold.
- **Name** — insert a character's name. Turkish suffixes follow the name correctly (Kemal'e,
  Ayşe'ye). For irregular names, set **Turkish suffix sounds like** on the character in Data.
- **Effect** — wrap the selected words: **Shake**, **Tremble**, **Wave**, **Whisper**, **Shout**,
  **Fade in**, **Scramble**, **Bold**, **Italic**, **Accent colour**.
- **Pause** — a short pause in the typewriter at that point.

Effects show as small marks in the editor. The exact syntax is in the
[reference](09-reference.md#text-markup) if you're curious, but you never have to type it.

## Choices

A **Choice** block holds options. Each option has its text and where it goes, either a passage or
blocks placed right under it.

- **Add a question**: a line shown above the options.
- **Timed**: the reader has a number of seconds; **When time runs out** picks the first option
  or a specific one. Readers can turn timers off in their settings.
- **Conditions and cost** (the settings on each option):
  - **Show only if** — hide the option unless a condition holds.
  - **Can be picked only if** — show it, but locked, with **Reason shown while locked** (leave it
    empty and the Player explains it on its own).
  - **Costs something** — an amount paid from a number variable (for example, 10 gold).
  - **Can be picked only once**.
  - **Show the odds of its dice check** — if the option starts with a Dice check, the reader sees
    the chance of success.
- Small tags on the option (_sometimes hidden_, _costs_, _once_…) remind you what is set.

## Conditions

Conditions appear in If blocks, option settings, rules and screens. They work the same
everywhere:

- Each row is **what to check**, **a comparison** and **a value**: `gold` `is at least` `10`.
  What you can check:
  - any variable;
  - **Passage visited**;
  - **Option picked before**;
  - **Carried item**;
  - a **Quest** status (not started, under way, complete, failed).
- **Combine**: **All of these** (and) or **Any of these** (or).
- **Formula** switches to typed form, like `trust >= 2 and not warned`. Use it for maths. If a
  formula is too complex for dropdowns, it stays a formula. See the
  [formula reference](09-reference.md#formulas).

## Views of the manuscript

The **View** switch at the top of Write:

- **Manuscript** — the block editor described above.
- **Translate** — two columns, English and Turkish, line by line. **Show: Missing** lists only
  the lines still missing one language. When every line exists in both, it says so.
- **Script** — the passage as plain text you can type or paste quickly:

  ```text
  The rain had not stopped for three days.
  Mira: We should go before the lamps go out.
  * Follow her -> Alley
  * Stay in the doorway -> Doorway
  === Alley
  You follow her into the dark.
  @end
  ```

  - A plain line is narration.
  - `Name: words` is dialogue, when Name is a character.
  - `* option -> Passage` lines in a row make one choice.
  - `-> Passage` jumps there; a passage that doesn't exist yet is made.
  - `=== Name` starts another passage, so you can paste a whole chapter at once.
  - `// note`, `@end` and `@pause 2` are a note, an end and a pause.
  - Blocks the script can't show (a fight, a sound) appear as lines like `@fight #b_x`. Leave
    them, or move them to another place.
  - Start a line with `\` to keep it plain narration.

  Press **Apply** (`Ctrl+Enter`) to turn the text into blocks. **Undo changes** throws away the
  edit.

**Writing language** picks which language you're writing in when the novel has both.

## Problems

The **Problems** list (under the passages) shows everything that would break or confuse a reader:

- a variable or character that no longer exists;
- a passage nothing leads to;
- a passage that runs out without going anywhere;
- a missing translation;
- a broken formula;
- a dice roll that isn't one;
- a fight without an enemy;
- and more.

Click a problem to jump to it. **Play** refuses to start while there are errors, and lists them
with **Fix these to play**.
