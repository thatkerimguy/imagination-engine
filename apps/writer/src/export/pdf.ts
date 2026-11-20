// Native PDF + print. Build print HTML (html.ts), inline the cover as base64, render with
// expo-print. Guardrails: complete <!DOCTYPE html>, `@page { margin: 48px }`, iOS margins, no
// `useMarkupFormatter` (breaks images), never `body { height: 100% }`.
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { fileStem } from './book-model.ts';
import { deliverFile } from './deliver.ts';
import { toHtml } from './html.ts';

const MARGINS = { left: 48, right: 48, top: 48, bottom: 48 } as const;
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** Data URIs and web URLs pass through; local files are read and base64-inlined. */
async function inlineCover(cover: string | undefined): Promise<string | undefined> {
  if (!cover || cover.startsWith('data:') || /^https?:/i.test(cover)) return cover;
  try {
    const ext = /\.(\w+)(?:\?|$)/.exec(cover)?.[1]?.toLowerCase() ?? 'jpg';
    return `data:${MIME[ext] ?? 'image/jpeg'};base64,${await new File(cover).base64()}`;
  } catch {
    return undefined;
  }
}

export async function printableHtml(book: CompiledBook, opts: ExportOptions): Promise<string> {
  const cover = await inlineCover(book.cover);
  return toHtml(cover ? { ...book, cover } : { ...book, cover: undefined }, opts);
}

export async function exportPdf(book: CompiledBook, opts: ExportOptions): Promise<void> {
  const html = await printableHtml(book, opts);
  const { uri } = await Print.printToFileAsync({ html, margins: MARGINS });
  await deliverFile(`${fileStem(book.title)}.pdf`, await new File(uri).bytes(), 'application/pdf');
}

export async function printBook(book: CompiledBook, opts: ExportOptions): Promise<void> {
  await Print.printAsync({ html: await printableHtml(book, opts), margins: MARGINS });
}
