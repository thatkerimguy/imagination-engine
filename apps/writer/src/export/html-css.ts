// Clean book CSS for the standalone HTML export and the PDF print path.
// Never `height: 100%` on body (it truncates multi-page printing on iOS).
export const BOOK_CSS = `
@page { margin: 48px; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0 auto; max-width: 38rem; padding: 2rem 1.25rem 4rem; color: #1b1a17; background: #fff;
  font-family: Georgia, 'Times New Roman', serif; font-size: 1.05rem; line-height: 1.65; }
h1, h2, h3, h4, h5 { font-weight: 600; line-height: 1.25; margin: 2rem 0 0.75rem; }
h1 { font-size: 1.9rem; } h2 { font-size: 1.45rem; } h3 { font-size: 1.2rem; }
p { margin: 0 0 0.9rem; orphans: 3; widows: 3; }
p.indent { text-indent: 1.5em; }
p.center { text-align: center; } p.right { text-align: right; } p.left { text-align: left; }
p.quote, blockquote { margin-left: 1.5em; padding-left: 1em; border-left: 2px solid #c9c4b8; color: #4a463e; }
p.italic { font-style: italic; }
p.bullet { padding-left: 1.2em; text-indent: -1.2em; }
.speaker { font-weight: 600; }
.scene-break { text-align: center; letter-spacing: 0.5em; margin: 1.6rem 0; color: #6b665b; }
.scene-label { text-align: center; font-style: italic; color: #6b665b; margin-top: -1rem; }
.title-page { text-align: center; padding: 18vh 0 0; page-break-after: always; }
.title-page h1 { font-size: 2.4rem; margin-bottom: 0.4rem; }
.title-page .subtitle { font-style: italic; margin: 0 0 1rem; }
.title-page .author { letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.9rem; color: #6b665b; }
.title-page img.cover { display: block; margin: 0 auto 2rem; max-width: 60%; max-height: 22rem; }
nav.toc { page-break-after: always; }
nav.toc ol { padding-left: 1.4rem; } nav.toc a { color: inherit; text-decoration: none; }
section.chapter.break { page-break-before: always; }
mark { background: #fff2a8; } a { color: inherit; }
@media (prefers-color-scheme: dark) { @media screen {
  body { background: #17160f; color: #ece7da; } .scene-break, .scene-label { color: #a39d8e; } mark { color: #17160f; } } }
@media print { body { max-width: none; padding: 0; } }
`;
