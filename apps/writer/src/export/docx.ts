// DOCX export: a minimal valid ECMA-376 package with exactly five parts, zipped with fflate.
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { docxBody } from './docx-body.ts';
import { CONTENT_TYPES, DOC_RELS, documentXml, ROOT_RELS, STYLES_XML } from './ooxml.ts';
import { bytesOf, zipFiles } from './zip.ts';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function buildDocx(book: CompiledBook, opts: ExportOptions): Promise<Uint8Array> {
  return zipFiles({
    '[Content_Types].xml': bytesOf(CONTENT_TYPES),
    '_rels/.rels': bytesOf(ROOT_RELS),
    'word/_rels/document.xml.rels': bytesOf(DOC_RELS),
    'word/styles.xml': bytesOf(STYLES_XML),
    'word/document.xml': bytesOf(documentXml(docxBody(book, opts))),
  });
}
