import { parseDice } from './dice.ts';
import { checkAudioAction, checkAudioLibrary } from './analyze-audio.ts';
import { checkEnemies, checkFightBlock } from './analyze-fight.ts';
import { checkReferences, type PendingRefs } from './analyze-refs.ts';
import { checkRpgBlock, checkRpgData, type RpgCheckContext } from './analyze-rpg.ts';
import { checkStageAction } from './analyze-stage.ts';
import { compileFormula, FormulaError, references, type Expr } from './formula.ts';
import { markupReferences, MarkupError, parseMarkup, type MarkupNode } from './markup.ts';
import type {
  Block,
  Chapter,
  CharacterDef,
  ChoiceBlock,
  ChoiceOption,
  Formula,
  LocalText,
  Passage,
  StoryProject,
  VariableDef,
} from './schema.ts';

export interface StoryProblem {
  readonly severity: 'error' | 'warning';
  /** Stable code; the Studio translates problems by code and params. */
  readonly code: string;
  /** English message, for logs and the Player's error screen. */
  readonly message: string;
  readonly params: Readonly<Record<string, string>>;
  /** The passage, block, option or branch the problem is in. */
  readonly where?: string;
}

export interface BlockInfo {
  readonly block: Block;
  readonly list: string;
  readonly passage: string;
}

/** List keys of the execution stack (see Frame in state.ts). */
export const listKey = {
  passage: (id: string) => `p:${id}`,
  option: (id: string) => `o:${id}`,
  branch: (id: string) => `b:${id}`,
  else: (ifId: string) => `e:${ifId}`,
  success: (checkId: string) => `s:${checkId}`,
  fail: (checkId: string) => `f:${checkId}`,
  win: (fightId: string) => `w:${fightId}`,
  lose: (fightId: string) => `l:${fightId}`,
  fled: (battleId: string) => `x:${battleId}`,
  rule: (ruleId: string) => `r:${ruleId}`,
  routine: (routineId: string) => `u:${routineId}`,
};

export interface Analysis {
  readonly passages: Map<string, { passage: Passage; chapter: Chapter }>;
  readonly blocks: Map<string, BlockInfo>;
  readonly options: Map<string, { option: ChoiceOption; choice: ChoiceBlock }>;
  readonly lists: Map<string, readonly Block[]>;
  readonly variables: Map<string, VariableDef>;
  readonly characters: Map<string, CharacterDef>;
  readonly formulas: Map<string, Expr>;
  readonly markups: Map<string, readonly MarkupNode[]>;
  readonly textVars: Map<string, readonly string[]>;
  readonly problems: StoryProblem[];
}

/** Whether a block list always leaves its passage (Jump, End, Return) instead of running out. */
export function leaves(list: readonly Block[]): boolean {
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
      case 'fight':
        return leaves(block.win) && leaves(block.lose);
      case 'battle':
        return (
          leaves(block.win) && leaves(block.lose) && (block.fled ? leaves(block.fled) : !block.flee)
        );
      default:
        return false;
    }
  });
}

const LANGUAGE_NAMES = { en: 'English', tr: 'Turkish' } as const;

/** Indexes a schema-valid project and reports every problem in it. Never throws. */
export function analyzeProject(project: StoryProject): Analysis {
  const problems: StoryProblem[] = [];
  const report = (
    severity: StoryProblem['severity'],
    code: string,
    message: string,
    params: Record<string, string>,
    where?: string,
  ) =>
    problems.push({ severity, code, message, params, ...(where === undefined ? {} : { where }) });

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
  const pendingRefs: PendingRefs[] = [];
  // A routine's inputs, readable like variables while its blocks are checked.
  let locals: ReadonlySet<string> = new Set();
  const known = (id: string) => variables.has(id) || locals.has(id);

  for (const chapter of project.chapters) {
    for (const passage of chapter.passages) {
      if (passages.has(passage.id))
        report(
          'error',
          'duplicate-id',
          `Two passages share the ID "${passage.id}".`,
          { id: passage.id },
          passage.id,
        );
      passages.set(passage.id, { passage, chapter });
    }
  }

  const unique = (id: string, where: string) => {
    if (nodeIds.has(id))
      report('error', 'duplicate-id', `The ID "${id}" is used twice.`, { id }, where);
    nodeIds.add(id);
  };

  const unknownVariable = (id: string, where: string) =>
    report('error', 'unknown-variable', `"${id}" isn't a variable.`, { id }, where);

  const useFormula = (formula: Formula, where: string): Expr | undefined => {
    try {
      const expr = compileFormula(formula);
      formulas.set(String(formula), expr);
      const refs = references(expr);
      for (const id of refs.vars) if (!known(id)) unknownVariable(id, where);
      pendingRefs.push({ ...refs, where });
      return expr;
    } catch (error) {
      const detail = error instanceof FormulaError ? error.message : String(error);
      report(
        'error',
        'formula',
        `In "${String(formula)}": ${detail}`,
        { formula: String(formula), detail },
        where,
      );
      return undefined;
    }
  };

  const useText = (text: LocalText, where: string) => {
    if (lineIds.has(text.id))
      report(
        'error',
        'duplicate-line',
        `Two lines share the line ID "${text.id}".`,
        { id: text.id },
        where,
      );
    lineIds.add(text.id);
    const vars = new Set<string>();
    // A line blank in every language is a line not written yet, not a missing translation.
    const written = project.languages.some((locale) => text[locale]?.trim());
    for (const locale of project.languages) {
      const source = text[locale];
      if (written && (source === undefined || source.trim() === '')) {
        report(
          'warning',
          'missing-translation',
          `Line "${text.id}" has no ${LANGUAGE_NAMES[locale]} text.`,
          { line: text.id, locale },
          where,
        );
      }
      if (source === undefined) continue;
      try {
        const nodes = parseMarkup(source);
        markups.set(`${text.id}:${locale}`, nodes);
        const refs = markupReferences(nodes);
        for (const id of refs.vars) {
          if (!known(id)) unknownVariable(id, where);
          vars.add(id);
        }
        for (const id of refs.characters) {
          if (!characters.has(id))
            report('error', 'unknown-character', `"${id}" isn't a character.`, { id }, where);
        }
      } catch (error) {
        const detail = error instanceof MarkupError ? error.message : String(error);
        report(
          'error',
          'markup',
          `Line "${text.id}" (${locale}): ${detail}`,
          { line: text.id, locale, detail },
          where,
        );
      }
    }
    textVars.set(text.id, [...vars]);
  };

  const needVar = (id: string, where: string, type?: VariableDef['type']) => {
    if (locals.has(id)) return;
    const def = variables.get(id);
    if (!def) unknownVariable(id, where);
    else if (type && def.type !== type)
      report('error', 'variable-type', `"${id}" must be a ${type} variable.`, { id, type }, where);
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
            report(
              'error',
              'unknown-character',
              `"${block.speaker}" isn't a character.`,
              { id: block.speaker },
              block.id,
            );
          break;
        case 'choice':
          if (block.prompt) useText(block.prompt, block.id);
          if (block.timer?.default && !block.options.some((o) => o.id === block.timer?.default)) {
            report(
              'error',
              'timer-default',
              "The timer's default isn't one of this choice's options.",
              {},
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
                {},
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
            const detail = error instanceof Error ? error.message : String(error);
            report('error', 'dice', detail, { dice: block.dice }, block.id);
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
            report('error', 'set-value', 'This Set block has no value.', {}, block.id);
          break;
        case 'jump':
        case 'call':
          targets[block.type].add(block.to);
          if (!passages.has(block.to))
            report(
              'error',
              'unknown-passage',
              `"${block.to}" isn't a passage.`,
              { id: block.to },
              block.id,
            );
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
        case 'fight':
          checkFightBlock(block, project, report);
          if (block.score) needVar(block.score, block.id, 'number');
          walk(block.win, listKey.win(block.id), passageId);
          walk(block.lose, listKey.lose(block.id), passageId);
          break;
        case 'item':
        case 'quest':
        case 'shop':
        case 'battle':
        case 'routine':
          checkRpgBlock(block, passageId, rpg);
          break;
        case 'action':
          checkAudioAction(block, project, report);
          checkStageAction(block, project, report);
          break;
        default:
          break;
      }
    }
  };

  const rpg: RpgCheckContext = {
    project,
    report,
    needVar,
    useFormula,
    walk,
    walkRoutine: (list, key, inputs) => {
      locals = new Set(inputs);
      walk(list, key, '');
      locals = new Set();
    },
    listKey,
  };

  for (const { passage } of passages.values())
    walk(passage.blocks, listKey.passage(passage.id), passage.id);
  checkRpgData(rpg);
  checkAudioLibrary(project, report);
  checkEnemies(project, report);

  checkReferences({ project, passages, options, targets, pendingRefs, leaves, report });

  return {
    passages,
    blocks,
    options,
    lists,
    variables,
    characters,
    formulas,
    markups,
    textVars,
    problems,
  };
}
