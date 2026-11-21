const CSS = `
.kn-lighter{position:absolute;inset:0;pointer-events:none;opacity:0}
.kn-lighter--on{opacity:1;transition:opacity 0.45s ease-out}
.kn-lighter--still{opacity:1;transition:none}
.kn-lighter[data-kn-lighter="out"]{opacity:0;transition:opacity 0.22s ease-in}
.kn-lighter--still[data-kn-lighter="out"]{transition:none}
.kn-lighter-glow{position:absolute;left:0;right:0;bottom:0;height:38vh;pointer-events:none;
  background:radial-gradient(ellipse 75% 100% at var(--kn-lx,100%) 100%,
    rgba(255,150,40,calc(0.42*var(--kn-warm,0.75))) 0%,rgba(255,110,20,calc(0.16*var(--kn-warm,0.75))) 45%,transparent 72%)}
.kn-lighter-flame{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);
  width:60px;height:110px;pointer-events:none}
.kn-lighter-flame canvas,.kn-lighter-flame svg{display:block;width:100%;height:100%}
.kn-lighter--lite .kn-lighter-flame svg{animation:kn-lighter-flick 2.6s ease-in-out infinite;transform-origin:50% 100%}
.kn-lighter--still .kn-lighter-flame{width:34px;height:60px;opacity:0.9}
.kn-lighter-cue{display:block;margin:1rem auto;padding:0.75rem 1.4rem;border-radius:999px;cursor:pointer;
  font:600 0.95rem/1 var(--font-ui,system-ui,sans-serif);color:var(--fg,#eee);background:transparent;
  border:1px solid color-mix(in srgb,#ffa73a 70%,transparent);min-height:44px}
.kn-lighter-cue:active{transform:scale(0.97)}
@keyframes kn-lighter-flick{0%,100%{transform:scale(1) rotate(-1deg)}50%{transform:scale(1.04,0.97) rotate(1.5deg)}}
@media (prefers-reduced-motion:reduce){.kn-lighter-flame svg{animation:none!important}}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'bl-lighter-flick';
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
