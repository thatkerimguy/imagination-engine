// The compiled-book model every serializer (DOCX, PDF/HTML, Markdown, TXT) works from. Pure.
import type { Block } from '@kn/core';
import type { ChapterStyles } from '../store/chapter-styles.ts';

export type GimmickMode = 'transcript' | 'summary' | 'omit';

export interface BookSection {
  id: string;
  title: string;
  blocks: readonly Block[];
  styles: ChapterStyles;
  /** The chapter's inline v2 blueprints (cue export templates); starters are the fallback. */
  blueprints?: Readonly<Record<string, unknown>>;
  /** Print the title as a chapter heading (default true). */
  showTitle?: boolean;
}

export interface CompiledBook {
  title: string;
  subtitle?: string;
  author: string;
  /** File URI (native) or data URI (web). */
  cover?: string;
  sections: readonly BookSection[];
}

export interface ExportOptions {
  titlePage: boolean;
  toc: boolean;
  pageBreaks: boolean;
  gimmickMode: GimmickMode;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  titlePage: true,
  toc: false,
  pageBreaks: true,
  gimmickMode: 'transcript',
};

export type ExportFormat = 'docx' | 'epub' | 'pdf' | 'md' | 'html' | 'royalroad' | 'txt' | 'knbook' | 'print';

/** A filesystem-safe file stem from a title. */
export function fileStem(title: string): string {
  const s = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return (s || 'book').slice(0, 60);
}
