// chat-thread CSS: tokens only. Four layouts share one list; pending lines are hidden.
export const CSS = `
.kn-e-chat-thread__hdr{display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:space-between;font-size:.78em;
letter-spacing:.12em;text-transform:uppercase;color:var(--kn-e-accent);margin-bottom:.6em}
.kn-e-chat-thread__enc{color:var(--dna-muted)}
.kn-e-chat-thread[data-enc=spoofed] .kn-e-chat-thread__enc{color:var(--dna-warn,var(--kn-e-accent))}
.kn-e-chat-thread__lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5em}
.kn-e-chat-thread__line{display:flex;flex-wrap:wrap;gap:2px 8px;transition:opacity .25s var(--dna-ease,ease)}
.kn-e-chat-thread__line[data-pending]{display:none}
.kn-e-chat-thread[data-tier=lite] .kn-e-chat-thread__line{animation:kn-ct-in .25s var(--dna-ease,ease) both}
.kn-e-chat-thread[data-tier=high] .kn-e-chat-thread__line{animation:kn-ct-in .3s var(--dna-ease,ease) both}
@keyframes kn-ct-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.kn-e-chat-thread__meta{color:var(--kn-e-accent);font-size:.82em;white-space:normal}
.kn-e-chat-thread__text{min-width:0;flex:1 1 12em}
.kn-e-chat-thread__line[data-side=system]{justify-content:center;color:var(--dna-muted);font-size:.85em;text-align:center}
.kn-e-chat-thread--cyber-link .kn-e-chat-thread__text{font-family:var(--dna-font-diegetic,monospace)}
.kn-e-chat-thread--cyber-link .kn-e-chat-thread__meta::after{content:' >'}
.kn-e-chat-thread--sms .kn-e-chat-thread__line{flex-direction:column;align-items:flex-start;max-width:85%}
.kn-e-chat-thread--sms .kn-e-chat-thread__line[data-side=right]{align-self:flex-end;align-items:flex-end}
.kn-e-chat-thread--sms .kn-e-chat-thread__text{flex:0 1 auto;padding:8px 12px;border-radius:calc(var(--dna-radius,10px) * 2);
background:var(--dna-surface-alt,var(--dna-surface));border:var(--dna-stroke,1px) solid var(--dna-border,transparent)}
.kn-e-chat-thread--sms [data-side=right] .kn-e-chat-thread__text{background:color-mix(in srgb,var(--kn-e-accent) 28%,var(--dna-surface))}
.kn-e-chat-thread--sms .kn-e-chat-thread__meta{color:var(--dna-muted)}
.kn-e-chat-thread__typing{display:inline-flex;gap:4px;padding:8px 12px;border-radius:calc(var(--dna-radius,10px) * 2);
background:var(--dna-surface-alt,var(--dna-surface));align-self:flex-start}
.kn-e-chat-thread__typing i{width:6px;height:6px;border-radius:50%;background:var(--dna-muted);animation:kn-ct-dot 1.2s ease-in-out infinite}
.kn-e-chat-thread__typing i:nth-child(2){animation-delay:.2s}.kn-e-chat-thread__typing i:nth-child(3){animation-delay:.4s}
@keyframes kn-ct-dot{0%,100%{opacity:.25}50%{opacity:1}}
.kn-e-chat-thread--telepathy{text-align:center;font-family:var(--dna-font-prose,serif)}
.kn-e-chat-thread--telepathy .kn-e-chat-thread__line{justify-content:center;font-style:italic;opacity:.85}
.kn-e-chat-thread--telepathy .kn-e-chat-thread__line:nth-child(even){padding-inline-start:12%}
.kn-e-chat-thread--telepathy .kn-e-chat-thread__line:nth-child(odd){padding-inline-end:12%}
.kn-e-chat-thread--telepathy .kn-e-chat-thread__text{text-shadow:0 0 12px var(--kn-e-accent);flex:0 1 auto}
.kn-e-chat-thread--telepathy .kn-e-chat-thread__meta{display:none}
.kn-e-chat-thread--intercom .kn-e-chat-thread__meta{text-transform:uppercase;letter-spacing:.08em}
.kn-e-chat-thread--intercom .kn-e-chat-thread__meta::before{content:'[' attr(data-time) '] '}
.kn-e-chat-thread--intercom .kn-e-chat-thread__meta::after{content:':'}
.kn-e-chat-thread--intercom .kn-e-chat-thread__meta[data-time='']::before{content:none}
`;
