// Dispatches a compiled book to the right serializer and delivers the file.
import { exportNovelArchive } from '../backup/archive-repo.ts';
import type { NovelRepository } from '../store/repository.ts';
import {
  fileStem,
  type CompiledBook,
  type ExportFormat,
  type ExportOptions,
} from './book-model.ts';
import { deliverBytes, deliverText, type DeliverResult } from './deliver';
import { buildDocx, DOCX_MIME } from './docx.ts';
import { buildEpub, EPUB_MIME, type EpubExtra } from './epub.ts';
import { toHtml } from './html.ts';
import { toMarkdown } from './markdown.ts';
import { exportPdf, printBook } from './pdf.ts';
import { toTxt } from './txt.ts';
import { isCoverSkip } from '../publish/cover-data.ts';
import { readCover } from '../publish/read-cover';
import { base64ToBytes } from './base64.ts';

/** Only `.knbook` needs to know where the book came from. */
export interface ExportContext {
  repo: NovelRepository;
  novelId?: string;
}

/** What happened: 'printed' = sent to the print dialog (nothing saved, nothing to confirm). */
export interface ExportOutcome {
  status: DeliverResult | 'printed';
  filename: string;
}

/** The book's cover as EPUB bytes; an unreadable cover is skipped (the book still exports). */
async function epubCover(uri: string | undefined): Promise<EpubExtra> {
  if (!uri) return {};
  const c = await readCover(uri).catch(() => null);
  return c && !isCoverSkip(c) ? { cover: { bytes: base64ToBytes(c.base64), mime: c.mime } } : {};
}

async function exportFile(
  book: CompiledBook,
  format: ExportFormat,
  opts: ExportOptions,
  ctx: ExportContext | undefined,
  filename: string,
): Promise<DeliverResult> {
  const stem = fileStem(book.title);
  switch (format) {
    case 'docx':
      return deliverBytes(filename, await buildDocx(book, opts), DOCX_MIME);
    case 'epub':
      return deliverBytes(
        filename,
        await buildEpub(book, opts, await epubCover(book.cover)),
        EPUB_MIME,
      );
    case 'pdf':
      return exportPdf(book, opts);
    case 'md':
      return deliverText(filename, toMarkdown(book, opts), 'text/markdown');
    case 'html':
      return deliverText(filename, toHtml(book, opts), 'text/html');
    case 'txt':
      return deliverText(filename, toTxt(book, opts), 'text/plain');
    default: {
      if (!ctx?.novelId) throw new Error('.knbook export is only available for books.');
      const bytes = await exportNovelArchive(ctx.repo, ctx.novelId);
      return deliverBytes(`${stem}.knbook`, bytes, 'application/zip');
    }
  }
}

export async function exportBook(
  book: CompiledBook,
  format: ExportFormat,
  opts: ExportOptions,
  ctx?: ExportContext,
): Promise<ExportOutcome> {
  const filename = `${fileStem(book.title)}.${format === 'print' ? 'pdf' : format}`;
  if (format === 'print') {
    await printBook(book, opts);
    return { status: 'printed', filename };
  }
  return { status: await exportFile(book, format, opts, ctx, filename), filename };
}
