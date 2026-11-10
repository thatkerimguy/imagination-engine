# 0017 — Logic and the RPG kit

**Status:** accepted · 2026-11-10

## Context

Phase 6 is done when an RPG chapter is built entirely in the Studio. PLAN.md §3.4 asks for Rules
(When → If → Do), Routines with inputs and formulas; §7 and §8.2 ask for stats, inventory, checks,
quests, shops, turn-based combat and a Data editor. Checks and formulas exist since Phase 1. The
interpreter (ADR 0007) must stay pure and deterministic, so saves, rewind and the auto-playtester
keep working, and the author still writes no code.

## Decision

**Everything is story data and blocks, run by the story interpreter.** The new data is optional
and additive, so `schemaVersion` stays 1 and older projects load unchanged.

- **Rules** (`rules`) are `when` (an event), an optional `if` formula, `once`, and a `do` block
  list. Events: a variable changed, a passage was entered (any or one), an item was gained or lost,
  a quest changed. Events raised while a block runs are queued in the state; before the next block,
  each matching rule whose condition holds is pushed as a frame on the stack, so its blocks run
  next, in rule order, and can show lines, ask choices or jump like any other blocks. A rule never
  fires while its own frame is on the stack, which stops loops. Host events (beats, timers, screen
  buttons) wait for later phases.
- **Routines** (`routines`) are named block lists with typed inputs. A Run routine block gives each
  input a formula. The routine runs behind a call boundary, so Return works, and its inputs live in
  the frame (`locals`): formulas and text read them like variables, Set writes them, and they
  vanish when the routine ends.
- **Items and inventory.** `items` have a name and description in both languages, a kind (item,
  consumable, key), a price and effects (`{ var, amount }`) applied when used. Counts live in the
  state. An Item block gives, takes or uses an item; `owned("id")` reads a count in formulas.
- **Quests** have a name and steps in both languages. A Quest block starts one, moves it to a step,
  completes or fails it, and leaves a line on the page. `quest("id")` reads `none`, `active`,
  `done` or `failed`.
- **Shops** are a block: a currency variable and a stock of items, optionally with prices of their
  own. The story waits on the shop like on a choice; each purchase or sale is one reader action
  (one rewind step) and leaves a line. Selling pays half the price.
- **Turn-based battles** are a block naming an enemy (the same enemies as rhythm fights, now with
  an optional defense), with win, lose and optional fled lists. The project's `hero` settings name
  the number variables that hold HP, max HP, attack, defense and MP. Each reader action (attack, a
  skill, a consumable, run) is answered by the enemy, using the story's seeded random numbers, and
  leaves lines. Skills (`skills`) have an MP cost, a power, and heal or harm; `requires` can hide
  one until the reader has earned it. Rewards are ordinary blocks in the win list.
- **Stats** are number variables marked `stat`. The Player shows a character sheet (stats,
  inventory, journal) when a novel has any of these.
- **The interpreter is split.** `runtime.ts` keeps the stack, the waits and the variables; the RPG
  blocks, battles and rules run in their own modules through a small core interface, so no file
  passes ~400 lines.

The Studio's **Logic** workspace edits rules and routines with sentence blocks and the block list
used everywhere else. **Data** gains Items, Skills, Quests and Hero tabs, and a Stat switch on
number variables.

## Consequences

- Rules make some behaviour depend on event order. The order is fixed (rule order in the project),
  and the analyzer warns when a rule's event names something missing.
- Equipment, loot tables, levels as a built-in and party combat are not in this phase; levels are
  a rule ("When XP changes, if XP ≥ next, add a level") until a kit packages them (Phase 7).
- A battle in progress is saved with the story (enemy HP and round), unlike a rhythm fight.
