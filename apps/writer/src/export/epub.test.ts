import type { Block } from '@kn/core';
import { EpubCheck } from '@likecoin/epubcheck-ts';
import { describe, expect, it } from 'vitest';
import { starterBlueprint } from '@kn/engines/blueprints';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook, type ExportOptions } from './book-model.ts';
import { EPUB_MIME, buildEpub } from './epub.ts';
import { textOf, unzipFiles } from './zip.ts';

const id = (n: number): string => `01HZZZZZZZZZZZZZZZZZZZZZ${String(n).padStart(2, '0')}`;
const mod = (n: number, moduleId: string, props: Record<string, unknown> = {}): Block => ({
  id: id(n),
  kind: 'module',
  moduleId,
  moduleVersion: 1,
  props,
});
/** A v2 cue: rendered through its blueprint's `epubXhtml` export template. */
const cue = (n: number, blueprintId: string, props: Record<string, unknown> = {}): Block => {
  const bp = starterBlueprint(blueprintId)!;
  return mod(n, bp.engine, { blueprintId, ...bp.defaultProps, ...props });
};

const blocks: Block[] = [
  {
    id: id(1),
    kind: 'prose',
    text: 'A **bold** & *soft* ++under++ ~~gone~~ ==lit== <b>tag</b> "q" it\'s',
  },
  { id: id(2), kind: 'dialogue', speaker: 'Ana & Bo', text: 'Hi <there>' },
  { id: id(3), kind: 'scene-break', label: 'Later & after' },
  { id: id(4), kind: 'prose', text: 'whispered', style: 'whisper' },
  cue(5, 'cyberbrain-link', { messages: [{ sender: 'KESTREL-9', text: 'Link established.' }] }),
  cue(6, 'dice-throw-3d'),
  cue(7, 'gaslight-rewrite'),
  cue(8, 'system-notification', { title: 'Tom & <b>Jerry</b>' }),
  cue(9, 'brass-lighter-3d'),
  mod(10, 'core-ambient-bed'),
];

const book: CompiledBook = {
  title: 'Tom & <Jerry> "Co" \'s',
  subtitle: 'Sub & title',
  author: 'A. <Author>',
  sections: [
    { id: 'c1', title: 'One & <Only>', blocks, styles: { [id(1)]: { heading: 2 } } },
    { id: 'c2', title: 'Two "quoted"', blocks: blocks.slice(0, 3), styles: {} },
    { id: 'c3', title: '', blocks: [], styles: {}, showTitle: false },
  ],
};

// 1x1 PNG and a minimal valid JPEG.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);
const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({
  ...DEFAULT_EXPORT_OPTIONS,
  ...o,
});
const now = new Date('2026-01-02T03:04:05.678Z');

/** Strict-enough XML well-formedness: balanced tags, no stray markup characters in text. */
function assertWellFormed(xml: string): void {
  const stack: string[] = [];
  const stripped = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
  for (const [, close, name, , self] of stripped.matchAll(
    /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g,
  )) {
    if (self) continue;
    if (close) expect(stack.pop()).toBe(name);
    else stack.push(name!);
  }
  expect(stack).toEqual([]);
  expect(stripped.replace(/<[^>]*>/g, '')).not.toMatch(/[<>]|&(?!(amp|lt|gt|quot|#39);)/);
}

describe('buildEpub', () => {
  it('writes OCF: mimetype first, STORE, no extra field, then container and package', async () => {
    const bytes = await buildEpub(book, opts(), { now, cover: { bytes: PNG, mime: 'image/png' } });
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // method STORE
    expect(v.getUint16(28, true)).toBe(0); // extra length
    expect(v.getUint16(26, true)).toBe(8);
    expect(textOf(bytes.subarray(30, 38))).toBe('mimetype');
    expect(textOf(bytes.subarray(38, 38 + EPUB_MIME.length))).toBe(EPUB_MIME);
    const files = await unzipFiles(bytes);
    expect(Object.keys(files).slice(0, 3)).toEqual([
      'mimetype',
      'META-INF/container.xml',
      'OEBPS/content.opf',
    ]);
    expect(textOf(files.mimetype!)).toBe('application/epub+zip');
  });

  it('is well-formed, escaped, and its manifest/spine/nav resolve', async () => {
    const files = await unzipFiles(
      await buildEpub(book, opts({ toc: true }), { now, cover: { bytes: PNG, mime: 'image/png' } }),
    );
    for (const [name, data] of Object.entries(files))
      if (/\.(xhtml|opf|xml)$/.test(name)) assertWellFormed(textOf(data));
    const opf = textOf(files['OEBPS/content.opf']!);
    expect(opf).toContain('version="3.0"');
    expect(opf).toContain('<meta property="dcterms:modified">2026-01-02T03:04:05Z</meta>');
    expect(opf).toContain('Tom &amp; &lt;Jerry&gt; &quot;Co&quot; &#39;s');
    expect(opf).toMatch(/<dc:identifier id="book-id">urn:uuid:[0-9a-f-]{36}</);
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('properties="nav"');
    const hrefs = [...opf.matchAll(/<item [^>]*href="([^"]+)"/g)].map((m) => m[1]!);
    for (const h of hrefs) expect(files[`OEBPS/${h}`], h).toBeDefined();
    const ids = [...opf.matchAll(/<item id="([^"]+)"/g)].map((m) => m[1]!);
    const refs = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => m[1]!);
    for (const r of refs) expect(ids).toContain(r);
    expect(refs[0]).toBe('cover');
    expect(textOf(files['OEBPS/nav.xhtml']!)).toContain('<nav epub:type="toc" id="toc">');
    const ch = textOf(files['OEBPS/ch-001.xhtml']!);
    expect(ch).toContain('<strong>bold</strong>');
    expect(ch).toContain('&lt;b&gt;tag&lt;/b&gt;');
    expect(ch).toContain('Ana &amp; Bo:');
    expect(ch).toContain('<hr class="scene-break"/>');
    expect(ch).toContain('<strong>KESTREL-9</strong> Link established.');
    expect(ch).toContain('Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;');
    expect(textOf(files['OEBPS/styles.css']!)).not.toMatch(
      /color:\s*#0+\b|background(-color)?:\s*#f/i,
    );
  });

  it('is deterministic and honours gimmick mode and unsupported cover mimes', async () => {
    const a = await buildEpub(book, opts(), { now });
    const b = await buildEpub(book, opts(), { now });
    expect(a).toEqual(b);
    const omit = await unzipFiles(
      await buildEpub(book, opts({ gimmickMode: 'omit' }), {
        now,
        identifier: 'urn:uuid:x',
        cover: { bytes: PNG, mime: 'image/bmp' },
      }),
    );
    expect(textOf(omit['OEBPS/ch-001.xhtml']!)).not.toContain('KESTREL-9');
    expect(Object.keys(omit).some((k) => k.includes('cover'))).toBe(false);
    expect(textOf(omit['OEBPS/content.opf']!)).toContain('>urn:uuid:x<');
  });

  it('passes EPUBCheck with no fatal or error messages', async () => {
    const bytes = await buildEpub(book, opts({ toc: true }), {
      now,
      cover: { bytes: PNG, mime: 'image/png' },
    });
    const result = await EpubCheck.validate(bytes);
    const bad = result.messages.filter((m) => m.severity === 'fatal' || m.severity === 'error');
    expect(bad.map((m) => `${m.id} ${m.message}`)).toEqual([]);
    expect(result.fatalCount + result.errorCount).toBe(0);
  });
});
