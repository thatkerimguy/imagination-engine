// Scoped CSS for bespoke-3d's inline card: caption, throw control, result badge and the lite
// CSS dice tumble. The 3D spectacle itself lives on the shared fixed WebGL stage.
export const CSS = `
.kn-e-bespoke-3d__cap{margin:0;font-family:var(--dna-font-prose,serif);color:var(--dna-muted)}
.kn-e-bespoke-3d__go{margin-top:10px;padding:6px 16px;background:transparent;color:var(--kn-e-accent);
border:var(--dna-stroke,1px) solid var(--kn-e-accent);border-radius:var(--dna-radius,8px);letter-spacing:.06em}
.kn-e-bespoke-3d__go[hidden]{display:none}
.kn-e-bespoke-3d__result{margin:10px 0 0;font-family:var(--dna-font-diegetic,monospace);color:var(--dna-ink);
letter-spacing:.04em;opacity:0;transition:opacity var(--dna-dur,320ms) var(--dna-ease,ease)}
.kn-e-bespoke-3d[data-state=done] .kn-e-bespoke-3d__result{opacity:1}
.kn-e-bespoke-3d__tray{display:flex;gap:12px;justify-content:center;min-height:0;margin-top:10px}
.kn-e-bespoke-3d__tray:empty{display:none}
.kn-e-bespoke-3d__die{position:relative;width:44px;height:44px;border-radius:9px;background:var(--kn-e-die,#e6dfd1);
box-shadow:inset 0 -3px 0 rgb(0 0 0/.18),0 3px 8px rgb(0 0 0/.3);animation:kn-e-b3d-tumble .9s var(--dna-ease,ease-out) both}
.kn-e-bespoke-3d__pip{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--kn-e-pip,#1d1a17)}
@keyframes kn-e-b3d-tumble{0%{transform:translate(-60px,-24px) rotate(-200deg);opacity:0}
60%{transform:translate(6px,4px) rotate(14deg);opacity:1}100%{transform:none}}`;
