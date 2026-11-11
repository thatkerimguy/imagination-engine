# 0023 — Script view: a plain-text form of a passage

**Status:** accepted · 2026-11-11

## Context

PLAN §3.3 promises a third view of the story, after Manuscript and Flow: plain text that converts
to and from blocks, for typing fast on a keyboard and for pasting from any writing app. Blocks are
typed data with stable ids (ADR 0007, 0011), and both languages hang off those ids, so a text
round trip must not break translations or drop what text can't show.

## Decision

**One passage, one language, one line per block.** Write gets a third mode, Script, beside
Manuscript and Translate. It shows the open passage in the language picked for writing:

| Line | Block |
|---|---|
| `=== Name` | starts another passage, found by name or made (so a chapter can be pasted) |
| `Mira: words` | dialogue, only when Mira is a character (any language's name, or the id) |
| `* option -> Passage` | a choice option; options in a row are one choice |
| `-> Passage` | a jump; a passage that doesn't exist is made |
| `// text` | a note |
| `@end`, `@pause 2` | End and Pause blocks |
| `@<type> #<id> …` | a block the script can't show, kept whole (with everything inside it) |
| `\…` | narration, whatever follows |
| anything else | narration |

Only simple choices (options with text and at most a jump; no conditions, costs, prompt or timer)
are written as `*` lines. Every other block becomes a kept line. A line not yet written in this
language is kept too, with the other language shown after it as a reminder.

**Nothing changes until Apply** (or Ctrl+Enter), and Apply is one undo step.

**Ids survive edits.** Text lines are matched to the old blocks by longest common subsequence on
their text. Between unchanged lines, the same count of lines pairs up in order; otherwise each new
line takes the most similar old one (letter-pair Dice, at least 0.4). A matched line keeps its
block id and line id, so the other language stays attached. Choices, jumps, notes and pauses
reuse old ids in order. Unchanged blocks keep object identity, so undo snapshots share them.

**Kept lines move, never copy.** A kept id is looked up only in the passages the script writes,
and only its first appearance counts. The rest are reported and left out.

**Script never deletes passages.** Leaving a `=== Name` section out leaves that passage alone;
passages are deleted in Manuscript or Flow.

The syntax and the conversion live in `@ie/story` (`script.ts`, `script-apply.ts`), pure and
tested; the Studio only shows the text box.

## Consequences

- A new block type shows up in Script as a kept line with no extra work. Giving it a text form
  means a new line kind in both `passageToScript` and `parseScript`, and a test that it round-trips.
- Script lines are the story's own markup (`{gold}`, `[shake]`), unchanged; the script adds no
  second markup.
- ink or Twine import, when it comes, can target this syntax or the same `ScriptItem`s.
