import { prefersReducedMotion, watchReducedMotion } from '@ie/core';
import type { Locale } from '@ie/i18n';
import {
  imageSetSchema,
  mediaView,
  videoSetSchema,
  type ImageSet,
  type MediaView,
  type VideoSet,
} from '@ie/story';

export interface MediaLayerOptions {
  /** The reader's language, for a picture's words. */
  readonly locale: () => Locale;
  /** Inside a positioned panel (the Studio's Play view) instead of over the whole window. */
  readonly contained?: boolean;
}

type Shown = Exclude<MediaView, { kind: 'none' }>;

/**
 * The picture or video behind the text (ADR 0026). One element, built when a novel first shows
 * media; a scene without media removes it, so novels that never use media pay nothing.
 */
export class MediaLayer {
  private scene: Record<string, unknown> = {};
  private root: HTMLElement | null = null;
  private shown: MediaView = { kind: 'none' };
  private parent: HTMLElement | null = null;
  private readonly stopWatching: () => void;

  constructor(private readonly options: MediaLayerOptions) {
    this.stopWatching = watchReducedMotion(() => this.syncMotion());
  }

  imageSet(params: ImageSet): void {
    this.apply({ ...this.scene, 'media.image.set': imageSetSchema.parse(params) });
  }

  videoSet(params: VideoSet): void {
    this.apply({ ...this.scene, 'media.video.set': videoSetSchema.parse(params) });
  }

  /** Restores what a saved scene showed (after a load, a rewind or a restart). */
  applyScene(scene: Readonly<Record<string, unknown>>): void {
    this.apply({
      'media.image.set': scene['media.image.set'],
      'media.video.set': scene['media.video.set'],
    });
  }

  /** Moves the layer into a panel (the Studio), or back to the page with null. */
  attach(parent: HTMLElement | null): void {
    this.parent = parent;
    if (this.root) this.place(this.root);
  }

  /** Repaints the words of a picture in another language. */
  refreshLocale(): void {
    const img = this.root?.querySelector('img');
    if (img && this.shown.kind === 'image') img.alt = this.altText(this.shown);
  }

  dispose(): void {
    this.stopWatching();
    this.root?.remove();
    this.root = null;
  }

  private apply(scene: Record<string, unknown>): void {
    this.scene = scene;
    const next = mediaView(scene);
    if (sameView(next, this.shown)) {
      if (next.kind !== 'none') this.style(next);
      return;
    }
    this.shown = next;
    if (next.kind === 'none') {
      this.root?.remove();
      this.root = null;
      return;
    }
    const root = this.root ?? this.build();
    root.querySelector('img, video')?.remove();
    root.prepend(next.kind === 'image' ? this.image(next) : this.video(next));
    this.style(next);
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = this.options.contained ? 'ie-media ie-media--contained' : 'ie-media';
    root.dataset.testid = 'media-layer';
    const veil = document.createElement('div');
    veil.className = 'ie-media__veil';
    root.append(veil);
    this.root = root;
    this.place(root);
    return root;
  }

  private place(root: HTMLElement): void {
    // First in its parent, so the page (later, positioned) paints over it.
    (this.parent ?? document.body).prepend(root);
  }

  private style(view: Shown): void {
    if (!this.root) return;
    this.root.style.setProperty('--ie-media-dim', String(view.dim));
    this.root.dataset.fit = view.fit;
  }

  private image(view: Extract<Shown, { kind: 'image' }>): HTMLElement {
    const img = document.createElement('img');
    img.className = 'ie-media__item';
    img.decoding = 'async';
    img.alt = this.altText(view);
    img.src = view.src;
    // A picture that can't load leaves the page as it was rather than a broken-image icon.
    img.addEventListener('error', () => img.remove(), { once: true });
    return img;
  }

  private video(view: Extract<Shown, { kind: 'video' }>): HTMLElement {
    const video = document.createElement('video');
    video.className = 'ie-media__item';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = view.loop;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.src = view.src;
    video.addEventListener('error', () => video.remove(), { once: true });
    if (!prefersReducedMotion()) {
      video.autoplay = true;
      void video.play().catch(() => undefined);
    }
    return video;
  }

  private syncMotion(): void {
    const video = this.root?.querySelector('video');
    if (!video) return;
    if (prefersReducedMotion()) video.pause();
    else void video.play().catch(() => undefined);
  }

  private altText(view: Extract<Shown, { kind: 'image' }>): string {
    const locale = this.options.locale();
    return view.alt?.[locale] ?? view.alt?.en ?? '';
  }
}

/** Same picture or video: only the dimming or fit may differ, so nothing reloads. */
export function sameView(a: MediaView, b: MediaView): boolean {
  if (a.kind === 'none' || b.kind === 'none') return a.kind === b.kind;
  if (a.kind !== b.kind || a.src !== b.src) return false;
  return a.kind !== 'video' || b.kind !== 'video' || a.loop === b.loop;
}
