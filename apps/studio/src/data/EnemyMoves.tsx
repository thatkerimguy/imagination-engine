import { createId } from '@ie/core';
import { MOVE_ANSWERS, MOVE_PATTERNS, type EnemyDef, type EnemyMove } from '@ie/story';
import { Film, Plus, X } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { useDoc } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { openSequence, useAddSequence } from '../write/blocks/SequenceEditor.tsx';

const TIMELINE = 'seq:';
const NEW_TIMELINE = '__newTimeline__';

const POWERS = [0.5, 0.75, 1, 1.5, 2] as const;

/** An enemy's moves: a name in both languages, its rhythm, how the reader answers, its power. */
export function EnemyMoves({
  enemy,
  onChange,
}: {
  readonly enemy: EnemyDef;
  readonly onChange: (moves: readonly EnemyMove[]) => void;
}) {
  const t = useT();
  const doc = useDoc();
  const locale = useStudio((s) => s.locale);
  const addSequence = useAddSequence();
  const moveSequences = (doc.sequences ?? []).filter((s) => s.kind === 'move');
  const set = (id: string, change: Partial<EnemyMove>) =>
    onChange(enemy.moves.map((m) => (m.id === id ? { ...m, ...change } : m)));
  /** A preset rhythm, or a move sequence from the timeline (ADR 0019). */
  const setRhythm = (move: EnemyMove, value: string) => {
    const { sequence: _old, ...rest } = move;
    let next: EnemyMove = rest;
    if (value === NEW_TIMELINE) {
      next = {
        ...rest,
        sequence: addSequence('move', labelText(move.name, locale, t('seq.moveBase'))),
      };
    } else if (value.startsWith(TIMELINE)) {
      next = { ...rest, sequence: value.slice(TIMELINE.length) };
    } else {
      const pattern = MOVE_PATTERNS.find((p) => p === value);
      if (pattern) next = { ...rest, pattern };
    }
    onChange(enemy.moves.map((m) => (m.id === move.id ? next : m)));
  };

  return (
    <div className="stack" data-testid="enemy-moves">
      <span className="ie-label">{t('enemies.moves')}</span>
      {enemy.moves.map((move) => (
        <div className="row row--wrap" key={move.id} data-testid="enemy-move">
          <input
            className="field"
            aria-label={`${t('enemies.move')} (${t('language.en')})`}
            placeholder={t('language.en')}
            value={move.name.en ?? ''}
            onChange={(e) => set(move.id, { name: { ...move.name, en: e.target.value } })}
          />
          <input
            className="field"
            lang="tr"
            aria-label={`${t('enemies.move')} (${t('language.tr')})`}
            placeholder={t('language.tr')}
            value={move.name.tr ?? ''}
            onChange={(e) => set(move.id, { name: { ...move.name, tr: e.target.value } })}
          />
          <select
            className="picker"
            aria-label={t('enemies.rhythm')}
            data-testid="move-rhythm"
            value={move.sequence ? `${TIMELINE}${move.sequence}` : move.pattern}
            onChange={(e) => setRhythm(move, e.target.value)}
          >
            {MOVE_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {t(`pattern.${p}` as MessageKey)}
              </option>
            ))}
            {move.sequence && !moveSequences.some((s) => s.id === move.sequence) && (
              <option value={`${TIMELINE}${move.sequence}`}>
                {t('enemies.timeline', { name: move.sequence })}
              </option>
            )}
            {moveSequences.map((s) => (
              <option key={s.id} value={`${TIMELINE}${s.id}`}>
                {t('enemies.timeline', { name: labelText(s.name, locale, s.id) })}
              </option>
            ))}
            <option value={NEW_TIMELINE}>{t('enemies.newTimeline')}</option>
          </select>
          {move.sequence && moveSequences.some((s) => s.id === move.sequence) && (
            <button
              type="button"
              className="ie-button ie-button--quiet"
              aria-label={t('enemies.editTimeline')}
              title={t('enemies.editTimeline')}
              data-testid="move-edit-timeline"
              onClick={() => openSequence(move.sequence ?? '')}
            >
              <Film size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          {!move.sequence && (
            <select
              className="picker"
              aria-label={t('enemies.answer')}
              value={move.answer}
              onChange={(e) => {
                const answer = MOVE_ANSWERS.find((a) => a === e.target.value);
                if (answer) set(move.id, { answer });
              }}
            >
              {MOVE_ANSWERS.map((a) => (
                <option key={a} value={a}>
                  {t(`answer.${a}` as MessageKey)}
                </option>
              ))}
            </select>
          )}
          <select
            className="picker"
            aria-label={t('enemies.power')}
            value={String(move.power ?? 1)}
            onChange={(e) => set(move.id, { power: Number(e.target.value) })}
          >
            {POWERS.map((p) => (
              <option key={p} value={String(p)}>
                {`×${p}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ie-button ie-button--quiet"
            aria-label={t('enemies.removeMove')}
            title={t('enemies.removeMove')}
            disabled={enemy.moves.length <= 1}
            onClick={() => onChange(enemy.moves.filter((m) => m.id !== move.id))}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="add-move"
          onClick={() =>
            onChange([
              ...enemy.moves,
              { id: createId('m'), name: { en: '', tr: '' }, pattern: 'jab', answer: 'parry' },
            ])
          }
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('enemies.addMove')}
        </button>
      </div>
    </div>
  );
}
