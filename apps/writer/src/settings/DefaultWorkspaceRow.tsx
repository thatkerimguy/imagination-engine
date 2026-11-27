// Settings › Writing & Display › Default workspace: the mode new books start in.
import type { WorkspaceMode } from '@kn/core';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useRepository } from '../store/context.tsx';
import { ListRow } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { space } from '../ui/tokens.ts';
import { MODE_CHOICES } from '../workspace/mode-policy.ts';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './app-settings.ts';

export function DefaultWorkspaceRow(): ReactNode {
  const repo = useRepository();
  const { t } = useI18n();
  const [mode, setMode] = useState<WorkspaceMode>(DEFAULT_SETTINGS.defaultWorkspace);
  useEffect(() => {
    let live = true;
    void loadSettings(repo).then((s) => live && setMode(s.defaultWorkspace));
    return () => {
      live = false;
    };
  }, [repo]);
  const options: readonly SegmentOption<WorkspaceMode>[] = MODE_CHOICES.map((c) => ({
    value: c.mode,
    label: t(c.labelKey),
    testID: `settings-workspace-${c.mode}`,
  }));
  const pick = (next: WorkspaceMode): void => {
    setMode(next);
    void saveSettings(repo, { defaultWorkspace: next });
  };
  return (
    <>
      <ListRow
        icon="feather"
        title={t('settings.defaultWorkspace')}
        subtitle={t('settings.defaultWorkspaceSub')}
        last
        testID="settings-default-workspace"
      />
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
        <SegmentControl<WorkspaceMode>
          options={options}
          value={mode}
          onChange={pick}
          accessibilityLabel={t('settings.defaultWorkspace')}
          testID="settings-workspace-control"
        />
      </View>
    </>
  );
}
