export type Unsubscribe = () => void;

type Handler = (payload: unknown) => void;
type AnyHandler = (type: PropertyKey, payload: unknown) => void;

/** Arguments for `emit`: the payload may be omitted when the event's payload type is `undefined`. */
export type EmitArgs<P> = undefined extends P ? [payload?: P] : [payload: P];

export type ErrorReporter = (error: unknown, context: string) => void;

export const defaultErrorReporter: ErrorReporter = (error, context) => {
  console.error(`[engine] ${context}`, error);
};

/**
 * A small typed event bus. A throwing listener is reported and skipped, so one broken module can't
 * stop the others from hearing an event.
 */
export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<Handler>>();
  private readonly anyHandlers = new Set<AnyHandler>();

  constructor(private readonly reportError: ErrorReporter = defaultErrorReporter) {}

  on<K extends keyof E>(type: K, handler: (payload: E[K]) => void): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const stored = handler as unknown as Handler;
    set.add(stored);
    return () => {
      set.delete(stored);
    };
  }

  once<K extends keyof E>(type: K, handler: (payload: E[K]) => void): Unsubscribe {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** Listens to every event; meant for debug logs and devtools. */
  onAny(handler: (type: keyof E, payload: unknown) => void): Unsubscribe {
    const stored = handler as AnyHandler;
    this.anyHandlers.add(stored);
    return () => {
      this.anyHandlers.delete(stored);
    };
  }

  emit<K extends keyof E>(type: K, ...args: EmitArgs<E[K]>): void {
    const payload = args[0];
    const set = this.handlers.get(type);
    if (set) {
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (error) {
          this.reportError(error, `listener for "${String(type)}" threw`);
        }
      }
    }
    for (const handler of [...this.anyHandlers]) {
      try {
        handler(type, payload);
      } catch (error) {
        this.reportError(error, `onAny listener threw on "${String(type)}"`);
      }
    }
  }

  listenerCount(type: keyof E): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}
