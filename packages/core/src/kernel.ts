import { z } from 'zod';
import { ActionBus } from './actions.ts';
import { EventBus, defaultErrorReporter, type ErrorReporter, type Unsubscribe } from './events.ts';
import { ServiceRegistry } from './services.ts';
import { StateStore, stateSnapshotSchema } from './state.ts';

/**
 * Engine-wide events. Modules add their own with declaration merging:
 *
 * ```ts
 * declare module '@ie/core' {
 *   interface EngineEvents { 'locale.changed': { locale: string } }
 * }
 * ```
 *
 * Keep this an interface (not a type alias) so declaration merging works.
 */
export interface EngineEvents {
  'kernel.started': undefined;
  'kernel.stopped': undefined;
  'module.installed': { id: string };
}

export interface ModuleContext {
  readonly kernel: Kernel;
  readonly events: EventBus<EngineEvents>;
  readonly actions: ActionBus;
  readonly state: StateStore;
  readonly services: ServiceRegistry;
  /** Registers cleanup (unsubscribers, timers) that runs when the kernel stops. */
  onDispose(cleanup: Unsubscribe): void;
}

export interface EngineModule {
  readonly id: string;
  readonly depends?: readonly string[];
  /** Register actions, services and listeners. Dependencies are already installed. */
  install(ctx: ModuleContext): void | Promise<void>;
  /** Runs after every module is installed. */
  start?(ctx: ModuleContext): void | Promise<void>;
  /** Module state for save files. Must be JSON-safe. */
  serialize?(): unknown;
  deserialize?(data: unknown): void;
  dispose?(): void;
}

export function defineModule<M extends EngineModule>(module: M): M {
  return module;
}

export const saveSnapshotSchema = z.object({
  format: z.literal(1),
  createdAt: z.number(),
  state: stateSnapshotSchema,
  modules: z.record(z.string(), z.unknown()),
});
export type SaveSnapshot = z.output<typeof saveSnapshotSchema>;

export type KernelStatus = 'idle' | 'starting' | 'running' | 'stopped';

export interface KernelOptions {
  readonly reportError?: ErrorReporter;
  readonly now?: () => number;
}

/** Orders modules so every module comes after the modules it depends on. */
export function sortModules(modules: readonly EngineModule[]): EngineModule[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const sorted: EngineModule[] = [];
  const visiting: string[] = [];
  const done = new Set<string>();

  const visit = (module: EngineModule): void => {
    if (done.has(module.id)) return;
    const cycleStart = visiting.indexOf(module.id);
    if (cycleStart !== -1) {
      const chain = [...visiting.slice(cycleStart), module.id].join(' → ');
      throw new Error(`Modules depend on each other in a loop: ${chain}.`);
    }
    visiting.push(module.id);
    for (const depId of module.depends ?? []) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Module "${module.id}" needs "${depId}", which isn't installed.`);
      }
      visit(dep);
    }
    visiting.pop();
    done.add(module.id);
    sorted.push(module);
  };

  for (const module of modules) visit(module);
  return sorted;
}

export class Kernel {
  readonly events: EventBus<EngineEvents>;
  readonly actions: ActionBus;
  readonly state = new StateStore();
  readonly services = new ServiceRegistry();

  private readonly modules: EngineModule[] = [];
  private readonly cleanups = new Map<string, Unsubscribe[]>();
  private order: EngineModule[] = [];
  private currentStatus: KernelStatus = 'idle';
  private readonly now: () => number;

  constructor(options: KernelOptions = {}) {
    this.events = new EventBus<EngineEvents>(options.reportError ?? defaultErrorReporter);
    this.actions = new ActionBus(options.now ? { now: options.now } : {});
    this.now = options.now ?? (() => Date.now());
  }

  get status(): KernelStatus {
    return this.currentStatus;
  }

  get installedModules(): readonly string[] {
    return this.order.map((m) => m.id);
  }

  use(module: EngineModule): this {
    if (this.currentStatus !== 'idle') {
      throw new Error(`Can't add module "${module.id}" after the kernel has started.`);
    }
    if (this.modules.some((m) => m.id === module.id)) {
      throw new Error(`Module "${module.id}" was added twice.`);
    }
    this.modules.push(module);
    return this;
  }

  async start(): Promise<void> {
    if (this.currentStatus !== 'idle') throw new Error('The kernel can only be started once.');
    this.currentStatus = 'starting';
    this.order = sortModules(this.modules);
    for (const module of this.order) {
      await module.install(this.contextFor(module));
      this.events.emit('module.installed', { id: module.id });
    }
    for (const module of this.order) {
      await module.start?.(this.contextFor(module));
    }
    this.currentStatus = 'running';
    this.events.emit('kernel.started');
  }

  snapshot(): SaveSnapshot {
    const modules: Record<string, unknown> = {};
    for (const module of this.order) {
      if (module.serialize) modules[module.id] = module.serialize();
    }
    return { format: 1, createdAt: this.now(), state: this.state.snapshot(), modules };
  }

  restore(snapshot: unknown): void {
    const save = saveSnapshotSchema.parse(snapshot);
    this.state.restore(save.state);
    for (const module of this.order) {
      if (module.deserialize && module.id in save.modules) {
        module.deserialize(save.modules[module.id]);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.currentStatus === 'stopped') return;
    for (const module of [...this.order].reverse()) {
      for (const cleanup of (this.cleanups.get(module.id) ?? []).reverse()) {
        try {
          cleanup();
        } catch (error) {
          console.error(`[engine] cleanup of "${module.id}" threw`, error);
        }
      }
      try {
        module.dispose?.();
      } catch (error) {
        console.error(`[engine] dispose of "${module.id}" threw`, error);
      }
    }
    this.cleanups.clear();
    this.currentStatus = 'stopped';
    this.events.emit('kernel.stopped');
    await Promise.resolve();
  }

  private contextFor(module: EngineModule): ModuleContext {
    return {
      kernel: this,
      events: this.events,
      actions: this.actions,
      state: this.state,
      services: this.services,
      onDispose: (cleanup) => {
        const list = this.cleanups.get(module.id) ?? [];
        list.push(cleanup);
        this.cleanups.set(module.id, list);
      },
    };
  }
}
