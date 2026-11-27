// Scoped CSS for audio-bed: a calm inline ambient pill.
export const CSS = `
.kn-e.kn-e-audio-bed{display:inline-flex;align-items:center;gap:8px;width:auto;max-width:100%;padding:6px 14px;margin:.8em 0;border-radius:999px;font-size:.85em;letter-spacing:.04em;color:var(--dna-muted,#b4b4b4)}
.kn-e-audio-bed__dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dna-muted,#b4b4b4);opacity:.5}
.kn-e-audio-bed[data-state=playing] .kn-e-audio-bed__dot{background:var(--kn-e-accent);opacity:1;animation:kn-ab-breathe 2.8s ease-in-out infinite}
.kn-e-audio-bed[data-state=muted]{opacity:.7}
.kn-e-audio-bed__text{min-width:0;overflow-wrap:anywhere}
@keyframes kn-ab-breathe{0%,100%{opacity:.45}50%{opacity:1}}`;
