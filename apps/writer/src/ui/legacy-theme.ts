// Writer palette: the reader's dark theme, so the authoring surface feels like the page.
export const colors = {
  bg: '#16171a',
  surface: '#202226',
  surfaceRaised: '#272a2f',
  line: '#2e3035',
  fg: '#e7e4dd',
  muted: '#9b968d',
  accent: '#4fd1c5',
  accentInk: '#0c1716',
  danger: '#e26d5a',
  warn: '#e0a458',
  ok: '#7bc47f',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const fonts = {
  prose: 'Georgia',
  mono: 'Menlo',
} as const;

/** Minimum comfortable tap target (Apple HIG / Material). */
export const TAP = 44;
