import type { Track } from './audio.ts';
import type { CompiledStory } from './compile.ts';
import type { PlaytestReport } from './playtest.ts';
import type { StoryProject } from './project.ts';

/*
 * The publish check, public fallbacks and generated credits (PLAN §10.1, ADR 0022). Pure data in,
 * data out: the Studio shows the items in the reader's language by `code` and `params`.
 */

export type PublishTarget = 'public' | 'private';

export interface PublishItem {
  /** `block` stops a public build; `warn` is shown but allowed. */
  readonly severity: 'block' | 'warn';
  readonly code: PublishCode;
  readonly params: Readonly<Record<string, string>>;
}

export type PublishCode =
  | 'music-private-source'
  | 'music-no-derivatives'
  | 'music-non-commercial'
  | 'music-share-alike'
  | 'music-audius'
  | 'music-ai'
  | 'music-no-license'
  | 'music-no-attribution'
  | 'music-bad-fallback'
  | 'story-errors'
  | 'story-warnings'
  | 'playtest-dead-ends'
  | 'playtest-softlocks'
  | 'playtest-stuck'
  | 'size-large';

export interface PublishCheck {
  readonly target: PublishTarget;
  readonly items: readonly PublishItem[];
  /** True when nothing blocks the build. */
  readonly ok: boolean;
}

/** Bytes of novel data above which the check warns; the reader downloads all of it. */
export const PUBLISH_SIZE_WARNING = 2_000_000;

/** Licence words from a code like `cc-by-nc-sa-4.0`. */
function licenseParts(code: string): Set<string> {
  return new Set(code.toLowerCase().split(/[-_ ]/));
}

function checkTrack(track: Track, target: PublishTarget, add: (i: PublishItem) => void): void {
  const params = { track: track.title || track.id };
  const kind = track.source.kind;
  if (kind === 'spotify' || kind === 'youtube') {
    if (target === 'public')
      add({ severity: 'block', code: 'music-private-source', params: { ...params, source: kind } });
    return; // Streaming tracks carry no licence of their own.
  }
  if (target === 'private') return;
  const code = track.license?.code ?? 'unknown';
  const parts = licenseParts(code);
  if (code === 'unknown') add({ severity: 'warn', code: 'music-no-license', params });
  if (parts.has('nd')) add({ severity: 'block', code: 'music-no-derivatives', params });
  if (parts.has('nc')) add({ severity: 'warn', code: 'music-non-commercial', params });
  if (parts.has('sa')) add({ severity: 'warn', code: 'music-share-alike', params });
  if (parts.has('ai')) add({ severity: 'warn', code: 'music-ai', params });
  if (track.source.kind === 'url' && track.source.provider === 'audius')
    add({ severity: 'warn', code: 'music-audius', params });
  if (parts.has('by') && !track.license?.attribution && !track.artist)
    add({ severity: 'warn', code: 'music-no-attribution', params });
}

/** Swaps every track that has a public fallback for that fallback, keeping its id (and loop). */
export function applyPublicFallbacks(project: StoryProject): StoryProject {
  const tracks = project.audio?.tracks;
  if (!tracks?.some((t) => t.publicFallback)) return project;
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const swapped = tracks.map((track): Track => {
    const fallback = track.publicFallback ? byId.get(track.publicFallback) : undefined;
    if (!fallback) return track;
    const { id: _id, publicFallback: _pf, ...rest } = fallback;
    return { ...rest, id: track.id, ...(track.loop && !rest.loop ? { loop: track.loop } : {}) };
  });
  return {
    ...project,
    audio: { ...project.audio, sounds: project.audio?.sounds ?? [], tracks: swapped },
  };
}

/**
 * The novel as a public build ships it: fallbacks swapped in, and the tracks that only stood in for
 * others dropped (nothing plays them any more).
 */
export function publicBuild(project: StoryProject): StoryProject {
  const standIns = new Set(
    (project.audio?.tracks ?? []).flatMap((t) => (t.publicFallback ? [t.publicFallback] : [])),
  );
  const swapped = applyPublicFallbacks(project);
  if (!standIns.size || !swapped.audio) return swapped;
  return {
    ...swapped,
    audio: { ...swapped.audio, tracks: swapped.audio.tracks.filter((t) => !standIns.has(t.id)) },
  };
}

/** Runs the publish check on a project (with its fallbacks applied for a public build). */
export function publishCheck(
  project: StoryProject,
  story: CompiledStory,
  target: PublishTarget,
  playtest?: PlaytestReport,
): PublishCheck {
  const items: PublishItem[] = [];
  const add = (i: PublishItem) => items.push(i);
  const tracks = project.audio?.tracks ?? [];
  const ids = new Set(tracks.map((t) => t.id));
  for (const track of tracks)
    if (track.publicFallback && !ids.has(track.publicFallback))
      add({
        severity: 'block',
        code: 'music-bad-fallback',
        params: { track: track.title || track.id },
      });
  const built = target === 'public' ? applyPublicFallbacks(project) : project;
  for (const track of built.audio?.tracks ?? []) checkTrack(track, target, add);

  const errors = story.problems.filter((p) => p.severity === 'error').length;
  const warnings = story.problems.length - errors;
  if (errors) add({ severity: 'block', code: 'story-errors', params: { n: String(errors) } });
  if (warnings) add({ severity: 'warn', code: 'story-warnings', params: { n: String(warnings) } });

  if (playtest) {
    const sum = (spots: readonly { count: number }[]) => spots.reduce((a, s) => a + s.count, 0);
    const runs = String(playtest.runs);
    if (playtest.deadEnds.length)
      add({
        severity: 'warn',
        code: 'playtest-dead-ends',
        params: { n: String(sum(playtest.deadEnds)), runs },
      });
    if (playtest.softlocks.length)
      add({
        severity: 'block',
        code: 'playtest-softlocks',
        params: { n: String(sum(playtest.softlocks)), runs },
      });
    if (playtest.stuck.length)
      add({
        severity: 'warn',
        code: 'playtest-stuck',
        params: { n: String(sum(playtest.stuck)), runs },
      });
  }

  const bytes = new TextEncoder().encode(JSON.stringify(built)).length;
  if (bytes > PUBLISH_SIZE_WARNING)
    add({ severity: 'warn', code: 'size-large', params: { mb: (bytes / 1e6).toFixed(1) } });

  return { target, items, ok: !items.some((i) => i.severity === 'block') };
}

export interface CreditLine {
  readonly kind: 'music' | 'font';
  readonly title: string;
  readonly by?: string;
  /** Licence code, e.g. `cc-by-4.0` or `ofl-1.1`. */
  readonly license: string;
  readonly url?: string;
}

/** The fonts every Player build ships (packages/ui-kit/src/fonts.css), all SIL OFL 1.1. */
export const PLAYER_FONTS: readonly CreditLine[] = [
  {
    kind: 'font',
    title: 'Literata',
    by: 'TypeTogether',
    license: 'ofl-1.1',
    url: 'https://github.com/googlefonts/literata',
  },
  {
    kind: 'font',
    title: 'Inter',
    by: 'Rasmus Andersson',
    license: 'ofl-1.1',
    url: 'https://rsms.me/inter/',
  },
  {
    kind: 'font',
    title: 'JetBrains Mono',
    by: 'JetBrains',
    license: 'ofl-1.1',
    url: 'https://www.jetbrains.com/lp/mono/',
  },
];

/** Tracks with a file source that are the author's own need no credit line. */
function creditFor(track: Track): CreditLine | null {
  const code = track.license?.code ?? 'unknown';
  if (code === 'own') return null;
  if (track.source.kind === 'spotify' || track.source.kind === 'youtube') return null;
  const by = track.license?.attribution ?? track.artist;
  const url =
    track.license?.url ??
    (track.source.kind === 'url' ? (track.source.page ?? track.source.url) : undefined);
  return {
    kind: 'music',
    title: track.title,
    license: code,
    ...(by ? { by } : {}),
    ...(url ? { url } : {}),
  };
}

/** Credits for a build: the music it actually plays (after fallbacks), then fonts. */
export function buildCredits(
  project: StoryProject,
  target: PublishTarget = 'public',
): readonly CreditLine[] {
  // Tracks that only stand in for others are credited through the track they replace.
  const standIns = new Set(
    (project.audio?.tracks ?? []).flatMap((t) => (t.publicFallback ? [t.publicFallback] : [])),
  );
  const built = target === 'public' ? applyPublicFallbacks(project) : project;
  const seen = new Set<string>();
  const music: CreditLine[] = [];
  for (const track of built.audio?.tracks ?? []) {
    if (standIns.has(track.id)) continue;
    const line = creditFor(track);
    const key = line ? `${line.title}|${line.by ?? ''}|${line.license}` : '';
    if (line && !seen.has(key)) {
      seen.add(key);
      music.push(line);
    }
  }
  return [...music, ...PLAYER_FONTS];
}
