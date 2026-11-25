// Publish connection settings. The API URL / reader URL live in `setting/publish`; the token lives
// in `setting/publish-secret`, which backups never export or overwrite (see backup/archive.ts).
import type { NovelRepository } from '../store/repository.ts';

export const PUBLISH_CONFIG_KEY = 'setting/publish';
export const PUBLISH_SECRET_KEY = 'setting/publish-secret';
export const publishStatusKey = (novelId: string): string => `meta/publish/${novelId}`;

export interface PublishConfig {
  apiUrl: string;
  readerUrl: string;
}

export interface PublishStatus {
  lastPublishedAt: string;
  publishedChapters: number;
  unlistedChapters: number;
  publicListed: boolean;
}

/** Trims, strips trailing slashes. '' for blank input; null when not a valid http(s) URL. */
export function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  return trimmed.replace(/\/+$/, '');
}

const EMPTY: PublishConfig = { apiUrl: '', readerUrl: '' };

export async function loadPublishConfig(repo: NovelRepository): Promise<PublishConfig> {
  const stored = (await repo.docs.read<unknown>(PUBLISH_CONFIG_KEY))?.data;
  if (!stored || typeof stored !== 'object') return { ...EMPTY };
  const s = stored as Record<string, unknown>;
  const pick = (v: unknown): string => (typeof v === 'string' ? (normalizeBaseUrl(v) ?? '') : '');
  return { apiUrl: pick(s.apiUrl), readerUrl: pick(s.readerUrl) };
}

export async function savePublishConfig(
  repo: NovelRepository,
  config: PublishConfig,
): Promise<PublishConfig> {
  const apiUrl = normalizeBaseUrl(config.apiUrl);
  if (apiUrl === null) throw new Error('The API URL must start with http:// or https://.');
  const readerUrl = normalizeBaseUrl(config.readerUrl);
  if (readerUrl === null) throw new Error('The reader URL must start with http:// or https://.');
  const next = { apiUrl, readerUrl };
  await repo.docs.write(PUBLISH_CONFIG_KEY, next);
  return next;
}

export async function loadPublishToken(repo: NovelRepository): Promise<string> {
  const data = (await repo.docs.read<unknown>(PUBLISH_SECRET_KEY))?.data;
  return typeof data === 'string' ? data : '';
}

export async function clearPublishToken(repo: NovelRepository): Promise<void> {
  await repo.docs.remove(PUBLISH_SECRET_KEY);
}

export async function savePublishToken(repo: NovelRepository, token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return clearPublishToken(repo);
  await repo.docs.write(PUBLISH_SECRET_KEY, trimmed);
}

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

export async function loadPublishStatus(
  repo: NovelRepository,
  novelId: string,
): Promise<PublishStatus | null> {
  const data = (await repo.docs.read<unknown>(publishStatusKey(novelId)))?.data;
  if (!data || typeof data !== 'object') return null;
  const s = data as Record<string, unknown>;
  if (typeof s.lastPublishedAt !== 'string') return null;
  return {
    lastPublishedAt: s.lastPublishedAt,
    publishedChapters: count(s.publishedChapters),
    unlistedChapters: count(s.unlistedChapters),
    publicListed: s.publicListed === true,
  };
}

export async function savePublishStatus(
  repo: NovelRepository,
  novelId: string,
  status: PublishStatus,
): Promise<void> {
  await repo.docs.write(publishStatusKey(novelId), status);
}

export async function clearPublishStatus(repo: NovelRepository, novelId: string): Promise<void> {
  await repo.docs.remove(publishStatusKey(novelId));
}

export const isPublishConfigured = (config: PublishConfig, token: string): boolean =>
  Boolean(config.apiUrl && token);

// ── Publishing Terms of Use consent (Google Play UGC) ───────────────────────────────────────────
/** Bump when the hosted Terms change: every author must accept again before the next publish. */
export const CURRENT_TOS_VERSION = '2026-11';
export const PUBLISH_TOS_KEY = 'setting/publish-tos';

export interface TosConsent {
  tosAcceptedVersion?: string;
  tosAcceptedAt?: string;
}

export const hasAcceptedCurrentTos = (settings: TosConsent | null | undefined): boolean =>
  settings?.tosAcceptedVersion === CURRENT_TOS_VERSION;

export async function loadTosConsent(repo: NovelRepository): Promise<TosConsent> {
  const data = (await repo.docs.read<unknown>(PUBLISH_TOS_KEY))?.data;
  if (!data || typeof data !== 'object') return {};
  const s = data as Record<string, unknown>;
  return {
    ...(typeof s.tosAcceptedVersion === 'string'
      ? { tosAcceptedVersion: s.tosAcceptedVersion }
      : {}),
    ...(typeof s.tosAcceptedAt === 'string' ? { tosAcceptedAt: s.tosAcceptedAt } : {}),
  };
}

export async function acceptCurrentTos(repo: NovelRepository, now: Date): Promise<TosConsent> {
  const next = { tosAcceptedVersion: CURRENT_TOS_VERSION, tosAcceptedAt: now.toISOString() };
  await repo.docs.write(PUBLISH_TOS_KEY, next);
  return next;
}

/** Full Terms hosted by the publish API (`/legal/terms`); '' until an API URL is configured. */
export const termsUrl = (config: PublishConfig): string =>
  config.apiUrl ? `${config.apiUrl}/legal/terms` : '';
