import { describe, expect, it } from 'vitest';
import { MODE_CHOICES, workspaceCapabilities, type WorkspaceCapabilities } from './mode-policy.ts';

type Flag = keyof WorkspaceCapabilities;
const GIMMICK: Flag[] = [
  'cues',
  'livePreview',
  'recordMode',
  'gimmickExportMode',
  'webPublish',
  'modulesSettings',
];
const KEPT: Flag[] = [
  'compile',
  'outline',
  'versionHistory',
  'readAloud',
  'storyLinks',
  'dialogue',
  'sceneBreaks',
  'staticTeaser',
];

describe('workspaceCapabilities', () => {
  it('prose hides every gimmick surface', () => {
    const c = workspaceCapabilities('prose');
    for (const f of GIMMICK) expect(c[f], f).toBe(false);
  });

  it('prose keeps the classic novel toolkit', () => {
    const c = workspaceCapabilities('prose');
    for (const f of KEPT) expect(c[f], f).toBe(true);
  });

  it('interactive is a strict superset of prose', () => {
    const p = workspaceCapabilities('prose');
    const i = workspaceCapabilities('interactive');
    for (const f of Object.keys(p) as Flag[]) if (p[f]) expect(i[f], f).toBe(true);
    for (const f of GIMMICK) expect(i[f], f).toBe(true);
  });

  it('note has no compile, cues or publish', () => {
    const n = workspaceCapabilities('note');
    for (const f of [...GIMMICK, 'compile', 'staticTeaser', 'outline'] as Flag[]) {
      expect(n[f], f).toBe(false);
    }
    expect(n.formatting).toBe(true);
    expect(n.storyLinks).toBe(true);
  });
});

describe('MODE_CHOICES', () => {
  it('offers prose then interactive with copy', () => {
    expect(MODE_CHOICES.map((c) => c.mode)).toEqual(['prose', 'interactive']);
    expect(MODE_CHOICES.map((c) => c.label)).toEqual(['Classic Novel', 'Interactive Studio']);
    for (const c of MODE_CHOICES) expect(c.hint.length).toBeGreaterThan(0);
  });
});
