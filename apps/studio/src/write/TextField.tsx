import { localeTag, type Locale } from '@ie/i18n';
import { AtSign, Braces, Sparkles, Timer } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MenuButton, type MenuItem } from '../components/Menu.tsx';
import type { MessageKey } from '../messages.ts';
import { useDoc } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from './edit.ts';
import { joinMarkup, splitMarkup, type Segment, type Token } from './tokens.ts';

/** Effects offered in the toolbar, with the markup each one writes. */
const EFFECTS = [
  ['shake', '[shake]'],
  ['tremble', '[tremble]'],
  ['wave', '[wave]'],
  ['whisper', '[whisper]'],
  ['shout', '[shout]'],
  ['fade', '[fade]'],
  ['scramble', '[scramble]'],
  ['b', '[b]'],
  ['i', '[i]'],
  ['color', '[color=accent]'],
] as const;

type Describe = (token: Token) => string;

function useDescribe(): Describe {
  const doc = useDoc();
  const locale = useStudio((s) => s.locale);
  const t = useT();
  return useCallback(
    (token: Token) => {
      const variable = (id: string) =>
        labelText(doc.variables.find((v) => v.id === id)?.name, locale, id);
      const effect = (name: string) =>
        EFFECTS.some(([n]) => n === name) ? t(`fx.${name}` as MessageKey) : name;
      switch (token.kind) {
        case 'var':
          return variable(token.id);
        case 'char':
          return labelText(doc.characters.find((c) => c.id === token.id)?.name, locale, token.id);
        case 'icu':
          return t('text.varies', { name: variable(token.id) });
        case 'open':
          return `${effect(token.name)} ⟩`;
        case 'close':
          return `⟨ ${effect(token.name)}`;
        case 'pause':
          return t('text.pause', { seconds: token.ms / 1000 });
        case 'raw':
          return token.raw;
      }
    },
    [doc, locale, t],
  );
}

let pressing = false;
let tracking = false;

/**
 * Runs `hide` once the press that moved focus away has finished. Hiding the toolbar at once would
 * shift the layout between pointerdown and click, and the click would miss what it was aimed at.
 */
function afterPress(hide: () => void): void {
  if (!tracking) {
    tracking = true;
    const up = () => (pressing = false);
    document.addEventListener('pointerdown', () => (pressing = true), true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
  }
  if (!pressing) return hide();
  // The click follows pointerup in the same task; a timeout runs after it.
  document.addEventListener('pointerup', () => setTimeout(hide), { once: true });
}

function chip(token: Token, describe: Describe): HTMLElement {
  const span = document.createElement('span');
  span.className = 'chip';
  span.contentEditable = 'false';
  span.dataset.raw = token.raw;
  span.dataset.kind = token.kind;
  span.textContent = describe(token);
  return span;
}

function render(el: HTMLElement, value: string, describe: Describe): void {
  el.replaceChildren(
    ...splitMarkup(value).map((s) =>
      s.kind === 'text' ? document.createTextNode(s.text) : chip(s, describe),
    ),
  );
}

function read(el: HTMLElement): Segment[] {
  const out: Segment[] = [];
  const walk = (node: Node) => {
    if (node instanceof Text) {
      if (node.data) out.push({ kind: 'text', text: node.data.replace(/\n/g, ' ') });
    } else if (node instanceof HTMLElement && node.dataset.raw !== undefined) {
      const [token] = splitMarkup(node.dataset.raw);
      if (token && token.kind !== 'text') out.push(token);
    } else node.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out;
}

export interface TextFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly placeholder?: string;
  readonly locale: Locale;
  /** Story prose (serif) rather than a short UI-ish line. */
  readonly prose?: boolean;
  readonly onEnter?: () => void;
  readonly onEmptyBackspace?: () => void;
  /** "/" typed into an empty field: open the block menu. */
  readonly onSlash?: () => void;
  readonly testId?: string;
}

/**
 * A one-line story text editor. Variables, names and effects are chips the author inserts from the
 * toolbar; the stored markup (ADR 0007) is never typed by hand.
 */
export function TextField(props: TextFieldProps) {
  const { value, onChange, label, placeholder, locale, prose, testId } = props;
  const t = useT();
  const doc = useDoc();
  const uiLocale = useStudio((s) => s.locale);
  const describe = useDescribe();
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [active, setActive] = useState(false);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node || shown.current === value) return;
    render(node, value, describe);
    shown.current = value;
  }, [value, describe]);

  // Names inside chips follow renames and the Studio language.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    node.querySelectorAll<HTMLElement>('.chip').forEach((c) => {
      const [token] = splitMarkup(c.dataset.raw ?? '');
      if (token && token.kind !== 'text') c.textContent = describe(token);
    });
  }, [describe]);

  const commit = () => {
    const node = el.current;
    if (!node) return;
    const segments = read(node);
    const next = joinMarkup(segments);
    if (!next)
      node.replaceChildren(); // so the placeholder shows again
    else if (splitMarkup(next).length !== segments.length) render(node, next, describe);
    shown.current = next;
    if (next !== value) onChange(next);
  };

  const remember = () => {
    const selection = document.getSelection();
    const node = el.current;
    if (!selection?.rangeCount || !node) return;
    const range = selection.getRangeAt(0);
    if (node.contains(range.commonAncestorContainer)) saved.current = range.cloneRange();
  };

  /** Inserts chips at the caret, or wraps the selection in an effect pair. */
  const insert = (open: string, close?: string) => {
    const node = el.current;
    if (!node) return;
    node.focus();
    let range = saved.current;
    if (!range || !node.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
    }
    const [openToken] = splitMarkup(open) as Token[];
    const [closeToken] = close ? (splitMarkup(close) as Token[]) : [];
    const after = range.cloneRange();
    after.collapse(false);
    const closing = closeToken ? chip(closeToken, describe) : null;
    if (closing) after.insertNode(closing);
    const before = range.cloneRange();
    before.collapse(true);
    const opening = openToken ? chip(openToken, describe) : null;
    if (opening) before.insertNode(opening);
    const caret = document.createRange();
    caret.setStartAfter(closing ?? opening ?? node);
    caret.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(caret);
    commit();
  };

  const orEmpty = (items: MenuItem[], hint: MessageKey): MenuItem[] =>
    items.length ? items : [{ id: 'none', label: t(hint), disabled: true, onSelect: () => {} }];
  const variables = orEmpty(
    doc.variables.map((v) => ({
      id: v.id,
      label: labelText(v.name, uiLocale, v.id),
      onSelect: () => insert(`{${v.id}}`),
    })),
    'text.noVariables',
  );
  const names = orEmpty(
    doc.characters.map((c) => ({
      id: c.id,
      label: labelText(c.name, uiLocale, c.id),
      onSelect: () => insert(`{@${c.id}}`),
    })),
    'text.noCharacters',
  );
  const effects: MenuItem[] = useMemo(
    () =>
      EFFECTS.map(([name, open]) => ({
        id: name,
        label: t(`fx.${name}` as MessageKey),
        onSelect: () => insert(open, `[/${name}]`),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, describe],
  );

  return (
    <div
      className="tf"
      data-active={active || undefined}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        const root = event.currentTarget;
        afterPress(() => {
          if (!root.contains(document.activeElement)) setActive(false);
        });
      }}
    >
      <div
        ref={el}
        className={prose ? 'tf__input tf__input--prose' : 'tf__input'}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        data-placeholder={placeholder ?? t('text.placeholder')}
        lang={localeTag(locale)}
        spellCheck
        data-testid={testId}
        onInput={commit}
        onKeyUp={remember}
        onMouseUp={remember}
        onTouchEnd={remember}
        onBlur={remember}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            props.onEnter?.();
          } else if (event.key === 'Backspace' && !value && props.onEmptyBackspace) {
            event.preventDefault();
            props.onEmptyBackspace();
          } else if (event.key === '/' && !value && props.onSlash) {
            event.preventDefault();
            props.onSlash();
          }
        }}
        onPaste={(event) => {
          // Pasted text is plain text; brackets in it are escaped like typed ones.
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ');
          document.execCommand('insertText', false, text);
        }}
      />
      {active && (
        <div className="tf__tools" role="toolbar" aria-label={t('text.tools')}>
          <MenuButton label={t('text.insertVariable')} items={variables} keepFocus>
            <Braces size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{t('text.variable')}</span>
          </MenuButton>
          <MenuButton label={t('text.insertName')} items={names} keepFocus>
            <AtSign size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{t('text.name')}</span>
          </MenuButton>
          <MenuButton
            label={t('text.effect')}
            items={effects}
            keepFocus
            align="end"
            testId="effect-menu"
          >
            <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{t('text.effect')}</span>
          </MenuButton>
          <button
            type="button"
            className="ie-button ie-button--quiet"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => insert('[pause=500]')}
          >
            <Timer size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{t('text.pauseButton')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
