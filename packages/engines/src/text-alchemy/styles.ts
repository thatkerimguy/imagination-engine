// text-alchemy CSS: tokens only. Four modes, one text surface, small native controls.
export const CSS = `
.kn-e-text-alchemy__text{margin:0;font-family:var(--dna-font-prose,serif);font-size:1.05em;line-height:1.6;
color:var(--dna-ink);transition:opacity .22s var(--dna-ease,ease)}
.kn-e-text-alchemy__text[data-fade=out]{opacity:0}
.kn-e-text-alchemy__ctl{margin-top:.6em;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.kn-e-text-alchemy__btn{background:transparent;border:var(--dna-stroke,1px) solid var(--kn-e-accent);
border-radius:var(--dna-radius,6px);padding:4px 12px;font-size:.8em;letter-spacing:.06em;color:var(--kn-e-accent)}
.kn-e-text-alchemy__btn[aria-pressed=true]{background:color-mix(in srgb,var(--kn-e-accent) 20%,transparent)}
.kn-e-text-alchemy__hint{margin:.5em 0 0;font-size:.8em;color:var(--dna-muted)}
.kn-e-text-alchemy__stack{position:relative;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.kn-e-text-alchemy__ghost{position:absolute;inset:0;margin:0;padding:3px 0 0 6px;font-family:var(--dna-font-prose,serif);
font-size:1.05em;line-height:1.6;font-style:italic;color:var(--kn-e-accent);opacity:0;pointer-events:none;
transition:opacity .4s var(--dna-ease,ease)}
.kn-e-text-alchemy[data-ghost=on] .kn-e-text-alchemy__ghost{opacity:.85}
.kn-e-text-alchemy--whisper .kn-e-text-alchemy__text{color:var(--dna-muted)}
.kn-e .kn-e-text-alchemy__bar{display:inline;padding:0 2px;border:0;border-radius:2px;min-height:0!important;min-width:0!important;
font:inherit;color:transparent;background-color:var(--dna-redact-bg,var(--dna-ink));
background-image:var(--dna-redact-hatch,none);box-shadow:inset 0 0 0 1px var(--dna-redact-border,transparent);cursor:pointer;
transition:background .35s var(--dna-ease,ease),color .35s var(--dna-ease,ease)}
.kn-e .kn-e-text-alchemy__bar[data-revealed]{color:var(--dna-ink);background-image:none;box-shadow:none;background-color:color-mix(in srgb,var(--kn-e-accent) 18%,transparent);cursor:default}
.kn-e-text-alchemy__rev{background:color-mix(in srgb,var(--kn-e-accent) 18%,transparent);padding:0 2px}
.kn-e-text-alchemy--cipher .kn-e-text-alchemy__text{font-family:var(--dna-font-diegetic,monospace);letter-spacing:.06em}
`;
