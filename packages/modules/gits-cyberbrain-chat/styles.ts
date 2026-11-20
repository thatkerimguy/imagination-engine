// Scoped styles, injected once and removed when the last thread is disposed.
const CSS = `
.kn-cbc{--c:var(--cbc-tone);font:500 0.82rem/1.45 var(--font-mono,ui-monospace,monospace);color:var(--fg,#e8e6e1);
  max-width:min(30rem,88%);margin:1.4rem 0;padding:0.7rem 0.85rem 0.8rem;position:relative;
  background:color-mix(in srgb,var(--c) 7%,transparent);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));
  backdrop-filter:blur(3px)}
.kn-cbc--right{margin-left:auto}
.kn-cbc--aesq{--cbc-tone:#4fd1c5}.kn-cbc--open{--cbc-tone:#9aa3ad}.kn-cbc--spoofed{--cbc-tone:#ff7a59}
.kn-cbc header{display:flex;gap:0.6rem;align-items:center;font-size:0.68rem;letter-spacing:0.12em;opacity:0.9;margin-bottom:0.45rem}
.kn-cbc .id{color:var(--c)}
.kn-cbc .badge{border:1px solid var(--c);color:var(--c);padding:0 0.35rem;border-radius:2px}
.kn-cbc .sig{margin-left:auto;display:flex;gap:2px;align-items:flex-end;height:0.7rem}
.kn-cbc .sig i{width:3px;background:var(--c);opacity:0.85}
.kn-cbc .sig i:nth-child(1){height:30%}.kn-cbc .sig i:nth-child(2){height:55%}
.kn-cbc .sig i:nth-child(3){height:80%}.kn-cbc .sig i:nth-child(4){height:100%}
.kn-cbc--live .sig i{animation:kn-cbc-jit 1.7s steps(3) infinite}
.kn-cbc--live .sig i:nth-child(2n){animation-delay:-0.6s}
.kn-cbc ol{list-style:none;margin:0;padding:0;display:grid;gap:0.35rem}
.kn-cbc li{padding-left:0.7rem;border-left:2px solid color-mix(in srgb,var(--c) 70%,transparent)}
.kn-cbc li.pending{visibility:hidden}
.kn-cbc--motion li.in{animation:kn-cbc-in 0.42s cubic-bezier(.2,.8,.2,1) both}
.kn-cbc .wait{opacity:0.55;font-size:0.7rem;letter-spacing:0.1em}
@keyframes kn-cbc-in{from{opacity:0;transform:translateX(var(--cbc-dx,10px));clip-path:inset(0 100% 0 0)}to{opacity:1;transform:none;clip-path:inset(0 0 0 0)}}
@keyframes kn-cbc-jit{50%{opacity:0.35}}
.kn-cbc--left{--cbc-dx:-10px}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'gits-cyberbrain-chat';
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
