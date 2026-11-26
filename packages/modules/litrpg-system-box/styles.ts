// Scoped styles, injected once and removed when the last box is disposed. The single sweep is
// one pass (no flashing, WCAG 2.3.1); reduced motion and the reduced tier show a static card.
const CSS = `
.kn-sb{--a:#3b82f6;margin:1.25em 0;padding:0;border:1.5px solid var(--a);border-radius:4px;
  background:linear-gradient(180deg,#0c2340,#081628);color:#eef6ff;position:relative;overflow:hidden;
  font:500 .9em/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  box-shadow:0 0 14px color-mix(in srgb,var(--a) 45%,transparent),inset 0 0 18px #0a1c33}
.kn-sb[data-kn-variant="warning"]{--a:#dc2626}
.kn-sb[data-kn-variant="level-up"]{--a:#f59e0b}
.kn-sb[data-kn-variant="quest"]{--a:#10b981}
.kn-sb-h{padding:.55em .9em;text-align:center;letter-spacing:.14em;font-size:.8em;color:var(--a);
  border-bottom:1px solid var(--a);text-transform:uppercase;overflow-wrap:anywhere}
.kn-sb-t{display:block;margin-top:.2em;color:#eef6ff;letter-spacing:.06em}
.kn-sb-l{margin:0;padding:.6em .9em .7em;list-style:none}
.kn-sb-l>li{padding:.15em 0;overflow-wrap:anywhere}
.kn-sb-l>li::before{content:"> ";color:var(--a)}
.kn-sb[data-kn-tier="high"]::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--a) 35%,transparent),transparent);
  transform:translateY(-100%);animation:kn-sb-sweep .8s ease-out 1 forwards}
.kn-sb[data-kn-tier="high"]{animation:kn-sb-in .35s ease-out 1}
.kn-sb[data-kn-tier="lite"]{animation:kn-sb-fade .3s ease-out 1}
@keyframes kn-sb-sweep{to{transform:translateY(100%);opacity:0}}
@keyframes kn-sb-in{from{opacity:0}to{opacity:1}}
@keyframes kn-sb-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.kn-sb,.kn-sb::after{animation:none!important}.kn-sb::after{display:none}}
`;

let users = 0;
let el: HTMLStyleElement | null = null;

export function retainStyles(): () => void {
  if (users++ === 0) {
    el = document.createElement('style');
    el.dataset.module = 'litrpg-system-box';
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
