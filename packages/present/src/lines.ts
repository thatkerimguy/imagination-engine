import type { Value } from '@ie/core';
import type { Locale, Translator } from '@ie/i18n';
import { plainText, type Beat, type Layout, type LocalText, type StoryRuntime } from '@ie/story';
import { checkText } from './labels.ts';
import type { PresentKey } from './messages.ts';
import { buildText, type BuildOptions } from './text-dom.ts';
import type { RevealStep } from './typewriter.ts';

/** The character whose lines are the reader's own (right-aligned in Chat). See ADR 0007. */
export const READER_CHARACTER = 'player';

export interface LineContext {
  readonly runtime: StoryRuntime;
  readonly locale: Locale;
  readonly t: Translator<PresentKey>;
  readonly layout: Layout;
  readonly hyphenate?: (text: string) => string;
}

export interface LineMode {
  readonly typed: boolean;
  readonly animate: boolean;
  /** Typing speed, used for the Chat layout's "is typing" delay. */
  readonly cps: number;
}

export interface BuiltLine {
  readonly element: HTMLElement;
  readonly steps: RevealStep[];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Visible text for sighted readers, and the same words once, whole, for screen readers. */
function textParts(
  text: LocalText,
  values: Readonly<Record<string, Value>>,
  ctx: LineContext,
  options: BuildOptions,
) {
  const pieces = ctx.runtime.render(text, ctx.locale, values);
  const built = buildText(
    pieces,
    ctx.hyphenate ? { ...options, hyphenate: ctx.hyphenate } : options,
  );
  const visual = el('span', 'line__text');
  visual.setAttribute('aria-hidden', 'true');
  visual.append(built.fragment);
  const spoken = el('span', 'ie-sr-only');
  spoken.textContent = built.plain;
  return { visual, spoken, steps: built.steps, plain: built.plain };
}

/** "Mira is typing", then the whole message: chat apps don't type letter by letter. */
function chatSteps(
  line: HTMLElement,
  plain: string,
  name: string,
  ctx: LineContext,
  mode: LineMode,
): RevealStep[] {
  const dots = el('span', 'line__typing');
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', ctx.t('chat.typing', { name }));
  dots.append(el('span', ''), el('span', ''), el('span', ''));
  line.dataset.typing = 'true';
  line.append(dots);
  const delay = Math.min(1800, Math.max(450, (plain.length * 1000 * 0.6) / mode.cps));
  return [
    { kind: 'pause', ms: delay },
    {
      kind: 'whole',
      length: plain.length,
      reveal: () => {
        dots.remove();
        delete line.dataset.typing;
      },
    },
  ];
}

/** Builds the page element for a beat, or null for beats that aren't lines of text. */
export function buildLine(beat: Beat, ctx: LineContext, mode: LineMode): BuiltLine | null {
  const story = ctx.runtime.story;
  const options: BuildOptions = { typed: mode.typed, animate: mode.animate };
  switch (beat.kind) {
    case 'line': {
      const block = story.blocks.get(beat.blockId)?.block;
      if (block?.type !== 'narration' && block?.type !== 'dialogue') return null;
      const line = el('p', `line line--${block.type}`);
      line.dataset.block = block.id;
      if (block.type === 'narration') {
        const parts = textParts(block.text, beat.values, ctx, options);
        line.append(parts.spoken, parts.visual);
        return { element: line, steps: parts.steps };
      }
      const self = block.speaker === READER_CHARACTER;
      const character = ctx.runtime.textContext(ctx.locale).character(block.speaker);
      const name = character?.name ?? block.speaker;
      line.dataset.speaker = block.speaker;
      if (self) line.dataset.self = 'true';
      const speaker = el('span', 'line__speaker');
      speaker.textContent = name;
      const color = story.characters.get(block.speaker)?.color;
      if (color) speaker.dataset.color = color;
      const chatTyping = ctx.layout === 'chat' && mode.typed && !self;
      // Chat messages arrive whole, after a typing indicator, instead of letter by letter.
      const parts = textParts(block.text, beat.values, ctx, {
        ...options,
        typed: mode.typed && ctx.layout !== 'chat',
      });
      // Screen readers hear "Mira: …"; the visual name is a label of its own.
      parts.spoken.textContent = `${name}: ${parts.plain}`;
      speaker.setAttribute('aria-hidden', 'true');
      line.append(parts.spoken, speaker, parts.visual);
      const steps = chatTyping
        ? chatSteps(line, parts.plain, name, ctx, mode)
        : ctx.layout === 'chat'
          ? []
          : parts.steps;
      return { element: line, steps };
    }
    case 'chosen':
    case 'answered': {
      const line = el('p', 'line line--chosen');
      line.dataset.self = 'true';
      if (beat.kind === 'answered') {
        line.textContent = beat.value;
        return { element: line, steps: [] };
      }
      const option = story.options.get(beat.optionId)?.option;
      if (!option) return null;
      const parts = textParts(option.text, beat.values, ctx, { typed: false, animate: false });
      line.append(parts.spoken, parts.visual);
      return { element: line, steps: [] };
    }
    case 'check': {
      const block = story.blocks.get(beat.blockId)?.block;
      const label =
        block?.type === 'check' && block.label
          ? ctx.runtime.render(block.label, ctx.locale, beat.values)
          : null;
      const line = el('p', 'line line--check');
      line.dataset.result = beat.success ? 'success' : 'fail';
      line.textContent = checkText(beat, label ? plainText(label) : undefined, ctx.t);
      return { element: line, steps: [] };
    }
    default:
      return null;
  }
}
