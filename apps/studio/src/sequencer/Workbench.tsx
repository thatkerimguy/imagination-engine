import {
  beatsPerBarOf,
  type SequenceClip,
  type SequenceDef,
  type SequenceNote,
  type SequenceTrack,
  type TrackKind,
} from '@ie/story';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePanZoom } from '../components/usePanZoom.ts';
import { useDoc, useProject } from '../project/store.ts';
import { attachStage, setStageLocale } from '../stage/studio-stage.ts';
import { useStudio, useT } from '../store.ts';
import {
  addItem,
  duplicateItem,
  findItem,
  mapTracks,
  newClip,
  newNote,
  newTrack,
  removeItem,
  snapBeats,
  snapTo,
  splitClip,
  updateItem,
  updateSequence,
  CLIP_KINDS,
} from './edit.ts';
import { Inspector } from './Inspector.tsx';
import { barBeat } from './labels.ts';
import { SequencePreview, sequenceTempo } from './preview.ts';
import { Settings } from './Settings.tsx';
import { Timeline } from './Timeline.tsx';
import { Transport } from './Transport.tsx';
import { useSequencerUi, ZOOMS } from './ui.ts';

const TYPING = 'input, textarea, select, [contenteditable="true"]';

/** One sequence open for editing: stage preview, transport, timeline, inspector and settings. */
export function Workbench({ sequence }: { readonly sequence: SequenceDef }) {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const locale = useStudio((s) => s.locale);
  const ui = useSequencerUi();
  const panel = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preview = useRef<SequencePreview | null>(null);
  const [playing, setPlaying] = useState(false);

  const { tempo, song } = sequenceTempo(doc, sequence);
  const beatsPerBar = song ? tempo.beatsPerBar : beatsPerBarOf(sequence);
  const step = snapBeats(ui.snap, { ...sequence, beatsPerBar });
  const snap = (beat: number) => snapTo(beat, step, sequence.length);
  const zoom = ui.zoom;
  // Pinch or Ctrl+wheel zooms around the fingers; the wheel alone scrolls through time.
  usePanZoom(scrollRef, {
    scale: zoom,
    onScale: ui.setZoom,
    min: ZOOMS[0],
    max: ZOOMS[ZOOMS.length - 1],
    axis: 'x',
    wheelScrollsX: true,
    panSurface: (el) => el.classList.contains('tl__lane') || el.closest('.tl__grid') !== null,
  });
  const position = (beat: number) => t('seq.position', barBeat(Math.max(0, beat), beatsPerBar));

  // Live values for the preview's callbacks, which outlive renders.
  const live = useRef({ zoom, position });
  useEffect(() => {
    live.current = { zoom, position };
  });

  useEffect(() => {
    if (!panel.current) return;
    const detach = attachStage(panel.current, null, locale);
    const p = new SequencePreview({
      frame: (beat) => {
        const x = beat * live.current.zoom;
        if (playheadRef.current) playheadRef.current.style.transform = `translateX(${x}px)`;
        if (positionRef.current) positionRef.current.textContent = live.current.position(beat);
        const scroller = scrollRef.current;
        if (
          scroller &&
          (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - 24)
        )
          scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 3);
      },
      stopped: (beat) => {
        setPlaying(false);
        const at = Math.max(0, beat);
        if (playheadRef.current)
          playheadRef.current.style.transform = `translateX(${at * live.current.zoom}px)`;
        useSequencerUi.getState().setPlayhead(at >= sequence.length ? 0 : at);
      },
    });
    preview.current = p;
    return () => {
      p.dispose();
      preview.current = null;
      detach();
    };
    // One preview per open sequence (the workbench is keyed by its ID).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setStageLocale(locale), [locale]);

  // Paused, the stage shows the scene in force at the playhead.
  useEffect(() => {
    if (!playing) preview.current?.showScene(sequence, doc, ui.playhead);
  }, [playing, sequence, doc, ui.playhead]);

  const change = useCallback(
    (fn: (s: SequenceDef) => SequenceDef, mergeKey?: string) =>
      edit((d) => updateSequence(d, sequence.id, fn), mergeKey),
    [edit, sequence.id],
  );
  const changeSelected = useCallback(
    (fn: (item: SequenceClip | SequenceNote) => SequenceClip | SequenceNote, mergeKey?: string) => {
      const id = useSequencerUi.getState().selected;
      if (id) change((s) => updateItem(s, id, fn), mergeKey);
    },
    [change],
  );

  const togglePlay = () => {
    const p = preview.current;
    if (!p) return;
    if (p.playing) return p.stop();
    setPlaying(true);
    const from = ui.playhead >= sequence.length ? 0 : ui.playhead;
    void p.play(doc, sequence, from);
  };
  const toStart = () => {
    preview.current?.stop();
    ui.setPlayhead(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  };
  const add = (track: SequenceTrack, beat: number) => {
    if (track.muted) return;
    const item =
      track.kind === 'notes'
        ? newNote(
            sequence.kind === 'move' && ui.noteKind === 'strike' ? 'parry' : ui.noteKind,
            beat,
          )
        : newClip(CLIP_KINDS[track.kind][0], beat, doc.audio?.sounds[0]?.id, doc.materials);
    change((s) => addItem(s, track.id, item));
    ui.select(item.id);
  };
  const remove = () => {
    if (!ui.selected) return;
    const id = ui.selected;
    change((s) => removeItem(s, id));
    ui.select(null);
  };
  const duplicate = () => {
    if (!ui.selected) return;
    let copy: string | null = null;
    const id = ui.selected;
    change((s) => {
      const result = duplicateItem(s, id, step);
      copy = result.id;
      return result.sequence;
    });
    if (copy) ui.select(copy);
  };
  const split = () => {
    const id = ui.selected;
    if (id) change((s) => splitClip(s, id, ui.playhead));
  };
  const nudge = (delta: number) =>
    changeSelected((i) => ({ ...i, at: snapTo(i.at + delta, step, sequence.length) }), 'nudge');
  const scrub = (beat: number) => {
    preview.current?.stop();
    ui.setPlayhead(beat);
  };
  const addTrack = (kind: TrackKind) =>
    change((s) => ({ ...s, tracks: [...s.tracks, newTrack(kind)] }));
  const trackChange = (trackId: string, what: 'mute' | 'remove') =>
    change((s) =>
      what === 'remove'
        ? { ...s, tracks: s.tracks.filter((tr) => tr.id !== trackId) }
        : mapTracks(s, (tr) =>
            tr.id === trackId
              ? tr.muted
                ? (({ muted: _m, ...rest }) => rest)(tr)
                : { ...tr, muted: true }
              : tr,
          ),
    );

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest(TYPING)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    const handled = (() => {
      if (key === ' ' && !(event.target instanceof HTMLButtonElement)) return (togglePlay(), true);
      if (key === 'k' || key === 'K') return (preview.current?.stop(), true);
      if (key === 'j' || key === 'J') return (scrub(Math.max(0, snap(ui.playhead - 1))), true);
      if (key === 'l' || key === 'L') return (scrub(snap(ui.playhead + 1)), true);
      if (!ui.selected) return false;
      if (key === 'ArrowLeft') return (nudge(-step), true);
      if (key === 'ArrowRight') return (nudge(step), true);
      if (key === 'Delete' || key === 'Backspace') return (remove(), true);
      return false;
    })();
    if (handled) event.preventDefault();
  };

  const selectedItem = findItem(sequence, ui.selected)?.item;
  const canSplit =
    !!selectedItem &&
    'action' in selectedItem &&
    !!selectedItem.length &&
    ui.playhead > selectedItem.at &&
    ui.playhead < selectedItem.at + selectedItem.length;

  return (
    <div className="seq-bench" onKeyDown={keys} data-testid="seq-bench">
      <div className="seq-bench__top">
        <div className="seq-stage" ref={panel} data-testid="seq-stage" />
        <Settings sequence={sequence} change={change} />
      </div>
      <Transport
        sequence={sequence}
        playing={playing}
        positionRef={positionRef}
        position={position(ui.playhead)}
        onPlay={togglePlay}
        onStart={toStart}
        onAddTrack={addTrack}
      />
      <Timeline
        sequence={sequence}
        beatsPerBar={beatsPerBar}
        zoom={zoom}
        snap={snap}
        step={step}
        selected={ui.selected}
        playhead={ui.playhead}
        playheadRef={playheadRef}
        scrollRef={scrollRef}
        onSelect={ui.select}
        onAdd={add}
        onMove={(id, beat) =>
          change((s) => updateItem(s, id, (i) => ({ ...i, at: beat })), `drag:${id}`)
        }
        onTrim={(id, length) =>
          change((s) => updateItem(s, id, (i) => ({ ...i, length })), `trim:${id}`)
        }
        onScrub={scrub}
        onTrack={trackChange}
      />
      <p className="hint seq-bench__keys">{t('seq.keys')}</p>
      <section className="seq-inspector" aria-label={t('seq.selected')}>
        <h3 className="seq-inspector__title">{t('seq.selected')}</h3>
        <Inspector
          sequence={sequence}
          selected={ui.selected}
          change={changeSelected}
          canSplit={canSplit}
          onSplit={split}
          onDuplicate={duplicate}
          onRemove={remove}
        />
      </section>
    </div>
  );
}
