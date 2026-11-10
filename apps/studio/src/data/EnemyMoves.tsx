import { createId } from '@ie/core';
import { MOVE_ANSWERS, MOVE_PATTERNS, type EnemyDef, type EnemyMove } from '@ie/story';
import { Plus, X } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { useT } from '../store.ts';

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
  const set = (id: string, change: Partial<EnemyMove>) =>
    onChange(enemy.moves.map((m) => (m.id === id ? { ...m, ...change } : m)));

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
            aria-label={t('enemies.pattern')}
            value={move.pattern}
            onChange={(e) => {
              const pattern = MOVE_PATTERNS.find((p) => p === e.target.value);
              if (pattern) set(move.id, { pattern });
            }}
          >
            {MOVE_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {t(`pattern.${p}` as MessageKey)}
              </option>
            ))}
          </select>
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
