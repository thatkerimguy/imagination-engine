# 0001 — Record architecture decisions

**Status:** accepted · 2026-11-09

## Context

The engine is built over many sessions, mostly by AI coding assistants. Without a written record,
settled questions get re-opened and earlier constraints get silently broken.

## Decision

Every decision that future work must respect gets a short record in `docs/adr/NNNN-title.md`:
context, decision, consequences. Records are never edited to reverse a decision; a new record
supersedes the old one and links back to it.

## Consequences

- Before changing architecture, read the ADRs. To change one, write a new ADR.
- Records stay short (one screen). Detail belongs in `PLAN.md` or code comments.
