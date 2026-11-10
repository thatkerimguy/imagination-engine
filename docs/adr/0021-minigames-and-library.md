# 0021 — Minigames, the Library and packs

**Status:** accepted · 2026-11-10

## Context

Phase 10 is done when minigames launched from the story feed their results back (PLAN §13), with
eight templates (§6.5) and a Library that shares work between projects (§8.2). The Fight block
(ADR 0016) already shows how a full-screen interaction joins the story: the runtime waits on a
beat, a framework-free runner mounts the screen, and the result resolves the beat. The author
still writes no code, and everything has to fit the Redmi Note 12 budget (ADR 0006, PLAN §11.1).

## Decision

### The Minigame block

**A minigame is a story block that works like a Fight block.** `minigame` holds:

- `game`: the template and its parameters, one object discriminated by `template`. Every
  parameter is optional and has a default (`MINIGAME_DEFAULTS`), except the words of a cipher and
  the phrases of a typing duel, which are labels in both languages.
- `title`: an optional label shown above the game.
- `score`: an optional number variable for the score.
- `store`: an optional map from a template's **result values** to number variables.
- `win` and `lose` block lists.

The runtime waits on a `minigame` beat until the host calls `resolveMinigame(result)`. It writes
the score and the stored values, records a `played` beat, and runs `win` or `lose`. Saves and
rewind see a minigame as one step; a game in progress is not saved. The parameters live in the
block rather than in project data: a minigame has no identity outside the place it is played, and
duplicating a block already copies it.

**The result contract** is `{ won, score, values }`: whether the reader succeeded, a score from 0
to 100, and the template's named numbers (`MINIGAME_VALUES`), such as a dice game's `total`.
PLAN §6.5 sketched `{ outcome, score, data }`; `won` matches the Fight result, and values are
numbers only so they can go straight into number variables and formulas.

### The framework

**`packages/minigame` holds the games, framework-free.** Each template is defined with
`defineMinigame({ id, setup, update, onInput, result, timeLeft })`:

- `setup(params, ctx)` builds the state from the parameters, a seeded random source, the reader's
  language and an ease factor. `update(state, dt)` moves time on. `onInput(state, input)` takes an
  abstract input. `result(state)` returns the result once the game is over.
- The logic is pure, seeded and DOM-free, with tests. The seed comes from the block and the story
  step, as in fights, so a rewound game deals the same lock, word order and dice.
- **Inputs are abstract**: `press`, `release`, `dir`, `pick`, `text`, `back`. Each template's view
  turns touches on its own buttons into them, and one keyboard reader does the same for keys, read
  by `KeyboardEvent.code` so Turkish Q and F layouts both work: Space or Enter presses, the arrows
  or WASD give directions, the digits pick, Backspace undoes. Letters go through the Turkish-aware
  casing helpers in `@ie/i18n`.
- **Drawing is DOM**: glyphs, bars and buttons styled with design tokens, moved with `transform`
  only. One `requestAnimationFrame` loop runs while a game is open; each frame is one `update`
  and a handful of style writes that are skipped when nothing changed. The GPU stage isn't used,
  so a minigame costs nothing in draw calls and works without WebGL2.
- `MinigameView` is the screen (title, help line, the game, a timer bar, and the result with a
  Continue button). `MinigameRunner` mounts it for a waiting beat and takes it down after a
  rewind, load or restart, as `FightRunner` does. The Player and the Studio's Play view share it.
- The package has its own EN/TR catalog. The reader's fight-assist setting, when it is anything
  but Off, also eases minigames: time limits and target zones grow by half.

### The eight templates

| Template       | What the reader does                                         | Result values         |
| -------------- | ------------------------------------------------------------ | --------------------- |
| **Lockpick**   | Stops a sweeping pick inside each pin's zone                 | `pins`, `tries`       |
| **Memory**     | Repeats a growing sequence of pads                           | `rounds`              |
| **Cipher**     | Puts scrambled letters back in order (Turkish-aware)         | `solved`, `seconds`   |
| **Typing**     | Types phrases before the clock runs out (on-screen keyboard) | `mistakes`, `seconds` |
| **Quick time** | Answers direction prompts in time                            | `hits`                |
| **Dice**       | Rolls to reach a target, keeping dice between rerolls        | `total`               |
| **Slider**     | Slides numbered tiles back into order                        | `moves`, `seconds`    |
| **Tension**    | Holds and releases to keep a marker inside a drifting zone   | `seconds`             |

The other templates in PLAN §6.5 (signal hack, card duel, stealth timing, rhythm mini,
investigation board, argument duel) and the no-code minigame builder stay for later. They fit the
same contract.

### The Library and packs

**The Library is Studio data, not project data.** It is a list of items kept in the Studio's
IndexedDB store through `@ie/core` storage, one record per item under `library:`, validated on
every read. An item is `{ id, kind, name, addedAt, data }`, where `kind` is one of:

- `effect`: a stage or sound Action block (`{ action, params }`), such as a tuned burst or shake
- `sequence`, `material`, `enemy`, `screen`: that project definition
- `theme`: a story theme

Each kind's `data` is validated by the schema the project uses for it. Adding an item to a
project copies it in with a fresh ID (an effect becomes an Action block at the end of the passage
open in Write; a theme replaces the project's theme). Copies are independent: editing one never
changes the Library or another project. References an item carries, such as a sequence's song or
an enemy move's sequence, are kept as they are; the Studio's Problems list reports any that the
target project doesn't have.

**A pack is a JSON file** `{ format: 'imagination.pack', version: 1, name, items }`. Export
writes the chosen items; import validates the whole file with the pack schema and adds every item
under a fresh ID. A file that fails validation is refused with the schema's message and changes
nothing.

## Consequences

- Minigames are reproducible from their seed, so tests and the auto-playtester (Phase 11) can
  play them through `onInput`.
- A new template is a logic file, a view file, a parameter schema and catalog entries; nothing
  in the runtime, the runner or the block changes.
- Library items don't pull their dependencies along. A pack that should work on its own has to
  include them; resolving references across a pack is left for when packs are shared for real.
- Minigames have no sound of their own yet; they sit on top of the scene's music. Sounds and stage
  effects for them can use the action bus later, as fight choreography does.
