import { createTranslator, type Locale } from '@ie/i18n';
import { average, formatMs, percentile } from './format.ts';
import { diagnosticsMessages } from './messages.ts';

interface ChromeMemory {
  usedJSHeapSize: number;
}

const WINDOW = 120; // frames kept for averages
const UPDATE_MS = 500;
const LONG_TASK_WINDOW_MS = 10_000;

/**
 * A small always-on-top readout of frame timing. It runs its own animation loop, so it costs a
 * little; it's off by default and toggled from settings or `?hud`.
 */
export class PerfHud {
  private element: HTMLElement | null = null;
  private frame = 0;
  private last: number | undefined;
  private lastUpdate = 0;
  private readonly intervals: number[] = [];
  private readonly longTasks: number[] = [];
  private observer: PerformanceObserver | null = null;
  private locale: Locale;

  constructor(locale: Locale = 'en') {
    this.locale = locale;
  }

  get mounted(): boolean {
    return this.element !== null;
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  mount(parent: HTMLElement = document.body): void {
    if (this.element) return;
    const el = document.createElement('div');
    el.className = 'ie-hud';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-testid', 'perf-hud');
    parent.append(el);
    this.element = el;
    this.observeLongTasks();
    this.frame = requestAnimationFrame(this.tick);
  }

  unmount(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.observer = null;
    this.element?.remove();
    this.element = null;
    this.last = undefined;
    this.intervals.length = 0;
    this.longTasks.length = 0;
  }

  toggle(parent?: HTMLElement): boolean {
    if (this.mounted) this.unmount();
    else this.mount(parent);
    return this.mounted;
  }

  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) return;
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) this.longTasks.push(entry.startTime);
    });
    this.observer.observe({ type: 'longtask', buffered: false });
  }

  private readonly tick = (now: number): void => {
    if (this.last !== undefined) {
      this.intervals.push(now - this.last);
      if (this.intervals.length > WINDOW) this.intervals.shift();
    }
    this.last = now;
    if (now - this.lastUpdate >= UPDATE_MS) {
      this.lastUpdate = now;
      this.render(now);
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(now: number): void {
    if (!this.element) return;
    const t = createTranslator(diagnosticsMessages, this.locale);
    while (this.longTasks.length > 0 && (this.longTasks[0] ?? 0) < now - LONG_TASK_WINDOW_MS) {
      this.longTasks.shift();
    }
    const avg = average(this.intervals);
    const fps = avg ? Math.round(1000 / avg) : 0;
    const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
    const lines = [
      `${fps} ${t('hud.fps')}`,
      `${t('hud.frame')} ${formatMs(avg)}`,
      `${t('hud.p95')} ${formatMs(percentile(this.intervals, 95))}`,
    ];
    if (memory) lines.push(`${t('hud.heap')} ${Math.round(memory.usedJSHeapSize / 1048576)} MB`);
    lines.push(`${t('hud.long')} ${this.longTasks.length}`);
    lines.push(`${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio.toFixed(2)}`);
    this.element.textContent = lines.join('\n');
    this.element.dataset.slow = String(avg !== undefined && avg > 18);
  }
}
