import type { Track, TrackLicense } from '@ie/story';
import { z } from 'zod';

/** A search result from a music catalogue, before it joins the novel's library. */
export interface CatalogTrack {
  readonly provider: 'openverse' | 'audius' | 'jamendo';
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /** Seconds, when the catalogue says. */
  readonly duration?: number;
  readonly streamUrl: string;
  readonly page?: string;
  readonly license: TrackLicense;
}

export type CatalogProvider = CatalogTrack['provider'];

const APP_NAME = 'ImaginationEngine';

/** `by-nc-nd` + `3.0` → `cc-by-nc-nd-3.0`; `cc0` → `cc0-1.0`. */
function ccCode(license: string, version?: string | null): string {
  const l = license.toLowerCase();
  if (l === 'cc0') return 'cc0-1.0';
  if (l === 'pdm') return 'public-domain';
  return `cc-${l}${version ? `-${version}` : ''}`;
}

const openverseSchema = z.object({
  results: z.array(
    z.looseObject({
      id: z.string(),
      title: z.string().nullable(),
      creator: z.string().nullable(),
      url: z.url(),
      foreign_landing_url: z.string().nullable(),
      license: z.string(),
      license_version: z.string().nullable(),
      license_url: z.string().nullable(),
      attribution: z.string().nullable(),
      duration: z.number().nullable(),
    }),
  ),
});

/** Creative Commons audio from Jamendo, Freesound and Wikimedia, through Openverse. No key. */
export async function searchOpenverse(
  query: string,
  kind: 'music' | 'sound' = 'music',
  signal?: AbortSignal,
): Promise<CatalogTrack[]> {
  const params = new URLSearchParams({ q: query, page_size: '20' });
  params.set('category', kind === 'music' ? 'music' : 'sound_effect');
  const json: unknown = await getJson(`https://api.openverse.org/v1/audio/?${params}`, signal);
  return openverseSchema.parse(json).results.map((r) => ({
    provider: 'openverse',
    id: r.id,
    title: r.title || r.id,
    artist: r.creator ?? '',
    ...(r.duration ? { duration: r.duration / 1000 } : {}),
    streamUrl: r.url,
    ...(r.foreign_landing_url ? { page: r.foreign_landing_url } : {}),
    license: {
      code: ccCode(r.license, r.license_version),
      ...(r.license_url ? { url: r.license_url } : {}),
      ...(r.attribution ? { attribution: r.attribution } : {}),
    },
  }));
}

const audiusSchema = z.object({
  data: z.array(
    z.looseObject({
      id: z.string(),
      title: z.string(),
      duration: z.number().optional(),
      permalink: z.string().optional(),
      license: z.string().nullable().optional(),
      is_streamable: z.boolean().optional(),
      user: z.looseObject({ name: z.string(), handle: z.string() }),
    }),
  ),
});

/** Audius: free streaming with an artist credit; terms are each artist's own. No key. */
export async function searchAudius(query: string, signal?: AbortSignal): Promise<CatalogTrack[]> {
  const params = new URLSearchParams({ query, app_name: APP_NAME });
  const json: unknown = await getJson(`https://api.audius.co/v1/tracks/search?${params}`, signal);
  return audiusSchema
    .parse(json)
    .data.filter((t) => t.is_streamable !== false)
    .map((t) => ({
      provider: 'audius',
      id: t.id,
      title: t.title,
      artist: t.user.name,
      ...(t.duration ? { duration: t.duration } : {}),
      streamUrl: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`,
      ...(t.permalink ? { page: `https://audius.co${t.permalink}` } : {}),
      license: {
        code: 'audius',
        attribution: `"${t.title}" by ${t.user.name} (@${t.user.handle}) on Audius${t.license ? `, ${t.license}` : ''}`,
      },
    }));
}

const jamendoSchema = z.object({
  headers: z.looseObject({ status: z.string(), error_message: z.string().optional() }),
  results: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      artist_name: z.string(),
      duration: z.number().optional(),
      audio: z.string(),
      shareurl: z.string().optional(),
      license_ccurl: z.string().optional(),
    }),
  ),
});

/** `https://creativecommons.org/licenses/by-sa/3.0/` → `cc-by-sa-3.0`. */
function codeFromCcUrl(url: string | undefined): string {
  const m = url?.match(/licenses\/([a-z-]+)\/(\d\.\d)/);
  return m ? `cc-${m[1]}-${m[2]}` : 'unknown';
}

/** Jamendo needs a free client ID from devportal.jamendo.com, entered in the Studio. */
export async function searchJamendo(
  query: string,
  clientId: string,
  signal?: AbortSignal,
): Promise<CatalogTrack[]> {
  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '20',
    search: query,
    audioformat: 'mp32',
    include: 'licenses',
  });
  const json: unknown = await getJson(`https://api.jamendo.com/v3.0/tracks/?${params}`, signal);
  const parsed = jamendoSchema.parse(json);
  if (parsed.headers.status !== 'success')
    throw new Error(parsed.headers.error_message || 'Jamendo refused the search.');
  return parsed.results.map((r) => ({
    provider: 'jamendo',
    id: r.id,
    title: r.name,
    artist: r.artist_name,
    ...(r.duration ? { duration: r.duration } : {}),
    streamUrl: r.audio,
    ...(r.shareurl ? { page: r.shareurl } : {}),
    license: {
      code: codeFromCcUrl(r.license_ccurl),
      ...(r.license_ccurl ? { url: r.license_ccurl } : {}),
      attribution: `"${r.name}" by ${r.artist_name} (Jamendo)`,
    },
  }));
}

/** A library track for a catalogue result. */
export function catalogToTrack(found: CatalogTrack, id: string): Track {
  return {
    id,
    title: found.title,
    ...(found.artist ? { artist: found.artist } : {}),
    source: {
      kind: 'url',
      url: found.streamUrl,
      provider: found.provider,
      ...(found.page ? { page: found.page } : {}),
    },
    license: found.license,
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal: signal ?? null,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`The catalogue answered ${response.status}.`);
  return response.json();
}

/** Whether a licence lets a published novel use the track (PLAN §5). */
export function publishability(code: string): 'ok' | 'credit' | 'caution' | 'private' {
  if (code === 'own' || code === 'procedural' || code === 'cc0-1.0' || code === 'public-domain')
    return 'ok';
  if (/-nd(-|$)/.test(code)) return 'private';
  if (/^cc-by(-\d|$)/.test(code)) return 'credit';
  if (code.startsWith('cc-')) return 'caution';
  return code === 'audius' ? 'caution' : 'private';
}
