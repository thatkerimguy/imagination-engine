// Scoped CSS for particle-field: a bounded canvas band (or fixed backdrop) and the calm still form.
export const CSS = `
.kn-e.kn-e-particle-field{background:none;border:0;box-shadow:none;padding:0;margin:1em 0}
.kn-e-particle-field__band{position:relative;height:120px;overflow:hidden;pointer-events:none}
.kn-e-particle-field__canvas{display:block;width:100%;height:100%}
.kn-e-particle-field__back{position:fixed;inset:0;z-index:0;pointer-events:none}
.kn-e-particle-field__hair{display:none;height:1px;margin:28px 12% 14px;background:linear-gradient(90deg,transparent,var(--kn-e-accent),transparent)}
.kn-e-particle-field__cap{margin:6px 0 0;text-align:center;font-size:.85em;letter-spacing:.04em;color:var(--dna-muted,#b4b4b4)}
.kn-e-particle-field[data-still=true] .kn-e-particle-field__band,.kn-e-particle-field[data-still=true] .kn-e-particle-field__back{display:none}
.kn-e-particle-field[data-still=true] .kn-e-particle-field__hair{display:block}`;
