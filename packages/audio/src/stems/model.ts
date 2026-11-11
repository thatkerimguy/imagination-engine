import type { ModelFile } from '../beat-this/model.ts';

/**
 * HTDemucs (Meta, MIT) as exported to a single ONNX file by demucs-web (timcsy, MIT), pinned to
 * one revision and checked by SHA-256 like Beat This! (ADR 0013, ADR 0028).
 */
const REVISION = '92e33df61cfc9eb820272aaa62d2ef6dcf4d950d';

export const DEMUCS_FILES: readonly ModelFile[] = [
  {
    name: 'htdemucs_embedded.onnx',
    url: `https://huggingface.co/timcsy/demucs-web-onnx/resolve/${REVISION}/htdemucs_embedded.onnx`,
    size: 180_534_758,
    sha256: 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077',
  },
];

export const DEMUCS_SIZE = DEMUCS_FILES.reduce((sum, f) => sum + f.size, 0);

/** The export's contract: stereo 44.1 kHz segments, a spectrogram made outside the network. */
export const DEMUCS = {
  sampleRate: 44100,
  segment: 343_980,
  nFft: 4096,
  hop: 1024,
  bins: 2048,
  frames: 336,
  overlap: 0.25,
} as const;

export const STEMS = ['drums', 'bass', 'other', 'vocals'] as const;
export type Stem = (typeof STEMS)[number];
