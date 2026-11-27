// `@kn/core/guard`: zero-dependency content checks for the reader (never pulls in Zod).
export { checkChapterDocument, checkNovelManifest, checkSeasonManifest } from './content.ts';
export { isUlid } from '../ids.ts';
export type {
  Block,
  ChapterDocument,
  ModuleBlock,
  NovelManifest,
  ParseResult,
  SeasonManifest,
} from '../schema.ts';
