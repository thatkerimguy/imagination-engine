// Master Lock settings body (PIN already set): lock toggle, biometrics, app-switcher privacy,
// change PIN, recovery.
import { useEffect, useState, type ReactNode } from 'react';
import { useRepository } from '../store/context.tsx';
import { unlockSession } from '../store/unlock-session.ts';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { authenticateBiometric, biometricAvailable } from './biometric.ts';
import { enableLock, setBiometric, setHideInRecents, type LockConfig } from './lock.ts';
import { hideInRecentsSetting } from './screen-privacy.ts';

export type LockMode = 'home' | 'change' | 'disable' | 'recover';

export function LockHome(p: { config: LockConfig; onMode(mode: LockMode): void }): ReactNode {
  const repo = useRepository();
  const { config } = p;
  const [bio, setBio] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setBio);
  }, []);

  const toggleLock = async (on: boolean): Promise<void> => {
    if (!on) return p.onMode('disable');
    await enableLock(repo.docs);
    repo.notifyChanged();
  };
  const toggleBio = async (on: boolean): Promise<void> => {
    if (on && !(await authenticateBiometric('Enable biometric unlock'))) return;
    await setBiometric(repo.docs, on);
    repo.notifyChanged();
  };
  const toggleRecents = async (on: boolean): Promise<void> => {
    await setHideInRecents(repo.docs, on);
    repo.notifyChanged();
  };

  return (
    <>
      <SectionLabel>Master Lock</SectionLabel>
      <ListRow
        icon="lock"
        title="Master Lock"
        subtitle="Ask for your PIN when the app opens or returns from the background"
        testID="lock-enable-row"
        trailing={
          <Toggle
            value={config.enabled}
            onValueChange={(on) => void toggleLock(on)}
            accessibilityLabel="Master Lock"
            testID="lock-enable"
          />
        }
        last={!bio && !config.enabled}
      />
      {bio ? (
        <ListRow
          icon="unlock"
          title="Biometric unlock"
          subtitle="Face or fingerprint instead of typing the PIN"
          last={!config.enabled}
          trailing={
            <Toggle
              value={config.biometric}
              onValueChange={(on) => void toggleBio(on)}
              accessibilityLabel="Biometric unlock"
              testID="lock-biometric"
            />
          }
        />
      ) : null}
      {config.enabled ? (
        <ListRow
          icon="eye-off"
          title="Hide in app switcher"
          subtitle="Blank in Recents and block screenshots of your manuscripts"
          testID="lock-hide-recents-row"
          last
          trailing={
            <Toggle
              value={hideInRecentsSetting(config)}
              onValueChange={(on) => void toggleRecents(on)}
              accessibilityLabel="Hide in app switcher"
              testID="lock-hide-recents"
            />
          }
        />
      ) : null}
      <SectionLabel>PIN</SectionLabel>
      <ListRow
        icon="key"
        title="Change PIN"
        testID="lock-change"
        onPress={() => p.onMode('change')}
      />
      <ListRow
        icon="life-buoy"
        title="Forgot PIN? Use recovery code"
        testID="lock-recover"
        onPress={() => p.onMode('recover')}
        last
      />
      {config.enabled ? (
        <>
          <SectionLabel>Now</SectionLabel>
          <ListRow
            icon="lock"
            title="Lock now"
            testID="lock-now"
            onPress={() => unlockSession.lockAll()}
            last
          />
        </>
      ) : null}
    </>
  );
}
