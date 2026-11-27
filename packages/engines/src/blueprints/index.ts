// `@kn/engines/blueprints`: the 28 starter v2 blueprints (2 per engine). Pure data: the writer
// seeds its catalog from these; the reader loads them only lazily (sandbox / dev fallback).
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { BATCH_A } from './batch-a.ts';
import { BATCH_B } from './batch-b.ts';
import { BATCH_C } from './batch-c.ts';
import { BATCH_D } from './batch-d.ts';

/** Every starter blueprint (28: 2 per engine) in catalog order. */
export const STARTER_BLUEPRINT_LIST: readonly GimmickBlueprint[] = [
  ...BATCH_A,
  ...BATCH_B,
  ...BATCH_C,
  ...BATCH_D,
];

export const STARTER_BLUEPRINTS_V2: ReadonlyMap<string, GimmickBlueprint> = new Map(
  STARTER_BLUEPRINT_LIST.map((b) => [b.id, b]),
);

export const starterBlueprint = (id: string): GimmickBlueprint | null =>
  STARTER_BLUEPRINTS_V2.get(id) ?? null;
