import { prefersReducedMotion } from '@ie/core';
import { createTranslator, localeTag, type Locale, type Translator } from '@ie/i18n';
import { pickLabel, spaceOrder, type SpaceDef, type StoryRuntime } from '@ie/story';
import { presentMessages, type PresentKey } from './messages.ts';
import { buildMap } from './world-view.ts';

/** What the deck asks of the app around it. */
export interface SpaceDeckHost {
  /** Walk to a room the reader tapped on a map. */
  go(roomId: string): void;
  /** Draws a panel screen into a space; called again whenever values may have changed. */
  screen(element: HTMLElement, screenId: string): void;
  /** False while something else owns the reader's fingers (a fight, a minigame, a menu). */
  canMove?(): boolean;
  /** The reader moved to another space (hold clocks, move focus). */
  moved?(atStory: boolean): void;
}

interface Pane {
  readonly space: SpaceDef | 'story';
  readonly element: HTMLElement;
}

/** How far (in px) a finger moves sideways before the deck follows it instead of the page. */
const SLOP = 12;

function div(className: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

/**
 * Scrolls `box` so `target` sits in its middle. Not scrollIntoView: that also scrolls every
 * ancestor, the deck's own overflow-hidden frame included, and would slide another pane into view.
 */
function centreIn(box: HTMLElement, target: HTMLElement): void {
  const t = target.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  box.scrollLeft += t.left + t.width / 2 - (b.left + b.width / 2);
  box.scrollTop += t.top + t.height / 2 - (b.top + b.height / 2);
}

/**
 * Spaces beside the story (ADR 0031): the story's own pane in the middle and the author's spaces
 * to its left and right. A sideways swipe or the edge buttons move between them; vertical
 * scrolling and taps stay the page's own.
 */
export class SpaceDeck {
  readonly element = div('spaces');
  private readonly track = div('spaces__track');
  private readonly edges = { left: this.edge('left'), right: this.edge('right') };
  private panes: Pane[] = [];
  private index = 0;
  private t: Translator<PresentKey>;
  private runtime: StoryRuntime | null = null;
  private swiped = false;
  /** Map panes not on screen are drawn when the reader reaches them, not after every step. */
  private readonly stale = new Set<Pane>();

  constructor(
    private readonly story: HTMLElement,
    private spaces: readonly SpaceDef[],
    private readonly host: SpaceDeckHost,
    private locale: Locale,
  ) {
    this.t = createTranslator(presentMessages, locale);
    this.element.dataset.testid = 'spaces';
    this.element.append(this.track, this.edges.left, this.edges.right);
    this.listen();
    this.build();
  }

  /** True while the story itself is on screen. */
  get atStory(): boolean {
    return this.panes[this.index]?.space === 'story';
  }

  setSpaces(spaces: readonly SpaceDef[]): void {
    if (JSON.stringify(spaces) === JSON.stringify(this.spaces)) return;
    this.spaces = spaces;
    this.build();
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.t = createTranslator(presentMessages, locale);
    this.refresh(this.runtime);
  }

  /** Redraws the spaces from the running story (after every step, load or rewind). */
  refresh(runtime: StoryRuntime | null): void {
    this.runtime = runtime;
    for (const pane of this.panes) {
      if (pane.space !== 'story' && pane.space.kind === 'map' && pane !== this.panes[this.index])
        this.stale.add(pane);
      else this.draw(pane);
    }
    this.updateEdges();
  }

  /** Back to the story. */
  home(): void {
    this.show(this.panes.findIndex((p) => p.space === 'story'));
  }

  /** Moves one space left (-1) or right (+1). */
  step(direction: -1 | 1): void {
    this.show(this.index + direction);
  }

  show(index: number, animate = true): void {
    const next = Math.max(0, Math.min(this.panes.length - 1, index));
    const moved = next !== this.index;
    this.index = next;
    this.track.dataset.animate = String(animate && !prefersReducedMotion());
    this.track.style.transform = `translateX(${-next * 100}%)`;
    this.panes.forEach((pane, i) => {
      pane.element.inert = i !== next;
      pane.element.setAttribute('aria-hidden', String(i !== next));
    });
    this.updateEdges();
    if (!moved) return;
    const pane = this.panes[next];
    if (pane && this.stale.has(pane)) {
      this.draw(pane);
      // Arriving at a map: the reader's own room in the middle.
      const map = pane.element.querySelector<HTMLElement>('.world-map');
      const here = map?.querySelector<HTMLElement>('[aria-current]');
      if (map && here) {
        centreIn(map, here);
        centreIn(pane.element, here);
      }
    }
    this.host.moved?.(this.atStory);
  }

  private build(): void {
    const order = spaceOrder(this.spaces);
    this.stale.clear();
    this.panes = order.map((space) => {
      if (space === 'story') return { space, element: this.story };
      const element = div('spaces__pane spaces__pane--space');
      element.dataset.space = space.id;
      element.dataset.testid = `space-${space.kind}`;
      // A tap on a space is the space's own; it never turns the page underneath.
      element.addEventListener('click', (event) => event.stopPropagation());
      return { space, element };
    });
    this.story.classList.add('spaces__pane');
    this.track.replaceChildren(...this.panes.map((p) => p.element));
    this.show(order.indexOf('story'), false);
    this.refresh(this.runtime);
  }

  private draw(pane: Pane): void {
    const { space, element } = pane;
    this.stale.delete(pane);
    if (space === 'story') return;
    const name = pickLabel(space.name, this.locale, '');
    element.lang = localeTag(this.locale);
    element.setAttribute('aria-label', name);
    let body = element.querySelector<HTMLElement>('.spaces__body');
    if (!body) {
      const title = document.createElement('h2');
      title.className = 'spaces__title';
      body = div('spaces__body');
      element.replaceChildren(title, body);
    }
    const title = element.querySelector('.spaces__title');
    if (title) title.textContent = name;
    if (space.kind === 'screen') {
      if (space.screen) this.host.screen(body, space.screen);
      return;
    }
    if (!this.runtime) return body.replaceChildren();
    const map = buildMap(
      this.runtime.map(),
      { runtime: this.runtime, t: this.t },
      {
        go: (roomId) => {
          this.home();
          this.host.go(roomId);
        },
      },
    );
    body.replaceChildren(map);
  }

  private edge(side: 'left' | 'right'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spaces__edge';
    button.dataset.side = side;
    button.dataset.testid = `space-edge-${side}`;
    const mark = document.createElement('span');
    mark.className = 'spaces__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = side === 'left' ? '‹' : '›';
    const label = document.createElement('span');
    label.className = 'spaces__label';
    button.append(mark, label);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.host.canMove?.() === false) return;
      this.step(side === 'left' ? -1 : 1);
    });
    return button;
  }

  private updateEdges(): void {
    for (const side of ['left', 'right'] as const) {
      const neighbour = this.panes[this.index + (side === 'left' ? -1 : 1)];
      const button = this.edges[side];
      button.hidden = !neighbour;
      if (!neighbour) continue;
      const name =
        neighbour.space === 'story'
          ? this.t('space.story')
          : pickLabel(neighbour.space.name, this.locale, '');
      const label = this.t('space.go', { name });
      button.setAttribute('aria-label', label);
      button.title = label;
      const text = button.querySelector('.spaces__label');
      if (text) text.textContent = name;
    }
  }

  /** Touch and pen swipes; a mouse uses the edge buttons (and the wheel scrolls as usual). */
  private listen(): void {
    let start: { x: number; y: number; id: number; at: number } | null = null;
    let dragging = false;
    const width = () => this.element.clientWidth || 1;
    const offset = (dx: number) => {
      const atEnd =
        (dx > 0 && this.index === 0) || (dx < 0 && this.index === this.panes.length - 1);
      // Past the last space the track gives a little, then stops.
      return atEnd ? dx / 4 : dx;
    };
    this.element.addEventListener('pointerdown', (event) => {
      // A touch swipe fires no click, so a flag left from one must not eat the next real tap.
      this.swiped = false;
      if (event.pointerType === 'mouse' || this.panes.length < 2) return;
      if (this.host.canMove?.() === false) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId, at: event.timeStamp };
      dragging = false;
    });
    this.element.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
          start = null; // the reader is scrolling the page
          return;
        }
        if (Math.abs(dx) < SLOP) return;
        dragging = true;
        try {
          this.element.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is already gone (lifted between events); the swipe still ends on pointerup.
        }
        this.track.dataset.animate = 'false';
      }
      const shift = (offset(dx) / width()) * 100;
      this.track.style.transform = `translateX(calc(${-this.index * 100}% + ${shift}%))`;
    });
    const end = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const fast = Math.abs(dx) / Math.max(1, event.timeStamp - start.at) > 0.5;
      start = null;
      if (!dragging) return;
      dragging = false;
      this.swiped = true;
      const far = Math.abs(dx) > width() * 0.22 || (fast && Math.abs(dx) > SLOP * 3);
      this.show(far ? this.index + (dx < 0 ? 1 : -1) : this.index);
    };
    // Once the deck follows a finger, the browser must not also take the drag (some browsers turn
    // a sideways swipe into Back). pointermove runs first, so `dragging` is already set here.
    this.element.addEventListener(
      'touchmove',
      (event) => {
        if (dragging && event.cancelable) event.preventDefault();
      },
      { passive: false },
    );
    this.element.addEventListener('pointerup', end);
    // A swipe the browser or the system took away goes back where it was: a cancelled pointer's
    // coordinates say nothing about where the reader meant to go.
    this.element.addEventListener('pointercancel', (event) => {
      if (!start || event.pointerId !== start.id) return;
      start = null;
      if (!dragging) return;
      dragging = false;
      this.show(this.index);
    });
    // The click that ends a swipe isn't a tap on the page.
    this.element.addEventListener(
      'click',
      (event) => {
        if (!this.swiped) return;
        this.swiped = false;
        event.stopPropagation();
        event.preventDefault();
      },
      { capture: true },
    );
  }
}
