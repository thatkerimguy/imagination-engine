// EPUB 3 serializer: OCF zip (mimetype first, STORE) + package, nav, stylesheet, chapters. Pure TS.
import type { CompiledBook, ExportOptions } from './book-model.ts';
import {
  CONTAINER_XML,
  EPUB_CSS,
  contentOpf,
  utcStamp,
  uuidFrom,
  type ManifestItem,
} from './epub-opf.ts';
import {
  chapterFile,
  chapterXhtml,
  coverXhtml,
  navXhtml,
  sectionTitle,
  titlePageXhtml,
  type NavEntry,
} from './epub-xhtml.ts';
import { bytesOf, zipFiles, type ZipInput } from './zip.ts';

export const EPUB_MIME = 'application/epub+zip';

export interface EpubExtra {
  cover?: { bytes: Uint8Array; mime: string };
  now?: Date;
  /** Overrides the deterministic `urn:uuid:` identifier. */
  identifier?: string;
  /** BCP-47 language tag (default 'en'). */
  language?: string;
}

const IMAGE_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const XHTML = 'application/xhtml+xml';

export async function buildEpub(
  book: CompiledBook,
  opts: ExportOptions,
  extra: EpubExtra = {},
): Promise<Uint8Array> {
  const lang = extra.language?.trim() || 'en';
  const title = book.title.trim() || 'Untitled';
  const mime = extra.cover?.mime.toLowerCase().trim();
  const ext = mime ? IMAGE_EXT[mime] : undefined;
  const cover = extra.cover && mime && ext ? { bytes: extra.cover.bytes, ext, mime } : undefined;

  const files: ZipInput = {
    mimetype: { data: bytesOf(EPUB_MIME), store: true },
    'META-INF/container.xml': bytesOf(CONTAINER_XML),
  };
  const manifest: ManifestItem[] = [
    { id: 'nav', href: 'nav.xhtml', mediaType: XHTML, properties: 'nav' },
    { id: 'css', href: 'styles.css', mediaType: 'text/css' },
  ];
  const spine: { idref: string; linear?: boolean }[] = [];
  const oebps: Record<string, Uint8Array> = {};

  if (cover) {
    const img = `cover.${cover.ext}`;
    manifest.push({
      id: 'cover-image',
      href: img,
      mediaType: cover.mime,
      properties: 'cover-image',
    });
    manifest.push({ id: 'cover', href: 'cover.xhtml', mediaType: XHTML });
    spine.push({ idref: 'cover' });
    oebps[img] = cover.bytes;
    oebps['cover.xhtml'] = bytesOf(coverXhtml(title, img, lang));
  }
  if (opts.titlePage) {
    manifest.push({ id: 'titlepage', href: 'titlepage.xhtml', mediaType: XHTML });
    spine.push({ idref: 'titlepage' });
    oebps['titlepage.xhtml'] = bytesOf(titlePageXhtml(book, lang));
  }
  if (opts.toc) spine.push({ idref: 'nav' });

  const entries: NavEntry[] = [];
  book.sections.forEach((section, i) => {
    const file = chapterFile(i);
    const id = `ch-${String(i + 1).padStart(3, '0')}`;
    manifest.push({ id, href: file, mediaType: XHTML });
    spine.push({ idref: id });
    oebps[file] = bytesOf(chapterXhtml(section, i, opts, lang));
    entries.push({ href: file, title: sectionTitle(section, i) });
  });
  if (entries.length === 0) entries.push({ href: 'nav.xhtml', title });

  const seed = [book.title, book.author, ...book.sections.map((s) => s.id)].join('\u0001');
  const identifier = extra.identifier?.trim() || `urn:uuid:${uuidFrom(seed)}`;
  const opf = contentOpf({
    identifier,
    title,
    author: book.author,
    language: lang,
    modified: utcStamp(extra.now ?? new Date()),
    manifest,
    spine: spine.length ? spine : [{ idref: 'nav' }],
  });

  oebps['content.opf'] = bytesOf(opf);
  oebps['nav.xhtml'] = bytesOf(navXhtml(title, entries, lang));
  oebps['styles.css'] = bytesOf(EPUB_CSS);
  const order = ['content.opf', 'nav.xhtml', 'styles.css'];
  for (const name of [...order, ...Object.keys(oebps).filter((k) => !order.includes(k))])
    files[`OEBPS/${name}`] = oebps[name]!;
  return zipFiles(files);
}
