// Folio popover menu behind a quiet ⋯ icon button: a 16px elevated card anchored under the
// trigger (measured in window coordinates), hairline-separated rows with optional Feather glyphs.
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { IconBtn } from './IconBtn.tsx';
import { Press } from './Press.tsx';
import { Txt } from './Txt.tsx';
import { lift, radius, space } from './tokens.ts';
import { useTheme } from './theme.tsx';

export interface MenuItem {
  label: string;
  icon?: GlyphName;
  onPress(): void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface PopoverMenuProps {
  items: readonly MenuItem[];
  accessibilityLabel: string;
  /** Trigger glyph (default `more-horizontal`). */
  icon?: GlyphName;
  testID?: string;
}

const WIDTH = 220;
const ROW = 44;

export function PopoverMenu(p: PopoverMenuProps): ReactNode {
  const { colors, dark } = useTheme();
  const win = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const open = (): void =>
    anchor.current?.measureInWindow((x, y, w, h) => {
      const left = Math.min(Math.max(space.xs, x + w - WIDTH), win.width - WIDTH - space.xs);
      const below = y + h + 4;
      const height = p.items.length * ROW + space.xs;
      setAt({ left, top: below + height > win.height ? Math.max(space.xs, y - height) : below });
    });
  const pick = (item: MenuItem): void => {
    setAt(null);
    item.onPress();
  };
  return (
    <View ref={anchor} collapsable={false}>
      <IconBtn
        icon={p.icon ?? 'more-horizontal'}
        accessibilityLabel={p.accessibilityLabel}
        onPress={open}
        testID={p.testID}
      />
      <Modal
        visible={at !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAt(null)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setAt(null)}
          accessibilityLabel="Close menu"
        />
        {at ? (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              lift(dark, 2),
              {
                top: at.top,
                left: at.left,
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.hairline,
              },
            ]}
          >
            {p.items.map((item, i) => (
              <Press
                key={item.label}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                disabled={item.disabled}
                testID={item.testID}
                onPress={() => pick(item)}
                style={[styles.item, i > 0 && { borderTopWidth: 1, borderColor: colors.hairline }]}
              >
                <Txt
                  variant="body"
                  color={item.destructive ? 'danger' : 'ink'}
                  style={styles.label}
                  numberOfLines={1}
                >
                  {item.label}
                </Txt>
                {item.icon ? (
                  <Glyph
                    name={item.icon}
                    size={16}
                    color={item.destructive ? 'danger' : 'inkSecondary'}
                  />
                ) : null}
              </Press>
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: WIDTH,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  label: { flex: 1 },
});
