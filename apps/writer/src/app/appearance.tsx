// Appearance & fonts: live paper preview, theme swatches, grouped font picker, typography.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { PaperPreview, Swatch } from '../fonts/AppearanceParts.tsx';
import { FontList } from '../fonts/FontList.tsx';
import { TypographyControls } from '../fonts/TypographyControls.tsx';
import { ListRow, Page, SectionLabel } from '../ui/Page.tsx';
import { THEMES } from '../ui/themes.ts';
import { Toggle } from '../ui/Toggle.tsx';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';

export default function AppearanceScreen(): ReactNode {
  const [p, update] = useWriterPrefs();
  const current = useTheme();
  const swatches = (dark: boolean): ReactNode => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: '3.5%', rowGap: 14 }}>
      {THEMES.filter((t) => t.dark === dark).map((t) => (
        <Swatch
          key={t.id}
          t={t}
          selected={p.themeId === t.id}
          onPress={() => update({ themeId: t.id })}
        />
      ))}
    </View>
  );
  return (
    <Page>
      <PaperPreview />
      <SectionLabel>Theme</SectionLabel>
      <ListRow
        last
        title="Match system"
        subtitle="Follows light or dark mode on this device."
        trailing={
          <Toggle
            testID="theme-system"
            accessibilityLabel="Match system"
            value={p.themeId === 'system'}
            onValueChange={(on) => update({ themeId: on ? 'system' : current.id })}
          />
        }
      />
      <SectionLabel>Night</SectionLabel>
      {swatches(true)}
      <SectionLabel>Day</SectionLabel>
      {swatches(false)}
      <SectionLabel>Font</SectionLabel>
      <FontList fontId={p.fontId} onSelect={(fontId) => update({ fontId })} />
      <SectionLabel>Typography</SectionLabel>
      <TypographyControls />
    </Page>
  );
}
