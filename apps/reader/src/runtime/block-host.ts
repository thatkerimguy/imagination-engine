// Defers the v2 BlueprintHost for a `module` block (every cue is a `blueprintId` cue) into its
// lazy chunk, so the initial reader JS stays tiny.
import type { DnaArchetypeId } from '@kn/core/dna';
import type { QualityTier } from '@kn/core/renderer';
import type { AudioBus } from './audio-bus.ts';

export interface HostDeps {
  audio: AudioBus;
  resolveAsset(path: string): string;
  /** Element that receives the book's `--dna-*` tokens (the reading root). */
  dnaRoot?: HTMLElement;
  /** Raw `visualDna` from the chapter or novel (archetype id or 7-axis object). */
  visualDna?: unknown;
  dnaFallback?: DnaArchetypeId;
  /** Inline v2 blueprints carried by the chapter payload. */
  blueprints?: Record<string, unknown>;
}

export interface HostRequest {
  moduleId: string;
  moduleVersion: number;
  props: Record<string, unknown>;
}

export interface BlockHost {
  mount(): Promise<boolean>;
  /** Plays the beat; resolves when it has landed. */
  trigger(): Promise<void>;
  dispose(): void;
}

class LazyHost implements BlockHost {
  private inner: Promise<BlockHost | null> | null = null;
  private disposed = false;

  constructor(
    private readonly req: HostRequest,
    private readonly el: HTMLElement,
    private readonly tier: QualityTier,
    private readonly deps: HostDeps,
  ) {}

  private load(): Promise<BlockHost | null> {
    const { req, el, tier, deps } = this;
    this.inner ??= (
      import('./blueprint-host.ts').then((m) => new m.BlueprintHost(req, el, tier, deps))
    ).then((h: BlockHost) => {
      if (!this.disposed) return h;
      h.dispose();
      return null;
    });
    return this.inner;
  }

  async mount(): Promise<boolean> {
    const h = await this.load();
    return h ? h.mount() : false;
  }

  async trigger(): Promise<void> {
    await (await this.load())?.trigger();
  }

  dispose(): void {
    this.disposed = true;
    void this.inner?.then((h) => h?.dispose());
  }
}

export const createBlockHost = (
  req: HostRequest,
  el: HTMLElement,
  tier: QualityTier,
  deps: HostDeps,
): BlockHost => new LazyHost(req, el, tier, deps);
