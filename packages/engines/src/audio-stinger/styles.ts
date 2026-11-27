// Scoped CSS for audio-stinger: a quiet caption with an optional sonic-pulse hairline.
export const CSS = `
.kn-e.kn-e-audio-stinger{padding:8px 14px;margin:.8em 0}
.kn-e-audio-stinger__cap{display:flex;align-items:baseline;gap:8px;min-width:0;font-size:.9em;font-style:italic;color:var(--dna-muted,#b4b4b4)}
.kn-e-audio-stinger__ico{flex:none;color:var(--kn-e-accent);font-style:normal}
.kn-e-audio-stinger__hair{height:1px;margin-top:6px;overflow:hidden}
.kn-e-audio-stinger__hair i{display:block;height:100%;background:linear-gradient(90deg,transparent,var(--kn-e-accent),transparent);transform:scaleX(0);transform-origin:50% 50%;opacity:0}
.kn-e-audio-stinger.is-pulse[data-tier=high] .kn-e-audio-stinger__hair i{animation:kn-as-pulse 900ms ease-out}
.kn-e-audio-stinger.is-pulse[data-tier=lite] .kn-e-audio-stinger__hair i{animation:kn-as-fade 900ms linear}
.kn-e-audio-stinger[data-tier=reduced] .kn-e-audio-stinger__hair{display:none}
@keyframes kn-as-pulse{0%{transform:scaleX(.05);opacity:.9}100%{transform:scaleX(1);opacity:0}}
@keyframes kn-as-fade{0%{transform:scaleX(1);opacity:.7}100%{transform:scaleX(1);opacity:0}}`;
