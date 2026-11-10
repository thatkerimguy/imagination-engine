import { describe, expect, it } from 'vitest';
import { reportTyped, Typewriter, type RevealStep, type Scheduler } from './typewriter.ts';

/** A scheduler driven by hand, so tests control time exactly. */
function manualClock() {
  let now = 0;
  const queue: { at: number; fn: () => void; id: number }[] = [];
  let ids = 0;
  const scheduler: Scheduler = {
    set: (fn, ms) => {
      const id = ++ids;
      queue.push({ at: now + ms, fn, id });
      return id;
    },
    clear: (handle) => {
      const i = queue.findIndex((q) => q.id === handle);
      if (i >= 0) queue.splice(i, 1);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      queue.sort((a, b) => a.at - b.at);
      const next = queue[0];
      if (!next || next.at > end) break;
      queue.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { scheduler, advance };
}

function run(text: string, speed = 1) {
  const seen: number[] = [];
  const step: RevealStep = { kind: 'chars', text, speed, reveal: (n) => seen.push(n) };
  return { step, seen };
}

describe('Typewriter', () => {
  it('reveals one character per tick at the chosen speed', () => {
    const clock = manualClock();
    const typewriter = new Typewriter(10, clock.scheduler); // 100 ms per character
    const { step, seen } = run('abcd');
    let done = false;
    typewriter.play([step], () => (done = true));
    expect(seen).toEqual([1]);
    clock.advance(250);
    expect(seen).toEqual([1, 2, 3]);
    clock.advance(1000);
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(done).toBe(true);
    expect(typewriter.busy).toBe(false);
  });

  it('pauses at the end of a sentence but not inside a number', () => {
    const clock = manualClock();
    const typewriter = new Typewriter(10, clock.scheduler);
    const { step, seen } = run('3.5. Go');
    typewriter.play([step]);
    clock.advance(300); // "3", ".", "5", "." revealed by t=300, then the sentence pause
    expect(seen.at(-1)).toBe(4);
    clock.advance(200);
    expect(seen.at(-1)).toBe(4);
    clock.advance(200);
    expect(seen.at(-1)).toBe(5);
  });

  it('skip reveals everything at once and reports done', () => {
    const clock = manualClock();
    const typewriter = new Typewriter(10, clock.scheduler);
    const a = run('hello');
    let whole = false;
    let done = 0;
    typewriter.play(
      [
        a.step,
        { kind: 'pause', ms: 500 },
        { kind: 'whole', length: 3, reveal: () => (whole = true) },
      ],
      () => done++,
    );
    typewriter.skip();
    expect(a.seen.at(-1)).toBe(5);
    expect(whole).toBe(true);
    expect(done).toBe(1);
    clock.advance(5000);
    expect(done).toBe(1);
  });

  it('instant speed shows the text immediately', () => {
    const typewriter = new Typewriter(Number.POSITIVE_INFINITY, manualClock().scheduler);
    const { step, seen } = run('abc');
    let done = false;
    typewriter.play([step], () => (done = true));
    expect(seen).toEqual([3]);
    expect(done).toBe(true);
  });

  it('reveals several characters per tick when faster than a frame', () => {
    const clock = manualClock();
    const typewriter = new Typewriter(500, clock.scheduler); // 2 ms per character
    const { step, seen } = run('abcdefghijklmnopqrstuvwxyz');
    typewriter.play([step]);
    expect(seen[0]).toBe(8);
  });

  it('honours the speed effect and silent pauses', () => {
    const clock = manualClock();
    const typewriter = new Typewriter(10, clock.scheduler);
    const slow = run('ab', 0.5); // 200 ms per character
    const fast = run('cd');
    typewriter.play([slow.step, { kind: 'pause', ms: 1000 }, fast.step]);
    clock.advance(199);
    expect(slow.seen).toEqual([1]);
    clock.advance(1);
    expect(slow.seen).toEqual([1, 2]);
    // The last slow character still takes its 200 ms (until t=400), then the 1 s silence.
    clock.advance(1100);
    expect(fast.seen).toEqual([]);
    clock.advance(150);
    expect(fast.seen).toEqual([1]);
  });
});

describe('reportTyped', () => {
  it('reports each newly revealed run once', () => {
    const shown: number[] = [];
    const typed: string[] = [];
    const steps: RevealStep[] = [
      { kind: 'chars', text: 'Hello', speed: 1, reveal: (n) => shown.push(n) },
      { kind: 'pause', ms: 10 },
    ];
    const wrapped = reportTyped(steps, (t) => typed.push(t));
    const first = wrapped[0];
    if (first?.kind !== 'chars') throw new Error('expected chars');
    first.reveal(2);
    first.reveal(2);
    first.reveal(5);
    expect(typed).toEqual(['He', 'llo']);
    expect(shown).toEqual([2, 2, 5]);
    expect(wrapped[1]).toBe(steps[1]);
  });
});
