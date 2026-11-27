// Progressive disclosure: the single source of truth for which authoring chrome each workspace
// mode shows. Pure (no React Native import) so screens, sheets and tests share one answer.
// `note` is the notes workspace; `prose` (Classic Novel) and `interactive` (Interactive Studio)
// are a book's reversible WorkspaceMode — switching never touches stored blocks.
import type { WorkspaceMode } from '@kn/core';

export type EditorMode = 'note' | WorkspaceMode;

export interface WorkspaceCapabilities {
  /** Bold / italic / underline / strike / headings / lists in the toolbar. */
  formatting: boolean;
  checklists: boolean;
  /** `@Title` and `[[Title]]` Story Bible links with autocomplete. */
  storyLinks: boolean;
  backlinks: boolean;
  readAloud: boolean;
  dialogue: boolean;
  sceneBreaks: boolean;
  outline: boolean;
  versionHistory: boolean;
  /** EPUB 3, DOCX, PDF, Markdown, TXT, Royal Road HTML, .knbook and Print. */
  compile: boolean;
  /** The static quote teaser card (always available to books). */
  staticTeaser: boolean;
  /** Insert Cue (gimmick) button, cue cards and cue pills. */
  cues: boolean;
  livePreview: boolean;
  /** 9:16 Teaser Studio recording. */
  recordMode: boolean;
  gimmickExportMode: boolean;
  webPublish: boolean;
  /** The Interactive Modules checklist in Book Settings. */
  modulesSettings: boolean;
}

const NOTE: WorkspaceCapabilities = {
  formatting: true,
  checklists: true,
  storyLinks: true,
  backlinks: true,
  readAloud: true,
  // Notes keep the chapter editor's dialogue and scene-break blocks.
  dialogue: true,
  sceneBreaks: true,
  outline: false,
  versionHistory: false,
  compile: false,
  staticTeaser: false,
  cues: false,
  livePreview: false,
  recordMode: false,
  gimmickExportMode: false,
  webPublish: false,
  modulesSettings: false,
};

const PROSE: WorkspaceCapabilities = {
  ...NOTE,
  outline: true,
  versionHistory: true,
  compile: true,
  staticTeaser: true,
};

const INTERACTIVE: WorkspaceCapabilities = {
  ...PROSE,
  cues: true,
  livePreview: true,
  recordMode: true,
  gimmickExportMode: true,
  webPublish: true,
  modulesSettings: true,
};

const BY_MODE: Readonly<Record<EditorMode, WorkspaceCapabilities>> = {
  note: NOTE,
  prose: PROSE,
  interactive: INTERACTIVE,
};

/** Every UI visibility flag for `mode`. Pure; returns a frozen shared object. */
export function workspaceCapabilities(mode: EditorMode): Readonly<WorkspaceCapabilities> {
  return BY_MODE[mode];
}

/** Picker copy shared by New Novel, Book Settings and Settings › Default workspace. */
export const MODE_CHOICES: readonly {
  mode: WorkspaceMode;
  label: string;
  hint: string;
  labelKey: 'mode.prose' | 'mode.interactive';
  hintKey: 'mode.proseHint' | 'mode.interactiveHint';
}[] = [
  {
    mode: 'prose',
    label: 'Classic Novel',
    hint: 'Clean, distraction-free prose. Export anywhere.',
    labelKey: 'mode.prose',
    hintKey: 'mode.proseHint',
  },
  {
    mode: 'interactive',
    label: 'Interactive Studio',
    hint: 'Kinetic cues, Live Preview and 9:16 teasers.',
    labelKey: 'mode.interactive',
    hintKey: 'mode.interactiveHint',
  },
];
