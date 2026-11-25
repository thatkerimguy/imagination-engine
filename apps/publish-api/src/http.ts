// Small response helpers shared by every route module.
import type { ErrorResponse } from './protocol.ts';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export const fail = (error: string, status: number, headers: Record<string, string> = {}) => {
  const body: ErrorResponse = { ok: false, error };
  return json(body, status, headers);
};

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a capped UTF-8 body. Returns a 413 Response when the cap is exceeded. */
export async function readCappedText(
  request: Request,
  maxBytes: number,
): Promise<string | Response> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return fail('Request body too large', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) return fail('Request body too large', 413);
  return new TextDecoder().decode(bytes);
}

/** Capped JSON body; Response on failure. */
export async function readCappedJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await readCappedText(request, maxBytes);
  if (text instanceof Response) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail('Body is not valid JSON', 400);
  }
}
