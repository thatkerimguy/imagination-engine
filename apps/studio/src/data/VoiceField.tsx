import { VOICE_WAVES, type Voice } from '@ie/story';
import { Play } from 'lucide-react';
import { director, engine } from '../audio/studio-audio.ts';
import { useT } from '../store.ts';

const NONE = 'none';
const DEFAULT_VOICE: Voice = { wave: 'square', pitch: 220, variance: 2, every: 2, volume: 0.5 };

/** Speaks a few blips the way a typed line would. */
function sample(voice: Voice): void {
  void engine.resume().then(() => {
    for (let i = 0; i < 5; i++) setTimeout(() => director.blip(voice), i * 90);
  });
}

/** A character's dialogue voice: a short tone every few typed letters, or none. */
export function VoiceField({
  voice,
  onChange,
}: {
  readonly voice: Voice | undefined;
  readonly onChange: (voice: Voice | undefined) => void;
}) {
  const t = useT();
  const set = (patch: Partial<Voice>) => onChange({ ...(voice ?? DEFAULT_VOICE), ...patch });
  return (
    <div className="voice-field" data-testid="voice">
      <label className="labelled">
        <span className="ie-label">{t('voice.label')}</span>
        <select
          className="picker"
          value={voice?.wave ?? NONE}
          onChange={(e) =>
            e.target.value === NONE
              ? onChange(undefined)
              : set({ wave: e.target.value as Voice['wave'] })
          }
        >
          <option value={NONE}>{t('voice.none')}</option>
          {VOICE_WAVES.map((w) => (
            <option key={w} value={w}>
              {t(`voice.wave.${w}`)}
            </option>
          ))}
        </select>
      </label>
      {voice && (
        <>
          <label className="labelled">
            <span className="ie-label">{t('voice.pitch')}</span>
            <input
              className="ie-range"
              type="range"
              min={80}
              max={900}
              step={10}
              value={voice.pitch}
              onChange={(e) => set({ pitch: Number(e.target.value) })}
              onPointerUp={() => sample(voice)}
            />
          </label>
          <label className="labelled">
            <span className="ie-label">{t('voice.every')}</span>
            <select
              className="picker"
              value={voice.every}
              onChange={(e) => set({ every: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {t('voice.everyN', { count: n })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ie-button ie-button--quiet"
            onClick={() => sample(voice)}
          >
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('voice.try')}
          </button>
        </>
      )}
    </div>
  );
}
