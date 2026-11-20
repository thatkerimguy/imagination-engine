// Expo Web (QA): the reader in an <iframe>, talking over window.postMessage.
import { useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { useTheme } from '../ui/theme.tsx';
import type { PreviewFrameProps } from './frame-types.ts';
import { parseReaderMessage } from './protocol.ts';

export function PreviewFrame({ url, onMessage, ref }: PreviewFrameProps): ReactNode {
  const { colors } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useImperativeHandle(ref, () => ({
    send(message) {
      frame.current?.contentWindow?.postMessage(message, '*');
    },
  }));

  useEffect(() => {
    const listen = (e: MessageEvent<unknown>): void => {
      if (e.source !== frame.current?.contentWindow) return;
      const msg = parseReaderMessage(e.data);
      if (msg) handler.current(msg);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  return (
    <iframe
      ref={frame}
      src={url}
      title="Reader preview"
      allow="autoplay; accelerometer; gyroscope"
      style={{ flex: 1, width: '100%', height: '100%', border: 0, background: colors.canvas }}
    />
  );
}
