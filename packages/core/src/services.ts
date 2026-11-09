import type { Unsubscribe } from './events.ts';

/** A typed handle for a shared service, e.g. `createServiceKey<AudioMixer>('audio.mixer')`. */
export interface ServiceKey<T> {
  readonly name: string;
  /** Phantom field that carries the service type; never set at runtime. */
  readonly __type?: T;
}

export function createServiceKey<T>(name: string): ServiceKey<T> {
  return { name };
}

/** Lets modules share objects (mixer, renderer, story runtime) without importing each other. */
export class ServiceRegistry {
  private readonly services = new Map<string, unknown>();

  provide<T>(key: ServiceKey<T>, service: T): Unsubscribe {
    if (this.services.has(key.name)) {
      throw new Error(`Service "${key.name}" is already provided.`);
    }
    this.services.set(key.name, service);
    return () => {
      if (this.services.get(key.name) === service) this.services.delete(key.name);
    };
  }

  get<T>(key: ServiceKey<T>): T {
    if (!this.services.has(key.name)) {
      throw new Error(
        `Service "${key.name}" isn't available. Is the module that provides it installed and listed in "depends"?`,
      );
    }
    return this.services.get(key.name) as T;
  }

  tryGet<T>(key: ServiceKey<T>): T | undefined {
    return this.services.get(key.name) as T | undefined;
  }

  has(key: ServiceKey<unknown>): boolean {
    return this.services.has(key.name);
  }
}
