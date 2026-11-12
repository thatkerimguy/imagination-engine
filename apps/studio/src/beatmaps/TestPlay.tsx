import { BeatmapView, parsePrefs } from '@ie/rhythm';
import type { BeatmapDef } from '@ie/story';
import { readPref, writePref } from '@ie/ui-kit';
import { useEffect, useRef } from 'react';
import { engine } from '../audio/studio-audio.ts';
import { RHYTHM_PREFS } from '../play/PlaySession.ts';
import { useStudio } from '../store.ts';
import type { LoadedSong } from './editor-playback.ts';

interface Props {
  readonly map: BeatmapDef;
  readonly song: LoadedSong;
  /** Song time to play from; earlier notes are left out. */
  readonly from: number;
  readonly onClose: () => void;
}

/** Plays the beatmap as a reader would, over the editor, from the playhead. */
export function TestPlay({ map, song, from, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const locale = useStudio((s) => s.locale);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    void engine.resume();
    const view = new BeatmapView({
      host: element,
      contained: true,
      beatmap: map,
      song: song.source,
      engine,
      locale,
      prefs: parsePrefs(readPref(RHYTHM_PREFS)),
      savePrefs: (p) => writePref(RHYTHM_PREFS, JSON.stringify(p)),
      ...(from > 0 ? { startAt: from } : {}),
      test: true,
      onDone: () => close.current(),
    });
    return () => view.dispose();
    // A test play keeps the chart it started with; edits show on the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="bmed__test" data-testid="bmed-test" />;
}
