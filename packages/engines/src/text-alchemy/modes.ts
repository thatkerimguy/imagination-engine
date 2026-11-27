// The four text-alchemy mechanics. Each takes the shared env and returns a small run object;
// all author text is written with textContent only.
import type { EngineRuntimeContext } from '@kn/core/gimmicks';
import { actionButton, cls, el } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { isStill } from '../shared/kit.ts';

export interface AlchemyEnv {
  ctx: EngineRuntimeContext;
  root: HTMLElement;
  body: HTMLElement;
  initial: string;
  altered: string;
  hint: string;
  cancels: Array<() => void>;
  onLand(): void;
}
export interface ModeRun {
  trigger(): Promise<void>;
  /** Called after a live tier change; rebuilds controls and finishes motion when still. */
  sync(): void;
}
const c = (part: string): string => cls('text-alchemy', part);
const GLYPHS = '#%&@$*+=?<>/';
const done = (): Promise<void> => Promise.resolve();

function toggle(e: AlchemyEnv, label: string, get: () => boolean, set: (v: boolean) => void) {
  const b = actionButton(
    label,
    () => (set(!get()), b.setAttribute('aria-pressed', String(get()))),
    e.ctx.signal,
    { class: c('btn'), 'aria-pressed': String(get()) },
    label,
  );
  return b;
}

export function gaslight(e: AlchemyEnv): ModeRun {
  const text = el('p', { class: c('text') }, e.initial);
  const ctl = el('div', { class: c('ctl') });
  e.body.append(text, ctl);
  let alt = false;
  let armed = false;
  let out = false;
  const paint = (): void => void (text.textContent = alt ? e.altered : e.initial);
  const swap = (): void => {
    if (alt) return;
    alt = true;
    if (isStill(e.ctx) || e.ctx.tier === 'lite') return (paint(), sync());
    text.dataset.fade = 'out';
    e.cancels.push(e.ctx.timeout(() => (paint(), delete text.dataset.fade, sync()), 220));
  };
  const sync = (): void => {
    ctl.replaceChildren();
    if (isStill(e.ctx)) {
      ctl.append(
        toggle(
          e,
          e.hint || 'Compare versions',
          () => alt,
          (v) => ((alt = v), paint()),
        ),
      );
    } else if (!alt)
      ctl.append(actionButton(rt('lookAgain'), swap, e.ctx.signal, { class: c('btn') }, rt('lookAgain')));
  };
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!armed || isStill(e.ctx)) continue;
        if (!en.isIntersecting) out = true;
        else if (out) {
          io.disconnect();
          swap();
        }
      }
    });
    io.observe(e.root);
    e.ctx.signal.addEventListener('abort', () => io.disconnect(), { once: true });
  }
  sync();
  return { trigger: () => ((armed = true), done()), sync };
}

export function whisper(e: AlchemyEnv): ModeRun {
  const text = el('p', { class: c('text') }, e.initial);
  const ghost = el('p', { class: c('ghost'), 'aria-hidden': 'true' }, e.altered);
  const stack = el('div', { class: c('stack') }, text, ghost);
  let pinned = false;
  let held = false;
  const apply = (): void => {
    const on = pinned || held;
    e.root.dataset.ghost = on ? 'on' : 'off';
    ghost.setAttribute('aria-hidden', String(!on));
  };
  const hold = (v: boolean) => (): void => ((held = v), apply());
  for (const [ev, v] of [
    ['pointerdown', true],
    ['pointerup', false],
    ['pointercancel', false],
    ['pointerleave', false],
  ] as const) {
    stack.addEventListener(ev, hold(v), { signal: e.ctx.signal });
  }
  const btn = toggle(
    e,
    e.hint || rt('holdToListen'),
    () => pinned,
    (v) => ((pinned = v), apply()),
  );
  e.body.append(stack, el('div', { class: c('ctl') }, btn));
  apply();
  return { trigger: done, sync: () => undefined };
}

export function redact(e: AlchemyEnv): ModeRun {
  const para = el('p', { class: c('text') });
  const bars: Array<{ bar: HTMLElement; phrase: string }> = [];
  const still = isStill(e.ctx);
  e.initial.split(/\[\[(.+?)\]\]/g).forEach((part, i) => {
    if (i % 2 === 0) return void (part && para.append(part));
    if (still) return void para.append(el('span', { class: c('rev') }, part));
    const bar = actionButton(
      rt('revealRedacted'),
      () => open(bar, part, false),
      e.ctx.signal,
      { class: c('bar') },
      part,
    );
    bars.push({ bar, phrase: part });
    para.append(bar);
  });
  const open = (bar: HTMLElement, phrase: string, instant: boolean): void => {
    if (instant) return bar.replaceWith(el('span', { class: c('rev') }, phrase));
    bar.setAttribute('data-revealed', '');
    bar.setAttribute('aria-label', `Revealed: ${phrase}`);
  };
  e.body.append(para);
  if (e.hint) e.body.append(el('p', { class: c('hint') }, e.hint));
  return {
    trigger: done,
    sync: () => isStill(e.ctx) && bars.splice(0).forEach((b) => open(b.bar, b.phrase, true)),
  };
}

export function cipher(e: AlchemyEnv): ModeRun {
  const text = el('p', { class: c('text') });
  const scr = (s: string, tick: number): string =>
    [...s].map((ch, i) => (/\s/.test(ch) ? ch : GLYPHS[(i * 7 + tick) % GLYPHS.length]!)).join('');
  let settle: (() => void) | null = null;
  let run: Promise<void> | null = null;
  const end = (): void => {
    e.cancels.splice(0).forEach((f) => f());
    text.textContent = e.altered;
    e.onLand();
    const s = settle;
    settle = null;
    s?.();
  };
  text.textContent = isStill(e.ctx) ? e.altered : scr(e.altered, 0);
  e.body.append(text);
  return {
    trigger() {
      if (isStill(e.ctx)) return (end(), done());
      if (run) return run;
      const len = [...e.altered].length;
      const ticks = Math.max(1, Math.min(len, 13));
      const per = Math.ceil(len / ticks);
      let k = 0;
      run = new Promise<void>((resolve) => {
        settle = resolve;
        e.cancels.push(
          e.ctx.interval(() => {
            k += per;
            if (k >= len) return end();
            const chars = [...e.altered];
            text.textContent = chars.slice(0, k).join('') + scr(chars.slice(k).join(''), k);
          }, 45),
        );
      });
      return run;
    },
    sync: () => isStill(e.ctx) && end(),
  };
}
