const CSS = `
.kn-dice-throw{display:block;margin:1rem auto;padding:0.75rem 1.4rem;border-radius:999px;cursor:pointer;
  font:600 0.95rem/1 var(--font-ui,system-ui,sans-serif);color:var(--fg,#eee);background:transparent;
  border:1px solid color-mix(in srgb,var(--accent,#4fd1c5) 70%,transparent);min-height:44px}
.kn-dice-throw:active{transform:scale(0.97)}
.kn-dice-result{display:flex;align-items:center;justify-content:center;gap:0.7rem;margin:0.8rem 0;
  font:500 0.85rem/1.2 var(--font-ui,system-ui,sans-serif);color:var(--muted,#999);letter-spacing:0.02em}
.kn-dice-result--in{animation:kn-dice-in 0.45s ease-out both}
.kn-dice-faces{display:inline-flex;gap:0.35rem}
.kn-dice-face{width:1.6rem;height:1.6rem}
.kn-dice-lite{position:absolute;inset:0;width:100%;height:100%}
@keyframes kn-dice-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.kn-dice-result--in{animation:none}}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'bl-dice-3d';
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
