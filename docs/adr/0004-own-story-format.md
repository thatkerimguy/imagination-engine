# 0004 — Own story format instead of ink / Yarn / Twine

**Status:** accepted · 2026-11-09

## Context

The owner writes without coding, in English and Turkish, and wants modular, scalable stories. ink is
code-like and has no built-in line IDs for translation; Yarn Spinner has no official JavaScript
runtime; Twine story formats are HTML-centric.

## Decision

The engine defines its own story format: Chapters → Passages → Blocks, with stable IDs for every
line, both languages stored per line ID, sentence-style Action and Condition blocks, and modules
able to register new block types. It is edited through Manuscript (block editor), Flow (graph) and,
later, Script (plain text) views over the same data. See PLAN.md §3.

## Consequences

- We build and maintain the interpreter (small) and the editors (needed anyway).
- Import from ink/Twine can be added later if ever needed.
