// Expo Web: "PDF" and "Print" are the browser print dialog (choose Save as PDF) over the same
// print HTML, rendered in a hidden iframe that is removed afterwards.
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { toHtml } from './html.ts';

function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    const done = (err?: Error): void => {
      frame.remove();
      if (err) reject(err);
      else resolve();
    };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return done(new Error('Could not open the print preview.'));
      win.addEventListener('afterprint', () => done(), { once: true });
      win.focus();
      win.print();
      // Browsers that never fire afterprint: clean up shortly after the dialog returns.
      setTimeout(() => done(), 60_000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export const printableHtml = async (book: CompiledBook, opts: ExportOptions): Promise<string> =>
  toHtml(book, opts);

export const exportPdf = async (book: CompiledBook, opts: ExportOptions): Promise<void> =>
  printHtml(await printableHtml(book, opts));

export const printBook = exportPdf;
