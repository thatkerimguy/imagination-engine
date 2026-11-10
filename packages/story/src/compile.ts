import type { Value } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { z } from 'zod';
import { parseDice } from './dice.ts';
import { compileFormula, FormulaError, references, type Expr } from './formula.ts';
import { markupReferences, MarkupError, parseMarkup, type MarkupNode } from './markup.ts';
import {
  storyProjectSchema,
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

export interface StoryProblem {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  /** The passage, block or line the problem is in. */
  readonly where?: string;
}

export class StoryLoadError extends Error {
  constructor(readonly problems: readonly StoryProblem[]) {
    super(
      `The story has ${problems.length} problem(s):\n${problems.map((p) => `- ${p.message}`).join('\n')}`,
    );
    this.name = 'StoryLoadError';
  }
}

export interface BlockInfo {
  readonly block: Block;
  readonly list: string;
  readonly passage: string;
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

/** List keys of the execution stack (see Frame in state.ts). */
export const listKey = {
  passage: (id: string) => `p:${id}`,
  option: (id: string) => `o:${id}`,
  branch: (id: string) => `b:${id}`,
  else: (ifId: string) => `e:${ifId}`,
  success: (checkId: string) => `s:${checkId}`,
  fail: (checkId: string) => `f:${checkId}`,
};

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

/** Whether a block list always leaves its passage (Jump, End, Return) instead of running out. */
function leaves(list: readonly Block[]): boolean {
  return list.some((block) => {
    switch (block.type) {
      case 'jump':
      case 'end':
      case 'return':
        return true;
      case 'if':
        return (
          block.else !== undefined &&
          leaves(block.else) &&
          block.branches.every((b) => leaves(b.then))
        );
      case 'choice':
        return block.options.every((o) => leaves(o.then));
      case 'random':
        return block.branches.every((b) => leaves(b.then));
      case 'check':
        return leaves(block.success) && leaves(block.fail);
      default:
        return false;
    }
  });
}

/** Validates and indexes a story. Throws {@link StoryLoadError} when it can't be played. */
export function compileStory(input: unknown): CompiledStory {
  const parsed = storyProjectSchema.safeParse(input);
  if (!parsed.success) {
    throw new StoryLoadError([
      { severity: 'error', code: 'schema', message: z.prettifyError(parsed.error) },
    ]);
  }
  const project = parsed.data as StoryProject;
  const problems: StoryProblem[] = [];
  const report = (
    severity: StoryProblem['severity'],
    code: string,
    message: string,
    where?: string,
  ) =>
    problems.push(
      where === undefined ? { severity, code, message } : { severity, code, message, where },
    );

  const variables = new Map(project.variables.map((v) => [v.id, v]));
  const characters = new Map(project.characters.map((c) => [c.id, c]));
  const passages = new Map<string, { passage: Passage; chapter: Chapter }>();
  const blocks = new Map<string, BlockInfo>();
  const options = new Map<string, { option: ChoiceOption; choice: ChoiceBlock }>();
  const lists = new Map<string, readonly Block[]>();
  const formulas = new Map<string, Expr>();
  const markups = new Map<string, readonly MarkupNode[]>();
  const textVars = new Map<string, readonly string[]>();
  const lineIds = new Set<string>();
  const nodeIds = new Set<string>();
  const targets = { jump: new Set<string>(), call: new Set<string>() };
  const pendingRefs: { passages: Set<string>; options: Set<string>; where: string }[] = [];

  for (const chapter of project.chapters) {
    for (const passage of chapter.passages) {
      if (passages.has(passage.id))
        report('error', 'duplicate-id', `Two passages share the ID "${passage.id}".`, passage.id);
      passages.set(passage.id, { passage, chapter });
    }
  }

  const unique = (id: string, where: string) => {
    if (nodeIds.has(id)) report('error', 'duplicate-id', `The ID "${id}" is used twice.`, where);
    nodeIds.add(id);
  };

  const useFormula = (formula: Formula, where: string): Expr | undefined => {
    try {
      const expr = compileFormula(formula);
      formulas.set(String(formula), expr);
      const refs = references(expr);
      for (const id of refs.vars) {
        if (!variables.has(id))
          report(
            'error',
            'unknown-variable',
            `"${String(formula)}" uses "${id}", which isn't a variable.`,
            where,
          );
      }
      pendingRefs.push({ passages: refs.passages, options: refs.options, where });
      return expr;
    } catch (error) {
      const message = error instanceof FormulaError ? error.message : String(error);
      report('error', 'formula', `In "${String(formula)}": ${message}`, where);
      return undefined;
    }
  };

  const useText = (text: LocalText, where: string) => {
    if (lineIds.has(text.id))
      report('error', 'duplicate-line', `Two lines share the line ID "${text.id}".`, where);
    lineIds.add(text.id);
    const vars = new Set<string>();
    for (const locale of project.languages) {
      const source = text[locale];
      if (source === undefined) {
        report(
          'warning',
          'missing-translation',
          `Line "${text.id}" has no ${locale === 'tr' ? 'Turkish' : 'English'} text.`,
          where,
        );
        continue;
      }
      try {
        const nodes = parseMarkup(source);
        markups.set(`${text.id}:${locale}`, nodes);
        const refs = markupReferences(nodes);
        for (const id of refs.vars) {
          if (!variables.has(id))
            report(
              'error',
              'unknown-variable',
              `Line "${text.id}" uses {${id}}, which isn't a variable.`,
              where,
            );
          vars.add(id);
        }
        for (const id of refs.characters) {
          if (!characters.has(id))
            report(
              'error',
              'unknown-character',
              `Line "${text.id}" uses {@${id}}, which isn't a character.`,
              where,
            );
        }
      } catch (error) {
        const message = error instanceof MarkupError ? error.message : String(error);
        report('error', 'markup', `Line "${text.id}" (${locale}): ${message}`, where);
      }
    }
    textVars.set(text.id, [...vars]);
  };

  const needVar = (id: string, where: string, type?: VariableDef['type']) => {
    const def = variables.get(id);
    if (!def) report('error', 'unknown-variable', `"${id}" isn't a variable.`, where);
    else if (type && def.type !== type)
      report('error', 'variable-type', `"${id}" must be a ${type} variable.`, where);
  };

  const walk = (list: readonly Block[], key: string, passageId: string) => {
    lists.set(key, list);
    for (const block of list) {
      unique(block.id, block.id);
      blocks.set(block.id, { block, list: key, passage: passageId });
      switch (block.type) {
        case 'narration':
          useText(block.text, block.id);
          break;
        case 'dialogue':
          useText(block.text, block.id);
          if (!characters.has(block.speaker))
            report('error', 'unknown-character', `"${block.speaker}" isn't a character.`, block.id);
          break;
        case 'choice':
          if (block.prompt) useText(block.prompt, block.id);
          if (block.timer?.default && !block.options.some((o) => o.id === block.timer?.default)) {
            report(
              'error',
              'timer-default',
              `The timer's default "${block.timer.default}" isn't one of this choice's options.`,
              block.id,
            );
          }
          for (const option of block.options) {
            unique(option.id, option.id);
            options.set(option.id, { option, choice: block });
            useText(option.text, option.id);
            if (option.lockedText) useText(option.lockedText, option.id);
            if (option.visibleIf !== undefined) useFormula(option.visibleIf, option.id);
            if (option.enabledIf !== undefined) useFormula(option.enabledIf, option.id);
            if (option.cost) {
              needVar(option.cost.var, option.id, 'number');
              useFormula(option.cost.amount, option.id);
            }
            if (option.showOdds && option.then[0]?.type !== 'check') {
              report(
                'warning',
                'odds-without-check',
                "This option shows odds but doesn't start with a Check.",
                option.id,
              );
            }
            walk(option.then, listKey.option(option.id), passageId);
          }
          break;
        case 'if':
          for (const branch of block.branches) {
            unique(branch.id, branch.id);
            useFormula(branch.when, branch.id);
            walk(branch.then, listKey.branch(branch.id), passageId);
          }
          if (block.else) walk(block.else, listKey.else(block.id), passageId);
          break;
        case 'check':
          if (block.label) useText(block.label, block.id);
          try {
            parseDice(block.dice);
          } catch (error) {
            report(
              'error',
              'dice',
              String(error instanceof Error ? error.message : error),
              block.id,
            );
          }
          if (block.modifier !== undefined) useFormula(block.modifier, block.id);
          useFormula(block.target, block.id);
          walk(block.success, listKey.success(block.id), passageId);
          walk(block.fail, listKey.fail(block.id), passageId);
          break;
        case 'input':
          useText(block.prompt, block.id);
          needVar(block.var, block.id, 'text');
          break;
        case 'set':
          needVar(block.var, block.id);
          if (block.value !== undefined) useFormula(block.value, block.id);
          else if (block.op !== 'toggle')
            report('error', 'set-value', 'This Set block has no value.', block.id);
          break;
        case 'jump':
        case 'call':
          targets[block.type].add(block.to);
          if (!passages.has(block.to))
            report('error', 'unknown-passage', `"${block.to}" isn't a passage.`, block.id);
          break;
        case 'random':
          for (const branch of block.branches) {
            unique(branch.id, branch.id);
            walk(branch.then, listKey.branch(branch.id), passageId);
          }
          break;
        case 'end':
          if (block.ending) useText(block.ending.title, block.id);
          break;
        default:
          break;
      }
    }
  };

  for (const { passage } of passages.values())
    walk(passage.blocks, listKey.passage(passage.id), passage.id);

  for (const refs of pendingRefs) {
    for (const id of refs.passages) {
      if (!passages.has(id))
        report(
          'error',
          'unknown-passage',
          `visited("${id}") names a passage that doesn't exist.`,
          refs.where,
        );
    }
    for (const id of refs.options) {
      if (!options.has(id))
        report(
          'error',
          'unknown-option',
          `chosen("${id}") names an option that doesn't exist.`,
          refs.where,
        );
    }
  }

  if (!passages.has(project.start))
    report('error', 'start', `The start passage "${project.start}" doesn't exist.`);
  for (const [id, { passage }] of passages) {
    if (id !== project.start && !targets.jump.has(id) && !targets.call.has(id)) {
      report('warning', 'unreachable', `Nothing leads to passage "${passage.name ?? id}".`, id);
    }
    if (!targets.call.has(id) && !leaves(passage.blocks)) {
      report(
        'warning',
        'dead-end',
        `Passage "${passage.name ?? id}" can run out without a Jump or End, so the story stops there.`,
        id,
      );
    }
  }
  for (const def of project.variables) {
    if (def.type === 'enum' && !def.values?.length)
      report('error', 'enum-values', `One-of variable "${def.id}" has no values.`, def.id);
  }

  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length) throw new StoryLoadError(errors);

  return {
    project,
    passages,
    blocks,
    options,
    lists,
    variables,
    characters,
    problems,
    formula(formula) {
      const key = String(formula);
      let expr = formulas.get(key);
      if (!expr) {
        expr = compileFormula(formula);
        formulas.set(key, expr);
      }
      return expr;
    },
    markup(text, locale) {
      const other = project.languages.find((l) => l !== locale) ?? locale;
      return markups.get(`${text.id}:${locale}`) ?? markups.get(`${text.id}:${other}`) ?? [];
    },
    textVars(text) {
      return textVars.get(text.id) ?? [];
    },
  };
}
