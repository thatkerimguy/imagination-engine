// artifact-doc CSS: tokens only. The surface tile comes from the frame; layouts add structure.
export const CSS = `
.kn-e-artifact-doc{font-family:var(--dna-font-prose,serif)}
.kn-e-artifact-doc__top{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between;align-items:baseline}
.kn-e-artifact-doc__ref{font-family:var(--dna-font-diegetic,monospace);font-size:.78em;letter-spacing:.12em;color:var(--dna-muted)}
.kn-e-artifact-doc__heading{margin:.4em 0;font-family:var(--dna-font-display,serif);font-size:1.25em;line-height:1.25;color:var(--dna-ink)}
.kn-e-artifact-doc__meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin:.5em 0;font-family:var(--dna-font-diegetic,monospace);
font-size:.8em;color:var(--dna-muted)}
.kn-e-artifact-doc__paras{min-width:0}
.kn-e-artifact-doc__paras p{margin:0 0 .8em;color:var(--dna-ink)}
.kn-e-artifact-doc__sig{margin:.8em 0 0;font-style:italic;color:var(--dna-ink);text-align:right}
.kn-e-artifact-doc__stamp{position:absolute;top:10px;right:10px;z-index:2;max-width:55%;padding:2px 10px;text-align:center;
border:calc(var(--dna-stroke,1px) * 2) solid var(--kn-e-accent);border-radius:var(--dna-radius,4px);color:var(--kn-e-accent);
font-family:var(--dna-font-diegetic,monospace);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:.8em;
opacity:.78;pointer-events:none;transform:rotate(-9deg) scale(1);
transition:transform .35s var(--dna-ease,ease),opacity .35s var(--dna-ease,ease)}
.kn-e-artifact-doc[data-state=idle]:not([data-tier=reduced]) .kn-e-artifact-doc__stamp{opacity:0;transform:rotate(-9deg) scale(1.4)}
.kn-e-artifact-doc[data-tier=lite] .kn-e-artifact-doc__stamp{transition:opacity .25s linear;transform:rotate(-9deg)}
.kn-e-artifact-doc--dossier .kn-e-artifact-doc__meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(9em,1fr));
border-block:var(--dna-stroke,1px) solid var(--dna-border,var(--dna-muted));padding:6px 0}
.kn-e-artifact-doc--dossier .kn-e-artifact-doc__top{padding-right:30%}
.kn-e-artifact-doc--diary{padding-left:28px;background-image:var(--kn-e-tile,none),repeating-linear-gradient(to bottom,
transparent 0,transparent 1.55em,color-mix(in srgb,var(--dna-muted) 30%,transparent) 1.55em,color-mix(in srgb,var(--dna-muted) 30%,transparent) calc(1.55em + 1px))}
.kn-e-artifact-doc--diary .kn-e-artifact-doc__paras p{line-height:1.55em;margin:0 0 1.55em}
.kn-e-artifact-doc--diary .kn-e-artifact-doc__meta{font-family:var(--dna-font-prose,serif);font-style:italic}
.kn-e-artifact-doc--diary .kn-e-artifact-doc__stamp{display:none}
.kn-e-artifact-doc--newsprint .kn-e-artifact-doc__top{border-block:calc(var(--dna-stroke,1px) * 3) double var(--dna-ink);padding:4px 0;
text-align:center;justify-content:center}
.kn-e-artifact-doc--newsprint .kn-e-artifact-doc__heading{text-align:center;font-size:1.5em;text-transform:uppercase}
.kn-e-artifact-doc--newsprint .kn-e-artifact-doc__paras{column-width:15em;column-gap:18px;text-align:justify;hyphens:auto}
.kn-e-artifact-doc--ticket .kn-e-artifact-doc__top{flex-direction:column-reverse}
.kn-e-artifact-doc--ticket .kn-e-artifact-doc__paras{border-top:2px dashed var(--dna-border,var(--dna-muted));margin-top:.8em;padding-top:.8em;position:relative}
.kn-e-artifact-doc--ticket .kn-e-artifact-doc__paras::before,.kn-e-artifact-doc--ticket .kn-e-artifact-doc__paras::after{content:'';
position:absolute;top:-9px;width:16px;height:16px;border-radius:50%;background:var(--dna-bg,var(--dna-surface))}
.kn-e-artifact-doc--ticket .kn-e-artifact-doc__paras::before{left:-26px}.kn-e-artifact-doc--ticket .kn-e-artifact-doc__paras::after{right:-26px}
.kn-e-artifact-doc--ticket .kn-e-artifact-doc__ref{font-size:1em;font-weight:700;color:var(--dna-ink)}
.kn-e-artifact-doc--contract .kn-e-artifact-doc__top{border-bottom:var(--dna-stroke,1px) solid var(--dna-ink);padding-bottom:.4em}
.kn-e-artifact-doc--contract .kn-e-artifact-doc__heading{text-align:center;text-transform:uppercase;letter-spacing:.1em;font-size:1.1em}
.kn-e-artifact-doc--contract .kn-e-artifact-doc__sig{margin-top:1.6em;border-top:var(--dna-stroke,1px) solid var(--dna-ink);
padding-top:.3em;max-width:70%;margin-left:auto}
`;
