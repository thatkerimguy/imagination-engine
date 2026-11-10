import { findKit } from '@ie/kits';
import { analyzeProject, storyProjectSchema } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { UNTITLED } from '../messages.ts';
import { wizardProject } from './wizard.ts';

describe('the new-novel wizard', () => {
  it('makes a blank novel in the chosen look and languages', () => {
    const doc = wizardProject(null, 'terminal', {}, ['tr'], 'Başlangıç');
    expect(storyProjectSchema.safeParse(doc).success).toBe(true);
    expect(doc.title).toEqual(UNTITLED);
    expect(doc.theme).toEqual({ preset: 'terminal' });
    expect(doc.languages).toEqual(['tr']);
  });

  it('makes a playable novel from a kit, with another look if asked', () => {
    const kit = findKit('chat');
    if (!kit) throw new Error('fixture');
    const doc = wizardProject(kit, 'paper', { en: 'Texts' }, ['en', 'tr'], 'Start');
    expect(doc.title).toEqual({ en: 'Texts' });
    expect(doc.layout).toBe('chat');
    expect(doc.theme).toEqual({ preset: 'paper' });
    expect(doc.kits).toEqual(['chat']);
    expect(analyzeProject(doc).problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});
