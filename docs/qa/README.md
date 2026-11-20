# QA Review Reports

Each Orchestrator review pass gets its own report file: `pass-<n>-report.md`. A new pass adds a
new file. Earlier reports are never rewritten, so the history of decisions stays readable.

| Pass  | Report                                               | Scope                                                                                       | Commit    |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------- |
| 1     | [pass-1-report.md](pass-1-report.md)                 | Dice settle-and-handoff, header fade, ivory lighting, context loss, reliability audit       | `54bb58b` |
| 2     | [pass-2-report.md](pass-2-report.md)                 | Frame-rate-independent lift, sequential beats, keyboard guard, sandbox scrim, `main` sync   | `eb6f71e` |
| P2·1  | [phase-2-pass-1-report.md](phase-2-pass-1-report.md) | Directive 02: Expo writer, offline store, schema sheets, editor, live preview bridge        | `40addbf` |
| P2·2  | [phase-2-pass-2-report.md](phase-2-pass-2-report.md) | Pass 1 bug fixes (sheet label, editor Back, stepper, preview pacing) + Material Design 3 UI | `a8ce46e` |
| P2B·1 | [phase-2b-1-report.md](phase-2b-1-report.md)         | Directive 02B-1: rich editor, 27 analyzers, growth charts, 12 themes, fonts                 | `a8f6bf3` |

Screenshots are attached to each handoff, not committed. To regenerate a pack, run
`node scripts/writer-shots.mjs --shots qa-shots-<name>` (writer, after `pnpm writer:export`) or
`node scripts/smoke.mjs --shots qa-shots-<name>` after `pnpm build`; `qa-shots*/` is git-ignored.
