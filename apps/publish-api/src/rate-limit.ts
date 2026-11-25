// Rate limiting seam. Production uses Cloudflare Rate Limiting bindings; tests and the local
// harness use the in-memory fixed-window limiter below (same limits).

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type RateBucket = 'report' | 'publish';
export type RateLimiter = Record<RateBucket, RateLimitBinding>;

export const RATE_LIMITS: Record<RateBucket, { limit: number; periodMs: number }> = {
  report: { limit: 5, periodMs: 60_000 },
  publish: { limit: 30, periodMs: 60_000 },
};

/** True when the request may proceed. No limiter configured => allowed. */
export async function checkRateLimit(
  limiter: RateLimiter | undefined,
  bucket: RateBucket,
  key: string,
): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter[bucket].limit({ key });
  return success;
}

/** `CF-Connecting-IP`, else first `x-forwarded-for` entry, else `anon`. */
export function clientKey(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || 'anon';
}

function memoryBinding(limit: number, periodMs: number, clock: () => number): RateLimitBinding {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    async limit({ key }) {
      const now = clock();
      if (windows.size > 5000) {
        for (const [k, w] of windows) if (now - w.start >= periodMs) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w || now - w.start >= periodMs) {
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      w.count++;
      return { success: w.count <= limit };
    },
  };
}

export function createMemoryLimiter(clock: () => number = Date.now): RateLimiter {
  return {
    report: memoryBinding(RATE_LIMITS.report.limit, RATE_LIMITS.report.periodMs, clock),
    publish: memoryBinding(RATE_LIMITS.publish.limit, RATE_LIMITS.publish.periodMs, clock),
  };
}
