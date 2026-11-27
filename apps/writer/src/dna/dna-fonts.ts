// System font family per DNA font voice (no downloads); React Native only.
import type { FontVoice } from '@kn/core/dna';
import { Platform } from 'react-native';
import { mono, sans, serif } from '../ui/type.ts';

const pick = (ios: string, android: string, web: string): string =>
  Platform.select({ ios, android, default: web }) ?? web;

export function fontFamilyFor(v: FontVoice): string {
  switch (v) {
    case 'serif-editorial':
      return serif ?? 'serif';
    case 'serif-antique':
      return pick('Palatino', 'serif', "'Palatino Linotype', Palatino, Georgia, serif");
    case 'sans-clean':
      return sans ?? 'sans-serif';
    case 'sans-condensed':
      return pick(
        'System',
        'sans-serif-condensed',
        "'Bahnschrift SemiCondensed', 'Arial Narrow', sans-serif",
      );
    case 'mono-terminal':
      return mono ?? 'monospace';
    case 'mono-typewriter':
      return pick('Courier New', 'monospace', "'Courier New', Courier, monospace");
  }
}
