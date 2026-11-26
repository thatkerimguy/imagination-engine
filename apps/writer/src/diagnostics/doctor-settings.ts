// Document Doctor checks for settings rows: unreadable JSON, sidecars of items that no longer
// exist (`meta/item/<id>`, `meta/chapter-styles/<id>`, `meta/publish/<id>`, `versions/<kind>:<id>`)
// and custom fonts that cannot be loaded.
import { isSecretKey } from '../backup/archive-format.ts';
import { brokenUri } from './doctor-media.ts';
import {
  isRecord,
  mk,
  QUARANTINE,
  type Issue,
  type ScanOptions,
  type Tables,
} from './doctor-types.ts';

export const CUSTOM_FONTS_KEY = 'prefs/custom-fonts';

const SIDECAR = /^(?:meta\/(?:item|chapter-styles|publish)\/([^/]+)|versions\/[a-z]+:([^/]+))$/;
const dataOf = (valueJson: string): unknown => (JSON.parse(valueJson) as { data?: unknown }).data;

export async function checkSettings(t: Tables, opts: ScanOptions): Promise<Issue[]> {
  const ids = new Set(t.nodes.map((n) => n.id));
  const out: Issue[] = [];
  for (const s of t.settings) {
    if (s.key.startsWith(QUARANTINE)) continue;
    const key = `setting/${s.key}`;
    let data: unknown;
    try {
      data = dataOf(s.valueJson);
    } catch {
      if (!isSecretKey(s.key))
        out.push(
          mk(
            'corrupt',
            key,
            'error',
            'Unreadable data',
            'The stored value is not valid JSON.',
            'quarantine-remove',
          ),
        );
      continue;
    }
    const m = SIDECAR.exec(s.key);
    const owner = m ? (m[1] ?? m[2]) : undefined;
    if (owner !== undefined && !ids.has(owner)) {
      const detail = 'Nothing in the library uses this any more.';
      out.push(
        mk(
          'orphan-sidecar',
          key,
          'info',
          'Leftover data for a deleted item',
          detail,
          'remove-sidecar',
        ),
      );
    } else if (s.key === CUSTOM_FONTS_KEY && Array.isArray(data)) {
      for (const f of data) {
        if (!isRecord(f) || typeof f.uri !== 'string' || typeof f.id !== 'string') continue;
        const why = await brokenUri(f.uri, opts);
        if (!why) continue;
        const name = typeof f.displayName === 'string' ? f.displayName : f.id;
        out.push(
          mk(
            'bad-font',
            key,
            'warning',
            `Custom font “${name}” cannot be loaded`,
            why,
            'clear-uri',
            f.id,
          ),
        );
      }
    }
  }
  return out;
}
