// Settings › Web Publishing & API › Live preview: built-in offline reader or a custom reader URL.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Field } from '../ui/Field.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  previewUrl,
  saveSettings,
  type PreviewMode,
} from './app-settings.ts';

export function LivePreviewCard(): ReactNode {
  const repo = useRepository();
  const { t } = useI18n();
  const [readerUrl, setReaderUrl] = useState(DEFAULT_SETTINGS.readerUrl);
  const [mode, setMode] = useState<PreviewMode>(DEFAULT_SETTINGS.previewMode);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadSettings(repo).then((s) => {
      if (!live) return;
      setMode(s.previewMode);
      setReaderUrl(s.readerUrl);
    });
    return () => {
      live = false;
    };
  }, [repo]);
  const segments: readonly SegmentOption<PreviewMode>[] = [
    { value: 'offline', label: t('settings.previewBuiltIn'), testID: 'settings-preview-offline' },
    { value: 'custom-url', label: t('settings.previewCustom'), testID: 'settings-preview-custom' },
  ];
  const pickMode = (next: PreviewMode): void => {
    setMode(next);
    void saveSettings(repo, { previewMode: next });
  };
  const valid = mode === 'offline' || previewUrl(readerUrl) !== null;
  const save = async (): Promise<void> => {
    await saveSettings(repo, { readerUrl: readerUrl.trim() });
    setNote(t('common.saved'));
  };
  return (
    <>
      <SectionLabel>{t('settings.livePreview')}</SectionLabel>
      <CardGroup testID="card-preview">
        <View style={{ gap: space.sm, padding: space.md }}>
          <SegmentControl<PreviewMode>
            options={segments}
            value={mode}
            onChange={pickMode}
            accessibilityLabel={t('settings.previewSource')}
            testID="settings-preview-mode"
          />
          {mode === 'offline' ? (
            <Txt variant="meta" color="inkSecondary">
              {t('settings.previewOfflineNote')}
            </Txt>
          ) : (
            <>
              <Field
                label={t('settings.previewUrl')}
                value={readerUrl}
                onChangeText={(v) => {
                  setReaderUrl(v);
                  setNote(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={DEFAULT_SETTINGS.readerUrl}
                error={valid ? null : t('settings.previewUrlError')}
                hint={t('settings.previewUrlHint')}
              />
              <Txt variant="meta" color="inkSecondary">
                {note ?? t('settings.previewUrlNote')}
              </Txt>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <ActionButton
                  label={t('common.save')}
                  disabled={!valid}
                  onPress={() => void save()}
                />
                <ActionButton
                  variant="ghost"
                  quiet
                  label={t('common.reset')}
                  onPress={() => setReaderUrl(DEFAULT_SETTINGS.readerUrl)}
                />
              </View>
            </>
          )}
        </View>
      </CardGroup>
    </>
  );
}
