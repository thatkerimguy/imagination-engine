import { createId } from '@ie/core';
import { foldForSearch } from '@ie/i18n';
import type {
  DialogueBlock,
  EndBlock,
  InputBlock,
  NarrationBlock,
  NoteBlock,
  PauseBlock,
} from '@ie/story';
import { useState } from 'react';
import { newText, type MenuBlockType } from '../../project/factory.ts';
import { useT } from '../../store.ts';
import { useNewBlock } from '../BlockList.tsx';
import { BlockPickerPanel } from '../BlockPicker.tsx';
import { focusBlock, useWrite } from '../context.ts';
import { listBlocks, replyingSpeaker } from '../dialogue.ts';
import { CharacterPicker, VariablePicker } from '../pickers.tsx';
import { TextField } from '../TextField.tsx';

/** "Mira: " at the start of a narration line turns it into Mira's dialogue. */
function speakerShortcut(
  value: string,
  characters: readonly { id: string; name: { en?: string; tr?: string } }[],
): { speaker: string; rest: string } | null {
  const match = /^([^:[\]{}]{1,40}):\s(.*)$/s.exec(value);
  if (!match) return null;
  const typed = foldForSearch(match[1] ?? '');
  const found = characters.find((c) =>
    [c.name.en, c.name.tr].some((n) => n && foldForSearch(n) === typed),
  );
  return found ? { speaker: found.id, rest: match[2] ?? '' } : null;
}

/** Narration and dialogue: the main writing surface. Enter starts the next line. */
export function LineEditor({
  block,
  listKey,
  index,
}: {
  readonly block: NarrationBlock | DialogueBlock;
  readonly listKey: string;
  readonly index: number;
}) {
  const t = useT();
  const { doc, editor, locale } = useWrite();
  const make = useNewBlock();
  const [picking, setPicking] = useState(false);
  const value = block.text[locale] ?? '';

  const replaceWith = (type: MenuBlockType) => {
    setPicking(false);
    const next = make(type);
    editor.block(block.id, () => next);
    focusBlock(next.id);
  };

  return (
    <div
      className={block.type === 'dialogue' ? 'line-editor line-editor--dialogue' : 'line-editor'}
    >
      {block.type === 'dialogue' && (
        <CharacterPicker
          doc={doc}
          value={block.speaker}
          label={t('dialogue.speaker')}
          testId="speaker"
          onChange={(speaker) =>
            editor.block(block.id, (b) => ({ ...b, speaker }) as DialogueBlock)
          }
        />
      )}
      <TextField
        value={value}
        locale={locale}
        prose
        label={t(block.type === 'dialogue' ? 'dialogue.line' : 'narration.line')}
        placeholder={t(
          block.type === 'dialogue' ? 'dialogue.placeholder' : 'narration.placeholder',
        )}
        testId="line-text"
        onChange={(next) => {
          // "Name: " works on dialogue lines too, to hand the line to someone else.
          const shortcut = speakerShortcut(next, doc.characters);
          if (!shortcut) return editor.text(block.text.id, locale, next);
          editor.block(block.id, () => ({
            id: block.id,
            type: 'dialogue',
            speaker: shortcut.speaker,
            text: { ...block.text, [locale]: shortcut.rest },
          }));
          focusBlock(block.id);
        }}
        onEnter={() => {
          const speaker =
            block.type === 'dialogue' ? replyingSpeaker(listBlocks(doc, listKey), index) : null;
          const made = make(speaker ? 'dialogue' : 'narration');
          const next = speaker ? ({ ...made, speaker } as DialogueBlock) : made;
          editor.insert(listKey, index + 1, next);
          focusBlock(next.id);
        }}
        onEmptyBackspace={() => {
          const other = locale === 'en' ? 'tr' : 'en';
          if (block.text[other]) return; // the other language still has words here
          editor.remove(block.id);
          const list = document.querySelectorAll<HTMLElement>('[data-block-id]');
          const at = [...list].findIndex((n) => n.dataset.blockId === block.id);
          const previous = list[at - 1]?.dataset.blockId;
          if (previous) focusBlock(previous);
        }}
        onSlash={() => setPicking(true)}
      />
      {picking && (
        <div className="line-editor__picker">
          <BlockPickerPanel
            testId="slash-block"
            onPick={replaceWith}
            onClose={() => {
              setPicking(false);
              focusBlock(block.id);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function NoteEditor({ block }: { readonly block: NoteBlock }) {
  const t = useT();
  const { editor } = useWrite();
  return (
    <textarea
      className="field note"
      rows={2}
      aria-label={t('block.note')}
      placeholder={t('note.placeholder')}
      value={block.text}
      onChange={(e) =>
        editor.block(
          block.id,
          (b) => ({ ...b, text: e.target.value }) as NoteBlock,
          `note:${block.id}`,
        )
      }
    />
  );
}

export function PauseEditor({ block }: { readonly block: PauseBlock }) {
  const t = useT();
  const { editor } = useWrite();
  const timed = block.seconds !== undefined;
  return (
    <div className="row">
      <select
        className="picker"
        aria-label={t('block.pause')}
        value={timed ? 'timed' : 'tap'}
        onChange={(e) =>
          editor.block(block.id, () =>
            e.target.value === 'timed'
              ? { id: block.id, type: 'pause', seconds: 1 }
              : { id: block.id, type: 'pause' },
          )
        }
      >
        <option value="tap">{t('pause.tap')}</option>
        <option value="timed">{t('pause.timed')}</option>
      </select>
      {timed && (
        <label className="inline-field">
          <input
            className="field field--number"
            type="number"
            min={0.1}
            step={0.1}
            inputMode="decimal"
            value={block.seconds}
            onChange={(e) =>
              editor.block(
                block.id,
                (b) =>
                  ({ ...b, seconds: Math.max(0.1, Number(e.target.value) || 0.1) }) as PauseBlock,
              )
            }
          />
          <span>{t('unit.seconds')}</span>
        </label>
      )}
    </div>
  );
}

export function InputEditor({ block }: { readonly block: InputBlock }) {
  const t = useT();
  const { doc, editor, locale } = useWrite();
  return (
    <div className="stack">
      <TextField
        value={block.prompt[locale] ?? ''}
        locale={locale}
        label={t('input.prompt')}
        placeholder={t('input.placeholder')}
        onChange={(v) => editor.text(block.prompt.id, locale, v)}
      />
      <label className="row">
        <span className="row__label">{t('input.saveIn')}</span>
        <VariablePicker
          doc={doc}
          value={block.var}
          types={['text']}
          newType="text"
          label={t('input.saveIn')}
          onChange={(id) => editor.block(block.id, (b) => ({ ...b, var: id }) as InputBlock)}
        />
      </label>
    </div>
  );
}

export function EndEditor({ block }: { readonly block: EndBlock }) {
  const t = useT();
  const { editor, locale } = useWrite();
  return (
    <div className="stack">
      <label className="check">
        <input
          type="checkbox"
          checked={block.ending !== undefined}
          onChange={(e) =>
            editor.block(block.id, () =>
              e.target.checked
                ? { id: block.id, type: 'end', ending: { id: createId('e'), title: newText() } }
                : { id: block.id, type: 'end' },
            )
          }
        />
        <span>{t('end.named')}</span>
      </label>
      {block.ending ? (
        <TextField
          value={block.ending.title[locale] ?? ''}
          locale={locale}
          label={t('end.title')}
          placeholder={t('end.placeholder')}
          onChange={(v) => block.ending && editor.text(block.ending.title.id, locale, v)}
        />
      ) : (
        <p className="hint">{t('end.plain')}</p>
      )}
    </div>
  );
}
