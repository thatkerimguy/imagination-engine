import { BEAT_THIS_FILES, type BeatThisSource } from '@ie/audio';
import { createModelStore } from './model-store.ts';

export type { ModelState } from './model-store.ts';

/** The Beat This! model (about 190 MB from Hugging Face), on request (ADR 0013). */
const model = createModelStore('models/beat-this', BEAT_THIS_FILES);

export const useBeatThisModel = model.use;
export const checkBeatThisModel = model.check;
export const downloadBeatThisModel = model.download;
export const cancelBeatThisDownload = model.cancel;
export const removeBeatThisModel = model.remove;

/** The analyzer's view of the model. */
export const beatThisSource: BeatThisSource = {
  available: model.available,
  async load() {
    const [onnx, filterbank] = await model.read();
    if (!onnx || !filterbank) throw new Error('The Beat This! model is missing.');
    return { onnx, filterbank };
  },
};
