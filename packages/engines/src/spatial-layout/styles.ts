// Scoped CSS for spatial-layout: one column at 360 px, two synchronized columns at >= 520 px.
export const CSS = `
.kn-e.kn-e-spatial-layout{container:kn-sl/inline-size;overflow-x:clip}
.kn-e-spatial-layout__grid{position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}
.kn-e-spatial-layout__head{display:none}
.kn-e-spatial-layout__cell{min-width:0;overflow-wrap:anywhere;margin-inline-start:min(calc(var(--ind,0) * 1ch),12%)}
.kn-e-spatial-layout__cell p{margin:0;white-space:pre-line;min-width:0}
.kn-e-spatial-layout__tag{display:block;font-size:.72em;letter-spacing:.08em;text-transform:uppercase;color:var(--dna-muted,#b4b4b4)}
.kn-e-spatial-layout--dual-pov .kn-e-spatial-layout__cell,.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__cell{padding-inline-start:10px;border-inline-start:2px solid var(--dna-muted,#b4b4b4)}
.kn-e-spatial-layout__cell[data-col=right]{border-inline-start-color:var(--kn-e-accent)!important}
.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__grid{gap:14px}
.kn-e-spatial-layout--falling-lines .kn-e-spatial-layout__cell{font-family:var(--dna-font-display,inherit)}
.kn-e-spatial-layout--staggered-echo .kn-e-spatial-layout__cell:nth-child(even){opacity:.8}
[data-tier=high] .kn-e-spatial-layout__cell{animation:kn-sl-in calc(var(--dna-dur,240ms) * 1.5) var(--dna-ease,ease-out) both;animation-delay:var(--d,0ms)}
[data-tier=lite] .kn-e-spatial-layout__cell{animation:kn-sl-fade var(--dna-dur,240ms) linear both}
[data-paused] .kn-e-spatial-layout__cell{animation-play-state:paused}
@keyframes kn-sl-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes kn-sl-fade{from{opacity:0}to{opacity:1}}
@container kn-sl (min-width:520px){
.kn-e-spatial-layout--dual-pov .kn-e-spatial-layout__grid,.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__grid{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:22px}
.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__grid{column-gap:40px}
.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__grid::before{content:'';position:absolute;inset-block:0;inset-inline-start:50%;border-inline-start:1px solid var(--kn-e-accent)}
.kn-e-spatial-layout__head{display:grid;grid-column:1/-1;grid-template-columns:subgrid;font-size:.78em;letter-spacing:.1em;text-transform:uppercase;color:var(--kn-e-accent)}
.kn-e-spatial-layout--dual-pov .kn-e-spatial-layout__cell,.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__cell{margin-inline-start:0}
.kn-e-spatial-layout__cell[data-col=left]{grid-column:1}
.kn-e-spatial-layout__cell[data-col=right]{grid-column:2}
.kn-e-spatial-layout__cell[data-col=center]{grid-column:1/-1;text-align:center}
.kn-e-spatial-layout--dual-pov .kn-e-spatial-layout__tag,.kn-e-spatial-layout--split-timeline .kn-e-spatial-layout__tag{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.kn-e-spatial-layout--staggered-echo .kn-e-spatial-layout__cell,.kn-e-spatial-layout--falling-lines .kn-e-spatial-layout__cell{margin-inline-start:min(calc(var(--ind,0) * 1.5ch),60%)}
}`;
