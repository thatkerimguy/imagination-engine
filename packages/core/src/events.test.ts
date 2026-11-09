import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events.ts';

interface TestEvents {
  ping: { n: number };
  empty: undefined;
}

describe('EventBus', () => {
  it('delivers payloads and unsubscribes', () => {
    const bus = new EventBus<TestEvents>();
    const seen: number[] = [];
    const off = bus.on('ping', (p) => seen.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([1]);
  });

  it('allows omitting undefined payloads', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('empty', handler);
    bus.emit('empty');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('fires once handlers a single time', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps delivering when a listener throws', () => {
    const report = vi.fn();
    const bus = new EventBus<TestEvents>(report);
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    expect(after).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
  });

  it('notifies onAny listeners with the event type', () => {
    const bus = new EventBus<TestEvents>();
    const seen: unknown[] = [];
    bus.onAny((type, payload) => seen.push([type, payload]));
    bus.emit('ping', { n: 3 });
    expect(seen).toEqual([['ping', { n: 3 }]]);
  });
});
