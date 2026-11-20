// Font catalog: six zero-byte system stacks plus individual bundled Google Font faces.
// Every face is imported via its own subpath (never a package root barrel, which would pull in
// every weight). Each import is only an asset id (no font bytes in JS), and a face is loaded lazily on first use.
import { Platform } from 'react-native';
import F_Lora_400Regular from '@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf';
import F_Lora_400Regular_Italic from '@expo-google-fonts/lora/400Regular_Italic/Lora_400Regular_Italic.ttf';
import F_Merriweather_400Regular from '@expo-google-fonts/merriweather/400Regular/Merriweather_400Regular.ttf';
import F_Merriweather_400Regular_Italic from '@expo-google-fonts/merriweather/400Regular_Italic/Merriweather_400Regular_Italic.ttf';
import F_Literata_400Regular from '@expo-google-fonts/literata/400Regular/Literata_400Regular.ttf';
import F_Literata_400Regular_Italic from '@expo-google-fonts/literata/400Regular_Italic/Literata_400Regular_Italic.ttf';
import F_CrimsonPro_400Regular from '@expo-google-fonts/crimson-pro/400Regular/CrimsonPro_400Regular.ttf';
import F_CrimsonPro_400Regular_Italic from '@expo-google-fonts/crimson-pro/400Regular_Italic/CrimsonPro_400Regular_Italic.ttf';
import F_EBGaramond_400Regular from '@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf';
import F_EBGaramond_400Regular_Italic from '@expo-google-fonts/eb-garamond/400Regular_Italic/EBGaramond_400Regular_Italic.ttf';
import F_SourceSerif4_400Regular from '@expo-google-fonts/source-serif-4/400Regular/SourceSerif4_400Regular.ttf';
import F_SourceSerif4_400Regular_Italic from '@expo-google-fonts/source-serif-4/400Regular_Italic/SourceSerif4_400Regular_Italic.ttf';
import F_Inter_400Regular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf';
import F_Inter_400Regular_Italic from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf';
import F_SourceSans3_400Regular from '@expo-google-fonts/source-sans-3/400Regular/SourceSans3_400Regular.ttf';
import F_SourceSans3_400Regular_Italic from '@expo-google-fonts/source-sans-3/400Regular_Italic/SourceSans3_400Regular_Italic.ttf';
import F_AtkinsonHyperlegible_400Regular from '@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf';
import F_AtkinsonHyperlegible_400Regular_Italic from '@expo-google-fonts/atkinson-hyperlegible/400Regular_Italic/AtkinsonHyperlegible_400Regular_Italic.ttf';
import F_JetBrainsMono_400Regular from '@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf';
import F_JetBrainsMono_400Regular_Italic from '@expo-google-fonts/jetbrains-mono/400Regular_Italic/JetBrainsMono_400Regular_Italic.ttf';

export type FontCategory = 'system' | 'serif' | 'sans' | 'mono';

export interface FontPreset {
  id: string;
  label: string;
  category: FontCategory;
  /** fontFamily value to render with once loaded (system stacks are always ready). */
  family: string;
  /** Imported .ttf asset module for bundled faces; absent for system stacks. */
  source?: number;
  sample?: string;
}

const stack = (id: string, label: string, category: FontCategory, family: string): FontPreset => ({
  id,
  label,
  category,
  family,
});

const face = (id: string, label: string, category: FontCategory, source: number): FontPreset => ({
  id,
  label,
  category,
  family: id,
  source,
});

export const FONT_PRESETS: readonly FontPreset[] = [
  stack(
    'system-default',
    'System default',
    'system',
    Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }),
  ),
  stack(
    'classic-serif',
    'Classic serif',
    'serif',
    Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia, "Times New Roman", serif',
    }),
  ),
  stack(
    'editorial-sans',
    'Editorial sans',
    'sans',
    Platform.select({
      ios: 'Helvetica Neue',
      android: 'sans-serif-medium',
      default: '"Helvetica Neue", Arial, sans-serif',
    }),
  ),
  stack(
    'rounded-ui',
    'Rounded',
    'sans',
    Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-light',
      default: 'ui-rounded, "Avenir Next", system-ui, sans-serif',
    }),
  ),
  stack(
    'monospace',
    'Monospace',
    'mono',
    Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, Menlo, monospace',
    }),
  ),
  stack(
    'typewriter',
    'Typewriter',
    'mono',
    Platform.select({
      ios: 'Courier New',
      android: 'monospace',
      default: '"Courier New", Courier, monospace',
    }),
  ),
  face('lora', 'Lora', 'serif', F_Lora_400Regular),
  face('lora-italic', 'Lora Italic', 'serif', F_Lora_400Regular_Italic),
  face('merriweather', 'Merriweather', 'serif', F_Merriweather_400Regular),
  face('merriweather-italic', 'Merriweather Italic', 'serif', F_Merriweather_400Regular_Italic),
  face('literata', 'Literata', 'serif', F_Literata_400Regular),
  face('literata-italic', 'Literata Italic', 'serif', F_Literata_400Regular_Italic),
  face('crimson-pro', 'Crimson Pro', 'serif', F_CrimsonPro_400Regular),
  face('crimson-pro-italic', 'Crimson Pro Italic', 'serif', F_CrimsonPro_400Regular_Italic),
  face('eb-garamond', 'EB Garamond', 'serif', F_EBGaramond_400Regular),
  face('eb-garamond-italic', 'EB Garamond Italic', 'serif', F_EBGaramond_400Regular_Italic),
  face('source-serif-4', 'Source Serif 4', 'serif', F_SourceSerif4_400Regular),
  face('source-serif-4-italic', 'Source Serif 4 Italic', 'serif', F_SourceSerif4_400Regular_Italic),
  face('inter', 'Inter', 'sans', F_Inter_400Regular),
  face('inter-italic', 'Inter Italic', 'sans', F_Inter_400Regular_Italic),
  face('source-sans-3', 'Source Sans 3', 'sans', F_SourceSans3_400Regular),
  face('source-sans-3-italic', 'Source Sans 3 Italic', 'sans', F_SourceSans3_400Regular_Italic),
  face('atkinson-hyperlegible', 'Atkinson Hyperlegible', 'sans', F_AtkinsonHyperlegible_400Regular),
  face(
    'atkinson-hyperlegible-italic',
    'Atkinson Hyperlegible Italic',
    'sans',
    F_AtkinsonHyperlegible_400Regular_Italic,
  ),
  face('jetbrains-mono', 'JetBrains Mono', 'mono', F_JetBrainsMono_400Regular),
  face('jetbrains-mono-italic', 'JetBrains Mono Italic', 'mono', F_JetBrainsMono_400Regular_Italic),
];

export const getFontPreset = (id: string): FontPreset | undefined =>
  FONT_PRESETS.find((f) => f.id === id);

export const DEFAULT_FONT_ID = 'classic-serif';

/** One picker row per typeface family: the regular face (italics stay registered for rendering). */
export interface FontFamilyEntry {
  /** Id of the regular face; selecting the family stores this id. */
  id: string;
  label: string;
  category: FontCategory;
}

const FAMILY_LABEL: Readonly<Record<string, string>> = {
  'classic-serif': 'System Serif',
  'editorial-sans': 'Editorial Sans',
};
/** Legacy system stacks that stay valid ids but are not offered as picker rows. */
const UNLISTED = new Set(['system-default', 'rounded-ui', 'typewriter']);

export const isItalicFace = (id: string): boolean => id.endsWith('-italic');

/** Picker families in catalog order (no italic faces, no legacy stacks). */
export const FONT_FAMILIES: readonly FontFamilyEntry[] = FONT_PRESETS.filter(
  (f) => !isItalicFace(f.id) && !UNLISTED.has(f.id),
).map((f) => ({ id: f.id, label: FAMILY_LABEL[f.id] ?? f.label, category: f.category }));

/** The picker family id a stored font id belongs to (an italic face maps to its regular face). */
export const familyIdOf = (id: string): string =>
  isItalicFace(id) ? id.slice(0, -'-italic'.length) : id;

/** Label for a catalog font id (including legacy stacks), for rows not in FONT_FAMILIES. */
export const familyLabel = (id: string): string =>
  FAMILY_LABEL[id] ?? getFontPreset(id)?.label ?? id;
