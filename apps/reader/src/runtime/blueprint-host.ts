// Owns one v2 cue's lifecycle: resolve the blueprint, load its engine through the static
// switch, build a leak-proof runtime context with the book's Visual DNA, mount, trigger and
// tear everything down. Problems show as a quiet notice, never a thrown error.
import type { EngineInstance } from '@kn/core/gimmicks';
import type { QualityTier } from '@kn/core/renderer';
import { attachDna, bookDna } from '../dna-apply.ts';
import { loadEngine } from '../engine-loader.ts';
import { createEngineRuntimeContext, type RuntimeHandle } from '../runtime-context.ts';
import type { BlockHost, HostDeps, HostRequest } from './block-host.ts';
import { resolveCue } from './cue-resolve.ts';
import { liveTier } from './tier-bus.ts';

export class BlueprintHost implements BlockHost {
  private runtime: RuntimeHandle | null = null;
  private instance: EngineInstance | null = null;
  private mounting: Promise<boolean> | null = null;
  private disposed = false;

  constructor(
    private readonly req: HostRequest,
    private readonly el: HTMLElement,
    private readonly tier: QualityTier,
    private readonly deps: HostDeps,
  ) {}

  mount(): Promise<boolean> {
    this.mounting ??= this.doMount();
    return this.mounting;
  }

  private async doMount(): Promise<boolean> {
    const cue = await resolveCue(this.req, this.deps.blueprints);
    if (this.disposed) return false;
    if (!cue.ok) return this.notice(cue.error);
    const engine = await loadEngine(cue.blueprint.engine);
    if (this.disposed) return false;
    const root = this.deps.dnaRoot ?? this.el.closest<HTMLElement>('.kn-main') ?? this.el;
    const dna = attachDna(root, bookDna(this.deps.visualDna, this.deps.dnaFallback));
    // Calm replays (resume) stay reduced; otherwise follow the live tier if it has moved.
    const live = liveTier();
    const tier = this.tier === 'reduced' ? 'reduced' : (live?.tier ?? this.tier);
    this.runtime = createEngineRuntimeContext({
      tier,
      calm: live?.calm ?? false,
      dna,
      dnaRoot: root,
      audio: this.deps.audio,
    });
    try {
      this.instance = engine.mount(this.el, cue.blueprint, cue.props, this.runtime.ctx);
    } catch (err) {
      console.warn(`[${cue.blueprint.engine}] mount failed`, err);
      this.runtime.dispose();
      this.runtime = null;
      return this.notice(`${cue.blueprint.name} could not start.`);
    }
    return true;
  }

  async trigger(): Promise<void> {
    if (!(await this.mount()) || this.disposed) return;
    try {
      await this.instance?.trigger();
    } catch (err) {
      console.warn(`[${this.req.moduleId}] trigger failed`, err);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.instance?.destroy();
    } catch (err) {
      console.warn(`[${this.req.moduleId}] destroy failed`, err);
    }
    this.runtime?.dispose();
    this.instance = null;
    this.runtime = null;
    this.el.replaceChildren();
  }

  private notice(text: string): false {
    console.warn(`[blueprint-host] ${text}`);
    const p = document.createElement('p');
    p.className = 'kn-module-notice';
    p.textContent = `⚠ ${text}`;
    this.el.replaceChildren(p);
    return false;
  }
}
