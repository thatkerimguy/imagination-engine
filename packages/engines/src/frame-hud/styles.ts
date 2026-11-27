// frame-hud CSS: tokens only (--dna-*, --kn-e-accent). One transform sweep + staggered fades.
export const CSS = `
.kn-e-frame-hud__hdr{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;
font-size:.78em;letter-spacing:.14em;text-transform:uppercase;color:var(--kn-e-accent)}
.kn-e-frame-hud__badge{border:var(--dna-stroke,1px) solid var(--kn-e-accent);border-radius:var(--dna-radius,6px);
padding:1px 8px;font-weight:700;color:var(--kn-e-accent)}
.kn-e-frame-hud__title{margin:.5em 0 .4em;font-size:1.15em;line-height:1.25;color:var(--dna-ink)}
.kn-e-frame-hud__lines{list-style:none;margin:0;padding:0;display:grid;gap:.3em}
.kn-e-frame-hud__line{color:var(--dna-ink);transition:opacity .3s var(--dna-ease,ease);transition-delay:var(--d,0ms)}
.kn-e-frame-hud__ftr{margin:.7em 0 0;font-size:.82em;color:var(--dna-muted)}
.kn-e-frame-hud__sweep{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:2}
.kn-e-frame-hud__sheen{position:absolute;left:0;right:0;top:0;height:40%;opacity:0;transform:translateY(-110%);
background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--kn-e-accent) 22%,transparent),transparent)}
.kn-e-frame-hud[data-tier=high][data-state=playing] .kn-e-frame-hud__sheen{opacity:1;animation:kn-fh-sweep .8s var(--dna-ease,ease) both}
@keyframes kn-fh-sweep{from{transform:translateY(-110%)}to{transform:translateY(300%)}}
.kn-e-frame-hud[data-paused] *{animation-play-state:paused!important}
.kn-e-frame-hud[data-state=idle]:not([data-tier=reduced]) .kn-e-frame-hud__line{opacity:0}
.kn-e-frame-hud[data-tier=lite] .kn-e-frame-hud__line{transition-duration:.25s;transition-delay:0ms}
.kn-e-frame-hud__ftr:empty,.kn-e-frame-hud__badge:empty{display:none}
.kn-e-frame-hud--system .kn-e-frame-hud__hdr{padding:4px 8px;margin:-4px -6px 0;
background:color-mix(in srgb,var(--kn-e-accent) 16%,transparent);border-radius:var(--dna-radius,6px)}
.kn-e-frame-hud--system .kn-e-frame-hud__line::before,.kn-e-frame-hud--terminal .kn-e-frame-hud__line::before{
content:'> ';color:var(--kn-e-accent)}
.kn-e-frame-hud--terminal .kn-e-frame-hud__line::before{content:'$ '}
.kn-e-frame-hud--terminal .kn-e-frame-hud__hdr{justify-content:flex-start;text-transform:none;letter-spacing:.02em;
border-bottom:var(--dna-stroke,1px) solid var(--kn-e-accent);padding-bottom:6px}
.kn-e-frame-hud--terminal .kn-e-frame-hud__hdr::before{content:'>_';font-weight:700}
.kn-e-frame-hud--bounty{text-align:center}
.kn-e-frame-hud--bounty .kn-e-frame-hud__hdr{justify-content:center;flex-direction:column;font-size:.9em}
.kn-e-frame-hud--bounty .kn-e-frame-hud__hdr::before{content:'\\25C6';font-size:1.6em}
.kn-e-frame-hud--bounty .kn-e-frame-hud__ftr{background:color-mix(in srgb,var(--kn-e-accent) 22%,transparent);
color:var(--dna-ink);padding:8px;border-radius:var(--dna-radius,6px);font-weight:700;font-size:1em}
.kn-e-frame-hud--tarot{max-width:20em;min-height:24em;margin-inline:auto;text-align:center;display:flex}
.kn-e-frame-hud--tarot .kn-e-body{display:flex;flex-direction:column;align-items:center;justify-content:space-between;width:100%}
.kn-e-frame-hud--tarot .kn-e-frame-hud__hdr{flex-direction:column;justify-content:center}
.kn-e-frame-hud--tarot .kn-e-frame-hud__badge{border-radius:999px;min-width:2.6em;font-size:1.3em;order:-1;padding:4px 10px}
.kn-e-frame-hud--tarot .kn-e-frame-hud__title{font-family:var(--dna-font-display,serif);font-size:1.4em}
.kn-e-frame-hud--decree{font-family:var(--dna-font-prose,serif)}
.kn-e-frame-hud--decree .kn-e-frame-hud__hdr,.kn-e-frame-hud--decree .kn-e-frame-hud__title{
font-family:var(--dna-font-display,serif);text-transform:none;letter-spacing:.04em}
.kn-e-frame-hud--decree .kn-e-frame-hud__title{font-size:1.4em;text-align:center;
border-bottom:var(--dna-stroke,1px) solid var(--kn-e-accent);padding-bottom:.4em}
.kn-e-frame-hud--decree .kn-e-frame-hud__ftr{text-align:right;font-style:italic;color:var(--kn-e-accent)}
.kn-e-frame-hud--decree .kn-e-frame-hud__ftr::before{content:'\\2766  '}
`;
