// Minimal ECMA-376 WordprocessingML helpers: escaping, runs, paragraphs and the static parts.
import type { InlineRun } from '../editor/inline-markup.ts';

// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Strips XML-illegal characters, then escapes & < > " '. */
export function xmlEscape(s: string): string {
  return s
    .replace(ILLEGAL, '')
    .replace(LONE_SURROGATE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export const CONTENT_TYPES = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

export const ROOT_RELS = `${HEAD}<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

export const DOC_RELS = `${HEAD}<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const style = (id: string, name: string, ppr: string, rpr: string, extra = ''): string =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;

const heading = (n: 1 | 2 | 3, size: number): string =>
  style(
    `Heading${n}`,
    `heading ${n}`,
    `<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="${n - 1}"/>`,
    `<w:b/><w:sz w:val="${size}"/>`,
    '<w:next w:val="Normal"/>',
  );

export const STYLES_XML = `${HEAD}<w:styles xmlns:w="${NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="312" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style('Title', 'Title', '<w:spacing w:before="2400" w:after="240"/><w:jc w:val="center"/>', '<w:b/><w:sz w:val="56"/>')}${style('Subtitle', 'Subtitle', '<w:jc w:val="center"/>', '<w:i/><w:sz w:val="26"/>')}${heading(1, 36)}${heading(2, 30)}${heading(3, 26)}${style('Quote', 'Quote', '<w:ind w:left="720" w:right="720"/>', '<w:i/>')}</w:styles>`;

export const documentXml = (body: string): string =>
  `${HEAD}<w:document xmlns:w="${NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

function runProps(r: InlineRun): string {
  const out =
    (r.bold ? '<w:b/>' : '') +
    (r.italic ? '<w:i/>' : '') +
    (r.strike ? '<w:strike/>' : '') +
    (r.fg ? `<w:color w:val="${r.fg.slice(1).toUpperCase()}"/>` : '') +
    (r.highlight ? '<w:highlight w:val="yellow"/>' : '') +
    (r.underline ? '<w:u w:val="single"/>' : '');
  return out ? `<w:rPr>${out}</w:rPr>` : '';
}

/** One styled run; `\n` becomes a line break and `\t` a tab. */
export function runXml(r: InlineRun): string {
  const pieces = r.text.split(/(\n|\t)/);
  const inner = pieces
    .filter((p) => p !== '')
    .map((p) =>
      p === '\n'
        ? '<w:br/>'
        : p === '\t'
          ? '<w:tab/>'
          : `<w:t xml:space="preserve">${xmlEscape(p)}</w:t>`,
    )
    .join('');
  return inner ? `<w:r>${runProps(r)}${inner}</w:r>` : '';
}

export interface ParaProps {
  style?: string;
  align?: 'left' | 'center' | 'right';
  /** First-line indent in twentieths of a point. */
  firstLine?: number;
  left?: number;
}

export function paraXml(runs: readonly InlineRun[], p: ParaProps = {}): string {
  const ind =
    p.firstLine || p.left
      ? `<w:ind${p.left ? ` w:left="${p.left}"` : ''}${p.firstLine ? ` w:firstLine="${p.firstLine}"` : ''}/>`
      : '';
  const jc = p.align ? `<w:jc w:val="${p.align}"/>` : '';
  const ppr = `${p.style ? `<w:pStyle w:val="${p.style}"/>` : ''}${ind}${jc}`;
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${runs.map(runXml).join('')}</w:p>`;
}

export const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
