import { createTranslator, localeTag, type Locale, type Translator } from '@ie/i18n';
import type { PLAYER_PANELS, ScreenAction, ScreenDef, ScreenKind, StoryRuntime } from '@ie/story';
import { presentMessages, type PresentKey } from './messages.ts';
import { screenModel, type ViewNode } from './screen-model.ts';
import { renderNodes, type RenderOptions } from './screens.ts';

export type PlayerPanel = (typeof PLAYER_PANELS)[number];

/** What a screen asks of the app around it. */
export interface ScreenHostEvents {
  /** Title screen: start the story from the beginning. */
  start(): void;
  /** Title screen: carry on from the last save. */
  continue(): void;
  /** Open one of the app's own panels; the Studio's Play view ignores these. */
  menu?(panel: PlayerPanel): void;
  /** A Set action changed a variable between steps (save, refresh what shows values). */
  changed?(): void;
  /** A title or panel screen opened or closed (hold the clocks while one covers the page). */
  toggled?(): void;
}

export interface ScreenHostOptions {
  readonly locale: Locale;
  /** False hides title-screen Continue buttons (nothing saved). */
  readonly canContinue?: () => boolean;
}

function div(className: string, testId?: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  if (testId) node.dataset.testid = testId;
  return node;
}

/**
 * Puts a story's screens around a presenter (ADR 0018): HUD strips above and below the page, and
 * one overlay for the title screen or an open panel. The app places the three elements.
 */
export class ScreenHost {
  readonly hudTop = div('screen-hud', 'hud');
  readonly hudBottom = div('screen-hud', 'hud-bottom');
  readonly overlay = div('screen-overlay', 'screen');
  private current: ScreenDef | null = null;
  private readonly tabs = new Map<string, string>();
  /** What each element last showed, so an unchanged screen is never rebuilt. */
  private readonly drawn = new Map<HTMLElement, string>();
  /** Elements of the reader's spaces that show a panel screen (ADR 0031), by screen ID. */
  private readonly spaces = new Map<HTMLElement, string>();
  private t: Translator<PresentKey>;

  constructor(
    private runtime: StoryRuntime,
    private readonly events: ScreenHostEvents,
    private options: ScreenHostOptions,
  ) {
    this.t = createTranslator(presentMessages, options.locale);
    this.hudTop.dataset.edge = 'top';
    this.hudBottom.dataset.edge = 'bottom';
    this.overlay.hidden = true;
    // Taps on a screen are the screen's own; they never turn the page underneath.
    this.overlay.addEventListener('click', (event) => event.stopPropagation());
    // Escape closes a panel; a title screen stays until the reader starts or continues.
    this.overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape' && this.current?.kind === 'panel') this.close();
    });
    this.refresh();
  }

  private get screens(): readonly ScreenDef[] {
    return this.runtime.story.project.screens ?? [];
  }

  /** The title screen, if the story has one (the first wins). */
  get title(): ScreenDef | undefined {
    return this.screens.find((s) => s.kind === 'title');
  }

  /** Panel screens, for the app's menu. */
  get panels(): readonly ScreenDef[] {
    return this.screens.filter((s) => s.kind === 'panel');
  }

  /** True while a title or panel screen covers the page. */
  get covering(): boolean {
    return this.current !== null;
  }

  /** What covers the page: the title screen, a panel, or nothing. */
  get showing(): ScreenKind | null {
    return this.current?.kind ?? null;
  }

  /** Follows a new runtime (restart, load) and redraws. */
  attach(runtime: StoryRuntime): void {
    this.runtime = runtime;
    this.refresh();
  }

  setLocale(locale: Locale): void {
    this.options = { ...this.options, locale };
    this.t = createTranslator(presentMessages, locale);
    this.refresh();
  }

  /** Shows the title screen. False when the story has none. */
  showTitle(): boolean {
    const title = this.title;
    if (!title) return false;
    this.show(title);
    return true;
  }

  open(screenId: string): void {
    const screen = this.screens.find((s) => s.id === screenId);
    if (screen) this.show(screen);
  }

  /** Draws a panel screen into a space beside the story; refresh() keeps it up to date. */
  showIn(element: HTMLElement, screenId: string): void {
    this.spaces.set(element, screenId);
    this.drawSpace(element, screenId);
  }

  close(): void {
    if (!this.current) return;
    this.current = null;
    this.overlay.hidden = true;
    this.overlay.replaceChildren();
    this.drawn.delete(this.overlay);
    this.events.toggled?.();
  }

  /**
   * Brings the HUDs and any open screen up to date with the runtime's values. Only what changed
   * is rebuilt: a rebuild under the reader's finger would swallow the tap (and costs a layout).
   */
  refresh(): void {
    const lang = localeTag(this.options.locale);
    for (const [element, edge] of [
      [this.hudTop, 'top'],
      [this.hudBottom, 'bottom'],
    ] as const) {
      const huds = this.screens.filter((s) => s.kind === 'hud' && (s.edge ?? 'top') === edge);
      const models = huds.map((s) => this.model(s));
      if (this.unchanged(element, [huds.map((s) => s.id), models])) continue;
      element.lang = lang;
      element.replaceChildren(...huds.map((s, i) => this.box(s, models[i] ?? [])));
      element.hidden = element.childElementCount === 0;
    }
    if (this.current) this.draw(this.current);
    for (const [element, screenId] of this.spaces) {
      if (element.isConnected) this.drawSpace(element, screenId);
      else this.spaces.delete(element);
    }
  }

  private drawSpace(element: HTMLElement, screenId: string): void {
    const screen = this.screens.find((s) => s.id === screenId);
    if (!screen) {
      element.replaceChildren();
      this.drawn.delete(element);
      return;
    }
    const nodes = this.model(screen);
    if (this.unchanged(element, [screen.id, nodes])) return;
    element.lang = localeTag(this.options.locale);
    element.replaceChildren(this.box(screen, nodes));
  }

  dispose(): void {
    this.hudTop.remove();
    this.hudBottom.remove();
    this.overlay.remove();
  }

  private show(screen: ScreenDef): void {
    const opening = !this.current;
    this.current = screen;
    this.overlay.hidden = false;
    this.draw(screen);
    if (opening) this.events.toggled?.();
    this.overlay.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }

  private draw(screen: ScreenDef): void {
    const nodes = this.model(screen);
    if (this.unchanged(this.overlay, [screen.id, screen.name, nodes])) return;
    const card = div('screen-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const name = screen.name[this.options.locale] || screen.name.en || screen.name.tr || '';
    card.setAttribute('aria-label', name);
    card.lang = localeTag(this.options.locale);
    if (screen.kind === 'panel') {
      const header = div('screen-card__header');
      const title = document.createElement('h2');
      title.className = 'screen-card__title';
      title.textContent = name;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'screen-card__close';
      close.dataset.testid = 'screen-close';
      close.textContent = this.t('screen.close');
      close.addEventListener('click', () => this.close());
      header.append(title, close);
      card.append(header);
    }
    const body = div('screen-card__body');
    body.append(this.box(screen, nodes));
    card.append(body);
    this.overlay.dataset.kind = screen.kind;
    this.overlay.dataset.screen = screen.id;
    this.overlay.replaceChildren(card);
  }

  private model(screen: ScreenDef): ViewNode[] {
    return screenModel(screen.children, {
      runtime: this.runtime,
      locale: this.options.locale,
      t: this.t,
      canContinue: this.options.canContinue?.() ?? true,
    });
  }

  /** True when `element` already shows `what` (in this language, with these tabs open). */
  private unchanged(element: HTMLElement, what: unknown): boolean {
    const signature = JSON.stringify([what, this.options.locale, [...this.tabs]]);
    if (this.drawn.get(element) === signature) return true;
    this.drawn.set(element, signature);
    return false;
  }

  private box(screen: ScreenDef, nodes: readonly ViewNode[]): HTMLElement {
    const render: RenderOptions = {
      onAction: (actions) => this.act(actions),
      tabs: this.tabs,
      onTab: () => {
        // The switch rebuilds the screen; keep the keyboard on the tab that was pressed.
        const pressed = (document.activeElement as HTMLElement | null)?.dataset.tab;
        this.refresh();
        if (pressed)
          [this.overlay, this.hudTop, this.hudBottom]
            .map((root) => root.querySelector<HTMLElement>(`[data-tab="${CSS.escape(pressed)}"]`))
            .find(Boolean)
            ?.focus({ preventScroll: true });
      },
    };
    const box = div('screen');
    box.dataset.kind = screen.kind;
    box.append(...renderNodes(nodes, render));
    return box;
  }

  private act(actions: readonly ScreenAction[]): void {
    let changed = false;
    for (const action of actions) {
      switch (action.type) {
        case 'start':
          this.close();
          this.events.start();
          return;
        case 'continue':
          this.close();
          this.events.continue();
          return;
        case 'open':
          this.open(action.screen);
          break;
        case 'close':
          this.close();
          break;
        case 'menu':
          this.events.menu?.(action.panel);
          break;
        case 'set':
          this.runtime.screenSet(action);
          changed = true;
          break;
      }
    }
    if (changed) this.events.changed?.();
    this.refresh();
  }
}
