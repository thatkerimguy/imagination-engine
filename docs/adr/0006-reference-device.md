# 0006 — Reference device and performance budget

**Status:** accepted · 2026-11-09

## Context

The owner's phone is a Redmi Note 12 4G: Snapdragon 685, Adreno 610 (entry-level GPU), 6 GB RAM,
120 Hz 1080×2400 OLED, Android with HyperOS, connected over adb for testing.

## Decision

- This phone is the **reference device** from Phase 0 on. A feature isn't done until it meets the
  budget in PLAN.md §11.1 on it (steady 60 fps, JS < 6 ms and GPU < 10 ms per frame, < 400 MB, reader
  shell < 250 KB gzipped).
- **WebGL2 is the baseline**; WebGPU is used when available but never required.
- Both apps ship a performance HUD and a device/GPU report (`@ie/diagnostics`) so numbers can be read
  on the phone itself. `pnpm phone --diag` opens the report.
- The e2e suite includes a Redmi Note 12 viewport (393×873 CSS px, DPR 2.75, touch).

## Consequences

- Heavy features (stem separation, full-size models) are desktop-only or opt-in.
- The player autosaves often and restores state after HyperOS reloads the tab.
