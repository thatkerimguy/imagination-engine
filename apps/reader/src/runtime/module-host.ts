// Owns one module block's lifecycle: resolve the module, validate props, mount the right tier,
// trigger the beat, and guarantee cleanup. Problems are shown as a quiet notice, never thrown.
import type { ModuleLayer } from '@kn/core';
import type { ModuleRenderer, QualityTier } from '@kn/core/renderer';
import type { AudioBus } from './audio-bus.ts';
import { loadModuleEntry, loadRendererFactory, type AnyProps } from './registry.ts';
import type { Stage } from './stage.ts';

export interface HostDeps {
  stage: Stage;
  audio: AudioBus;
  resolveAsset(path: string): string;
}

export interface ModuleRequest {
  moduleId: string;
  moduleVersion: number;
  props: AnyProps;
}

export class ModuleHost {
  layer: ModuleLayer | null = null;
  private renderer: ModuleRenderer<AnyProps> | null = null;
  private readonly abort = new AbortController();
  private mounting: Promise<boolean> | null = null;

  constructor(
    private readonly request: ModuleRequest,
    private readonly el: HTMLElement,
    private readonly tier: QualityTier,
    private readonly deps: HostDeps,
  ) {}

  mount(): Promise<boolean> {
    this.mounting ??= this.doMount();
    return this.mounting;
  }

  private async doMount(): Promise<boolean> {
    const { moduleId, moduleVersion, props: raw } = this.request;
    const entry = await loadModuleEntry(moduleId);
    if (!entry) return this.notice(`Unknown spectacle “${moduleId}”.`);
    const { meta } = entry.schema;
    this.layer = meta.layer;
    if (moduleVersion > meta.version) {
      return this.notice(
        `${meta.name} v${moduleVersion} needs a newer reader (has v${meta.version}).`,
      );
    }
    const valid = entry.schema.validate(raw);
    if (!valid.ok) return this.notice(`${meta.name}: ${valid.errors.join('; ')}`);
    const factory = await loadRendererFactory(moduleId);
    if (!factory || this.abort.signal.aborted) return false;
    const renderer = factory();
    this.renderer = renderer;
    const ctx = {
      props: valid.props,
      tier: this.tier,
      blockId: this.el.dataset.block ?? '',
      host: this.el,
      stage: this.deps.stage,
      audio: this.deps.audio,
      signal: this.abort.signal,
      resolveAsset: this.deps.resolveAsset,
    };
    try {
      if (this.tier === 'reduced') await renderer.reducedMotionFallback(ctx);
      else await renderer.mount(ctx);
    } catch (err) {
      console.warn(`[${moduleId}] mount failed`, err);
      return this.notice(`${meta.name} could not start.`);
    }
    return !this.abort.signal.aborted;
  }

  /** Plays the beat; resolves when the module reports it has landed. */
  async trigger(): Promise<void> {
    if (!(await this.mount())) return;
    try {
      await this.renderer?.trigger?.();
    } catch (err) {
      console.warn(`[${this.request.moduleId}] trigger failed`, err);
    }
  }

  dispose(): void {
    this.abort.abort();
    try {
      this.renderer?.dispose();
    } catch (err) {
      console.warn(`[${this.request.moduleId}] dispose failed`, err);
    }
    this.renderer = null;
    this.el.replaceChildren();
  }

  private notice(text: string): false {
    console.warn(`[module-host] ${text}`);
    const p = document.createElement('p');
    p.className = 'kn-module-notice';
    p.textContent = `⚠ ${text}`;
    this.el.replaceChildren(p);
    return false;
  }
}
