// chat-thread: a message thread that lands one line per beat. Reduced / Calm shows every line at
// once; high adds a 120 ms glyph scramble (cyber-link) or typing dots (sms) between messages.
import { propNumber, propRecords, propText, type GimmickEngine } from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const LAYOUTS = ['cyber-link', 'sms', 'telepathy', 'intercom'] as const;
const ENC: Record<string, string> = {
  'aes-q': 'AES-Q ENCRYPTED',
  open: 'OPEN CHANNEL',
  spoofed: 'SIGNAL SPOOFED',
};
const GLYPHS = '#%&@$*+=?<>/';
const c = (part: string): string => cls('chat-thread', part);

const scramble = (s: string, tick: number): string =>
  [...s]
    .map((ch, i) => (/\s/.test(ch) ? ch : GLYPHS[(i * 5 + tick * 3) % GLYPHS.length]!))
    .join('');

export const chatThreadEngine: GimmickEngine = {
  id: 'chat-thread',
  mount(host, blueprint, props, ctx) {
    injectEngineStyle('chat-thread', CSS);
    const layout = variantOf(blueprint, props, 'layout', LAYOUTS);
    const channel = propText(props, 'channel');
    const enc = propText(props, 'encryption', 'open');
    const gap = Math.max(0.4, propNumber(props, 'lineDelay', 1.2)) * 1000;
    const { root, body } = mountFrame(host, blueprint, ctx, { layout, label: channel });
    root.dataset.enc = enc;
    const messages = propRecords(props, 'messages').map((m) => ({
      sender: String(m.sender ?? ''),
      text: String(m.text ?? ''),
      side: String(m.side ?? 'left'),
      time: String(m.time ?? ''),
    }));
    const items = messages.map((m) => {
      const meta = el('span', { class: c('meta'), 'data-time': m.time }, m.sender);
      const text = el('span', { class: c('text') }, m.text);
      const li = el(
        'li',
        { class: c('line'), 'data-side': m.side, 'data-pending': '' },
        meta,
        text,
      );
      return { li, text, full: m.text };
    });
    const list = el('ul', { class: c('lines'), role: 'log', 'aria-label': channel || undefined });
    list.append(...items.map((i) => i.li));
    body.append(
      el(
        'div',
        { class: c('hdr') },
        el('span', {}, channel),
        el('span', { class: c('enc') }, ENC[enc] ?? enc),
      ),
      list,
    );

    let settle: (() => void) | null = null;
    let run: Promise<void> | null = null;
    let cancels: Array<() => void> = [];
    let typing: HTMLElement | null = null;
    const clear = (): void => {
      cancels.forEach((f) => f());
      cancels = [];
      typing?.remove();
      typing = null;
    };
    const finish = (): void => {
      clear();
      for (const it of items) {
        it.li.removeAttribute('data-pending');
        it.text.textContent = it.full;
      }
      root.dataset.state = 'done';
      const s = settle;
      settle = null;
      s?.();
    };
    const chime = (): void => {
      if (isStill(ctx) || props.sound === false || !blueprint.sound) return;
      const { patch, gain, pitchShift } = blueprint.sound;
      ctx.audio.stinger(patch, { gain, pitchShift });
    };
    const reveal = (i: number): number => {
      const it = items[i]!;
      it.li.removeAttribute('data-pending');
      chime();
      if (layout !== 'cyber-link' || ctx.tier !== 'high') return 0;
      let tick = 0;
      it.text.textContent = scramble(it.full, tick);
      const stop = ctx.interval(() => {
        tick++;
        it.text.textContent = tick >= 3 ? it.full : scramble(it.full, tick);
        if (tick >= 3) stop();
      }, 40);
      cancels.push(stop);
      return 120;
    };
    const step = (i: number): void => {
      typing?.remove();
      typing = null;
      const land = reveal(i);
      if (i + 1 >= items.length) {
        if (land) cancels.push(ctx.timeout(finish, land));
        else finish();
        return;
      }
      const dots = layout === 'sms' && ctx.tier === 'high' ? Math.min(700, gap * 0.6) : 0;
      if (dots) {
        cancels.push(
          ctx.timeout(() => {
            typing = el(
              'li',
              { class: c('typing'), 'aria-hidden': 'true' },
              el('i'),
              el('i'),
              el('i'),
            );
            list.append(typing);
          }, gap - dots),
        );
      }
      cancels.push(ctx.timeout(() => step(i + 1), gap));
    };

    if (isStill(ctx)) finish();
    ctx.onTierChange(() => isStill(ctx) && finish());
    return {
      trigger() {
        if (isStill(ctx) || root.dataset.state === 'done' || items.length === 0) {
          finish();
          return Promise.resolve();
        }
        if (run) return run;
        root.dataset.state = 'playing';
        run = new Promise<void>((resolve) => {
          settle = resolve;
          step(0);
        });
        return run;
      },
      destroy() {
        clear();
        settle?.();
        settle = null;
        root.remove();
      },
    };
  },
};

export default chatThreadEngine;
