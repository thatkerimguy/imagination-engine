# 0028 — Stem separation: drum hits from an opt-in model

**Status:** accepted · 2026-11-11

## Context

PLAN §5 lists demucs-web as an optional analysis step: a large model, opt-in and cached, that
separates a song so charts can follow the drums. The reference phone can't run it (ADR 0006), and
ADR 0014 already says heavy analysis is done on a desktop and travels with the novel.

## Decision

**The model.** HTDemucs (Meta, MIT) in the single-file ONNX export made by demucs-web (timcsy,
MIT), pinned to one Hugging Face revision and checked by size and SHA-256 like Beat This!
(ADR 0013). It is about 180 MB, downloaded only when the author asks, kept in OPFS, and removable.
The Studio's download, check and removal code is shared by both models (`createModelStore`).

**Our own runner, not the npm package.** `@ie/audio` runs the export with onnxruntime-web
(WebGPU, WASM fallback), as it does Beat This!. The export leaves the spectrogram outside the
graph, so `stems/spec.ts` reproduces Demucs' `_spec` and `_ispec` exactly: 4096-point STFT, hop
1024, reflect padding, two frames dropped at each end. A unit test checks that a sound goes in and
comes back out unchanged through an identity mask. Songs go through in 7.8 s segments with 25 %
overlap and linear crossfades. Outputs are told apart by rank, because the export's tensor names
aren't documented.

**What we keep: drum hits, not stems.** The worker separates only the drum stem, finds its hits
(the rise in short-time energy, with hits closer than 70 ms merged), and returns their times. They
are saved in the track's analysis as `drums` (seconds, at most 2400). Stem audio is never stored:
four stereo copies of every song would outweigh the novel many times over.

**Desktop only.** The Studio offers the download only to fine pointers, so phones and tablets get
a short explanation instead. A re-analysis (a better beat tracker) replaces the analysis and drops
its drum hits, which can be found again.

## Consequences

- Fights don't use the drum hits yet. Placing notes on beats near a drum hit belongs in the fight
  director and needs song time mapped to fight beats; that is follow-up work.
- The runner hasn't been checked against the downloaded model in this repository's tests (it would
  download 180 MB). The first separation on a desktop is the check. If the export's outputs differ,
  the runner fails with "unknown shape" and nothing is saved.
- Stem-reactive visuals (PLAN §5) and adaptive stems for music are separate features.
