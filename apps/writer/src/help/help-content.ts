// Pure copy + data for Help & Legal (100% offline).
import type { GlyphName } from '../ui/Glyph.tsx';

export interface HelpCard {
  icon: GlyphName;
  title: string;
  body: string;
}

export const MARKUP_ROWS: readonly { syntax: string; result: string }[] = [
  { syntax: '**bold**', result: 'Bold' },
  { syntax: '*italic*', result: 'Italic' },
  { syntax: '++underline++', result: 'Underline' },
  { syntax: '~~strike~~', result: 'Strikethrough' },
  { syntax: '==highlight==', result: 'Highlight' },
];

export const MARKUP_NOTE =
  'Dialogue and scene breaks are their own blocks: add them from the Add block menu in the Chapter Editor.';

export const BACKUP_CARDS: readonly HelpCard[] = [
  {
    icon: 'hard-drive',
    title: 'External backup folder',
    body: 'On Android, link a folder in Settings › Backup & Restore. Your novels are mirrored there so they survive a phone change.',
  },
  {
    icon: 'trash-2',
    title: '30-day Trash',
    body: 'Deleted items rest in Trash for 30 days. Restore them any time before then.',
  },
  {
    icon: 'book-open',
    title: 'EPUB 3 export',
    body: 'Compile a novel into an EPUB 3 file for e-readers. Interactive cues become calm text.',
  },
  {
    icon: 'globe',
    title: 'Web publishing',
    body: 'Publish a novel to a shareable link, and unpublish it whenever you like from the same screen.',
  },
];

export const WHATS_NEW: readonly string[] = [
  'Welcome tour and this Help & Legal guide, both fully offline.',
  'Backups to an external folder, plus a 30-day Trash.',
  'EPUB 3 export and web publishing with takedown tools.',
  'Large-screen layouts, hardware keyboard shortcuts and Calm Mode.',
];

export interface LicenseEntry {
  name: string;
  license: string;
  notice: string;
}

export const OFL_NOTICE =
  'Bundled fonts are licensed under the SIL Open Font License 1.1: free to use, embed and share with their copyright notices; they may not be sold on their own.';

export const LICENSES: readonly LicenseEntry[] = [
  {
    name: 'Lora, Merriweather, Literata, Crimson Pro, EB Garamond, Source Serif 4, Inter, Source Sans 3, Atkinson Hyperlegible, JetBrains Mono',
    license: 'SIL OFL 1.1',
    notice: 'Copyright their respective authors, distributed via Google Fonts.',
  },
  {
    name: 'React Native, React',
    license: 'MIT',
    notice: 'Copyright Meta Platforms, Inc. and affiliates.',
  },
  { name: 'Expo and Expo modules', license: 'MIT', notice: 'Copyright 650 Industries, Inc.' },
  { name: 'Feather Icons', license: 'MIT', notice: 'Copyright Cole Bemis.' },
  { name: 'fflate', license: 'MIT', notice: 'Copyright Arjun Barrett.' },
  { name: 'zod', license: 'MIT', notice: 'Copyright Colin McDonnell.' },
  {
    name: 'Three.js (web reader only)',
    license: 'MIT',
    notice: 'Copyright three.js authors.',
  },
];

export const MIT_SUMMARY =
  'MIT: permission is granted, free of charge, to use, copy, modify and distribute the software, provided the copyright and permission notice are kept. The software is provided "as is", without warranty.';

export const PRIVACY_SUMMARY =
  'Your writing stays on this device. Nothing is uploaded unless you publish a novel yourself. No account is needed to read or write.';

export const TERMS_SUMMARY =
  'You own what you write and are responsible for what you publish. Published content must follow the publishing terms, and may be taken down if it does not.';

export type LegalPage = 'terms' | 'privacy' | 'takedown';

/** `<base>/legal/<page>`, or '' when no (valid) API base URL is configured. */
/** Fallback host for the legal pages when no Publish API URL is configured (launch domain). */
export const DEFAULT_LEGAL_BASE = 'https://read.imaginationengine.app';

export function legalUrl(base: string, page: LegalPage): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+/i.test(trimmed) ? `${trimmed}/legal/${page}` : '';
}
