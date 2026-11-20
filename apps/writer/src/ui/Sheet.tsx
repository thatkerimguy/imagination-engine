// Folio modal sheet: `surface`, 20px top radius, 36×4 handle, a single-line title (+ optional
// quiet subtitle) with a × close, hairline divider, padded scroll body and a docked action bar.
// The header lives OUTSIDE the scroll view so the first field is never clipped. Plain RN Modal.
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
import { IconBtn } from './IconBtn.tsx';
import { Txt } from './Txt.tsx';
import { radius, space, withAlpha } from './tokens.ts';
import { makeStyles, useTheme } from './theme.tsx';

export interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Optional leading element in the header (e.g. a module glyph). */
  leading?: ReactNode;
  onClose(): void;
  /** Docked actions under the scrolling body (e.g. Reset / Done). */
  footer?: ReactNode;
  /** Fixed content between the header and the scroll body (e.g. UnderlineTabs). */
  toolbar?: ReactNode;
  children: ReactNode;
  testID?: string;
}

export function Sheet(p: SheetProps): ReactNode {
  const insets = useSafeAreaInsets();
  const { colors, dark } = useTheme();
  const s = useStyles();
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.scrim, dark ? 0.5 : 0.28) },
          ]}
          onPress={p.onClose}
          accessibilityLabel="Dismiss sheet"
        />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.sm) }]}
          testID={p.testID}
        >
          <View style={s.handle} />
          <View style={s.header}>
            {p.leading}
            <View style={s.headerText}>
              <Txt variant="heading" numberOfLines={1} accessibilityRole="header">
                {p.title}
              </Txt>
              {p.subtitle ? (
                <Txt variant="meta" color="inkSecondary" numberOfLines={1}>
                  {p.subtitle}
                </Txt>
              ) : null}
            </View>
            <IconBtn
              icon="x"
              accessibilityLabel="Close sheet"
              onPress={p.onClose}
              testID="sheet-close"
            />
          </View>
          {p.toolbar ? <View style={s.toolbar}>{p.toolbar}</View> : <View style={s.divider} />}
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
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: space.xs,
    marginBottom: space.xxs,
    backgroundColor: t.colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xxs + 2,
    paddingBottom: space.xxs,
  },
  headerText: { flex: 1, gap: 1 },
  toolbar: { paddingHorizontal: space.lg },
  divider: { height: 1, backgroundColor: t.colors.hairline },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderColor: t.colors.hairline,
  },
}));
