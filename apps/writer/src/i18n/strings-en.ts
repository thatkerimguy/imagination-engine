// Canonical English dictionary, composed from per-domain parts (each file stays under 250 lines).
// Every other language must provide every key (type-checked); {{name}} placeholders must match.
import { enContent } from './en-content.ts';
import { enCore } from './en-core.ts';
import { enDna } from './en-dna.ts';
import { enGimmicks } from './en-gimmicks.ts';
import { enScreens } from './en-screens.ts';

export const en = { ...enCore, ...enScreens, ...enContent, ...enGimmicks, ...enDna } as const;

export type StringKey = keyof typeof en;
