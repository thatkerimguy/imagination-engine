// Turkish, composed from per-domain parts. Typed as a full Record so a missing key is a compile
// error; i18n.ts still falls back to English at runtime for robustness.
import type { StringKey } from './strings-en.ts';
import { trContent } from './tr-content.ts';
import { trCore } from './tr-core.ts';
import { trScreens } from './tr-screens.ts';

export const tr: Record<StringKey, string> = { ...trCore, ...trScreens, ...trContent };
