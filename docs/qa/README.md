# QA Review Reports

Each Orchestrator review pass gets its own report file: `pass-<n>-report.md`. A new pass adds a
new file. Earlier reports are never rewritten, so the history of decisions stays readable.

| Pass  | Report                                                                         | Scope                                                                                       | Commit    |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| 1     | [pass-1-report.md](pass-1-report.md)                                           | Dice settle-and-handoff, header fade, ivory lighting, context loss, reliability audit       | `54bb58b` |
| 2     | [pass-2-report.md](pass-2-report.md)                                           | Frame-rate-independent lift, sequential beats, keyboard guard, sandbox scrim, `main` sync   | `eb6f71e` |
| P2·1  | [phase-2-pass-1-report.md](phase-2-pass-1-report.md)                           | Directive 02: Expo writer, offline store, schema sheets, editor, live preview bridge        | `40addbf` |
| P2·2  | [phase-2-pass-2-report.md](phase-2-pass-2-report.md)                           | Pass 1 bug fixes (sheet label, editor Back, stepper, preview pacing) + Material Design 3 UI | `a8ce46e` |
| P2B·1 | [phase-2b-1-report.md](phase-2b-1-report.md)                                   | Directive 02B-1: rich editor, 27 analyzers, growth charts, 12 themes, fonts                 | `a8f6bf3` |
| P2C   | [phase-2c-folio-ui-report.md](phase-2c-folio-ui-report.md)                     | Directive 02C: Folio editorial design system, all writer screens, 02B-1 visual fixes        | `04572a7` |
| P2B·2 | [phase-2b-2-report.md](phase-2b-2-report.md)                                   | Directive 02B-2: Notes folders, search, version history, book exports, Master Lock, Doctor  | `1e383ab` |
| P2D   | [phase-2d-hardware-polish-report.md](phase-2d-hardware-polish-report.md)       | Directive 02D: dice glare, offline preview, toolbar halves, read cache, local APK           | `7c5b9bf` |
| P2E   | [phase-2e-120hz-material-you-report.md](phase-2e-120hz-material-you-report.md) | Directive 02E: 120Hz scroll, native shake, Material You theme, Folio cards, `-Abi` APK      | `02c7014` |

Screenshots are attached to each handoff, not committed. To regenerate a pack, run
`node scripts/writer-shots.mjs --shots qa-shots-<name>` (writer, after `pnpm writer:export`) or
`node scripts/smoke.mjs --shots qa-shots-<name>` after `pnpm build`; `qa-shots*/` is git-ignored.
