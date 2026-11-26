// What the cover picker hands the store: the finished full cover and (when it rendered) its
// library thumbnail, both already final files ready to register in `media_assets`.
export interface CoverFile {
  /** Final URI (native: `file:///…/covers/<id>.jpg`; web: a JPEG data URI). */
  uri: string;
  width: number;
  height: number;
  /** Encoded size in bytes (0 when unknown). */
  bytes: number;
  mimeType: string;
}

export interface PickedCover {
  /** 1200 × 1800 max, JPEG 0.84 (or the copied original when re-encoding failed). */
  cover: CoverFile;
  /** 240 × 360 max, JPEG 0.80 `<id>.thumb.jpg`, or `null` when the thumbnail failed. */
  thumb: CoverFile | null;
}
