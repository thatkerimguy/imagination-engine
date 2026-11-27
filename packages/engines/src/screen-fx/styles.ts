// Scoped CSS for screen-fx: the inline marker card and the GPU-composited fixed overlay.
// Every effect is gradients + opacity/transform only; pulses stay under 1.5 Hz.
export const CSS = `
.kn-e.kn-e-screen-fx{padding:10px 14px;margin:1em 0}
.kn-e-screen-fx__row{display:flex;align-items:center;gap:10px;min-width:0}
.kn-e-screen-fx__name{flex:1;min-width:0;font-size:.8em;letter-spacing:.08em;text-transform:uppercase;color:var(--kn-e-accent)}
.kn-e-screen-fx__cap{margin:4px 0 0;font-size:.9em;color:var(--dna-muted,#b4b4b4)}
.kn-e-screen-fx__replay{background:none;border:var(--dna-stroke,1px) solid var(--kn-e-accent);border-radius:999px}
.kn-e-screen-fx__ov{position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;contain:strict;animation:kn-fx-env var(--fx-dur,3000ms) ease-in-out forwards}
.kn-e-screen-fx__fx{position:absolute;inset:0;opacity:var(--fx-i,.4)}
@keyframes kn-fx-env{0%{opacity:0}20%{opacity:1}75%{opacity:1}100%{opacity:0}}
[data-fx=frost-creep] .kn-e-screen-fx__fx{background:radial-gradient(ellipse at 50% 55%,transparent 36%,color-mix(in srgb,var(--dna-accent-2,#bfe3ff) 60%,var(--dna-ink,#fff)) 100%),repeating-conic-gradient(from 0deg at 50% 50%,color-mix(in srgb,var(--dna-ink,#fff) 14%,transparent) 0 2deg,transparent 2deg 11deg)}
[data-fx=blood-pulse] .kn-e-screen-fx__fx{background:radial-gradient(ellipse at 50% 50%,transparent 38%,var(--dna-warn,#b3202a) 100%)}
[data-fx=crt-scanlines] .kn-e-screen-fx__fx{inset:-6px 0;background:repeating-linear-gradient(to bottom,transparent 0 3px,color-mix(in srgb,var(--dna-bg,#000) 70%,transparent) 3px 6px),radial-gradient(ellipse at 50% 50%,transparent 55%,color-mix(in srgb,var(--dna-accent,#4fd1c5) 30%,transparent) 100%)}
[data-fx=spotlight] .kn-e-screen-fx__fx{background:radial-gradient(circle at 50% 42%,transparent 0 16%,color-mix(in srgb,var(--dna-bg,#050507) 92%,transparent) 58%)}
[data-fx=sepia-flash] .kn-e-screen-fx__fx{background:color-mix(in srgb,var(--dna-warn,#d9a35f) 60%,transparent)}
[data-fx=rain-streaks] .kn-e-screen-fx__fx{inset:-20%;background:repeating-linear-gradient(90deg,transparent 0 13px,color-mix(in srgb,var(--dna-ink,#cfe) 45%,transparent) 13px 14px);-webkit-mask-image:repeating-linear-gradient(to bottom,transparent 0 50px,#000 50px 90px);mask-image:repeating-linear-gradient(to bottom,transparent 0 50px,#000 50px 90px);transform:rotate(8deg)}
[data-fx=sepia-flash]{animation-name:kn-fx-slow}
@keyframes kn-fx-slow{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
[data-tier=high][data-fx=blood-pulse] .kn-e-screen-fx__fx{animation:kn-fx-beat 1.6s ease-in-out infinite}
[data-tier=high][data-fx=crt-scanlines] .kn-e-screen-fx__fx{animation:kn-fx-scan 1s steps(6) infinite}
[data-tier=high][data-fx=rain-streaks] .kn-e-screen-fx__fx{animation:kn-fx-rain .9s linear infinite}
@keyframes kn-fx-beat{0%,100%{opacity:calc(var(--fx-i) * .5)}50%{opacity:var(--fx-i)}}
@keyframes kn-fx-scan{from{transform:translateY(0)}to{transform:translateY(6px)}}
@keyframes kn-fx-rain{from{transform:rotate(8deg) translateY(0)}to{transform:rotate(8deg) translateY(90px)}}
@media (prefers-reduced-motion:reduce){.kn-e-screen-fx__ov{display:none}}`;
