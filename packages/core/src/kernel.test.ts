import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineAction } from './actions.ts';
import { Kernel, defineModule, sortModules, type EngineModule } from './kernel.ts';
import { createServiceKey } from './services.ts';

const mod = (id: string, depends: string[] = []): EngineModule => ({
  id,
  depends,
  install: () => {},
});

describe('sortModules', () => {
  it('puts dependencies first', () => {
    const order = sortModules([mod('story', ['logic']), mod('logic', ['core']), mod('core')]);
    expect(order.map((m) => m.id)).toEqual(['core', 'logic', 'story']);
  });

  it('reports missing dependencies and loops clearly', () => {
    expect(() => sortModules([mod('a', ['b'])])).toThrow(/needs "b"/);
    expect(() => sortModules([mod('a', ['b']), mod('b', ['a'])])).toThrow(/a → b → a/);
  });
});

describe('Kernel', () => {
  it('installs modules in dependency order and starts them', async () => {
    const calls: string[] = [];
    const kernel = new Kernel();
    kernel.use({ id: 'b', depends: ['a'], install: () => void calls.push('install b') });
    kernel.use({
      id: 'a',
      install: () => void calls.push('install a'),
      start: () => void calls.push('start a'),
    });
    const started = vi.fn();
    kernel.events.on('kernel.started', started);
    await kernel.start();
    expect(calls).toEqual(['install a', 'install b', 'start a']);
    expect(kernel.installedModules).toEqual(['a', 'b']);
    expect(kernel.status).toBe('running');
    expect(started).toHaveBeenCalledOnce();
  });

  it('lets modules share services and actions', async () => {
    const counterKey = createServiceKey<{ count: number }>('test.counter');
    const kernel = new Kernel();
    kernel.use(
      defineModule({
        id: 'counter',
        install(ctx) {
          const counter = { count: 0 };
          ctx.services.provide(counterKey, counter);
          ctx.actions.register(
            defineAction({
              id: 'counter.add',
              params: z.object({ by: z.number() }),
              run: ({ by }) => (counter.count += by),
            }),
          );
        },
      }),
    );
    await kernel.start();
    await kernel.actions.run('counter.add', { by: 3 });
    expect(kernel.services.get(counterKey).count).toBe(3);
  });

  it('round-trips state and module data through snapshots', async () => {
    let memory = 'initial';
    const kernel = new Kernel({ now: () => 1000 });
    kernel.use({
      id: 'notes',
      install: () => {},
      serialize: () => ({ memory }),
      deserialize: (data) => {
        memory = (data as { memory: string }).memory;
      },
    });
    await kernel.start();
    kernel.state.set('game.gold', 5);
    const save = kernel.snapshot();
    expect(save).toEqual({
      format: 1,
      createdAt: 1000,
      state: { 'game.gold': 5 },
      modules: { notes: { memory: 'initial' } },
    });

    memory = 'changed';
    kernel.state.set('game.gold', 99);
    kernel.restore(JSON.parse(JSON.stringify(save)));
    expect(memory).toBe('initial');
    expect(kernel.state.get('game.gold')).toBe(5);
    expect(() => kernel.restore({ format: 2 })).toThrow();
  });

  it('runs cleanups in reverse order on stop', async () => {
    const calls: string[] = [];
    const kernel = new Kernel();
    kernel.use({
      id: 'a',
      install: (ctx) => {
        ctx.onDispose(() => calls.push('a1'));
        ctx.onDispose(() => calls.push('a2'));
      },
      dispose: () => void calls.push('dispose a'),
    });
    kernel.use({
      id: 'b',
      depends: ['a'],
      install: (ctx) => ctx.onDispose(() => calls.push('b1')),
    });
    await kernel.start();
    await kernel.stop();
    expect(calls).toEqual(['b1', 'a2', 'a1', 'dispose a']);
    expect(kernel.status).toBe('stopped');
  });

  it('refuses modules after start and duplicate ids', async () => {
    const kernel = new Kernel();
    kernel.use(mod('a'));
    expect(() => kernel.use(mod('a'))).toThrow(/twice/);
    await kernel.start();
    expect(() => kernel.use(mod('c'))).toThrow(/after the kernel has started/);
  });
});
