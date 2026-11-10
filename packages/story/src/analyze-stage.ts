import { z } from 'zod';
import { checkMaterialRef } from './analyze-material.ts';
import type { ActionBlock, StoryProject } from './schema.ts';
import { isStageAction, STAGE_ACTIONS, type Title } from './stage.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** Params of a known stage action, and a title written in only some of the novel's languages. */
export function checkStageAction(block: ActionBlock, project: StoryProject, report: Report): void {
  if (!isStageAction(block.action)) return;
  const parsed = STAGE_ACTIONS[block.action].safeParse(block.params ?? {});
  if (!parsed.success) {
    const detail = z.prettifyError(parsed.error);
    report(
      'error',
      'action-params',
      `The ${block.action} block is incomplete: ${detail}`,
      { action: block.action, detail },
      block.id,
    );
    return;
  }
  checkMaterialRef(block.action, block.params ?? {}, project, report, block.id);
  if (block.action !== 'stage.title') return;
  const text = (parsed.data as Title).text;
  const written = project.languages.filter((l) => text[l]?.trim());
  if (written.length === 0) report('error', 'title-empty', 'The title has no text.', {}, block.id);
  else
    for (const locale of project.languages)
      if (!text[locale]?.trim())
        report(
          'warning',
          'title-translation',
          `The title has no ${locale} text.`,
          { locale },
          block.id,
        );
}
