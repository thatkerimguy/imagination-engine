// Shared fixtures for the writer QA packs (block ids, rich prose, a synthetic Growth history).
export const ID = {
  dialogue: '01M7WD7TG4T9804M170B4T81MM',
  chat: '01M7WD7TG3C1Z266E87HFD27KR',
  dice: '01M7WD7TG54FMBWYMZM8XKD1V7',
  snake: '01M7WD7TG6R6734B03YH123PFY',
};
export const RICH =
  '**Snake eyes.** The room *exhaled*, the ++felt++ went ~~quiet~~ still, and ==nobody breathed==.';
/** Synthetic 40-day history so the Growth charts have a curve to draw (QA fixture only). */
export const GROWTH_SEED = (() => {
  const day = 86400000;
  const now = Date.now();
  const points = [];
  for (let i = 40; i >= 1; i--) {
    const ts = now - i * day;
    const d = new Date(ts);
    const words = Math.round(40 + (40 - i) * 2 + 8 * Math.sin(i / 3));
    points.push({
      dayKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      ts,
      chars: words * 5,
      words,
      sentences: Math.round(words / 8),
      paragraphs: Math.round(words / 20),
    });
  }
  return JSON.stringify({ data: { points }, updatedAt: now });
})();

/**
 * DIRECTIVE-06: keeps the first-run Welcome tour out of every regression gate (each Playwright
 * context is a fresh workspace). The Dir-06 pass shoots the tour in its own clean context.
 */
export const skipOnboarding = (target) =>
  target.addInitScript(() => {
    const key = 'kn-writer:setting/onboarding';
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ data: { dismissedAt: 1 }, updatedAt: 1 }));
  });
