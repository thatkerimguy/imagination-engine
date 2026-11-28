// Scoped CSS for tactile-reveal. Tokens only; motion is transform/opacity and tier-gated.
export const CSS = `
.kn-e-tactile-reveal{text-align:center}
.kn-e-tactile-reveal__prompt{margin:0 0 12px;font-family:var(--dna-font-prose,serif);color:var(--dna-ink,#e6e6e6)}
.kn-e-tactile-reveal__btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:12px;
background:transparent;border:var(--dna-stroke,1px) solid var(--dna-border,currentColor);border-radius:var(--dna-radius,10px);
user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.kn-e-tactile-reveal__stage{position:relative;width:100%;min-height:96px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--dna-radius,10px)}
.kn-e-tactile-reveal__svg{display:block;width:100%;max-width:120px;height:auto}
.kn-e-tactile-reveal__hint{font-size:.85em;color:var(--dna-muted,#b4b4b4)}
.kn-e-tactile-reveal__half{fill:var(--kn-e-accent);transform-origin:50px 50px}
.kn-e-tactile-reveal--wax-seal .kn-e-tactile-reveal__svg{filter:drop-shadow(0 2px 2px rgb(0 0 0/.38)) drop-shadow(0 6px 10px rgb(0 0 0/.22))}
.kn-e-tactile-reveal__stamp{fill:none;stroke:var(--dna-surface,#1f2125);stroke-width:1.6;stroke-dasharray:2.4 2.2;opacity:.5}
.kn-e-tactile-reveal__ring{transition:opacity .2s linear}
.is-open .kn-e-tactile-reveal__ring{opacity:0}
.kn-e-tactile-reveal__rim,.kn-e-tactile-reveal__track,.kn-e-tactile-reveal__print{fill:none;stroke:var(--dna-border,currentColor);stroke-width:2}
.kn-e-tactile-reveal__print{stroke:var(--dna-muted,#b4b4b4);stroke-linecap:round}
.kn-e-tactile-reveal__rim{stroke:var(--dna-surface,#1f2125);opacity:.55}
.kn-e-tactile-reveal__bar{fill:none;stroke:var(--kn-e-accent);stroke-width:4;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100}
.is-holding .kn-e-tactile-reveal__bar,.is-open .kn-e-tactile-reveal__bar{stroke-dashoffset:0}
.kn-e-tactile-reveal__peek{font-family:var(--dna-font-display,serif);font-size:2em;color:var(--dna-muted,#b4b4b4)}
.kn-e-tactile-reveal__cover{position:absolute;inset:0;pointer-events:none}
.kn-e-tactile-reveal--scratch-off .kn-e-tactile-reveal__cover{background:repeating-linear-gradient(45deg,var(--dna-surface-alt,#2a2d33) 0 6px,var(--dna-border,#444) 6px 7px)}
.kn-e-tactile-reveal--fog-wipe .kn-e-tactile-reveal__cover{background:color-mix(in srgb,var(--dna-surface-alt,#2a2d33) 82%,transparent);backdrop-filter:blur(8px)}
.kn-e-tactile-reveal__region{margin-top:14px;text-align:left;font-family:var(--dna-font-prose,serif)}
.kn-e-tactile-reveal__title{margin:0 0 6px;font-family:var(--dna-font-display,serif);font-size:1.15em;color:var(--kn-e-accent)}
.kn-e-tactile-reveal__region p{margin:.4em 0}
.kn-e-tactile-reveal__region[hidden]{display:none}
.is-open .kn-e-tactile-reveal__half-l{transform:translate(-18px,6px) rotate(-14deg);opacity:0}
.is-open .kn-e-tactile-reveal__half-r{transform:translate(18px,6px) rotate(14deg);opacity:0}
.is-open .kn-e-tactile-reveal__cover{opacity:0!important}
[data-tier=lite].is-open .kn-e-tactile-reveal__stage,[data-tier=reduced].is-open .kn-e-tactile-reveal__stage{display:none}
[data-tier=high] .kn-e-tactile-reveal__half{transition:transform calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out),opacity calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out)}
[data-tier=high] .kn-e-tactile-reveal__bar{transition:stroke-dashoffset 160ms ease-out}
[data-tier=high].is-holding .kn-e-tactile-reveal__bar{transition:stroke-dashoffset 650ms linear}
[data-tier=high] .kn-e-tactile-reveal__cover{transition:opacity var(--dna-dur,240ms) var(--dna-ease,ease-out)}
[data-tier=high].is-cue .kn-e-tactile-reveal__btn{animation:kn-tr-cue 600ms ease-in-out 1}
@keyframes kn-tr-cue{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`;
