// Scoped styles, injected once and removed when the last whisper is disposed. At rest the ghost
// line sits a touch offset (and a little brighter) behind the surface line so attentive readers
// notice something lurking there; Reduced stays static and hidden until revealed.
const CSS = `
.kn-gw{--gw:#4fd1c5;display:grid;margin:1.6rem 0;padding:0.2rem 0;cursor:pointer;outline-offset:4px;
  font-family:var(--font-prose,Georgia,serif);font-size:inherit;line-height:inherit;color:var(--fg,#e7e4dd);
  touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent}
.kn-gw--silver{--gw:#c9d1d9}.kn-gw--amber{--gw:#e0a94f}
.kn-gw .s,.kn-gw .g{grid-area:1/1;margin:0;white-space:pre-wrap}
.kn-gw .s{opacity:1}
.kn-gw .g{color:var(--gw);font-family:var(--font-mono,ui-monospace,monospace);font-size:0.92em;opacity:0.27;pointer-events:none;transform:translate(3px,0.22em)}
.kn-gw[data-kn-revealed="true"] .s{opacity:0.18}
.kn-gw[data-kn-revealed="true"] .g{opacity:1;filter:none;transform:none}
.kn-gw--high .g,.kn-gw--lite .g{filter:blur(1px)}
.kn-gw--high .s,.kn-gw--lite .s,.kn-gw--high .g,.kn-gw--lite .g{transition:opacity 0.45s var(--ease,ease),filter 0.45s var(--ease,ease),transform 0.45s var(--ease,ease)}
.kn-gw--high .g{text-shadow:-1px 0 rgba(255,60,120,0.45),1px 0 rgba(60,200,255,0.45);animation:kn-gw-drift 9s ease-in-out infinite}
.kn-gw--high[data-kn-revealed="true"] .g{animation-play-state:paused}
.kn-gw--reduced .s,.kn-gw--reduced .g{transition:none;animation:none;filter:none;transform:none}
.kn-gw--reduced .g{opacity:0}
.kn-gw--reduced[data-kn-revealed="true"] .g{opacity:1}
.kn-gw--reduced[data-kn-revealed="true"] .s{opacity:0}
.kn-gw:focus-visible{outline:2px solid var(--gw)}
@keyframes kn-gw-drift{0%,100%{transform:translate(-1px,0.22em)}50%{transform:translate(6px,0.1em)}}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'gits-ghost-whisper';
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
