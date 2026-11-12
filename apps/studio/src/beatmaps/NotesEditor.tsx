import { snapTime } from '@ie/rhythm';
import { BEATMAP_LIMITS, type BeatmapDef, type FieldPoint, type HitObject } from '@ie/story';
import { Check, Minus, Pause, Play, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { addObject, newObjectId, removeObjects, updateBeatmap } from './beatmap-edit.ts';
import { EditorPlayback, useSong } from './editor-playback.ts';
import type { EditorTime } from './editor-time.ts';
import { NoteField } from './NoteField.tsx';
import { NoteInspector } from './NoteInspector.tsx';
import { NoteTimeline } from './NoteTimeline.tsx';
import {
  SNAPS,
  TOOLS,
  sliderFromDraft,
  spinnerAt,
  stepTime,
  type Clip,
  type SliderDraft,
  type Tool,
} from './note-tools.ts';
import { TestPlay } from './TestPlay.tsx';
import { useNoteKeys } from './useNoteKeys.ts';

const SPANS = [1000, 2000, 4000, 8000, 16000, 32000] as const;

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(total % 1000).padStart(3, '0')}`;
}

/** Notes: the field at the playhead, the timeline under it, and the selected notes beside. */
export function NotesEditor({ map, time }: { readonly map: BeatmapDef; readonly time: EditorTime }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const song = useSong(map.track);
  const [playback] = useState(() => new EditorPlayback(time));
  const [playing, setPlaying] = useState(false);
  const [tool, setToolState] = useState<Tool>('select');
  const [divisor, setDivisor] = useState(4);
  const [spanIndex, setSpanIndex] = useState(2);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<SliderDraft | null>(null);
  const [testFrom, setTestFrom] = useState<number | null>(null);
  const clip = useRef<Clip | null>(null);
  const readout = useRef<HTMLOutputElement>(null);

  useEffect(() => playback.onChange(setPlaying), [playback]);
  useEffect(() => () => playback.dispose(), [playback]);
  useEffect(() => {
    const show = (now: number) => {
      if (readout.current) readout.current.textContent = clock(now);
    };
    show(time.t);
    return time.subscribe(show);
  }, [time]);

  const commit = (change: (m: BeatmapDef) => BeatmapDef, mergeKey?: string) =>
    edit((d) => updateBeatmap(d, map.id, change), mergeKey);
  const now = () => snapTime(map.timing, time.t, divisor);

  const setTool = (next: Tool) => {
    setToolState(next);
    if (next !== 'slider') setDraft(null);
  };

  const seek = (at: number) => {
    time.set(at);
    if (playback.playing && song) playback.play(song, map, time.t, true);
  };

  // Restarting the song on every pointer move of a pan would rebuild its audio each time, so a
  // pan pauses it and it carries on once from where the pan ends.
  const resumeAfterScrub = useRef(false);
  const scrub = (at: number, done: boolean) => {
    if (playback.playing) {
      resumeAfterScrub.current = true;
      playback.stop();
    }
    time.set(at);
    if (!done || !resumeAfterScrub.current) return;
    resumeAfterScrub.current = false;
    if (song) playback.play(song, map, time.t, true);
  };

  const togglePlay = () => {
    if (playback.playing) return playback.stop();
    if (song) playback.play(song, map, time.t, true);
  };

  /** Adds a note, replacing one that starts at the same moment (one note per moment). */
  const place = (o: HitObject) => {
    commit((m) => {
      const same = new Set(m.objects.filter((n) => Math.abs(n.t - o.t) < 1).map((n) => n.id));
      return addObject(removeObjects(m, same), o);
    });
    setSelected(new Set([o.id]));
  };

  const onPlace = (p: FieldPoint) => {
    if (tool === 'circle') place({ id: newObjectId(), kind: 'circle', t: now(), x: p.x, y: p.y });
    else if (tool === 'spinner') place(spinnerAt(map.timing, now(), newObjectId()));
    else if (tool === 'slider') {
      if (!draft) return setDraft({ t: now(), points: [p] });
      const last = draft.points[draft.points.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.005) return;
      if (draft.points.length > BEATMAP_LIMITS.path) return;
      setDraft({ ...draft, points: [...draft.points, p] });
    }
  };

  const finishSlider = () => {
    const slider = draft && sliderFromDraft(draft, map.timing, divisor, newObjectId());
    setDraft(null);
    if (slider) place(slider);
  };

  const test = () => {
    playback.stop();
    setTestFrom(time.t);
  };

  useNoteKeys({
    active: testFrom === null,
    map,
    time,
    divisor,
    selected,
    draft,
    clip,
    setTool,
    setSelected,
    setDraft,
    commit,
    togglePlay,
    seek,
    finishSlider,
  });

  return (
    <div className="bmed" data-testid="bmed-notes">
      <div className="row row--wrap bmed__bar">
        <Segmented
          label={t('bmed.tool')}
          value={tool}
          options={TOOLS.map((value) => ({ value, label: t(`bmed.tool.${value}`) }))}
          onChange={setTool}
        />
        <label className="labelled bmed__snap">
          <span className="ie-label">{t('bmed.snap')}</span>
          <select
            className="picker"
            value={divisor}
            data-testid="bmed-snap"
            onChange={(e) => setDivisor(Number(e.target.value))}
          >
            {SNAPS.map((n) => (
              <option key={n} value={n}>
                {t('bmed.snapValue', { n })}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ie-button"
          data-testid="bmed-play"
          disabled={!song}
          onClick={togglePlay}
        >
          {playing ? (
            <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          {playing ? t('bmed.pause') : t('bmed.play')}
        </button>
        <output ref={readout} className="bmed__clock" data-testid="bmed-clock" />
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-label={t('bmed.zoomOut')}
          title={t('bmed.zoomOut')}
          disabled={spanIndex >= SPANS.length - 1}
          onClick={() => setSpanIndex((i) => Math.min(SPANS.length - 1, i + 1))}
        >
          <Minus size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-label={t('bmed.zoomIn')}
          title={t('bmed.zoomIn')}
          disabled={spanIndex <= 0}
          onClick={() => setSpanIndex((i) => Math.max(0, i - 1))}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button"
          data-testid="bmed-test-play"
          disabled={!song || map.objects.length === 0}
          onClick={test}
        >
          {t('bmed.test')}
        </button>
      </div>
      {draft && (
        <div className="row row--wrap bmed__draft">
          <span className="hint">{t('bmed.sliderHint')}</span>
          <button
            type="button"
            className="ie-button"
            data-testid="bmed-finish-slider"
            disabled={draft.points.length < 2}
            onClick={finishSlider}
          >
            <Check size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('bmed.finishSlider')}
          </button>
          <button type="button" className="ie-button ie-button--quiet" onClick={() => setDraft(null)}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('bmed.cancelSlider')}
          </button>
        </div>
      )}
      <div className="bmed__main">
        <NoteField
          map={map}
          time={time}
          tool={tool}
          selected={selected}
          draft={draft}
          label={t('bmed.field')}
          onSelect={setSelected}
          onPlace={onPlace}
          onFinishSlider={finishSlider}
          onCommit={commit}
        />
        <aside className="bmed__side">
          <NoteInspector map={map} selected={selected} onCommit={commit} onSelect={setSelected} />
        </aside>
      </div>
      <NoteTimeline
        map={map}
        time={time}
        selected={selected}
        divisor={divisor}
        span={SPANS[spanIndex] ?? 4000}
        peaks={song?.peaks ?? null}
        label={t('bmed.timeline')}
        onSeek={seek}
        onScrub={scrub}
        onSelect={setSelected}
        onCommit={commit}
        onWheelStep={(direction) => seek(stepTime(map.timing, time.t, divisor, direction))}
        onZoom={(direction) =>
          setSpanIndex((i) => Math.max(0, Math.min(SPANS.length - 1, i + direction)))
        }
      />
      {testFrom !== null && song && (
        <TestPlay map={map} song={song} from={testFrom} onClose={() => setTestFrom(null)} />
      )}
    </div>
  );
}
