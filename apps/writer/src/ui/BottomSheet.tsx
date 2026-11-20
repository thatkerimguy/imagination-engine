// A plain React Native Modal styled as a bottom sheet: no gesture or animation libraries, so it
// behaves the same on iOS, Android and Expo Web.
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from './theme.ts';

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose(): void;
  /** Sticky actions under the scrolling body (e.g. Reset / Save). */
  footer?: ReactNode;
  children: ReactNode;
  testID?: string;
}

export function BottomSheet(p: BottomSheetProps): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={p.onClose} accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}
          testID={p.testID}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{p.title}</Text>
              {p.subtitle ? <Text style={styles.subtitle}>{p.subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={p.onClose}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              hitSlop={12}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {p.children}
          </ScrollView>
          {p.footer ? <View style={styles.footer}>{p.footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginTop: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 13 },
  close: { color: colors.muted, fontSize: 18, padding: 4 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg },
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
});
