// Friendly "edited 5 minutes ago" text. Pure, so it is easy to test.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export function relativeTime(then: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - then);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return plural(Math.floor(diff / MIN), 'minute');
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour');
  if (diff < 7 * DAY) return diff < 2 * DAY ? 'yesterday' : plural(Math.floor(diff / DAY), 'day');
  if (diff < 30 * DAY) return plural(Math.floor(diff / (7 * DAY)), 'week');
  return new Date(then).toLocaleDateString();
}

/** "1 Season", "3 Volumes". */
export function countLabel(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? '' : 's'}`;
}
