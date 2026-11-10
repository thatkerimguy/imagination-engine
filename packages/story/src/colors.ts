/** Colours a stage effect or an enemy can name; the stage maps them to the theme or fixed hues. */
export const STAGE_COLORS = ['ink', 'accent', 'white', 'red', 'gold', 'blue'] as const;
export type StageColor = (typeof STAGE_COLORS)[number];
