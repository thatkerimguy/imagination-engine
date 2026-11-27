// Spanish (neutral Latin-American / Castilian-safe), composed from per-domain parts. Typed as a
// full Record so a missing key is a compile error; i18n.ts still falls back to English at runtime.
import { esContent } from './es-content.ts';
import { esCore } from './es-core.ts';
import { esDna } from './es-dna.ts';
import { esGimmicks } from './es-gimmicks.ts';
import { esScreens } from './es-screens.ts';
import type { StringKey } from './strings-en.ts';

export const es: Record<StringKey, string> = { ...esCore, ...esScreens, ...esContent, ...esGimmicks, ...esDna };
