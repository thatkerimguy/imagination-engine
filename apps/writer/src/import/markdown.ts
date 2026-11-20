// Markdown → blocks. Writer markup already speaks `**bold**`, `*italic*`, `~~strike~~`, so most
// inline syntax passes through; `_x_` / `__x__`, links and images are normalised.
import {
  buildImported,
  cleanText,
  isSceneBreakLine,
  type ImportedDoc,
  type ImportedItem,
} from './build.ts';

export function inlineFromMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[^\w\\])__(?=\S)(.+?)(?<=\S)__(?!\w)/g, '$1**$2**')
    .replace(/(^|[^\w\\])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1*$2*')
    .replace(/<\/?(u|mark|em|strong|s)>/gi, (_m, tag: string) =>
      /^(u)$/i.test(tag) ? '++' : /^mark$/i.test(tag) ? '==' : /^(em)$/i.test(tag) ? '*' : '**',
    );
}

export function parseMarkdown(raw: string, title?: string): ImportedDoc {
  const text = cleanText(raw);
  const items: ImportedItem[] = [];
  let found = title;
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) items.push({ text: inlineFromMarkdown(para.join(' ')) });
    para = [];
  };
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
    const bullet = /^[-+*]\s+(.+)$/.exec(trimmed);
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (!trimmed) flush();
    else if (isSceneBreakLine(trimmed)) {
      flush();
      items.push({ scene: true });
    } else if (h) {
      flush();
      const level = Math.min(3, h[1]!.length) as 1 | 2 | 3;
      if (!found && items.length === 0 && h[1]!.length === 1) found = inlineFromMarkdown(h[2]!);
      else items.push({ text: inlineFromMarkdown(h[2]!), style: { heading: level } });
    } else if (bullet) {
      flush();
      items.push({ text: inlineFromMarkdown(bullet[1]!), style: { list: 'bullet' } });
    } else if (quote) {
      flush();
      if (quote[1]!.trim())
        items.push({ text: inlineFromMarkdown(quote[1]!), style: { quote: true } });
    } else para.push(trimmed);
  }
  flush();
  return buildImported(found, items);
}
