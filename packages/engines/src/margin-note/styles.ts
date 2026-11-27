// Scoped CSS for margin-note. Colours come from DNA tokens only.
export const CSS = `
.kn-e.kn-e-margin-note{background:none;border:0;box-shadow:none;padding:2px 0;margin:.5em 0;font-family:inherit}
.kn-e-margin-note__line{margin:0}
.kn-e-margin-note__anchor{display:inline-block;padding:0 2px;background:none;border:0;border-bottom:2px dotted var(--kn-e-accent);color:inherit;font:inherit;text-align:start;overflow-wrap:anywhere}
.kn-e-margin-note--scratch-out .kn-e-margin-note__anchor{border-bottom:0;text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:var(--dna-warn,#f6ad55)}
.kn-e-margin-note--pov-whisper .kn-e-margin-note__anchor{font-style:italic;border-bottom-style:dashed}
.kn-e-margin-note__callout{position:relative;margin:8px 0 0;padding:12px 48px 12px 14px;color:var(--dna-ink,#e6e6e6);font-family:var(--dna-font-diegetic,inherit);overflow-wrap:anywhere}
.kn-e-margin-note__title{display:block;margin-bottom:4px;font-family:var(--dna-font-display,inherit)}
.kn-e-margin-note__text{margin:0;white-space:pre-line}
.kn-e-margin-note__by{display:block;margin-top:6px;color:var(--dna-muted,#b4b4b4)}
.kn-e-margin-note__close{position:absolute;top:0;inset-inline-end:0;background:none;border:0;font-size:1.3em;line-height:1}
.kn-e-margin-note--footnote .kn-e-margin-note__callout{font-size:.88em;border-inline-start:2px solid var(--kn-e-accent);color:var(--dna-muted,#b4b4b4)}
.kn-e-margin-note--lore-card .kn-e-margin-note__callout{background:color-mix(in srgb,var(--dna-surface,#1f2125) 88%,var(--kn-e-accent));border:var(--dna-stroke,1px) solid var(--kn-e-accent);border-radius:var(--dna-radius,10px)}
.kn-e-margin-note--scratch-out .kn-e-margin-note__callout{font-style:italic;border:var(--dna-stroke,1px) dashed var(--dna-warn,#f6ad55);border-radius:4px;transform:rotate(-.4deg)}
.kn-e-margin-note--pov-whisper .kn-e-margin-note__callout{font-style:italic;border-inline-start:1px dotted var(--kn-e-accent);text-shadow:0 0 12px color-mix(in srgb,var(--kn-e-accent) 45%,transparent)}
[data-tier=high] .kn-e-margin-note__callout:not([hidden]){animation:kn-mn-in var(--dna-dur,240ms) var(--dna-ease,ease-out)}
[data-tier=lite] .kn-e-margin-note__callout:not([hidden]){animation:kn-mn-fade var(--dna-dur,240ms) linear}
.kn-e-margin-note.is-nudge .kn-e-margin-note__anchor{animation:kn-mn-nudge 600ms ease-in-out}
[data-paused] .kn-e-margin-note__anchor,[data-paused] .kn-e-margin-note__callout{animation-play-state:paused}
@keyframes kn-mn-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes kn-mn-fade{from{opacity:0}to{opacity:1}}
@keyframes kn-mn-nudge{0%,100%{opacity:1}50%{opacity:.55}}
@media print{.kn-e-margin-note__callout[hidden]{display:block}}`;
