import { localeTag, type Translator } from '@ie/i18n';
import { variableLabel } from '@ie/present';
import { formatValue, pickLabel, type CompiledStory } from '@ie/story';
import { h } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import type { StoryController } from '../story/controller.ts';

/** Whether a story has anything for a character sheet: stats, items or quests (ADR 0017). */
export function hasSheet(story: CompiledStory): boolean {
  const { project } = story;
  return (
    project.variables.some((v) => v.stat) ||
    Boolean(project.items?.length) ||
    Boolean(project.quests?.length)
  );
}

/** The character sheet: stats, what the reader carries, and the quest journal. */
export function fillSheet(
  body: HTMLElement,
  t: Translator<MessageKey>,
  story: StoryController,
): void {
  const runtime = story.session.runtime;
  const { project } = runtime.story;
  const locale = t.locale;
  const sheet = h('div', { class: 'sheet', lang: localeTag(locale), 'data-testid': 'sheet' });
  const section = (title: string, content: HTMLElement) =>
    sheet.append(
      h('section', { class: 'sheet__section' }, h('h3', { class: 'sheet__title' }, title), content),
    );

  const stats = project.variables.filter((v) => v.stat);
  if (stats.length) {
    const list = h('dl', { class: 'sheet__stats' });
    for (const stat of stats)
      list.append(
        h('dt', {}, variableLabel(runtime.story, stat.id, locale)),
        h('dd', {}, formatValue(runtime.value(stat.id), locale)),
      );
    section(t('sheet.stats'), list);
  }

  if (project.items?.length) {
    const carried = project.items.filter((i) => (runtime.inventory[i.id] ?? 0) > 0);
    const list = h('ul', { class: 'sheet__list', 'data-testid': 'sheet-items' });
    for (const item of carried) {
      const count = runtime.inventory[item.id] ?? 0;
      const row = h(
        'li',
        { class: 'sheet__item' },
        h('span', { class: 'sheet__name' }, pickLabel(item.name, locale, item.id)),
        h('span', { class: 'sheet__count' }, formatValue(count, locale)),
      );
      const about = pickLabel(item.description, locale);
      if (about) row.append(h('span', { class: 'sheet__note' }, about));
      list.append(row);
    }
    section(
      t('sheet.inventory'),
      carried.length ? list : h('p', { class: 'muted' }, t('sheet.empty')),
    );
  }

  if (project.quests?.length) {
    const order = { active: 0, done: 1, failed: 2 } as const;
    const known = project.quests
      .flatMap((q) => {
        const state = runtime.quests[q.id];
        return state ? [{ quest: q, state }] : [];
      })
      .sort((a, b) => order[a.state.status] - order[b.state.status]);
    const list = h('ul', { class: 'sheet__list', 'data-testid': 'sheet-quests' });
    for (const { quest, state } of known) {
      const row = h(
        'li',
        { class: 'sheet__item', 'data-status': state.status },
        h('span', { class: 'sheet__name' }, pickLabel(quest.name, locale, quest.id)),
      );
      if (state.status === 'active')
        row.append(
          h('span', { class: 'sheet__note' }, pickLabel(quest.steps[state.step]?.text, locale)),
        );
      else
        row.append(
          h(
            'span',
            { class: 'sheet__count' },
            t(state.status === 'done' ? 'sheet.done' : 'sheet.failed'),
          ),
        );
      list.append(row);
    }
    section(
      t('sheet.journal'),
      known.length ? list : h('p', { class: 'muted' }, t('sheet.noQuests')),
    );
  }
  body.replaceChildren(sheet);
}
