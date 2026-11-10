# 0027 — The remaining genre kits

**Status:** accepted · 2026-11-11

## Context

ADR 0018 made kits data (a theme, a layout, definitions, screens and a bilingual starter story) and
shipped four. PLAN §7 lists nine more: Text RPG, Rhythm action, Social/romance,
Survival/management, Roguelite, Explorer, Horror, Terminal and Kinetic poetry.

## Decision

**Each genre is built only from blocks and definitions that already exist.** No kit adds engine
code; a kit that needed a new mechanic would mean the mechanic belongs in the engine first.

| Kit            | Built from                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text RPG       | hero stats, items with effects, skills, a quest, a shop, a turn-based battle or a rhythm fight, a level-up rule                                       |
| Rhythm action  | two fight enemies with their own moves, scores into a variable, stage look, flash and burst                                                           |
| Social         | one number per character for affinity, a day counter advanced by a routine, gifts bought in a shop and given from choices, a rule that fires on day 3 |
| Survival       | resources with bars, days, a weighted Random block as the nightly event deck                                                                          |
| Roguelite      | a weighted encounter deck with checks, `persistent` variables for runs, deepest level and an unlock                                                   |
| Explorer       | passages as rooms, choices as Look / Take / Use / Talk and exits, items gating options, an `entered` rule counting turns                              |
| Horror         | a sanity variable, rules that change the stage look as it falls, If blocks that change what the text says                                             |
| Terminal       | the terminal theme, choices written as commands, a cipher minigame and a trace counter                                                                |
| Kinetic poetry | stage titles, pauses, transitions, backgrounds and ambience between short lines                                                                       |

**Every kit is tested like the first four:** it builds a project with no problems at all, and
random play (choices, fights, minigames, shops and battles answered at random) always reaches an
ending and reaches every ending it declares.

**Kits still don't carry sequences, sound libraries or materials** (ADR 0018 leaves them out of a
kit's content). Kinetic poetry therefore uses blocks rather than a sequence, and the Rhythm action
kit fights to a procedural beat until an author picks a song.

## Consequences

- The wizard, the Studio's Kits section and the Player's development shelf list thirteen kits.
- Adding sequences or sound to kits later is a change to `kitSchema` and `applyKit`, not to these
  files.
