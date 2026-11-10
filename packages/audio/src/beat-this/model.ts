/**
 * Beat This! (CPJKU, MIT) as exported to ONNX for onnxruntime-web by musetric, pinned to one
 * revision and checked by SHA-256, since the files come from a third party (ADR 0013).
 */
export const BEAT_THIS_TRACKER = 'beat-this-1';

const REVISION = '25308706dda545c0d5950065bb0604ad71bcf1f5';
const BASE = `https://huggingface.co/musetric/beat-this-onnx/resolve/${REVISION}/`;

export interface ModelFile {
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
}

export const BEAT_THIS_FILES: readonly ModelFile[] = [
  {
    name: 'beat_this.onnx',
    url: `${BASE}beat_this.onnx`,
    size: 190_649_026,
    sha256: '1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55',
  },
  {
    name: 'mel-filterbank.bin',
    url: `${BASE}mel-filterbank.bin`,
    size: 262_656,
    sha256: '1ee975d96f44ccf2c3bfe37825c1c1f0b089f5703c7a12a84b1f0a3bce004533',
  },
];

export const BEAT_THIS_SIZE = BEAT_THIS_FILES.reduce((sum, f) => sum + f.size, 0);

/** The feature contract of the export (its config.json). */
export const BEAT_THIS = {
  sampleRate: 22050,
  nFft: 1024,
  hop: 441,
  mels: 128,
  fps: 50,
  chunk: 1500,
  border: 6,
} as const;

/** The model's files as loaded by the host. */
export interface BeatThisModel {
  readonly onnx: ArrayBuffer;
  /** A row-major float32 [513, 128] mel filterbank (torchaudio's own, written verbatim). */
  readonly filterbank: ArrayBuffer;
}
