import { parseSpotifyUri, parseYouTubeId } from '@ie/audio';
import { createId } from '@ie/core';
import type { StoryProject, Track } from '@ie/story';
import { ChevronDown, ChevronRight, Link, Search, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { addTrack, importAudioFile, useAnalysis } from '../audio/studio-audio.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { CatalogSearch } from './CatalogSearch.tsx';
import { TrackDetail } from './TrackDetail.tsx';
import { TrackSummary } from './TrackSummary.tsx';

/** A Spotify or YouTube track from a pasted link, or null if the link is neither. */
function trackFromLink(link: string): Track | null {
  const uri = parseSpotifyUri(link);
  const videoId = uri ? null : parseYouTubeId(link);
  if (!uri && !videoId) return null;
  return {
    id: createId('t'),
    title: uri ? 'Spotify' : 'YouTube',
    source: uri ? { kind: 'spotify', uri } : { kind: 'youtube', videoId: videoId ?? '' },
    // Streaming services: fine to play privately, never in a published novel (PLAN §5).
    license: { code: uri ? 'spotify' : 'youtube' },
  };
}

function LinkForm({ onAdded }: { readonly onAdded: (id: string) => void }) {
  const t = useT();
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <form
      className="catalog__search"
      onSubmit={(e) => {
        e.preventDefault();
        const track = trackFromLink(link);
        setBad(!track);
        if (!track) return;
        addTrack(track);
        onAdded(track.id);
        setLink('');
      }}
    >
      <input
        className="field"
        value={link}
        placeholder={t('sound.linkPlaceholder')}
        aria-label={t('sound.addLink')}
        aria-invalid={bad}
        onChange={(e) => setLink(e.target.value)}
      />
      <button type="submit" className="ie-button">
        {t('sound.add')}
      </button>
      {bad && (
        <p className="hint" data-error>
          {t('sound.badLink')}
        </p>
      )}
    </form>
  );
}

/** Music: the novel's tracks, and the ways to add one (a file, a catalogue, a streaming link). */
export function MusicPanel({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const tracks = doc.audio?.tracks ?? [];
  const jobs = useAnalysis((s) => s.jobs);
  const usages = useMemo(() => countUsages(doc).audio, [doc]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<'catalogue' | 'link' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const added = (id: string) => setOpen(id);

  return (
    <div className="cards" data-testid="music">
      <div className="page__actions sound__add">
        <button type="button" className="ie-button" onClick={() => fileInput.current?.click()}>
          <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.importFile')}
        </button>
        <button
          type="button"
          className="ie-button"
          aria-pressed={adding === 'catalogue'}
          data-testid="find-music"
          onClick={() => setAdding(adding === 'catalogue' ? null : 'catalogue')}
        >
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.findMusic')}
        </button>
        <button
          type="button"
          className="ie-button"
          aria-pressed={adding === 'link'}
          onClick={() => setAdding(adding === 'link' ? null : 'link')}
        >
          <Link size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sound.addLink')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          multiple
          hidden
          data-testid="import-audio"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            for (const file of files) void importAudioFile(file).then((track) => setOpen(track.id));
          }}
        />
      </div>
      {adding === 'catalogue' && <CatalogSearch onAdded={added} />}
      {adding === 'link' && <LinkForm onAdded={added} />}
      {tracks.length === 0 && <p className="hint">{t('sound.noTracks')}</p>}
      {tracks.map((track) => (
        <section className="card" key={track.id} data-testid="track">
          <button
            type="button"
            className="track-head"
            aria-expanded={open === track.id}
            onClick={() => setOpen(open === track.id ? null : track.id)}
          >
            {open === track.id ? (
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="track-head__title">{track.title || t('sound.untitled')}</span>
            {open !== track.id && <TrackSummary track={track} job={jobs[track.id]} />}
          </button>
          {open === track.id && <TrackDetail track={track} uses={usages.get(track.id) ?? 0} />}
        </section>
      ))}
    </div>
  );
}
