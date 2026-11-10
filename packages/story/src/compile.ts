import type { Value } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { z } from 'zod';
import { analyzeProject, type BlockInfo, type StoryProblem } from './analyze.ts';
import { compileFormula, type Expr } from './formula.ts';
import { storyProjectSchema } from './project.ts';
import type { MarkupNode } from './markup.ts';
import {
  type Block,
  type Chapter,
  type CharacterDef,
  type ChoiceBlock,
  type ChoiceOption,
  type Formula,
  type LocalText,
  type Passage,
  type StoryProject,
  type VariableDef,
} from './schema.ts';

export { listKey, type BlockInfo, type StoryProblem } from './analyze.ts';

export class StoryLoadError extends Error {
  constructor(readonly problems: readonly StoryProblem[]) {
    super(
      `The story has ${problems.length} problem(s):\n${problems.map((p) => `- ${p.message}`).join('\n')}`,
    );
    this.name = 'StoryLoadError';
  }
}

export interface CompiledStory {
  readonly project: StoryProject;
  readonly passages: ReadonlyMap<string, { readonly passage: Passage; readonly chapter: Chapter }>;
  readonly blocks: ReadonlyMap<string, BlockInfo>;
  readonly options: ReadonlyMap<
    string,
    { readonly option: ChoiceOption; readonly choice: ChoiceBlock }
  >;
  readonly lists: ReadonlyMap<string, readonly Block[]>;
  readonly variables: ReadonlyMap<string, VariableDef>;
  readonly characters: ReadonlyMap<string, CharacterDef>;
  readonly problems: readonly StoryProblem[];
  formula(formula: Formula): Expr;
  /** Parsed markup of a line in a language, falling back to the other language. */
  markup(text: LocalText, locale: Locale): readonly MarkupNode[];
  /** Variables a line interpolates, in either language. */
  textVars(text: LocalText): readonly string[];
}

export function defaultValue(def: VariableDef): Value {
  if (def.default !== undefined) return def.default;
  switch (def.type) {
    case 'number':
      return 0;
    case 'text':
      return '';
    case 'bool':
      return false;
    case 'list':
      return [];
    case 'enum':
      return def.values?.[0] ?? '';
  }
}

type Parsed = { project: StoryProject } | { problem: StoryProblem };

function parseProject(input: unknown): Parsed {
  const parsed = storyProjectSchema.safeParse(input);
  if (parsed.success) return { project: parsed.data };
  const detail = z.prettifyError(parsed.error);
  return { problem: { severity: 'error', code: 'schema', message: detail, params: { detail } } };
}

/** Every problem in a story, errors and warnings, without throwing (for the Studio's validator). */
export function checkStory(input: unknown): StoryProblem[] {
  const parsed = parseProject(input);
  return 'problem' in parsed ? [parsed.problem] : analyzeProject(parsed.project).problems;
}

export interface CompileOptions {
  /**
   * Index a story that still has errors. Only for previews that read values and render texts
   * (the Studio's screen preview); a story compiled this way must never be played.
   */
  readonly allowErrors?: boolean;
}

/** Validates and indexes a story. Throws {@link StoryLoadError} when it can't be played. */
export function compileStory(input: unknown, options: CompileOptions = {}): CompiledStory {
  const parsed = parseProject(input);
  if ('problem' in parsed) throw new StoryLoadError([parsed.problem]);
  const { project } = parsed;
  const a = analyzeProject(project);
  const errors = a.problems.filter((p) => p.severity === 'error');
  if (errors.length && !options.allowErrors) throw new StoryLoadError(errors);

  return {
    project,
    passages: a.passages,
    blocks: a.blocks,
    options: a.options,
    lists: a.lists,
    variables: a.variables,
    characters: a.characters,
    problems: a.problems,
    formula(formula) {
      const key = String(formula);
      let expr = a.formulas.get(key);
      if (!expr) {
        expr = compileFormula(formula);
        a.formulas.set(key, expr);
      }
      return expr;
    },
    markup(text, locale) {
      const other = project.languages.find((l) => l !== locale) ?? locale;
      return a.markups.get(`${text.id}:${locale}`) ?? a.markups.get(`${text.id}:${other}`) ?? [];
    },
    textVars(text) {
      return a.textVars.get(text.id) ?? [];
    },
  };
}
