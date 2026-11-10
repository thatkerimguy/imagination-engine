import type { Expr } from './formula.ts';
import type { Formula, LocalText, StoryProject, VariableDef } from './schema.ts';
import { walkComponents, type ScreenAction, type ScreenDef } from './screens.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** What the screen checks borrow from the analyzer (see analyze.ts). */
export interface ScreenCheckContext {
  readonly project: StoryProject;
  readonly report: Report;
  needVar(id: string, where: string, type?: VariableDef['type']): void;
  useFormula(formula: Formula, where: string): Expr | undefined;
  /** Compiles a text's markup, so the runtime can render it, and checks its translations. */
  useText(text: LocalText, where: string): void;
}

function checkAction(
  action: ScreenAction,
  screen: ScreenDef,
  where: string,
  ctx: ScreenCheckContext,
) {
  const { project, report } = ctx;
  if (action.type === 'open' && !project.screens?.some((s) => s.id === action.screen))
    report(
      'error',
      'unknown-screen',
      `"${action.screen}" isn't a screen.`,
      { id: action.screen },
      where,
    );
  if (action.type === 'set') {
    ctx.needVar(action.var, where);
    if (action.value !== undefined) ctx.useFormula(action.value, where);
  }
  if ((action.type === 'start' || action.type === 'continue') && screen.kind !== 'title')
    report(
      'warning',
      'title-only-action',
      `Start and Continue only work on a title screen.`,
      { screen: screen.id },
      where,
    );
}

/** Checks every screen: ids, bound variables, formulas, texts and button actions. */
export function checkScreens(ctx: ScreenCheckContext): void {
  const { project, report } = ctx;
  const screens = project.screens ?? [];
  const seen = new Set<string>();
  if (screens.filter((s) => s.kind === 'title').length > 1)
    report('warning', 'two-titles', 'Only the first title screen is shown.', {});
  for (const screen of screens) {
    if (seen.has(screen.id))
      report('error', 'duplicate-id', `Two screens share the ID "${screen.id}".`, {
        id: screen.id,
      });
    seen.add(screen.id);
    walkComponents(screen.children, (component) => {
      const where = component.id;
      if (component.if !== undefined) ctx.useFormula(component.if, where);
      switch (component.type) {
        case 'text':
          ctx.useText(component.text, where);
          break;
        case 'bar':
          ctx.needVar(component.var, where, 'number');
          if (component.maxVar) ctx.needVar(component.maxVar, where, 'number');
          if (component.label) ctx.useText(component.label, where);
          break;
        case 'list':
          if (component.source === 'variable') {
            if (component.var) ctx.needVar(component.var, where, 'list');
            else report('error', 'list-needs-var', 'This list needs a List variable.', {}, where);
          }
          if (component.empty) ctx.useText(component.empty, where);
          break;
        case 'button':
          ctx.useText(component.label, where);
          for (const action of component.actions) checkAction(action, screen, where, ctx);
          break;
        case 'tabs':
          for (const tab of component.tabs) ctx.useText(tab.label, tab.id);
          break;
        default:
          break;
      }
    });
  }
}
