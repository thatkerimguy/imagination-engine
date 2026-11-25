import type { PreviewHostMessage, ReaderMessage } from './protocol.ts';

export interface PreviewFrameHandle {
  send(message: PreviewHostMessage): void;
  /** Forwards a native accelerometer shake into the reader (`kn-native-shake`). */
  triggerShake(): void;
}

export interface PreviewFrameProps {
  /** Self-contained reader HTML (the built-in offline reader). Wins over `url`. */
  html?: string;
  /** Remote reader address, used when no `html` is given. */
  url?: string;
  onMessage(message: ReaderMessage): void;
  /** The page could not be loaded at all (native only; iframes cannot report this). */
  onLoadError(description: string): void;
  ref?: React.Ref<PreviewFrameHandle>;
}
