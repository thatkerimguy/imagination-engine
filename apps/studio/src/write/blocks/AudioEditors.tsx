import { AMBIENCES, type ActionBlock, type Ambience, type StoryProject } from '@ie/story';
import { Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { director, engine } from '../../audio/studio-audio.ts';
import { runAction } from '../../kernel.ts';
import { audioKind } from '../../project/factory.ts';
import { useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { Sentence } from '../Sentence.tsx';

const OPEN_SOUND = '__sound__';

type Params = Readonly<Record<string, unknown>>;

function slotOf(params: Params): Ambience {
  return AMBIENCES.find((a) => a === params.slot) ?? 'rain';
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Picks a track or a sound; the last entry opens the Sound workspace to add one. */
function LibraryPicker({
  items,
  value,
  label,
  empty,
  none,
  onChange,
}: {
  readonly items: readonly { id: string; name: string }[];
  readonly value: string;
  readonly label: string;
  readonly empty: string;
  /** Label of the "nothing" choice (Silence), when there is one. */
  readonly none?: string;
  readonly onChange: (id: string) => void;
}) {
  const t = useT();
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid="audio-picker"
      onChange={(e) => {
        if (e.target.value === OPEN_SOUND) return runAction('studio.view.open', { view: 'sound' });
        onChange(e.target.value);
      }}
    >
      {none !== undefined && <option value="">{none}</option>}
      {none === undefined && !value && <option value="">{items.length ? label : empty}</option>}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name || item.id}
        </option>
      ))}
      <option value={OPEN_SOUND}>{t('audioBlock.openSound')}</option>
    </select>
  );
}

function Seconds({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (n: number) => void;
}) {
  return (
    <input
      className="field field--number"
      type="number"
      min={0}
      max={30}
      step={0.5}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
    />
  );
}

/** Hear what the block does without playing the story. Ambience and music toggle off again. */
function Preview({ kind, params, doc }: { kind: string; params: Params; doc: StoryProject }) {
  const t = useT();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    return () => {
      if (kind === 'music') director.music.stop(0.3);
      if (kind === 'ambience') director.ambienceSet({ slot: slotOf(params), volume: 0, fade: 0.3 });
    };
  }, [on, kind, params]);
  const press = async () => {
    await engine.resume();
    if (kind === 'sfx')
      return director.sfxPlay({ sound: typeof params.sound === 'string' ? params.sound : '' });
    if (on) return setOn(false);
    setOn(true);
    if (kind === 'music') {
      const id = typeof params.track === 'string' ? params.track : null;
      const track = doc.audio?.tracks.find((x) => x.id === id);
      await director.music.set({ track: id, fade: 0.3 }, track);
    } else {
      director.ambienceSet({ slot: slotOf(params), volume: num(params.volume, 0.6), fade: 0.3 });
    }
  };
  const Icon = on ? Square : Play;
  return (
    <button
      type="button"
      className="ie-button ie-button--quiet"
      aria-label={on ? t('sound.stop') : t('audioBlock.preview')}
      aria-pressed={kind === 'sfx' ? undefined : on}
      onClick={() => void press()}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/** Music, sound-effect and ambience blocks: sentences with pickers, plus a preview. */
export function AudioEditor({ block }: { readonly block: ActionBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const kind = audioKind(block);
  const params: Params = block.params ?? {};
  const set = (patch: Params) =>
    editor.block(
      block.id,
      (b) => ({ ...(b as ActionBlock), params: { ...params, ...patch } }),
      `audio:${block.id}`,
    );
  const tracks = (doc.audio?.tracks ?? []).map((x) => ({ id: x.id, name: x.title }));
  const sounds = doc.audio?.sounds ?? [];

  let sentence;
  if (kind === 'music') {
    sentence = (
      <Sentence
        template={t('audioBlock.music')}
        slots={{
          track: (
            <LibraryPicker
              items={tracks}
              value={typeof params.track === 'string' ? params.track : ''}
              label={t('audioBlock.track')}
              empty={t('audioBlock.noTracks')}
              none={t('audioBlock.silence')}
              onChange={(id) => set({ track: id || null })}
            />
          ),
          fade: (
            <Seconds
              value={num(params.fade, 2)}
              label={t('audioBlock.fade')}
              onChange={(fade) => set({ fade })}
            />
          ),
        }}
      />
    );
  } else if (kind === 'sfx') {
    sentence = (
      <Sentence
        template={t('audioBlock.sfx')}
        slots={{
          sound: (
            <LibraryPicker
              items={sounds}
              value={typeof params.sound === 'string' ? params.sound : ''}
              label={t('audioBlock.sound')}
              empty={t('audioBlock.noSounds')}
              onChange={(sound) => set({ sound })}
            />
          ),
        }}
      />
    );
  } else {
    sentence = (
      <Sentence
        template={t('audioBlock.ambience')}
        slots={{
          slot: (
            <select
              className="picker"
              aria-label={t('audioBlock.layer')}
              value={slotOf(params)}
              onChange={(e) => set({ slot: e.target.value })}
            >
              {AMBIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(`ambience.${a}`)}
                </option>
              ))}
            </select>
          ),
          volume: (
            <select
              className="picker"
              aria-label={t('audioBlock.volume')}
              value={String(Math.round(num(params.volume, 0.6) * 10) / 10)}
              onChange={(e) => set({ volume: Number(e.target.value) })}
            >
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
                <option key={v} value={String(v)}>
                  {v === 0 ? t('audioBlock.off') : `${Math.round(v * 100)}%`}
                </option>
              ))}
            </select>
          ),
          fade: (
            <Seconds
              value={num(params.fade, 3)}
              label={t('audioBlock.fade')}
              onChange={(fade) => set({ fade })}
            />
          ),
        }}
      />
    );
  }
  return (
    <div className="audio-block">
      {sentence}
      {kind && <Preview kind={kind} params={params} doc={doc} />}
    </div>
  );
}
