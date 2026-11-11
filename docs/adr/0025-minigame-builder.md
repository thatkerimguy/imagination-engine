# 0025 — The minigame builder: parts and rules

**Status:** accepted · 2026-11-11

## Context

ADR 0021 shipped eight minigame templates. PLAN §6.5 adds, for later, a no-code builder: compose a
minigame from parts and drive it with rules. It has to stay a Minigame block (same result
contract, same runner, same saves), pure and seeded, cheap on the reference phone, and editable
with forms only.

## Decision

**A ninth template, `built`, whose parameters are the parts and the rules.** It lives in the block
like every template's parameters (ADR 0021), so duplicating a block copies the game.

**Parts:** one to four **meters** (a whole number from 0 to its maximum, shown as a bar), up to six
**buttons**, optional **dice** (1–4 dice of 4–20 sides, with a Roll button) and an optional
**clock** with what running out means (fail by default). A **score meter** can be chosen: the score
is its share of its maximum; otherwise success scores 100 and failure 0.

**Rules** run top to bottom. Each is a sentence:
*when* an event (the game starts, the reader taps a button, the dice are rolled, a meter changes,
a second passes, time runs out), *and* up to three conditions (a meter, the last roll or the
seconds gone, compared with a number), *then* one to four actions (add to, take from or set a
meter, add the roll to a meter, succeed, fail). After any rule changes a meter, the "a meter
changes" rules run, at most eight times in a row, so two rules feeding each other can't hang the
game. Meters are clamped to their range. Rules that point at a removed part do nothing, and the
Studio removes such rules when a part is removed.

**The result** is the usual `{ won, score, values }`; the values are every meter by its id, so a
block can store any meter in a number variable. `minigameValues(game)` replaces direct lookups of
`MINIGAME_VALUES`, which stays the table for the fixed templates.

**State is plain data.** The dice keep their random generator as a number in the state, so the
same seed rolls the same and states compare equal in tests.

**The screen** is DOM like the other templates: bars scaled with `transform`, dice faces as text,
the author's buttons in a two-column grid; it repaints only when a counter of meter changes moves.

**Grid, deck, lanes, tokens and word input**, also listed in PLAN §6.5, are not parts yet. Each
would be a new part kind in the schema, the game and the editor; the rule sentence stays the same.

## Consequences

- Rule ids, meter ids and button ids are unique inside one game only.
- A built game can't be proven winnable; the auto-playtester treats it like any minigame (won six
  times in ten). The try-out under the block is how an author checks it.
