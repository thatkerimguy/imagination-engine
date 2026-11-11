import { generateSfxr, mutateSfxr, SFXR_PRESETS, type SfxrPreset } from '@ie/audio';
import { createId } from '@ie/core';
import { SFXR_WAVES, type SfxrParams, type SoundDef, type StoryProject } from '@ie/story';
import { Play, Plus, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { director, editAudio, engine } from '../audio/studio-audio.ts';
import { MenuButton } from '../components/Menu.tsx';
import { Segmented } from '../components/Segmented.tsx';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { SFX_ICON } from '../project/preset-icons.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { nextName } from '../write/edit.ts';

/** The sliders worth showing; the rest stay as the preset made them. */
const SLIDERS = [
  ['freq', 0, 1],
  ['freqRamp', -1, 1],
  ['attack', 0, 1],
  ['sustain', 0, 1],
  ['punch', 0, 1],
  ['decay', 0, 1],
  ['vibratoDepth', 0, 1],
  ['repeatSpeed', 0, 1],
  ['lpf', 0, 1],
  ['hpf', 0, 1],
  ['volume', 0, 1],
] as const satisfies readonly (readonly [keyof SfxrParams, number, number])[];

function play(params: SfxrParams): void {
  void engine.resume().then(() => director.preview(params));
}

function setSound(id: string, change: (s: SoundDef) => SoundDef, mergeKey?: string): void {
  editAudio(
    (lib) => ({ ...lib, sounds: lib.sounds.map((s) => (s.id === id ? change(s) : s)) }),
    mergeKey,
  );
}

function SoundEditor({ sound, uses }: { readonly sound: SoundDef; readonly uses: number }) {
  const t = useT();
  const p = sound.sfxr;
  const set = (sfxr: SfxrParams, merge?: string) =>
    setSound(sound.id, (s) => ({ ...s, sfxr }), merge);
  return (
    <div className="sound-editor">
      <label className="labelled">
        <span className="ie-label">{t('sound.name')}</span>
        <input
          className="field"
          value={sound.name}
          onChange={(e) =>
            setSound(sound.id, (s) => ({ ...s, name: e.target.value }), `sound:${sound.id}:name`)
          }
        />
      </label>
      <div className="page__actions">
        <button type="button" className="ie-button ie-button--primary" onClick={() => play(p)}>
          <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.play')}
        </button>
        <button
          type="button"
          className="ie-button"
          onClick={() => {
            const next = mutateSfxr(p);
            set(next);
            play(next);
          }}
        >
          <Shuffle size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.mutate')}
        </button>
        {SFXR_PRESETS.map((preset) => {
          const Icon = SFX_ICON[preset];
          return (
            <button
              key={preset}
              type="button"
              className="ie-button ie-button--quiet"
              onClick={() => {
                const next = generateSfxr(preset);
                set(next);
                play(next);
              }}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              {t(`sfxr.${preset}`)}
            </button>
          );
        })}
      </div>
      <Segmented
        label={t('sound.wave')}
        value={p.wave}
        options={SFXR_WAVES.map((w) => ({ value: w, label: t(`sfxr.wave.${w}`) }))}
        onChange={(wave) => {
          set({ ...p, wave });
          play({ ...p, wave });
        }}
      />
      <div className="card__grid">
        {SLIDERS.map(([key, min, max]) => (
          <label key={key} className="labelled">
            <span className="ie-label">{t(`sfxr.${key}`)}</span>
            <input
              className="ie-range"
              type="range"
              min={min}
              max={max}
              step={0.01}
              value={p[key]}
              onChange={(e) =>
                set({ ...p, [key]: Number(e.target.value) }, `sound:${sound.id}:${key}`)
              }
              onPointerUp={() => play(sound.sfxr)}
              onKeyUp={() => play(sound.sfxr)}
            />
          </label>
        ))}
      </div>
      <div className="card__foot">
        <span className="hint">{t('data.uses', { count: uses })}</span>
        <DeleteButton
          uses={uses}
          onDelete={() =>
            editAudio((lib) => ({ ...lib, sounds: lib.sounds.filter((s) => s.id !== sound.id) }))
          }
        />
      </div>
    </div>
  );
}

/** Sound effects made from sfxr presets: a few kilobytes for a whole novel, no files to license. */
export function SoundDesigner({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const sounds = doc.audio?.sounds ?? [];
  const usages = useMemo(() => countUsages(doc).audio, [doc]);
  const [open, setOpen] = useState<string | null>(sounds[0]?.id ?? null);
  const add = (preset: SfxrPreset) => {
    const sound: SoundDef = {
      id: createId('s'),
      name: nextName(
        t(`sfxr.${preset}`),
        sounds.map((s) => s.name),
      ),
      sfxr: generateSfxr(preset),
    };
    editAudio((lib) => ({ ...lib, sounds: [...lib.sounds, sound] }));
    setOpen(sound.id);
    play(sound.sfxr);
  };

  return (
    <div className="cards" data-testid="sounds">
      <div className="page__actions sound__add">
        <MenuButton
          label={t('sound.newSound')}
          testId="new-sound"
          items={SFXR_PRESETS.map((preset) => ({
            id: preset,
            label: t(`sfxr.${preset}`),
            icon: SFX_ICON[preset],
            onSelect: () => add(preset),
          }))}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>{t('sound.newSound')}</span>
        </MenuButton>
      </div>
      {sounds.length === 0 && <p className="hint">{t('sound.noSounds')}</p>}
      {sounds.map((sound) => (
        <section className="card" key={sound.id} data-testid="sound">
          <div className="track-head">
            <button
              type="button"
              className="ie-button ie-button--quiet"
              aria-label={t('sound.play')}
              onClick={() => play(sound.sfxr)}
            >
              <Play size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="track-head__title track-head__toggle"
              aria-expanded={open === sound.id}
              onClick={() => setOpen(open === sound.id ? null : sound.id)}
            >
              {sound.name || t('sound.untitled')}
            </button>
          </div>
          {open === sound.id && <SoundEditor sound={sound} uses={usages.get(sound.id) ?? 0} />}
        </section>
      ))}
    </div>
  );
}
