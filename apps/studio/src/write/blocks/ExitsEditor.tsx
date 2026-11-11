import type { ExitsBlock } from '@ie/story';
import { Map as MapIcon } from 'lucide-react';
import { newText } from '../../project/factory.ts';
import { useStudio, useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { labelText } from '../edit.ts';
import { TextField } from '../TextField.tsx';

/**
 * The Exits block (ADR 0031) only takes an optional question: the ways out themselves belong to
 * the room, and are edited in World.
 */
export function ExitsEditor({ block }: { readonly block: ExitsBlock }) {
  const t = useT();
  const { doc, editor, locale } = useWrite();
  const setView = useStudio((s) => s.setView);
  const passage = doc.chapters
    .flatMap((c) => c.passages)
    .find((p) => p.blocks.some((b) => b.id === block.id));
  const room = doc.world?.rooms.find((r) => r.passage === passage?.id);
  const exits = room?.exits.length ?? 0;

  return (
    <div className="exits-editor" data-testid="exits-editor">
      {block.prompt ? (
        <TextField
          value={block.prompt[locale] ?? ''}
          locale={locale}
          label={t('exitsBlock.prompt')}
          placeholder={t('exitsBlock.promptPlaceholder')}
          onChange={(v) => block.prompt && editor.text(block.prompt.id, locale, v)}
        />
      ) : null}
      <p className="hint">
        {room
          ? t('exitsBlock.room', { name: labelText(room.name, t.locale, room.id) })
          : t('exitsBlock.noRoom')}
        {room && exits === 0 ? ` ${t('world.noExits')}` : ''}
      </p>
      <div className="row row--wrap">
        {!block.prompt && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            onClick={() =>
              editor.block(block.id, (b) => ({ ...(b as ExitsBlock), prompt: newText() }))
            }
          >
            {t('exitsBlock.prompt')}
          </button>
        )}
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="exits-open-world"
          onClick={() => setView('world')}
        >
          <MapIcon size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('exitsBlock.open')}
        </button>
      </div>
    </div>
  );
}
