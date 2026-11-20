import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import type { CyberbrainChatProps } from './schema.ts';
import { retainStyles } from './styles.ts';
import { playChime } from './chime.ts';

const GLYPHS = '01アイウエオカキクケコｱｲｳｴｵ#%&@$<>/\\=+*';

export default function createRenderer(): ModuleRenderer<CyberbrainChatProps> {
  let ctx: RendererContext<CyberbrainChatProps> | null = null;
  let root: HTMLElement | null = null;
  let items: HTMLLIElement[] = [];
  let releaseStyles: (() => void) | null = null;
  const timers = new Set<number>();

  const build = (c: RendererContext<CyberbrainChatProps>, instant: boolean): void => {
    ctx = c;
    releaseStyles = retainStyles();
    const p = c.props;
    root = document.createElement('section');
    const tone = p.encryption === 'AES-Q' ? 'aesq' : p.encryption.toLowerCase();
    root.className = `kn-cbc kn-cbc--${p.side} kn-cbc--${tone}${c.tier === 'reduced' ? '' : ' kn-cbc--motion kn-cbc--live'}`;
    root.setAttribute('role', 'log');
    root.setAttribute('aria-label', `Thought-link from ${p.senderId}, ${p.encryption}`);
    const header = document.createElement('header');
    const id = Object.assign(document.createElement('span'), {
      className: 'id',
      textContent: p.senderId,
    });
    const badge = Object.assign(document.createElement('span'), {
      className: 'badge',
      textContent: p.encryption,
    });
    const sig = Object.assign(document.createElement('span'), { className: 'sig' });
    sig.setAttribute('aria-hidden', 'true');
    sig.append(...Array.from({ length: 4 }, () => document.createElement('i')));
    header.append(id, badge, sig);
    const list = document.createElement('ol');
    items = p.messages.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (!instant) li.className = 'pending';
      return li;
    });
    list.append(...items);
    root.append(header, list);
    c.host.append(root);
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });

  // High tier: each line decrypts from glyph noise to its real text.
  const decrypt = (li: HTMLLIElement, text: string): Promise<void> =>
    new Promise((resolve) => {
      const start = performance.now();
      const duration = Math.min(700, 180 + text.length * 12);
      const frame = (now: number): void => {
        if (!ctx || ctx.signal.aborted) return resolve();
        const t = Math.min(1, (now - start) / duration);
        const shown = Math.floor(text.length * t);
        let out = text.slice(0, shown);
        for (let i = shown; i < text.length; i++) {
          out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        li.textContent = out;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  return {
    mount(c) {
      build(c, false);
    },
    reducedMotionFallback(c) {
      build(c, true);
    },
    async trigger() {
      const c = ctx;
      if (!c || !root) return;
      const p = c.props;
      for (let i = 0; i < items.length; i++) {
        if (c.signal.aborted) return;
        const li = items[i]!;
        if (p.chime) playChime(c.audio, p.encryption, i);
        if (c.tier === 'reduced') continue;
        li.className = 'in';
        if (c.tier === 'high') await decrypt(li, p.messages[i] ?? '');
        if (i < items.length - 1) await wait(p.lineDelay * 1000);
      }
      root.classList.remove('kn-cbc--live');
    },
    dispose() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      root?.remove();
      root = null;
      items = [];
      releaseStyles?.();
      releaseStyles = null;
      ctx = null;
    },
  };
}
