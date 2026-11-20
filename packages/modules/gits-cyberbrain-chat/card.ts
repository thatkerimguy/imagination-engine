import type { ModuleCardFormatter } from '@kn/core';
import type { CyberbrainChatProps } from './schema.ts';

export const formatCardSummary: ModuleCardFormatter<CyberbrainChatProps> = (p) => {
  const first = p.messages[0] ?? '';
  const preview = first.length > 40 ? `${first.slice(0, 39)}…` : first;
  const lines = p.messages.length;
  return {
    title: `🧠 ${p.senderId} · ${lines} line${lines === 1 ? '' : 's'}`,
    subtitle: `“${preview}”`,
    badge: p.encryption,
  };
};
