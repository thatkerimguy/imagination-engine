// Shared by the native and web teaser exporters (identical call signature).
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import type { TeaserCard } from './teaser-model.ts';

/** Ref to the full-size card view. */
export type CardRef = ComponentRef<typeof View>;

export interface TeaserExportInput {
  card: TeaserCard;
  /** File name stem; the file is saved as `<stem>-teaser.png`. */
  stem: string;
  /** Native only: the hidden full-size card that gets captured. */
  viewRef: RefObject<CardRef | null>;
}

export type TeaserExportResult =
  { ok: true; status: 'saved' | 'cancelled'; filename: string } | { ok: false; message: string };

export const teaserFilename = (stem: string): string =>
  `${stem.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'chapter'}-teaser.png`;
