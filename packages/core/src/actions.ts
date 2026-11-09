import { z } from 'zod';
import type { Unsubscribe } from './events.ts';

/** Where an action call came from: a story block, a rule, the sequencer, the debug console... */
export interface ActionContext {
  readonly source: string;
  readonly signal?: AbortSignal;
}

export interface ActionDefinition<S extends z.ZodType = z.ZodType> {
  /** `domain.verb`, e.g. `ui.locale.set` or `audio.play`. */
  readonly id: string;
  readonly params: S;
  readonly description?: string;
  /** Blocking actions (battles, minigames, sequences) pause the story until they resolve. */
  readonly blocking?: boolean;
  run(params: z.output<S>, ctx: ActionContext): unknown;
}

export interface ActionLogEntry {
  readonly id: string;
  readonly source: string;
  readonly at: number;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly error?: string;
}

export class ActionError extends Error {
  constructor(
    message: string,
    readonly actionId: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ActionError';
  }
}

const ACTION_ID = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/** Identity helper that keeps the params type inferred from the schema. */
export function defineAction<S extends z.ZodType>(
  definition: ActionDefinition<S>,
): ActionDefinition<S> {
  return definition;
}

export interface ActionBusOptions {
  /** How many recent calls to keep for the debug log. */
  readonly logSize?: number;
  readonly now?: () => number;
}

/**
 * Every operation that *does* something goes through here, so story blocks, rules, timelines and
 * the debug console all share one validated, logged entry point.
 */
export class ActionBus {
  private readonly actions = new Map<string, ActionDefinition>();
  private readonly log: ActionLogEntry[] = [];
  private readonly logSize: number;
  private readonly now: () => number;

  constructor(options: ActionBusOptions = {}) {
    this.logSize = options.logSize ?? 200;
    this.now = options.now ?? (() => performance.now());
  }

  register<S extends z.ZodType>(definition: ActionDefinition<S>): Unsubscribe {
    if (!ACTION_ID.test(definition.id)) {
      throw new ActionError(
        `Action id "${definition.id}" must look like "domain.verb" (lowercase start, dot-separated).`,
        definition.id,
      );
    }
    if (this.actions.has(definition.id)) {
      throw new ActionError(`Action "${definition.id}" is already registered.`, definition.id);
    }
    this.actions.set(definition.id, definition);
    return () => {
      if (this.actions.get(definition.id) === definition) this.actions.delete(definition.id);
    };
  }

  has(id: string): boolean {
    return this.actions.has(id);
  }

  get(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  list(): readonly ActionDefinition[] {
    return [...this.actions.values()];
  }

  async run(id: string, params: unknown = {}, ctx: Partial<ActionContext> = {}): Promise<unknown> {
    const definition = this.actions.get(id);
    const source = ctx.source ?? 'unknown';
    if (!definition) {
      throw new ActionError(`Unknown action "${id}".`, id);
    }
    const parsed = definition.params.safeParse(params);
    if (!parsed.success) {
      const message = `Invalid parameters for "${id}":\n${z.prettifyError(parsed.error)}`;
      this.record({ id, source, at: this.now(), durationMs: 0, ok: false, error: message });
      throw new ActionError(message, id, { cause: parsed.error });
    }
    const startedAt = this.now();
    try {
      const context: ActionContext = ctx.signal ? { source, signal: ctx.signal } : { source };
      const result: unknown = await definition.run(parsed.data, context);
      this.record({ id, source, at: startedAt, durationMs: this.now() - startedAt, ok: true });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.record({
        id,
        source,
        at: startedAt,
        durationMs: this.now() - startedAt,
        ok: false,
        error: message,
      });
      throw new ActionError(`Action "${id}" failed: ${message}`, id, { cause: error });
    }
  }

  /** Most recent calls, oldest first. */
  recent(): readonly ActionLogEntry[] {
    return [...this.log];
  }

  private record(entry: ActionLogEntry): void {
    this.log.push(entry);
    if (this.log.length > this.logSize) this.log.splice(0, this.log.length - this.logSize);
  }
}
