# 3. Flow, Logic and Data

## Flow: the map

**Flow** draws every passage as a box, with an arrow for every choice, jump, visit and branch.
Each box shows the start of its text.

- **Double-click** (double-tap) a box to open it in Write.
- **Right-click** (long-press) a box to play from there.
- **Zoom** with the buttons, `Ctrl` + mouse wheel, or a pinch. **Move around** by dragging the
  background, or with the middle mouse button.

Use Flow to spot loose ends: a box with no arrows into it is unreachable, and one with no arrows
out of it needs an End.

## Logic: rules and routines

**Logic** holds story logic that isn't tied to one place in the text. Both are built from the
same blocks as Write.

### Rules: "when this happens, do that"

A rule runs its blocks automatically whenever something happens anywhere in the story.

- **When**: a variable changes, a passage is entered, an item is gained or lost, or a quest
  changes. **Which** narrows it (which variable, which passage, or **Any passage**).
- **Only if**: optional conditions.
- **Only the first time**: run once per playthrough.
- **Do**: the blocks to run.

Example: _When_ `sanity` changes, _only if_ `sanity is at most 3`, _do_ Look → dread. Now
every scene that lowers sanity also darkens the screen, without you repeating it.

### Routines: reusable blocks

A routine is a named set of blocks you can run from anywhere with a **Run routine** block.

- **Inputs** let each run pass different values. Inside the routine, inputs work like
  variables (for example, a `damage` input).
- Use them for anything you repeat: "take damage", "rest at camp", "level up".

## Data

**Data** holds the story's cast and its memory. Everything here can also be made on the spot
from a block (**New character…**, **New variable…**, **New item…**). Each entry shows **Used in N
places**; deleting one that's still used asks first, and the Problems panel will list what broke.

### Characters

- **Name** in each language.
- **Name colour**: plain, accent, quiet text, faint or text colour.
- **Turkish suffix sounds like**: for names with irregular suffixes. Kemal → "Kemel" gives
  Kemal'e.
- **Voice**: little blips as their lines type out — silent, or a square, soft, round or buzzy
  wave, with a pitch and blips every N letters. **Try** plays it.

### Variables

- **Type**: Number, Text, Yes/No, List, or **One of** (a fixed set of values like
  `day, dusk, night`).
- **Starts as**: the value at the beginning.
- **Lowest** / **Highest** for numbers. Changes are kept inside that range.
- **Remembered for**:
  - **The playthrough** — until the reader starts over (the usual choice).
  - **The chapter** — starts again at each new chapter.
  - **The passage** — starts again each time a passage begins.
  - **Until the next choice** — forgotten after the next choice or answer.
  - **Every playthrough** — kept across playthroughs, like endings found or unlocks.
- **On the character sheet**: show it in the reader's Character panel.
- **What it is for**: a note for yourself.

### Items

- **Name**, **Description**, **Kind** (item, consumable, key item), **Price** (for shops).
- **When used**: effects such as "Add 20 to hp". Consumables are used up.
- Readers see carried items in their Character panel.

### Skills

Offered in turn-based battles: **MP cost**, **Does** (damage or heal), **Power** (damage: times
the hero's attack; heal: a share of max HP, so 0.5 heals half), and **Only when** (a condition).

### Quests

A name and its **Steps**. Quest blocks start, advance, complete or fail them; conditions can
check them; readers see them in the journal.

### Hero

Which number variables hold the hero's **HP**, **Max HP**, **Attack**, **Defense** and **MP**
for battles. **Create hero stats** makes all of them at once.

### Enemies

Used by rhythm fights and battles (chapter 6): name, **Strength**, **Damage per hit**,
**Defense in battles**, **Colour**, **Words around it** (one per line, drifting on the fight
screen) and **Moves**.
