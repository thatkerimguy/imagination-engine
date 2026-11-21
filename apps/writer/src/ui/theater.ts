// The Live Preview "theater": a calm, fixed dark surround (#0E0F12 / #E6E8E7 / #232729) so the
// dark kinetic reading stage looks intentional whether the writer is in a Day or Night theme.
import { folioColors } from './palette.ts';
import type { Theme } from './theme.tsx';

export const THEATER_BG = '#0E0F12';

export const THEATER_THEME: Theme = {
  id: 'editorial-teal-dark',
  label: 'Theater',
  dark: true,
  colors: {
    ...folioColors(
      `${THEATER_BG} #15171A #1E2125 #E6E8E7 #B3BAB8 #8A9090 #4FD1C5 #00302C #E5A75A #FF8A80 #7BD88F`,
      true,
    ),
    hairline: '#232729',
  },
};
