// Where the "Report abuse" button posts. Only published readers (built against the publish API)
// have an endpoint; the plain static reader and Writer previews never do.

/** Pure derivation: explicit URL wins, else `<base>/novels/` -> `<base>/api/reports`. */
export function deriveReportEndpoint(explicit?: string, novelsBase?: string): string | null {
  if (explicit) return explicit;
  if (!novelsBase) return null;
  try {
    const u = new URL(novelsBase);
    if (!/^https?:$/.test(u.protocol) || !u.pathname.endsWith('/novels/')) return null;
    return new URL('../api/reports', u).href;
  } catch {
    return null;
  }
}

export const reportEndpoint = (): string | null =>
  deriveReportEndpoint(
    import.meta.env.VITE_REPORT_API_URL as string | undefined,
    // Normalise like data.ts novelsBase (trailing slash) without importing it.
    ((import.meta.env.VITE_NOVELS_BASE_URL as string | undefined) ?? '').replace(/\/*$/, '/') ||
      undefined,
  );

/** True in any Writer preview flavour (live WebView, ?preview=1, offline bundle). */
export const inPreviewMode = (): boolean =>
  new URLSearchParams(location.search).get('preview') === '1' ||
  document.documentElement.dataset.preview === '1';
