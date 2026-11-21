// Scoped styles, injected once and removed when the last passage is disposed.
// The passage must read as ordinary body prose: it inherits size, line-height and colour from
// .kn-chapter, and repeats the .kn-block / .kn-prose rules the host's p would otherwise get.
const CSS = `
.kn-gl{display:grid;margin:0 0 1.25em;font-family:var(--font-prose,inherit);
  hyphens:auto;text-wrap:pretty;white-space:pre-line}
.kn-gl>span{grid-area:1/1}
.kn-gl>span[aria-hidden="true"]{visibility:hidden}
.kn-gl--bruise>.kn-gl-b{color:color-mix(in srgb,currentColor 86%,#6b6f86)}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'pt-gaslight-edit';
    el.textContent = CSS;
    document.head.append(el);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) {
      el?.remove();
      el = null;
    }
  };
}
