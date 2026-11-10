import type { Expr } from './formula.ts';
import { eventKey } from './logic.ts';
import type { HeroDef, RpgBlock } from './rpg.ts';
import type { Block, Formula, StoryProject, VariableDef } from './schema.ts';
import type { RoutineBlock } from './logic.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** What the RPG checks borrow from the analyzer's walk (see analyze.ts). */
export interface RpgCheckContext {
  readonly project: StoryProject;
  readonly report: Report;
  needVar(id: string, where: string, type?: VariableDef['type']): void;
  useFormula(formula: Formula, where: string): Expr | undefined;
  walk(list: readonly Block[], key: string, passageId: string): void;
  /** Walks a routine's blocks with its inputs readable as variables. */
  walkRoutine(list: readonly Block[], key: string, locals: readonly string[]): void;
  readonly listKey: {
    win(id: string): string;
    lose(id: string): string;
    fled(id: string): string;
    rule(id: string): string;
    routine(id: string): string;
  };
}

const LANGUAGE_NAMES = { en: 'English', tr: 'Turkish' } as const;

/** Checks an Item, Quest, Shop, Battle or Run routine block. */
export function checkRpgBlock(
  block: RpgBlock | RoutineBlock,
  passageId: string,
  ctx: RpgCheckContext,
): void {
  const { project, report } = ctx;
  const missing = (code: string, what: string, id: string) =>
    report(
      'error',
      code,
      id ? `"${id}" isn't ${what}.` : `This block needs ${what}.`,
      { id },
      block.id,
    );
  switch (block.type) {
    case 'item':
      if (!project.items?.some((i) => i.id === block.item))
        missing('unknown-item', 'an item', block.item);
      if (block.count !== undefined) ctx.useFormula(block.count, block.id);
      break;
    case 'quest': {
      const quest = project.quests?.find((q) => q.id === block.quest);
      if (!quest) missing('unknown-quest', 'a quest', block.quest);
      else if (block.op === 'step' && !quest.steps.some((s) => s.id === block.step))
        report(
          'error',
          'unknown-step',
          'Pick the quest step to move to.',
          { id: quest.id },
          block.id,
        );
      break;
    }
    case 'shop':
      ctx.needVar(block.currency, block.id, 'number');
      if (block.stock.length === 0)
        report('warning', 'shop-empty', 'This shop has nothing for sale.', {}, block.id);
      for (const stock of block.stock)
        if (!project.items?.some((i) => i.id === stock.item))
          missing('unknown-item', 'an item', stock.item);
      break;
    case 'battle':
      if (!project.enemies?.some((e) => e.id === block.enemy))
        missing('unknown-enemy', 'an enemy', block.enemy);
      if (!project.hero?.hp || !project.hero.attack)
        report(
          'error',
          'hero-missing',
          "Battles need the hero's HP and attack variables (Data → Hero).",
          {},
          block.id,
        );
      ctx.walk(block.win, ctx.listKey.win(block.id), passageId);
      ctx.walk(block.lose, ctx.listKey.lose(block.id), passageId);
      if (block.fled) ctx.walk(block.fled, ctx.listKey.fled(block.id), passageId);
      break;
    case 'routine': {
      const routine = project.routines?.find((r) => r.id === block.routine);
      if (!routine) {
        missing('unknown-routine', 'a routine', block.routine);
        break;
      }
      for (const [param, value] of Object.entries(block.args ?? {})) {
        if (!routine.params?.some((p) => p.id === param))
          report(
            'error',
            'unknown-input',
            `"${param}" isn't an input of this routine.`,
            { id: param },
            block.id,
          );
        ctx.useFormula(value, block.id);
      }
      break;
    }
  }
}

/** Items, skills, quests, the hero, rules and routines: IDs, names, and what they point at. */
export function checkRpgData(ctx: RpgCheckContext): void {
  const { project, report } = ctx;
  const seen = new Set<string>();
  const named = (
    kind: string,
    list: readonly { id: string; name: { en?: string; tr?: string } }[] | undefined,
  ) => {
    for (const entry of list ?? []) {
      if (seen.has(entry.id))
        report('error', 'duplicate-id', `The ID "${entry.id}" is used twice.`, { id: entry.id });
      seen.add(entry.id);
      for (const locale of project.languages)
        if (!entry.name[locale]?.trim())
          report(
            'warning',
            'data-name',
            `The ${kind} "${entry.id}" has no ${LANGUAGE_NAMES[locale]} name.`,
            { id: entry.id, kind, locale },
          );
    }
  };
  named('item', project.items);
  named('skill', project.skills);
  named('quest', project.quests);
  for (const item of project.items ?? [])
    for (const effect of item.effects ?? []) ctx.needVar(effect.var, item.id, 'number');
  for (const skill of project.skills ?? [])
    if (skill.requires !== undefined) ctx.useFormula(skill.requires, skill.id);
  const hero: HeroDef = project.hero ?? {};
  for (const id of [hero.hp, hero.maxHp, hero.attack, hero.defense, hero.mp])
    if (id) ctx.needVar(id, 'hero', 'number');

  for (const rule of project.rules ?? []) {
    const target = rule.target;
    const exists =
      target === undefined
        ? rule.on === 'entered'
        : rule.on === 'changed'
          ? project.variables.some((v) => v.id === target)
          : rule.on === 'entered'
            ? project.chapters.some((c) => c.passages.some((p) => p.id === target))
            : rule.on === 'quest'
              ? (project.quests ?? []).some((q) => q.id === target)
              : (project.items ?? []).some((i) => i.id === target);
    if (!exists)
      report(
        'error',
        'rule-target',
        `The rule "${rule.name ?? rule.id}" listens for ${eventKey(rule.on, target)}, which doesn't exist.`,
        { id: rule.id, name: rule.name ?? '' },
        rule.id,
      );
    if (rule.if !== undefined) ctx.useFormula(rule.if, rule.id);
    ctx.walk(rule.do, ctx.listKey.rule(rule.id), '');
  }

  const variables = new Set(project.variables.map((v) => v.id));
  for (const routine of project.routines ?? []) {
    const params = routine.params ?? [];
    for (const param of params)
      if (variables.has(param.id))
        report(
          'error',
          'input-clash',
          `The input "${param.id}" of routine "${routine.name}" has a variable's ID.`,
          { id: param.id, name: routine.name },
          routine.id,
        );
    ctx.walkRoutine(
      routine.blocks,
      ctx.listKey.routine(routine.id),
      params.map((p) => p.id),
    );
  }
}
