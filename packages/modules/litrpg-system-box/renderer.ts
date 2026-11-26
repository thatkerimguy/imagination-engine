import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import type { SystemBoxProps } from './schema.ts';
import { playChime } from './sfx.ts';
import { retainStyles } from './styles.ts';

type Ctx = RendererContext<SystemBoxProps>;

const REVEAL_MS = 800;

export default function createRenderer(): ModuleRenderer<SystemBoxProps> {
  let root: HTMLElement | null = null;
  let ctx: Ctx | null = null;
  let releaseStyles: (() => void) | null = null;
  let stopChime: (() => void) | null = null;
  let chimed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const wakers = new Set<() => void>();

  const build = (c: Ctx): void => {
    cleanup();
    ctx = c;
    chimed = false;
    releaseStyles = retainStyles();
    const p = c.props;
    const box = document.createElement('div');
    box.className = 'kn-sb';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', `${p.header} ${p.title}`);
    box.dataset.knVariant = p.variant;
    box.dataset.knTier = c.tier;
    const head = document.createElement('div');
    head.className = 'kn-sb-h';
    head.append(p.header);
    const title = document.createElement('strong');
    title.className = 'kn-sb-t';
    title.textContent = p.title;
    head.append(title);
    const list = document.createElement('ul');
    list.className = 'kn-sb-l';
    for (const line of p.lines) {
      const li = document.createElement('li');
      li.textContent = line;
      list.append(li);
    }
    box.append(head, list);
    root = box;
    c.host.append(box);
    c.signal.addEventListener('abort', cleanup, { once: true });
    if (c.signal.aborted) cleanup();
  };

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const wake = (): void => {
        clearTimeout(id);
        timers.delete(id);
        wakers.delete(wake);
        resolve();
      };
      const id = setTimeout(wake, ms);
      timers.add(id);
      wakers.add(wake);
    });

  function cleanup(): void {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const wake of [...wakers]) wake();
    wakers.clear();
    stopChime?.();
    stopChime = null;
    root?.remove();
    root = null;
    releaseStyles?.();
    releaseStyles = null;
    ctx = null;
  }

  return {
    mount: build,
    reducedMotionFallback: (c) => build({ ...c, tier: 'reduced' }),
    async trigger() {
      const c = ctx;
      if (!c || c.tier === 'reduced') return;
      if (c.props.sound && !chimed) {
        chimed = true;
        stopChime = playChime(c.audio);
      }
      await sleep(c.tier === 'high' ? REVEAL_MS : 300);
    },
    dispose: cleanup,
  };
}
