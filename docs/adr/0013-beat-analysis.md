# 0013 — Beat analysis: Beat This! with an own DSP tracker as the fallback

**Status:** accepted · 2026-11-10 · amended the same day: Beat This! added (see the end)

## Context

PLAN.md §2 names **Beat This!** (an ONNX model through onnxruntime-web) for beats and downbeats,
and **Meyda** for features such as onsets, energy and chroma. Phase 3 must be done when "any file
or catalogue song gets beats and downbeats automatically". Running Beat This! means fetching and
caching a model of several megabytes from a third party, which needs the owner's go-ahead, and
adding onnxruntime-web to the Studio. Meyda would be a dependency for a few hundred lines of
spectral code.

## Decision

**Ship our own tracker (`dsp-1`, now `dsp-2`) and keep the tracker pluggable.** Every analysis
records which tracker made it (`TrackAnalysis.tracker`). Cached results are keyed by tracker
version and a SHA-256 of the audio, so a better tracker re-analyses everything on its own.
Beat This! can be added later as another tracker behind the same worker interface, once the model
download is approved.

The pipeline runs in a worker on mono audio at 22.05 kHz. The page decodes the audio, since only
the main thread has `decodeAudioData`.

1. **Onsets:** log-mel spectral flux at about 100 frames a second, plus a separate flux below
   about 180 Hz for bass hits.
2. **Tempo:** autocorrelation of the onset curve, weighted by a log-normal prior around 120 BPM so
   halves and doubles lose.
3. **Beats:** Ellis-style dynamic programming, then a refinement towards nearby onset peaks. A
   line fit decides between a constant and a changing tempo: constant only if every beat is
   within 25 ms of the line.
4. **Meter and downbeats:** each beat's accent is its bass hit, read as the peak within 70 ms of
   the beat, plus how much the chord changes there. The bass hit is z-scored. The chord change
   stays raw (0 to 1), so a song without chord changes doesn't promote noise. 4/4 and 3/4 are
   tried at every phase, and 3/4 must win clearly.
5. **Key:** chroma from an 8192-point FFT every 40 ms. That is fine enough to separate bass notes,
   which the onset FFT cannot. Each bin is whitened against its surroundings, so drums and hiss
   average to zero. The totals are correlated with the Krumhansl–Kessler profiles. A key is named
   only when the correlation is at least 0.5 and the music stands clearly above noise. Otherwise
   there is no key, which is better than a wrong one.
6. **Sections:** novelty between the 8 bars before and after each downbeat, from pitch profile and
   loudness.

Tests cover synthetic click tracks at 92, 120 and 150 BPM, 4/4 and 3/4, a groove that starts on
the one, chord progressions with harmonics in noise, and noise and drums with no key.

## Consequences

- No model download and no extra runtime dependency. Analysis of a song takes seconds on a desktop
  and runs in a worker everywhere.
- Accuracy on real, complex music (rubato, syncopation, odd meters) is below Beat This!. The
  Studio's beat check (a click on each beat, with a lit downbeat) shows the author when a grid is
  off. Tap calibration remains available.
- Beat This! (and a phone-friendly small model) is still the target in PLAN.md. Adding it is a new
  tracker ID, not a format change.

## Amendment: Beat This! (2026-11-10)

The owner approved downloading the model. Beat This! is now the first choice, and the DSP tracker
is the fallback.

- **Model:** the ONNX export at huggingface.co/musetric/beat-this-onnx (checkpoint `final0`,
  20 M parameters, MIT). It is pinned to one revision and checked by SHA-256. It is about 190 MB,
  downloaded only when the author asks (Sound → Setup), and kept in OPFS. No smaller model is
  published in a browser-ready form, so phones don't run it (ADR 0014).
- **Runtime:** onnxruntime-web, loaded on demand inside the analysis worker. It tries WebGPU first
  and falls back to WASM. The Player never loads it.
- **Front end and windows** follow the export's contract exactly: mean downmix at 22.05 kHz,
  n_fft 1024, hop 441, periodic Hann, reflect-padded centred frames, magnitude / √1024, the shipped
  mel filterbank, `log1p(1000 · x)`. Windows are 1500 frames with a 6-frame border, laid out and
  joined like the reference (`keep_first`).
- **Postprocessing:** a TypeScript port of madmom's `DBNDownBeatTrackingProcessor` with
  Beat This!'s settings: 3 or 4 beats a bar, 55–215 BPM, transition λ 100, observation λ 16. It
  keeps one tempo where the network is unsure. Only beat-boundary states keep back-pointers, so
  a 30-minute mix needs about 15 MB.
- **What it supplies:** beats, downbeats and the meter. The tempo map, key and sections still come
  from the DSP features over those beats.
- **Tracker ID `beat-this-1`.** A cached or saved Beat This! result is preferred over a DSP one
  wherever it exists. If the network fails (no GPU memory, an unsupported device), the DSP tracker
  answers and the Studio says so on the track.
