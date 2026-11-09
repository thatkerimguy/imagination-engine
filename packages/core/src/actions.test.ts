import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ActionBus, ActionError, defineAction } from './actions.ts';

const add = defineAction({
  id: 'math.add',
  params: z.object({ a: z.number(), b: z.number() }),
  run: ({ a, b }) => a + b,
});

describe('ActionBus', () => {
  it('validates params and returns the result', async () => {
    const bus = new ActionBus();
    bus.register(add);
    await expect(bus.run('math.add', { a: 2, b: 3 })).resolves.toBe(5);
  });

  it('rejects invalid params with a readable error', async () => {
    const bus = new ActionBus();
    bus.register(add);
    await expect(bus.run('math.add', { a: 'two', b: 3 })).rejects.toThrow(/Invalid parameters/);
  });

  it('rejects unknown actions and bad ids', async () => {
    const bus = new ActionBus();
    await expect(bus.run('nope.nothing')).rejects.toBeInstanceOf(ActionError);
    expect(() => bus.register({ ...add, id: 'NoDot' })).toThrow(/domain.verb/);
  });

  it('refuses duplicate registrations', () => {
    const bus = new ActionBus();
    bus.register(add);
    expect(() => bus.register(add)).toThrow(/already registered/);
  });

  it('logs successes and failures', async () => {
    let t = 0;
    const bus = new ActionBus({ now: () => (t += 5), logSize: 2 });
    bus.register(add);
    bus.register(
      defineAction({
        id: 'math.fail',
        params: z.object({}),
        run: () => {
          throw new Error('nope');
        },
      }),
    );
    await bus.run('math.add', { a: 1, b: 1 }, { source: 'test' });
    await expect(bus.run('math.fail', {}, { source: 'test' })).rejects.toThrow(/nope/);
    await bus.run('math.add', { a: 1, b: 1 });
    const log = bus.recent();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ id: 'math.fail', ok: false, source: 'test' });
    expect(log[1]).toMatchObject({ id: 'math.add', ok: true, source: 'unknown' });
  });

  it('unregisters', async () => {
    const bus = new ActionBus();
    const off = bus.register(add);
    off();
    expect(bus.has('math.add')).toBe(false);
    await expect(bus.run('math.add', { a: 1, b: 1 })).rejects.toThrow(/Unknown action/);
  });
});
