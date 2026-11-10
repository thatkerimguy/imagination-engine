/** Timing windows in seconds either side of a note (PLAN §6.4). */
export const WINDOWS = { perfect: 0.035, great: 0.07, good: 0.11 } as const;

export type Grade = 'perfect' | 'great' | 'good' | 'miss';

/** What each grade is worth towards the score and the damage a strike deals. */
export const GRADE_VALUE: Readonly<Record<Grade, number>> = {
  perfect: 1,
  great: 0.8,
  good: 0.5,
  miss: 0,
};

/** How much the "wider timing" assist stretches every window. */
export const WIDE_WINDOWS = 1.6;

/** The grade for an input `error` seconds off its note, or null when it is outside every window. */
export function gradeFor(error: number, scale = 1): Exclude<Grade, 'miss'> | null {
  const e = Math.abs(error);
  if (e <= WINDOWS.perfect * scale) return 'perfect';
  if (e <= WINDOWS.great * scale) return 'great';
  if (e <= WINDOWS.good * scale) return 'good';
  return null;
}
