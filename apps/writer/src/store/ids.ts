import { ulid } from '@kn/core';

/** Block ids are canonical ULIDs. */
export const newBlockId = (): string => ulid();

/** Novel / season / chapter ids must be lowercase slugs, so they use the lowercased ULID. */
export const newSlugId = (): string => ulid().toLowerCase();
