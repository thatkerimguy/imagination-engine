import type { BeatmapDef, StoryProject } from '@ie/story';
import { FileUp, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { importAudioFile } from '../audio/studio-audio.ts';
import { Segmented } from '../components/Segmented.tsx';
import { useDoc, useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText, nextName } from '../write/edit.ts';
import { addBeatmaps, beatmapsOf, newBeatmap, removeBeatmap, updateBeatmap } from './beatmap-edit.ts';
import { BeatmapSettings } from './BeatmapSettings.tsx';
import { EditorTime } from './editor-time.ts';
import { readChartFiles } from './import-osu.ts';
import { NotesEditor } from './NotesEditor.tsx';
import { useBeatmapPick } from './selection.ts';
import { TimingEditor } from './TimingEditor.tsx';

const TABS = ['notes', 'timing', 'settings'] as const;
type Tab = (typeof TABS)[number];

function MapEditor({ doc, map, tab }: { readonly doc: StoryProject; readonly map: BeatmapDef; readonly tab: Tab }) {
  const edit = useProject((s) => s.edit);
  const pick = useBeatmapPick((s) => s.pick);
  // A fresh playhead per beatmap, just before its first note.
  const [time] = useState(() => {
    const start = new EditorTime();
    start.set((map.objects[0]?.t ?? 0) - 500);
    return start;
  });
  const commit = (change: (m: BeatmapDef) => BeatmapDef, mergeKey?: string) =>
    edit((d) => updateBeatmap(d, map.id, change), mergeKey);
  const track = doc.audio?.tracks.find((t) => t.id === map.track);

  if (tab === 'timing') return <TimingEditor map={map} track={track} time={time} onCommit={commit} />;
  if (tab === 'settings')
    return (
      <BeatmapSettings
        doc={doc}
        map={map}
        onCommit={commit}
        onDelete={() => {
          edit((d) => removeBeatmap(d, map.id));
          pick(null);
        }}
      />
    );
  return <NotesEditor map={map} time={time} />;
}

/** Beatmaps: the charts Rhythm blocks play, imported from .osu/.osz or placed by hand (ADR 0033). */
export function BeatmapsView() {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const locale = useStudio((s) => s.locale);
  const pickedId = useBeatmapPick((s) => s.id);
  const pick = useBeatmapPick((s) => s.pick);
  const [tab, setTab] = useState<Tab>('notes');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const maps = beatmapsOf(doc);
  const map = maps.find((m) => m.id === pickedId) ?? maps[0];

  const add = (made: readonly BeatmapDef[]) => {
    edit((d) => addBeatmaps(d, made));
    if (made[0]) pick(made[0].id);
    setTab('notes');
  };

  const makeNew = () => {
    const name = nextName(t('bmed.base'), maps.map((m) => labelText(m.name, locale, m.id)));
    add([newBeatmap({ en: name, tr: name })]);
    setStatus(null);
  };

  const importFiles = async (files: readonly File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setStatus(t('bmed.importing'));
    try {
      const set = await readChartFiles(files);
      const first = set.charts[0];
      if (!first) {
        // Only a song: a new, empty beatmap to chart it.
        if (set.audio) {
          const track = await importAudioFile(set.audio);
          add([newBeatmap({ en: track.title, tr: track.title }, track)]);
          return setStatus(null);
        }
        return setStatus(set.skipped > 0 ? t('bmed.skipped', { count: set.skipped }) : t('bmed.importFailed'));
      }
      const credit = first.beatmap.credit;
      const track = set.audio
        ? await importAudioFile(set.audio, {
            ...(credit?.title ? { title: credit.title } : {}),
            ...(credit?.artist ? { artist: credit.artist } : {}),
            own: false,
          })
        : null;
      add(set.charts.map((c) => (track ? { ...c.beatmap, track: track.id } : c.beatmap)));
      const notes = [t('bmed.imported', { count: set.charts.length })];
      if (set.skipped > 0) notes.push(t('bmed.skipped', { count: set.skipped }));
      if (!track) notes.push(t('bmed.noSongFound'));
      setStatus(notes.join(' '));
    } catch (error) {
      console.warn(error);
      setStatus(t('bmed.importFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="page page--wide"
      data-testid="view-beatmaps"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        void importFiles([...e.dataTransfer.files]);
      }}
    >
      <h2 className="page__title">{t('view.beatmaps')}</h2>
      <p className="page__intro">{t('bmed.intro')}</p>
      <div className="row row--wrap bmed__pick">
        {map && (
          <select
            className="picker"
            aria-label={t('bmed.list')}
            value={map.id}
            data-testid="beatmap-pick"
            onChange={(e) => pick(e.target.value)}
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {labelText(m.name, locale, m.id)} · {t('bmed.noteCount', { count: m.objects.length })}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="ie-button" data-testid="beatmap-new" onClick={makeNew}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bmed.new')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="beatmap-import"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bmed.import')}
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple
          accept=".osu,.osz,.zip,audio/*"
          data-testid="beatmap-file"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            void importFiles(files);
          }}
        />
        {status && (
          <span className="hint" role="status" data-testid="beatmap-status">
            {status}
          </span>
        )}
      </div>
      {map ? (
        <>
          <div className="data__tabs">
            <Segmented
              label={t('view.beatmaps')}
              value={tab}
              options={TABS.map((value) => ({ value, label: t(`bmed.tab.${value}`) }))}
              onChange={setTab}
            />
          </div>
          <div className="page__body">
            <MapEditor key={map.id} doc={doc} map={map} tab={tab} />
          </div>
        </>
      ) : (
        <p className="hint">{t('bmed.empty')}</p>
      )}
    </section>
  );
}
