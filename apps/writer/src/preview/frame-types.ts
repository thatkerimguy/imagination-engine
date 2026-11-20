import type { PreviewLoadMessage, ReaderMessage } from './protocol.ts';

export interface PreviewFrameHandle {
  send(message: PreviewLoadMessage): void;
}

export interface PreviewFrameProps {
  url: string;
  onMessage(message: ReaderMessage): void;
  /** The page could not be loaded at all (native only; iframes cannot report this). */
  onLoadError(description: string): void;
  ref?: React.Ref<PreviewFrameHandle>;
}
