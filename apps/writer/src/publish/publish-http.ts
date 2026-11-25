// Tiny fetch wrapper for the publish API: timeouts, friendly failures.
import type { PublishConfig } from './publish-settings.ts';
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type PublishFailure = {
  ok: false;
  kind: 'unconfigured' | 'unauthorized' | 'unreachable' | 'rejected';
  error: string;
};

export const VERIFY_TIMEOUT_MS = 10_000;
export const PUBLISH_TIMEOUT_MS = 60_000;
export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export async function request(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // fall through
  }
  return `The server refused the request (${res.status}).`;
}

export async function failureOf(res: Response | null): Promise<PublishFailure | null> {
  if (!res) return { ok: false, kind: 'unreachable', error: 'Could not reach server' };
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: 'unauthorized', error: 'Invalid token' };
  }
  const kind = res.status === 400 || res.status === 413 ? 'rejected' : 'unreachable';
  return { ok: false, kind, error: await errorText(res) };
}

export const unconfigured = (config: PublishConfig, token: string): PublishFailure | null =>
  config.apiUrl && token
    ? null
    : { ok: false, kind: 'unconfigured', error: 'Add the API URL and token first.' };

export const endpoint = (config: PublishConfig, novelId: string): string =>
  `${config.apiUrl}/api/novels/${encodeURIComponent(novelId)}`;
