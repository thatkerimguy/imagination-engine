// Scoped CSS for telemetry-meter. Colours come from DNA tokens; `--kn-e-meter` flips to warn.
export const CSS = `
.kn-e-telemetry-meter{--kn-e-meter:var(--kn-e-accent)}
.kn-e-telemetry-meter[data-over=true]{--kn-e-meter:var(--dna-warn,#f6ad55)}
.kn-e-telemetry-meter__head{display:flex;justify-content:space-between;gap:8px;font-size:.8em;letter-spacing:.08em;text-transform:uppercase;color:var(--dna-muted,#b4b4b4)}
.kn-e-telemetry-meter__readout{display:flex;align-items:baseline;gap:6px;margin:2px 0 8px;color:var(--kn-e-meter)}
.kn-e-telemetry-meter__num{font-family:var(--dna-font-display,monospace);font-size:2.2em;line-height:1.1;font-variant-numeric:tabular-nums}
.kn-e-telemetry-meter__unit{font-size:.85em;color:var(--dna-muted,#b4b4b4)}
.kn-e-telemetry-meter__svg{display:block;width:100%;height:auto;overflow:hidden}
.kn-e-telemetry-meter--countdown .kn-e-telemetry-meter__svg,.kn-e-telemetry-meter--radar .kn-e-telemetry-meter__svg,.kn-e-telemetry-meter--compass .kn-e-telemetry-meter__svg{max-width:180px;margin:0 auto}
.kn-e-telemetry-meter__track,.kn-e-telemetry-meter__grid{fill:none;stroke:var(--dna-border,#444);stroke-width:1}
.kn-e-telemetry-meter__track.is-bar{fill:var(--dna-border,#444);stroke:none;opacity:.6}
.kn-e-telemetry-meter__fill{fill:var(--kn-e-accent);transform-box:fill-box;transform-origin:0 50%;transform:scaleX(0)}
.kn-e-telemetry-meter__fill.is-main{fill:var(--kn-e-meter)}
.kn-e-telemetry-meter__t{font:8px var(--dna-font-diegetic,monospace);fill:var(--dna-muted,#b4b4b4)}
.kn-e-telemetry-meter__t.is-n{font-size:7px}
.kn-e-telemetry-meter__arc{fill:none;stroke:var(--kn-e-meter);stroke-width:5;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100}
.kn-e-telemetry-meter__line{fill:none;stroke:var(--kn-e-meter);stroke-width:1.6;stroke-linejoin:round;vector-effect:non-scaling-stroke;transform:scaleY(.04);transform-origin:0 30px}
.kn-e-telemetry-meter__needle{fill:var(--kn-e-meter);transform-origin:50px 50px}
.kn-e-telemetry-meter__sweep{fill:var(--kn-e-accent);opacity:.28}
.kn-e-telemetry-meter__range{fill:none;stroke:var(--kn-e-meter);stroke-width:1.5;stroke-dasharray:3 2;vector-effect:non-scaling-stroke;transform-origin:50px 50px;transform:scale(0)}
.kn-e-telemetry-meter__blip{fill:var(--kn-e-meter)}
[data-tier=lite] .kn-e-telemetry-meter__fill,[data-tier=lite] .kn-e-telemetry-meter__line,[data-tier=lite] .kn-e-telemetry-meter__needle,[data-tier=lite] .kn-e-telemetry-meter__range{transition:transform calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out)}
[data-tier=lite] .kn-e-telemetry-meter__arc{transition:stroke-dashoffset calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out)}`;
