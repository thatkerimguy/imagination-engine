// Scoped CSS for kinetic-prose: reads as prose on the page, not as a card.
export const CSS = `
.kn-e.kn-e-kinetic-prose{padding:0;background:none;box-shadow:none;border-radius:0;font-family:var(--dna-font-prose,Georgia,serif);
font-size:1.08em;line-height:1.7;color:var(--dna-ink,#e6e6e6);margin:1.2em 0}
.kn-e.kn-e-kinetic-prose[data-border]{border:0;box-shadow:none}
.kn-e-kinetic-prose .kn-e-body{position:relative}
.kn-e-kinetic-prose__layer{margin:0}
.kn-e-kinetic-prose__em{color:var(--kn-e-accent);font-style:italic}
.kn-e-kinetic-prose--shiver .kn-e-kinetic-prose__w,.kn-e-kinetic-prose--sink .kn-e-kinetic-prose__w{display:inline-block}
.kn-e-kinetic-prose__cap{float:left;font-family:var(--dna-font-display,serif);font-size:3.2em;line-height:.85;padding:.04em .08em 0 0;color:var(--kn-e-accent)}
.kn-e-kinetic-prose__ghost{position:absolute;inset:0;pointer-events:none;color:var(--kn-e-accent);opacity:0}
.kn-e-kinetic-prose[data-state=idle] .kn-e-kinetic-prose__ghost{opacity:.35;transform:translate(.07em,.05em)}
.kn-e-kinetic-prose.is-typing .kn-e-kinetic-prose__c:not(.on){opacity:0}
[data-tier=lite].kn-e-kinetic-prose--typewriter[data-state=idle] .kn-e-kinetic-prose__layer{opacity:0}
[data-tier=lite].kn-e-kinetic-prose--typewriter .kn-e-kinetic-prose__layer{transition:opacity calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out)}
[data-tier=high].kn-e-kinetic-prose--drop-cap[data-state=idle] .kn-e-kinetic-prose__cap,
[data-tier=lite].kn-e-kinetic-prose--drop-cap[data-state=idle] .kn-e-kinetic-prose__cap{opacity:0;transform:scale(.7)}
[data-tier=high] .kn-e-kinetic-prose__cap,[data-tier=lite] .kn-e-kinetic-prose__cap{transform-origin:0 0;transition:opacity calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out),transform calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out)}
[data-tier=high] .kn-e-kinetic-prose__ghost,[data-tier=lite] .kn-e-kinetic-prose__ghost{transition:opacity 900ms var(--dna-ease,ease-out),transform 900ms var(--dna-ease,ease-out)}
.kn-e-kinetic-prose--sink[data-state=idle] .kn-e-kinetic-prose__w{opacity:0;transform:translateY(-.5em)}
[data-tier=high] .kn-e-kinetic-prose--sink .kn-e-kinetic-prose__w,[data-tier=lite] .kn-e-kinetic-prose--sink .kn-e-kinetic-prose__w{
transition:opacity calc(var(--dna-dur,240ms)*1.6) var(--dna-ease,ease-out),transform calc(var(--dna-dur,240ms)*2) var(--dna-ease,ease-out);transition-delay:var(--d,0ms)}
[data-tier=high].kn-e-kinetic-prose--sink[data-state=idle] .kn-e-kinetic-prose__w,[data-tier=lite].kn-e-kinetic-prose--sink[data-state=idle] .kn-e-kinetic-prose__w{transition:none}
.kn-e-kinetic-prose--shiver:not([data-state=idle]) .kn-e-kinetic-prose__w{animation:kn-kp-shiver 1.7s ease-in-out infinite;animation-delay:calc(var(--i,0) * -190ms)}
.kn-e-kinetic-prose--pulse:not([data-state=idle]) .kn-e-kinetic-prose__pt{display:inline-block;transform-origin:left center;animation:kn-kp-pulse 3.4s ease-in-out infinite}
.kn-e-kinetic-prose[data-paused=true] *{animation-play-state:paused!important}
@keyframes kn-kp-shiver{0%,100%{transform:translate(0,0)}25%{transform:translate(.5px,-.4px)}50%{transform:translate(-.4px,.3px)}75%{transform:translate(.3px,.5px)}}
@keyframes kn-kp-pulse{0%,100%{opacity:.72;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}`;
