// Folio confirm dialog: a 16px elevated card with serif title, quiet message and a hairline-
// separated action row; plus a promise-based confirm() so screens can
// `if (await confirm({...}))` without managing state.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ActionButton } from './ActionButton.tsx';
import { Txt } from './Txt.tsx';
import { lift, radius, space, withAlpha } from './tokens.ts';
import { useTheme } from './theme.tsx';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger-coloured confirm action (delete, reset). */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(() => Promise.resolve(false));

export const useConfirm = (): Confirm => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
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
        <ConfirmDialog {...open} onConfirm={() => close(true)} onCancel={() => close(false)} />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function ConfirmDialog(
  p: ConfirmOptions & { onConfirm(): void; onCancel(): void },
): ReactNode {
  const { colors, dark } = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={p.onCancel}>
      <View style={styles.center}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.scrim, dark ? 0.55 : 0.3) },
          ]}
          onPress={p.onCancel}
          accessibilityLabel="Dismiss dialog"
        />
        <View
          accessibilityRole="alert"
          testID="dialog"
          style={[
            styles.card,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.hairline },
            lift(dark, 2),
          ]}
        >
          <View style={styles.body}>
            <Txt variant="heading">{p.title}</Txt>
            <Txt variant="body" color="inkSecondary">
              {p.message}
            </Txt>
          </View>
          <View style={[styles.actions, { borderColor: colors.hairline }]}>
            <ActionButton
              variant="ghost"
              quiet
              label={p.cancelLabel ?? 'Cancel'}
              onPress={p.onCancel}
              testID="dialog-cancel"
            />
            <ActionButton
              variant={p.destructive ? 'danger' : 'primary'}
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
  card: {
    width: '100%',
    maxWidth: 420,
    minWidth: 280,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  body: { padding: space.lg, paddingBottom: space.md, gap: space.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
  },
});
