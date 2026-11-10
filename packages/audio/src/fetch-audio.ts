/**
 * Fetches audio bytes for analysis. Many catalogue hosts allow cross-origin reads; for those that
 * don't, `proxy` rewrites the URL to a same-origin relay (the dev server's `/fetch`, later a
 * small Worker).
 */
export async function fetchAudioBytes(
  url: string,
  proxy?: (url: string) => string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url, { mode: 'cors', signal: signal ?? null });
    if (response.ok) return await response.arrayBuffer();
    if (!proxy) throw new Error(`The audio host answered ${response.status}.`);
  } catch (error) {
    // A CORS refusal surfaces as a TypeError; anything else is a real failure.
    if (!proxy || (error instanceof DOMException && error.name === 'AbortError')) throw error;
  }
  const relayed = await fetch(proxy(url), { signal: signal ?? null });
  if (!relayed.ok) throw new Error(`The audio relay answered ${relayed.status}.`);
  return relayed.arrayBuffer();
}
