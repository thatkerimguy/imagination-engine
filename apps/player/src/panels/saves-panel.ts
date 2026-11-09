import { localeTag, type Locale, type Translator } from '@ie/i18n';
import { plainText } from '@ie/story';
import { h } from '../dom.ts';
import type { MessageKey } from '../messages.ts';
import type { StoryController } from '../story/controller.ts';
import { SLOTS, type SaveFile } from '../story/saves.ts';

export interface SavesContext {
  readonly t: Translator<MessageKey>;
  readonly story: StoryController;
  readonly runAsync: (actionId: string, params?: unknown) => Promise<unknown>;
  readonly close: () => void;
}

const EXCERPT_LENGTH = 90;

/** Where a save is: its chapter, and the last line the reader saw, in the current language. */
function describe(
  file: SaveFile,
  story: StoryController,
  locale: Locale,
): { where: string; excerpt: string } {
  const { runtime } = story.session;
  const chapter = runtime.story.project.chapters.find((c) => c.id === file.state.chapter);
  const where = chapter ? (chapter.title[locale] ?? chapter.title.en ?? '') : '';
  const line = file.state.log.findLast((beat) => beat.kind === 'line');
  const block = line?.kind === 'line' ? runtime.story.blocks.get(line.blockId)?.block : undefined;
  let excerpt = '';
  if (line?.kind === 'line' && (block?.type === 'narration' || block?.type === 'dialogue')) {
    excerpt = plainText(runtime.render(block.text, locale, line.values));
    if (excerpt.length > EXCERPT_LENGTH)
      excerpt = `${excerpt.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`;
  }
  return { where, excerpt };
}

function quietButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'ie-button' }, label);
  button.addEventListener('click', onClick);
  return button;
}

export async function fillSaves(body: HTMLElement, ctx: SavesContext): Promise<void> {
  const { t, story } = ctx;
  const locale = t.locale;
  const files = await Promise.all(SLOTS.map((slot) => story.session.slot(slot)));
  const dates = new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const rows = SLOTS.map((slot, i) => {
    const file = files[i];
    const info = h(
      'div',
      { class: 'save-slot__info' },
      h('span', { class: 'save-slot__name' }, t('saves.slot', { n: slot })),
    );
    if (file) {
      const { where, excerpt } = describe(file, story, locale);
      info.append(
        h(
          'span',
          { class: 'save-slot__detail' },
          [dates.format(file.savedAt), where].filter(Boolean).join(' · '),
        ),
      );
      if (excerpt)
        info.append(h('span', { class: 'save-slot__excerpt', lang: localeTag(locale) }, excerpt));
    } else {
      info.append(h('span', { class: 'save-slot__detail' }, t('saves.empty')));
    }
    const save = quietButton(file ? t('saves.overwrite') : t('saves.save'), () => {
      void ctx.runAsync('story.save', { slot }).then(() => fillSaves(body, ctx));
    });
    save.dataset.testid = `save-${slot}`;
    const load = quietButton(t('saves.load'), () => {
      void ctx.runAsync('story.load', { slot }).then(() => ctx.close());
    });
    load.dataset.testid = `load-${slot}`;
    load.disabled = !file;
    return h(
      'div',
      { class: 'save-slot' },
      info,
      h('div', { class: 'save-slot__actions' }, save, load),
    );
  });

  // Starting over loses the current place unless it was saved, so it asks twice.
  let armed = false;
  const restart = h(
    'button',
    { type: 'button', class: 'ie-button ie-button--quiet' },
    t('saves.restart'),
  );
  restart.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      restart.textContent = t('saves.restartConfirm');
      return;
    }
    ctx.close();
    void ctx.runAsync('story.restart');
  });

  body.replaceChildren(
    h('div', { class: 'save-slots' }, ...rows),
    h('p', { class: 'muted save-note' }, t('saves.note')),
    h('div', { class: 'dialog-actions' }, restart),
  );
}
