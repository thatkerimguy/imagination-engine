# QA Review Reports

Each Orchestrator review pass gets its own report file: `pass-<n>-report.md`. A new pass adds a
new file. Earlier reports are never rewritten, so the history of decisions stays readable.

| Pass | Report                               | Scope                                                                                     | Commit    |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| 1    | [pass-1-report.md](pass-1-report.md) | Dice settle-and-handoff, header fade, ivory lighting, context loss, reliability audit     | `54bb58b` |
| 2    | [pass-2-report.md](pass-2-report.md) | Frame-rate-independent lift, sequential beats, keyboard guard, sandbox scrim, `main` sync | `eb6f71e` |

Screenshots are attached to each handoff, not committed. To regenerate a pack, run
`node scripts/smoke.mjs --shots qa-shots-<name>` after `pnpm build`; `qa-shots*/` is git-ignored.
