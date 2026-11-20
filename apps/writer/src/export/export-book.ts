// Dispatches a compiled book to the right serializer and delivers the file.
import { exportNovelArchive } from '../backup/archive-repo.ts';
import type { NovelRepository } from '../store/repository.ts';
import {
  fileStem,
  type CompiledBook,
  type ExportFormat,
  type ExportOptions,
} from './book-model.ts';
import { deliverFile } from './deliver.ts';
import { buildDocx, DOCX_MIME } from './docx.ts';
import { toHtml } from './html.ts';
import { toMarkdown } from './markdown.ts';
import { exportPdf, printBook } from './pdf.ts';
import { toTxt } from './txt.ts';

/** Only `.knbook` needs to know where the book came from. */
export interface ExportContext {
  repo: NovelRepository;
  novelId?: string;
}

export async function exportBook(
  book: CompiledBook,
  format: ExportFormat,
  opts: ExportOptions,
  ctx?: ExportContext,
): Promise<void> {
  const stem = fileStem(book.title);
  switch (format) {
    case 'docx':
      return deliverFile(`${stem}.docx`, await buildDocx(book, opts), DOCX_MIME);
    case 'pdf':
      return exportPdf(book, opts);
    case 'print':
      return printBook(book, opts);
    case 'md':
      return deliverFile(`${stem}.md`, toMarkdown(book, opts), 'text/markdown');
    case 'html':
      return deliverFile(`${stem}.html`, toHtml(book, opts), 'text/html');
    case 'txt':
      return deliverFile(`${stem}.txt`, toTxt(book, opts), 'text/plain');
    case 'knbook': {
      if (!ctx?.novelId) throw new Error('.knbook export is only available for books.');
      const bytes = await exportNovelArchive(ctx.repo, ctx.novelId);
      return deliverFile(`${stem}.knbook`, bytes, 'application/zip');
    }
  }
}
