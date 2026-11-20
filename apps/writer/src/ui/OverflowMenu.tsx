// M3 menu behind a ⋮ icon button, anchored under the button (measured in window coordinates).
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import { shape, space } from './m3-tokens.ts';
import { StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onPress(): void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface OverflowMenuProps {
  items: readonly MenuItem[];
  accessibilityLabel: string;
  icon?: IconName;
  testID?: string;
}

const MENU_WIDTH = 200;

export function OverflowMenu(p: OverflowMenuProps): ReactNode {
  const { colors } = useTheme();
  const win = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const open = (): void =>
    anchor.current?.measureInWindow((x, y, w, h) => {
      const left = Math.min(
        Math.max(space.sm, x + w - MENU_WIDTH),
        win.width - MENU_WIDTH - space.sm,
      );
      const below = y + h + space.xs;
      const height = p.items.length * 48 + space.sm * 2;
      setAt({ left, top: below + height > win.height ? Math.max(space.sm, y - height) : below });
    });
  const pick = (item: MenuItem): void => {
    setAt(null);
    item.onPress();
  };
  return (
    <View ref={anchor} collapsable={false}>
      <IconButton
        icon={p.icon ?? 'more-vert'}
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
              shadow,
              { top: at.top, left: at.left, backgroundColor: colors.surfaceContainer },
            ]}
          >
            {p.items.map((item) => {
              const fg = item.destructive ? 'error' : 'onSurface';
              return (
                <StatePressable
                  key={item.label}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  disabled={item.disabled}
                  testID={item.testID}
                  onPress={() => pick(item)}
                  layerColor={colors.onSurface}
                  style={[styles.item, item.disabled && styles.disabled]}
                >
                  <View style={styles.row}>
                    {item.icon ? (
                      <Icon
                        name={item.icon}
                        size={24}
                        color={item.destructive ? 'error' : 'onSurfaceVariant'}
                      />
                    ) : null}
                    <AppText variant="labelLarge" color={fg}>
                      {item.label}
                    </AppText>
                  </View>
                </StatePressable>
              );
            })}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: shape.extraSmall,
    paddingVertical: space.sm,
  },
  item: { height: 48, justifyContent: 'center', paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  disabled: { opacity: 0.38 },
});
