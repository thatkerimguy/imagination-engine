// Friendly "edited 5 minutes ago" text. Pure, so it is easy to test.
import { formatDate, t, type Locale, type StringKey } from '../i18n/i18n.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Unit = 'minutes' | 'hours' | 'days' | 'weeks';
const plural = (n: number, unit: Unit, locale: Locale): string =>
  t(`time.${unit}.${n === 1 ? 'one' : 'other'}` as StringKey, { n }, locale);

export function relativeTime(
  then: number,
  now: number = Date.now(),
  locale: Locale = 'en',
): string {
  const diff = Math.max(0, now - then);
  if (diff < MIN) return t('time.justNow', undefined, locale);
  if (diff < HOUR) return plural(Math.floor(diff / MIN), 'minutes', locale);
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hours', locale);
  if (diff < 7 * DAY)
    return diff < 2 * DAY
      ? t('time.yesterday', undefined, locale)
      : plural(Math.floor(diff / DAY), 'days', locale);
  if (diff < 30 * DAY) return plural(Math.floor(diff / (7 * DAY)), 'weeks', locale);
  return locale === 'en'
    ? new Date(then).toLocaleDateString()
    : formatDate(new Date(then).toISOString(), locale);
}

/** "1 Season", "3 Volumes". */
export function countLabel(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? '' : 's'}`;
}
