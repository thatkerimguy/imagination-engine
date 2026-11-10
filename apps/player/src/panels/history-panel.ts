import { createTranslator, localeTag, type Locale, type Translator } from '@ie/i18n';
import { buildLine, presentMessages, type LineContext } from '@ie/present';
import { h } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import type { StoryController } from '../story/controller.ts';

export interface HistoryContext {
  readonly t: Translator<MessageKey>;
  readonly story: StoryController;
  readonly run: (actionId: string, params: unknown) => void;
  readonly close: () => void;
  readonly hyphenate: ((text: string, locale: Locale) => string) | undefined;
}

/**
 * The backlog: everything read so far, re-rendered from the log in the current language, with a
 * way back to earlier choices.
 */
export function fillHistory(body: HTMLElement, ctx: HistoryContext): void {
  const { session } = ctx.story;
  const locale = ctx.t.locale;
  const lineContext: LineContext = {
    runtime: session.runtime,
    locale,
    t: createTranslator(presentMessages, locale),
    layout: 'page',
    ...(ctx.hyphenate
      ? { hyphenate: (text: string) => ctx.hyphenate?.(text, locale) ?? text }
      : {}),
  };
  const list = h('div', { class: 'history', lang: localeTag(locale), 'data-testid': 'history' });
  session.runtime.log.forEach((beat, index) => {
    if (beat.kind === 'passage') {
      if (!beat.keepPage && list.lastElementChild && list.lastElementChild.tagName !== 'HR') {
        list.append(h('hr', { class: 'history__break' }));
      }
      return;
    }
    const built = buildLine(beat, lineContext, {
      typed: false,
      animate: false,
      cps: Number.POSITIVE_INFINITY,
    });
    if (!built) return;
    list.append(built.element);
    const point = beat.kind === 'chosen' ? session.choicePoint(index) : null;
    if (point === null) return;
    const rewind = h(
      'button',
      { type: 'button', class: 'ie-button ie-button--quiet history__rewind' },
      ctx.t('history.rewind'),
    );
    rewind.addEventListener('click', () => {
      ctx.close();
      ctx.run('story.rewind', { to: point });
    });
    list.append(rewind);
  });
  if (!list.childElementCount) list.append(h('p', { class: 'muted' }, ctx.t('history.empty')));
  body.replaceChildren(list);
  // Newest at the bottom, where the reader left off.
  requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight }));
}
