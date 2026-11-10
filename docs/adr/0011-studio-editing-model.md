# 0011 — How the Studio edits a novel

**Status:** accepted · 2026-11-10

## Context

Phase 2 makes the Studio a writing tool: Manuscript, Flow, conditions, action blocks, characters,
variables, translation, validation and Play from here. The novel is the story format from ADR 0007:
typed blocks with stable IDs and bilingual text that uses a small inline markup. PLAN.md §2 names
TipTap (ProseMirror) for the manuscript and React Flow for the map. Building Phase 2 raised
choices the plan leaves open, and one place where this decision departs from it.

## Decision

**One novel is one document in IndexedDB.** The Studio keeps the whole `StoryProject` in the
`imagination-studio` store under `project:<id>`, wrapped as `{ v: 1, updatedAt, doc }` and
checked with the story schema on read. Changes autosave 500 ms after the last edit and on
`visibilitychange` to hidden. The last open novel is a per-device preference. Import never
overwrites a novel: the file becomes a new novel with a new ID. Export writes the same JSON the
Player loads.

**Edits are pure functions over an immutable tree.** `project/tree.ts` changes one block, option
or list and shares every untouched branch. Undo keeps whole snapshots (cheap, thanks to that
sharing), up to 300 of them. Edits with the same key within 1.2 s merge into one step, so a typed
sentence is one undo step and not one per letter. Undo and redo are kernel actions
(`project.undo`, `project.redo`) for the palette and shortcuts. Keystroke-rate edits go straight to
the store, not through the action bus.

**Validation runs on the typed document, not through the schema.** The Studio calls
`analyzeProject` on every change. A block the writer has only half filled (a dialogue line with
no speaker yet) then reports "no speaker is chosen". Running it through the schema would fail the
whole novel and report nothing useful. Problems carry a code and parameters; the Studio words
them in both languages. Play compiles the novel, and an error blocks Play with a list that jumps
to each problem.

**Each text block is its own plain-text field, not one rich-text document.** The departure from
PLAN.md: the manuscript is a list of block cards. Every line is a `contentEditable="plaintext-only"`
field whose markup tokens (`{var}`, `{@char}`, effect tags, pauses) render as atomic chips
(`contenteditable=false`, with the raw token in `data-raw`). Typed brackets are escaped, so a
writer can't write broken markup by accident. Reasons:

- Blocks are typed data with stable IDs (ADR 0007). A ProseMirror document would have to be
  mapped onto that tree on every keystroke and back again.
- The inline markup is small and closed. Chips cover it without a schema of marks.
- Plain-text fields leave input to the browser. Android keyboards (Gboard, Turkish input,
  composition and autocorrect) take the native path, with nothing intercepting `beforeinput`.
  That was the main risk PLAN.md §14 noted for a block editor.
- No editor framework in the bundle.

The trade-off: no selection across blocks, and no dragging text between them. Enter starts a new
line, Backspace on an empty line removes it, "/" turns a line into another block, and "Name: "
at the start of a line makes it that character's dialogue.

**Logic reads as sentences, translated whole.** Action blocks show sentence templates such as
`sentence.add` = "{value} to {var}" / "{var} değerine {value} ekle", with controls in the slots.
Each language orders the words its own way, and Turkish word order and suffixes never get
assembled from English pieces. Conditions are rows of dropdowns that print to and parse from
formula strings. A formula too complex for rows stays editable as text.

**Flow is a computed map, not a node editor.** Passages are laid out in columns by distance
from the start, with unreached passages in a last column, and edges drawn in SVG. It reads
the novel and edits it only through buttons (new passage, open, play from here). React Flow can
come in when Flow needs dragging and drawing links.

## Consequences

- New block types need: a factory entry, an editor component, menu and hint strings in both
  languages, and validation in `analyzeProject`.
- Anything that changes the novel goes through `useEditor()` or `useProject().edit`, so it is
  undoable and autosaved. Don't write to IndexedDB directly.
- The Studio's `.line-editor` classes must not reuse the presenter's class names (`.line`,
  `.story`, …), because Play mounts the real presenter inside the Studio.
- Rich text beyond the markup (headings, lists, inline images) would mean a new ADR. So would
  moving to ProseMirror.
- The Gboard and Turkish-keyboard check on the phone is still due (PLAN.md §14). It is the first
  thing to test when phone testing resumes.
