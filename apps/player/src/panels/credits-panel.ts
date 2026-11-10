import { upper, type Translator } from '@ie/i18n';
import { buildCredits, type CreditLine } from '@ie/story';
import { h } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import type { StoryController } from '../story/controller.ts';

/** Credits generated from the novel's own data (ADR 0022): its music, then the fonts. */
export function fillCredits(
  body: HTMLElement,
  t: Translator<MessageKey>,
  story: StoryController,
): void {
  const { project } = story.session.story;
  // A published file already has its public fallbacks swapped in.
  const lines = buildCredits(project, 'private');
  const section = (title: string, items: readonly CreditLine[]) =>
    h(
      'section',
      { class: 'sheet__section' },
      h('h3', { class: 'sheet__title' }, title),
      h(
        'ul',
        { class: 'credits' },
        ...items.map((c) => {
          const name = c.url
            ? h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.title)
            : h('span', {}, c.title);
          return h(
            'li',
            { 'data-kind': c.kind },
            name,
            c.by ? ` · ${c.by}` : '',
            h('span', { class: 'credits__license' }, upper(c.license, 'en')),
          );
        }),
      ),
    );
  const music = lines.filter((c) => c.kind === 'music');
  const fonts = lines.filter((c) => c.kind === 'font');
  const author = project.author;
  body.replaceChildren(
    h(
      'div',
      { class: 'sheet', 'data-testid': 'credits' },
      ...(author
        ? [
            h(
              'section',
              { class: 'sheet__section' },
              h('h3', { class: 'sheet__title' }, t('credits.story')),
              h('p', {}, author),
            ),
          ]
        : []),
      ...(music.length ? [section(t('credits.music'), music)] : []),
      section(t('credits.fonts'), fonts),
      h('p', { class: 'muted' }, t('credits.engine')),
    ),
  );
}
