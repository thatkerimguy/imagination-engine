// M3 basic dialog (28dp, surfaceContainerHigh, headlineSmall, right-aligned text actions) and a
// promise-based confirm() so screens can `if (await confirm({...}))` without managing state.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText.tsx';
import { Button } from './Button.tsx';
import { shape, space, withAlpha } from './m3-tokens.ts';
import { useTheme } from './theme.tsx';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Error-coloured confirm action (delete, reset). */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(() => Promise.resolve(false));

export const useConfirm = (): Confirm => useContext(ConfirmContext);

export function DialogProvider({ children }: { children: ReactNode }): ReactNode {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpen(options);
      }),
    [],
  );
  const close = (ok: boolean): void => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open ? (
        <Dialog {...open} onConfirm={() => close(true)} onCancel={() => close(false)} />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function Dialog(p: ConfirmOptions & { onConfirm(): void; onCancel(): void }): ReactNode {
  const { colors } = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={p.onCancel}>
      <View style={styles.center}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.scrim, 0.32) }]}
          onPress={p.onCancel}
          accessibilityLabel="Dismiss dialog"
        />
        <View
          accessibilityRole="alert"
          testID="dialog"
          style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <AppText variant="headlineSmall">{p.title}</AppText>
          <AppText variant="bodyMedium" color="onSurfaceVariant">
            {p.message}
          </AppText>
          <View style={styles.actions}>
            <Button
              variant="text"
              label={p.cancelLabel ?? 'Cancel'}
              onPress={p.onCancel}
              testID="dialog-cancel"
            />
            <Button
              variant="text"
              destructive={p.destructive}
              label={p.confirmLabel}
              onPress={p.onConfirm}
              testID="dialog-confirm"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: {
    width: '100%',
    maxWidth: 560,
    minWidth: 280,
    borderRadius: shape.extraLarge,
    padding: space.xl,
    gap: space.lg,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
