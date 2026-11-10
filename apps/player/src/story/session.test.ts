import { createMemoryStore } from '@ie/core';
import { samples } from '@ie/samples';
import { compileStory } from '@ie/story';
import { describe, expect, it, vi } from 'vitest';
import { persistentKey, readSave, saveKey } from './saves.ts';
import { StorySession } from './session.ts';

const story = compileStory(samples.rainAlley);
const host = { runAction: () => {} };

/** Taps through lines until something other than a line waits. */
function tapThrough(session: StorySession) {
  while (session.canAdvance) session.advance();
  return session.runtime.waiting;
}

describe('StorySession', () => {
  it('starts a fresh story and types its first line', async () => {
    const session = await StorySession.open(story, createMemoryStore(), host);
    const beats = session.start();
    expect(beats.map((b) => b.kind)).toEqual(['passage', 'line']);
    expect(session.canGoBack).toBe(false);
  });

  it('has progress to continue only once the story has run to something to read', async () => {
    const store = createMemoryStore();
    const session = await StorySession.open(story, store, host);
    expect(session.hasProgress).toBe(false);
    session.start();
    expect(session.hasProgress).toBe(true);
    await session.flush();
    expect((await StorySession.open(story, store, host)).hasProgress).toBe(true);
  });

  it('steps back through reader actions', async () => {
    const session = await StorySession.open(story, createMemoryStore(), host);
    session.start();
    expect(tapThrough(session)?.kind).toBe('input');
    session.submit('Ayşe');
    expect(session.runtime.value('name')).toBe('Ayşe');
    expect(session.back()).toBe(true);
    expect(session.runtime.waiting?.kind).toBe('input');
    expect(session.runtime.value('name')).toBe('Can');
  });

  it('resumes exactly where the reader left off after a reload', async () => {
    const store = createMemoryStore();
    const first = await StorySession.open(story, store, host);
    first.start();
    tapThrough(first);
    first.submit('Kerim');
    await first.flush();

    const second = await StorySession.open(story, store, host);
    expect(second.start()).toEqual([]); // nothing to type: the page is redrawn instead
    expect(second.runtime.snapshot()).toEqual(first.runtime.snapshot());
    expect(second.runtime.value('name')).toBe('Kerim');
  });

  it('keeps the way back across a reload, but not into an abandoned branch', async () => {
    const store = createMemoryStore();
    const first = await StorySession.open(story, store, host);
    first.start();
    tapThrough(first);
    first.submit('Ayşe');
    first.advance();
    await first.flush();

    const second = await StorySession.open(story, store, host);
    expect(second.canGoBack).toBe(true);
    expect(second.back()).toBe(true);
    expect(second.back()).toBe(true);
    expect(second.runtime.waiting?.kind).toBe('input');
    // A different answer, and the tab closes before the history is saved again.
    second.submit('Deniz');
    second.advance();
    await second.flush();

    const third = await StorySession.open(story, store, host);
    expect(third.runtime.value('name')).toBe('Deniz');
    const names: unknown[] = [];
    while (third.back()) names.push(third.runtime.value('name'));
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('Ayşe');
  });

  it('saves to a slot and loads it back after a restart', async () => {
    const session = await StorySession.open(story, createMemoryStore(), host);
    session.start();
    tapThrough(session);
    session.submit('Deniz');
    await session.save(1);
    const saved = session.runtime.snapshot();

    session.restart();
    expect(session.runtime.value('name')).toBe('Can');
    expect(await session.load(1)).toEqual([]);
    expect(session.runtime.snapshot()).toEqual(saved);
    expect(await session.load(2)).toBeNull();
  });

  it('keeps persistent values across playthroughs and in their own record', async () => {
    const store = createMemoryStore();
    const session = await StorySession.open(story, store, host);
    session.start();
    session.advance(); // the prologue counts the walk after its first line
    expect(session.runtime.value('runs')).toBe(1);
    session.restart();
    session.advance();
    expect(session.runtime.value('runs')).toBe(2);
    await session.flush();
    expect(await store.get(persistentKey(story.project.id))).toEqual({ runs: 2 });
  });

  it('finds the history entry for an earlier choice', async () => {
    const session = await StorySession.open(story, createMemoryStore(), host);
    session.start();
    tapThrough(session);
    session.submit('');
    const choice = tapThrough(session);
    expect(choice?.kind).toBe('choice');
    session.choose('pro_she');
    const chosenAt = session.runtime.log.findIndex((b) => b.kind === 'chosen');
    const point = session.choicePoint(chosenAt);
    expect(point).not.toBeNull();
    session.advance();
    expect(session.rewindTo(point ?? -1)).toBe(true);
    expect(session.runtime.waiting).toEqual(choice);
  });

  it('treats a damaged save as empty instead of failing', async () => {
    const store = createMemoryStore();
    await store.set(saveKey(story.project.id, 'auto'), {
      v: 1,
      storyId: story.project.id,
      state: 'nonsense',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await readSave(store, story.project.id, 'auto')).toBeUndefined();
    const session = await StorySession.open(story, store, host);
    expect(session.start().length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
