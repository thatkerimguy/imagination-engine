import * as z from 'zod/mini';
import { isUlid } from './ids.ts';

/** Bump only with a migration; readers refuse manifests newer than they understand. */
export const SCHEMA_VERSION = 1;

const slug = z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Expected a lowercase slug'));
const ulidId = z.string().check(z.refine(isUlid, 'Expected a ULID'));
const nonEmpty = z.string().check(z.minLength(1));
const cssColor = z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb'));
const cssToken = z.string().check(z.regex(/^--[a-z0-9-]+$/, 'Expected a CSS custom property'));
const beatStop = z.optional(z.boolean());

export const sectionLabels = ['Season', 'Volume', 'Arc'] as const;
export const chapterStatuses = ['draft', 'unlisted', 'published'] as const;
export const proseStyles = ['body', 'whisper', 'emphasis'] as const;

export const novelManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: slug,
  title: nonEmpty,
  subtitle: z.optional(z.string()),
  author: nonEmpty,
  sectionLabel: z.enum(sectionLabels),
  /** CSS custom-property overrides applied to the reading root, e.g. `{"--accent": "#c43"}`. */
  theme: z.record(cssToken, z.string().check(z.maxLength(120))),
  enabledModules: z.array(slug),
  seasons: z.array(slug).check(z.minLength(1)),
});

export const seasonManifestSchema = z.object({
  id: slug,
  title: nonEmpty,
  subtitle: z.optional(z.string()),
  accentColor: z.optional(cssColor),
  chapters: z.array(slug),
});

export const proseBlockSchema = z.object({
  id: ulidId,
  kind: z.literal('prose'),
  text: nonEmpty,
  style: z.optional(z.enum(proseStyles)),
  beatStop,
});

export const dialogueBlockSchema = z.object({
  id: ulidId,
  kind: z.literal('dialogue'),
  speaker: nonEmpty,
  text: nonEmpty,
  accentColor: z.optional(cssColor),
  beatStop,
});

export const sceneBreakBlockSchema = z.object({
  id: ulidId,
  kind: z.literal('scene-break'),
  label: z.optional(z.string()),
  timestamp: z.optional(z.string()),
  beatStop,
});

export const moduleBlockSchema = z.object({
  id: ulidId,
  kind: z.literal('module'),
  moduleId: slug,
  moduleVersion: z.number().check(z.int(), z.positive()),
  props: z.record(z.string(), z.unknown()),
  beatStop,
});

export const blockSchema = z.discriminatedUnion('kind', [
  proseBlockSchema,
  dialogueBlockSchema,
  sceneBreakBlockSchema,
  moduleBlockSchema,
]);

export const chapterDocumentSchema = z
  .object({
    id: slug,
    seasonId: slug,
    title: nonEmpty,
    status: z.enum(chapterStatuses),
    blocks: z.array(blockSchema),
  })
  .check(
    z.refine(
      (chapter) => new Set(chapter.blocks.map((b) => b.id)).size === chapter.blocks.length,
      'Block ids must be unique within a chapter',
    ),
  );

export type NovelManifest = z.infer<typeof novelManifestSchema>;
export type SeasonManifest = z.infer<typeof seasonManifestSchema>;
export type ProseBlock = z.infer<typeof proseBlockSchema>;
export type DialogueBlock = z.infer<typeof dialogueBlockSchema>;
export type SceneBreakBlock = z.infer<typeof sceneBreakBlockSchema>;
export type ModuleBlock = z.infer<typeof moduleBlockSchema>;
export type Block = z.infer<typeof blockSchema>;
export type ChapterDocument = z.infer<typeof chapterDocumentSchema>;
export type SectionLabel = NovelManifest['sectionLabel'];
export type ChapterStatus = ChapterDocument['status'];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function parseWith<T>(schema: z.ZodMiniType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

export const parseNovelManifest = (data: unknown): ParseResult<NovelManifest> =>
  parseWith(novelManifestSchema, data);
export const parseSeasonManifest = (data: unknown): ParseResult<SeasonManifest> =>
  parseWith(seasonManifestSchema, data);
export const parseChapterDocument = (data: unknown): ParseResult<ChapterDocument> =>
  parseWith(chapterDocumentSchema, data);
