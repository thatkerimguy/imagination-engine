// Gates that hide the app (Master Lock) or a single locked item behind the PIN pad. The Master
// gate covers the app with an opaque canvas overlay so navigation state survives a re-lock.
import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { loadItemMeta } from '../store/item-meta.ts';
import { unlockSession } from '../store/unlock-session.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { lockGateConsumesBack } from '../ui/back-layers.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';
import { LockPrompt } from './LockPrompt.tsx';
import { hideInRecentsSetting, PRIVACY_TAG, shouldBlockScreenCapture } from './screen-privacy.ts';
import { useLockConfig } from './useLockConfig.ts';
import { useScreenPrivacy } from './use-screen-privacy.ts';

const useMasterUnlocked = (): boolean =>
  useSyncExternalStore(unlockSession.subscribe, unlockSession.isMasterUnlocked);

/** Root-layout gate (inside RepositoryProvider + ThemeProvider). */
export function LockGate({ children }: { children: ReactNode }): ReactNode {
  const { colors } = useTheme();
  const { config, reload } = useLockConfig();
  const unlocked = useMasterUnlocked();

  useEffect(() => {
    if (config === null || config?.enabled === false) unlockSession.setMasterUnlocked(true);
  }, [config]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      void reload().then((c) => {
        if (c?.enabled) unlockSession.lockAll();
      });
    });
    return () => sub.remove();
  }, [reload]);

  const covered = config === undefined || (config?.enabled === true && !unlocked);
  useScreenPrivacy(
    PRIVACY_TAG.gate,
    shouldBlockScreenCapture({
      isLocked: covered,
      onSensitiveScreen: false,
      lockEnabled: config?.enabled === true,
      hideInRecents: hideInRecentsSetting(config),
    }),
  );
  // Android back / predictive back is swallowed while covered: no route pops or peeks under the
  // overlay. Registered on every (re)lock, so it runs before any screen-level back listener.
  useEffect(() => {
    if (Platform.OS !== 'android' || !lockGateConsumesBack(covered)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [covered]);

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={covered}
      >
        {children}
      </View>
      {covered ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            styles.gap,
            { backgroundColor: colors.canvas },
          ]}
        >
          <Glyph name="book" size={28} color="inkMuted" />
          {config ? (
            <LockPrompt
              config={config}
              title="Enter PIN"
              autoBiometric
              onUnlocked={() => unlockSession.setMasterUnlocked(true)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Wraps a locked item's body: shows the PIN pad until it is unlocked this session. */
export function ItemLockGate(p: { itemId: string; title: string; children: ReactNode }): ReactNode {
  const repo = useRepository();
  const { config } = useLockConfig();
  const [locked, setLocked] = useState<boolean | null>(null);
  const itemUnlocked = useSyncExternalStore(unlockSession.subscribe, () =>
    unlockSession.isItemUnlocked(p.itemId),
  );
  useEffect(() => {
    let live = true;
    const load = (): void =>
      void loadItemMeta(repo, p.itemId).then((m) => live && setLocked(m.locked === true));
    load();
    const off = repo.subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, [repo, p.itemId]);

  if (locked === null && config === undefined) return null;
  if (!locked || itemUnlocked) return p.children;
  return (
    <View style={[styles.fill, styles.overlay, styles.gap]} testID="item-lock-gate">
      <Glyph name="lock" size={28} color="inkMuted" />
      {config ? (
        <LockPrompt
          config={config}
          title="Enter PIN"
          caption={`“${p.title}” is locked`}
          autoBiometric
          onUnlocked={() => unlockSession.unlockItem(p.itemId)}
        />
      ) : (
        <>
          <Txt variant="title" style={styles.center}>
            “{p.title}” is locked
          </Txt>
          <Txt variant="body" color="inkSecondary" style={styles.center}>
            Set a PIN in Settings → Master Lock to open locked items.
          </Txt>
          <ActionButton label="Set up PIN" onPress={() => router.push(routes.lock)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  gap: { gap: space.md },
  center: { textAlign: 'center' },
});
