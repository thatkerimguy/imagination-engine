// Settings → Language: System / English / Español, saved on tap and applied app-wide at once.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { space } from '../ui/tokens.ts';
import { useI18n } from './I18nProvider.tsx';
import type { LanguageSetting } from './i18n.ts';

export function LanguageRow(): ReactNode {
  const { t, setting, setLanguage } = useI18n();
  const options: readonly SegmentOption<LanguageSetting>[] = [
    { value: 'system', label: t('settings.language.system'), testID: 'settings-language-system' },
    { value: 'en', label: t('settings.language.en'), testID: 'settings-language-en' },
    { value: 'es', label: t('settings.language.es'), testID: 'settings-language-es' },
  ];
  return (
    <CardGroup testID="card-language">
      <ListRow
        icon="globe"
        title={t('settings.language')}
        subtitle={t('settings.languageSub')}
        last
        testID="settings-language"
      />
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
        <SegmentControl<LanguageSetting>
          options={options}
          value={setting}
          onChange={setLanguage}
          accessibilityLabel={t('settings.language')}
          testID="settings-language-control"
        />
      </View>
    </CardGroup>
  );
}
