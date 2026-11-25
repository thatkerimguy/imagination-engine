// EPUB 3 package metadata: container.xml, content.opf, stylesheet, deterministic identifier. Pure.
import { escapeXml } from './epub-xhtml.ts';

export const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>
`;

/** Calm book typography. Colours are never forced so reading-system dark modes keep working. */
export const EPUB_CSS = `body { margin: 0; line-height: 1.5; text-align: left; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; text-align: center; margin: 1.6em 0 0.8em; page-break-after: avoid; }
h1 { font-size: 1.6em; }
p { margin: 0 0 0.9em; orphans: 2; widows: 2; }
p.indent { text-indent: 1.5em; margin-bottom: 0; }
p.center { text-align: center; }
p.right { text-align: right; }
p.quote { margin-left: 1.5em; margin-right: 1.5em; font-style: italic; }
p.bullet { margin-left: 1em; }
.speaker { font-weight: bold; }
mark { background: none; color: inherit; font-weight: bold; text-decoration: underline; }
hr.scene-break { border: none; text-align: center; margin: 1.6em 0; height: 1em; }
hr.scene-break::after { content: "* * *"; letter-spacing: 0.4em; color: currentColor; opacity: 0.7; }
p.scene-label { text-align: center; font-style: italic; opacity: 0.8; }
.title-page { text-align: center; margin-top: 30%; }
.title-page .subtitle { font-style: italic; }
.title-page .author { margin-top: 2em; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-width: 100%; max-height: 100%; }
nav ol { list-style: none; padding: 0; }
nav li { margin: 0.5em 0; }
`;

/** Deterministic RFC-4122-shaped UUID from arbitrary text (FNV-1a, four lanes). */
export function uuidFrom(seed: string): string {
  const lanes = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b9];
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      lanes[k] = Math.imul((lanes[k]! ^ (c + k * 31)) >>> 0, 0x01000193) >>> 0;
    }
  }
  const hex = lanes.map((n) => n.toString(16).padStart(8, '0')).join('');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface OpfInput {
  identifier: string;
  title: string;
  author: string;
  language: string;
  modified: string;
  manifest: readonly ManifestItem[];
  spine: readonly { idref: string; linear?: boolean }[];
}

/** `YYYY-MM-DDThh:mm:ssZ` in UTC, no milliseconds. */
export const utcStamp = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function contentOpf(p: OpfInput): string {
  const manifest = p.manifest
    .map(
      (m) =>
        `<item id="${escapeXml(m.id)}" href="${escapeXml(m.href)}" media-type="${escapeXml(m.mediaType)}"${m.properties ? ` properties="${m.properties}"` : ''}/>`,
    )
    .join('\n');
  const spine = p.spine
    .map(
      (s) => `<itemref idref="${escapeXml(s.idref)}"${s.linear === false ? ' linear="no"' : ''}/>`,
    )
    .join('\n');
  const creator = p.author.trim() ? `<dc:creator>${escapeXml(p.author)}</dc:creator>\n` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(p.language)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${escapeXml(p.identifier)}</dc:identifier>
<dc:title>${escapeXml(p.title)}</dc:title>
${creator}<dc:language>${escapeXml(p.language)}</dc:language>
<meta property="dcterms:modified">${p.modified}</meta>
</metadata>
<manifest>
${manifest}
</manifest>
<spine>
${spine}
</spine>
</package>
`;
}
