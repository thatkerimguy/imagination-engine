// M3 modal bottom sheet: surfaceContainerLow, 28dp top corners, 32×4 drag handle, a fixed header
// OUTSIDE the scroll view (so the first field is never clipped), padded scrolling body and a
// docked footer. A plain RN Modal: same behaviour on iOS, Android and web.
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText.tsx';
import { IconButton } from './IconButton.tsx';
import { shape, space, withAlpha } from './m3-tokens.ts';
import { makeStyles, useTheme } from './theme.tsx';

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Optional leading element in the header, e.g. a module icon badge. */
  leading?: ReactNode;
  onClose(): void;
  /** Docked actions under the scrolling body (e.g. Reset / Save). */
  footer?: ReactNode;
  children: ReactNode;
  testID?: string;
}

export function BottomSheet(p: BottomSheetProps): ReactNode {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.scrim, 0.32) }]}
          onPress={p.onClose}
          accessibilityLabel="Close sheet"
        />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}
          testID={p.testID}
        >
          <View style={s.handle} />
          <View style={s.header}>
            {p.leading}
            <View style={s.headerText}>
              <AppText variant="titleLarge" numberOfLines={1}>
                {p.title}
              </AppText>
              {p.subtitle ? (
                <AppText variant="bodyMedium" color="onSurfaceVariant" numberOfLines={2}>
                  {p.subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="close" accessibilityLabel="Close sheet" onPress={p.onClose} />
          </View>
          <View style={s.divider} />
          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {p.children}
          </ScrollView>
          {p.footer ? <View style={s.footer}>{p.footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: t.colors.surfaceContainerLow,
    borderTopLeftRadius: shape.extraLarge,
    borderTopRightRadius: shape.extraLarge,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: withAlpha(t.colors.onSurfaceVariant, 0.4),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.xl,
    paddingRight: space.md,
    paddingBottom: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: t.colors.outlineVariant },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderColor: t.colors.outlineVariant,
  },
}));
