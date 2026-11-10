import { MinigameView } from '@ie/minigame';
import { pickLabel, type MinigameGame, type MinigameResult } from '@ie/story';
import { Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../store.ts';
import { useWriteLocale } from '../write/edit.ts';

/**
 * Plays the block's game right under it, with its current settings: the same view the Player
 * mounts, contained in a box. Nothing reaches the story; each try deals a new game.
 */
export function MinigameTryout({
  game,
  title,
}: {
  readonly game: MinigameGame;
  readonly title?: { readonly en?: string; readonly tr?: string };
}) {
  const t = useT();
  // The game plays in the language being written, so Turkish words can be tried in Turkish.
  const locale = useWriteLocale();
  const host = useRef<HTMLDivElement>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const open = round > 0;
  // Changing a parameter while trying restarts the try with the new settings.
  const key = JSON.stringify(game);
  const name = pickLabel(title, locale);

  useEffect(() => {
    const box = host.current;
    if (!open || !box) return;
    const view = new MinigameView({
      host: box,
      contained: true,
      game,
      ...(name ? { title: name } : {}),
      seed: (Date.now() ^ (round * 2654435761)) >>> 0,
      locale,
      onDone: (r) => setResult(r),
    });
    return () => view.dispose();
    // `game` is covered by `key`, which changes exactly when the parameters do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, round, key, locale, name]);

  const start = () => {
    setResult(null);
    setRound((r) => r + 1);
  };

  return (
    <div className="mg-try">
      <div className="row row--wrap">
        <button type="button" className="ie-button" data-testid="mg-try" onClick={start}>
          {open ? (
            <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          {t(open ? 'mg.tryAgain' : 'mg.try')}
        </button>
        {open && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-testid="mg-try-close"
            onClick={() => {
              setRound(0);
              setResult(null);
            }}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('mg.tryClose')}
          </button>
        )}
        {result && (
          <span className="mg-try__result" data-testid="mg-try-result" data-won={result.won}>
            {t('mg.tryResult', {
              outcome: t(result.won ? 'mg.tryWon' : 'mg.tryLost'),
              score: result.score,
            })}
          </span>
        )}
      </div>
      {!open && <p className="hint">{t('mg.tryHint')}</p>}
      {open && <div className="mg-try__box" ref={host} data-testid="mg-try-box" />}
    </div>
  );
}
