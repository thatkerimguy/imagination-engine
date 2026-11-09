import type { Translator } from '@ie/i18n';
import {
  ENDINGS_KEY,
  formatValue,
  plainText,
  type Beat,
  type LocalText,
  type StoryRuntime,
} from '@ie/story';
import type { Countdown } from './countdown.ts';
import { costText, endingIds, lockText, oddsText } from './labels.ts';
import type { PresentKey } from './messages.ts';

export type ChoiceBeat = Extract<Beat, { kind: 'choice' }>;
export type InputBeat = Extract<Beat, { kind: 'input' }>;
export type EndBeat = Extract<Beat, { kind: 'end' }>;

export interface PromptHandlers {
  choose(optionId: string): void;
  submit(answer: string): void;
  restart(): void;
}

export interface PromptContext {
  readonly runtime: StoryRuntime;
  readonly t: Translator<PresentKey>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function words(
  ctx: PromptContext,
  text: LocalText | undefined,
  values?: ChoiceBeat['values'],
): string {
  return text ? plainText(ctx.runtime.render(text, ctx.t.locale, values)) : '';
}

/** The quiet hairline that shrinks while a timed choice waits. */
function timerBar(countdown: Countdown, ctx: PromptContext): HTMLElement {
  const bar = el('div', 'choices__timer');
  bar.setAttribute('role', 'img');
  bar.setAttribute(
    'aria-label',
    ctx.t('choice.timer', { seconds: Math.round(countdown.totalMs / 1000) }),
  );
  const fill = el('span', '');
  fill.style.setProperty('--timer-total', `${countdown.totalMs}ms`);
  fill.style.setProperty('--timer-elapsed', `${countdown.elapsed}ms`);
  fill.style.setProperty(
    '--timer-steps',
    String(Math.max(1, Math.round(countdown.totalMs / 1000))),
  );
  bar.append(fill);
  if (countdown.paused) bar.dataset.paused = 'true';
  return bar;
}

export function buildChoice(
  beat: ChoiceBeat,
  ctx: PromptContext,
  handlers: PromptHandlers,
  countdown: Countdown | null,
): HTMLElement {
  const story = ctx.runtime.story;
  const block = story.blocks.get(beat.blockId)?.block;
  const prompt = block?.type === 'choice' ? words(ctx, block.prompt, beat.values) : '';
  const group = el('div', 'choices');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', prompt || ctx.t('choice.choices'));
  if (prompt) group.append(el('p', 'choices__prompt', prompt));
  if (countdown) group.append(timerBar(countdown, ctx));

  const list = el('div', 'choices__list');
  beat.options.forEach((view, index) => {
    const option = story.options.get(view.id)?.option;
    if (!option) return;
    const button = el('button', 'choice');
    button.type = 'button';
    button.dataset.option = view.id;
    button.dataset.testid = 'choice';
    const body = el('span', 'choice__body');
    body.append(el('span', 'choice__text', words(ctx, option.text, beat.values)));
    if (!view.enabled && view.lock) {
      const reason = lockText(
        view.lock,
        story,
        ctx.t,
        option.lockedText ? words(ctx, option.lockedText, beat.values) : undefined,
        view.cost?.var,
      );
      body.append(el('span', 'choice__note', reason));
    }
    if (view.seen) body.append(el('span', 'ie-sr-only', ctx.t('choice.seen')));
    const key = el('span', 'choice__key', String(index + 1));
    key.setAttribute('aria-hidden', 'true');
    button.append(key, body);

    const meta: string[] = [];
    if (view.odds !== undefined) {
      const check = option.then[0];
      const label = check?.type === 'check' ? words(ctx, check.label, beat.values) : '';
      meta.push(
        label ? `${label} ${oddsText(view.odds, ctx.t.locale)}` : oddsText(view.odds, ctx.t.locale),
      );
    }
    if (view.cost) meta.push(costText(view.cost, story, ctx.t));
    if (meta.length) button.append(el('span', 'choice__meta', meta.join(' · ')));

    if (view.seen) button.dataset.seen = 'true';
    if (!view.enabled) {
      // Focusable but inert, so the reason can be read out.
      button.setAttribute('aria-disabled', 'true');
      button.dataset.locked = 'true';
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (view.enabled) handlers.choose(view.id);
    });
    list.append(button);
  });
  group.append(list);
  return group;
}

export function buildInput(
  beat: InputBeat,
  ctx: PromptContext,
  handlers: PromptHandlers,
): HTMLElement {
  const block = ctx.runtime.story.blocks.get(beat.blockId)?.block;
  const form = el('form', 'answer');
  if (block?.type !== 'input') return form;
  const id = `answer-${block.id}`;
  const label = el('label', 'answer__label', words(ctx, block.prompt));
  label.htmlFor = id;
  const field = el('input', 'answer__field');
  Object.assign(field, {
    id,
    type: 'text',
    autocomplete: 'off',
    spellcheck: false,
    maxLength: block.maxLength ?? 40,
  });
  field.enterKeyHint = 'done';
  // Leaving it empty keeps the story's default, which the placeholder shows.
  field.placeholder = formatValue(ctx.runtime.value(block.var), ctx.t.locale);
  field.dataset.testid = 'answer';
  const confirm = el('button', 'ie-button ie-button--primary', ctx.t('input.confirm'));
  confirm.type = 'submit';
  const row = el('div', 'answer__row');
  row.append(field, confirm);
  form.append(label, row);
  form.addEventListener('click', (event) => event.stopPropagation());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submit(field.value);
  });
  return form;
}

export function buildEnd(beat: EndBeat, ctx: PromptContext, handlers: PromptHandlers): HTMLElement {
  const story = ctx.runtime.story;
  const block = beat.blockId ? story.blocks.get(beat.blockId)?.block : undefined;
  const ending = block?.type === 'end' ? block.ending : undefined;
  const end = el('div', 'story-end');
  end.dataset.testid = 'story-end';
  const mark = el('p', 'story-end__mark', '⁂');
  mark.setAttribute('aria-hidden', 'true');
  const title = ending
    ? ctx.t('end.ending', { title: words(ctx, ending.title) })
    : ctx.t('end.plain');
  end.append(mark, el('p', 'story-end__title', title));
  const total = endingIds(story).length;
  if (total > 0) {
    const reached = ctx.runtime.persistentValues[ENDINGS_KEY];
    const count = Array.isArray(reached) ? reached.length : 0;
    end.append(el('p', 'story-end__count', ctx.t('end.count', { count, total })));
  }
  const restart = el('button', 'ie-button', ctx.t('end.restart'));
  restart.type = 'button';
  restart.dataset.testid = 'restart';
  restart.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.restart();
  });
  end.append(restart);
  return end;
}
