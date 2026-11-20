// Plain text → blocks: blank-line separated paragraphs (single newlines when there are none).
import { escapeMarkup } from '../export/markup-util.ts';
import { buildImported, isSceneBreakLine, type ImportedDoc, type ImportedItem } from './build.ts';

export function parseTxt(raw: string, title?: string): ImportedDoc {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const hasBlank = /\n[ \t]*\n/.test(text);
  const chunks = hasBlank ? text.split(/\n[ \t]*\n/) : text.split('\n');
  const items: ImportedItem[] = [];
  for (const chunk of chunks) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.length === 1 && isSceneBreakLine(lines[0]!)) items.push({ scene: true });
    else items.push({ text: escapeMarkup(lines.join(' ')) });
  }
  return buildImported(title, items);
}
