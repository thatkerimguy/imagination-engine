# 0007 — Story data: blocks, formulas, text markup and runtime state

**Status:** accepted · 2026-11-09

## Context

ADR 0004 chose our own story format. Phase 1 needs the concrete shape: what a block looks like, how
conditions are stored, how text carries variables and effects, and what a save contains. The Studio
(Phase 2) edits this data through forms and blocks, but the files must also stay readable and
diffable, because they are hand-written in Phase 1 and kept in git.

## Decision

**Project bundle.** One JSON document (`format: "imagination.story"`, `schemaVersion: 1`) holds
the project's variables, characters and chapters → passages → blocks. Chapter files loaded on demand
come later; the schema already groups by chapter. Everything is validated with Zod at load.

**IDs.** Every passage, block, option, branch, variable, character and line has a stable ID.
IDs are opaque strings (`[A-Za-z][A-Za-z0-9_]*`). The Studio generates them with `createId()`;
hand-written files may use readable ones (`gold`, `alley`). References are always by ID, so renaming
a label never breaks a reference.

**Bilingual text.** A text field is `{ id, en, tr }`. The line ID is the translation key. A missing
language falls back to the other one and the validator reports it.

**Formulas are the stored form of logic.** Conditions and values are strings in a small formula
language (`charisma >= 6 and not warned`, `gold - 10`, `visited("alley") > 1`), parsed and
type-checked once at load. Numbers and booleans may be written as JSON literals. The Phase 2
condition builder parses a formula into sentence blocks and writes it back, so the two are views of
one thing; references are variable IDs, so they survive renames.

**Text markup.** Inside a text string:

- `{gold}` inserts a variable, `{@mira}` a character's name.
- In Turkish, a suffix written after a placeholder is re-harmonized for the actual value:
  `{name}'e` gives Kerim'e, Ayşe'ye, Can'a. Characters may set `suffixAs` for exceptions (Kemal'e).
- ICU-style `plural` and `select`: `{coins, plural, one {# coin} other {# coins}}`,
  `{pronoun, select, she {her} he {him} other {them}}`.
- Effects are tags: `[shake]…[/shake]`, `[wave]`, `[whisper]`, `[shout]`, `[b]`, `[i]`,
  `[color=accent]`, `[speed=0.5]`, `[fade]`, `[tremble]`, `[scramble]`, and the self-closing
  `[pause=400]`. Colours name theme tokens, never hex values.
- `[[`, `]]` and `{{` write a literal `[`, `]` or `{`.

The Studio shows tags and placeholders as chips; authors never type them there.

**Variable scopes.** `game` lasts the playthrough; `chapter` resets when a new chapter starts;
`passage` resets each time any passage is entered; `temp` resets after every choice or input;
`persistent` survives across playthroughs and is stored outside save slots (endings unlocked, "the
game remembers").

**Runtime state is plain JSON.** Position is a stack of frames (`list` + `index` + the block ID at
that index), plus variables, visit and choice counts, the RNG state (seeded, so rewind and
auto-testing are deterministic) and a capped log of shown beats. Beats store block IDs and the values
they interpolated, not rendered strings, so the backlog and the current screen re-render in the
other language. On load, a frame whose block ID no longer sits at its index is re-found by ID; if
the block is gone, play restarts at the start of its passage.

**Action blocks** name a kernel action (`audio.play`) and its params. The story runtime asks its host
to run them through the action bus, so modules add story actions without touching the interpreter.

## Consequences

- Hand-written JSON stays short; formulas and markup need parsers with good error messages, and
  the validator reports problems in plain language.
- Turkish suffix rules live in `@ie/i18n` and are shared by every renderer.
- The interpreter is pure and has no DOM, so the Player, the Studio's Play view and an
  auto-playtester can all drive it.
