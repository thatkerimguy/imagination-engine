// Editor layout preferences: focus mode, ribbon, toolbar buttons and quick typography.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE_RANGE, LINE_HEIGHT_RANGE, type ToolId } from '../store/writer-prefs.ts';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { shape, space, TOUCH } from '../ui/m3-tokens.ts';
import { Switch } from '../ui/Switch.tsx';
import { makeStyles, useWriterPrefs } from '../ui/theme.tsx';
import { toolLabel } from './FormattingToolbar.tsx';

export interface LayoutPrefsSheetProps {
  visible: boolean;
  focusMode: boolean;
  onFocusMode(on: boolean): void;
  onClose(): void;
  onOpenAppearance(): void;
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH },
  grow: { flex: 1 },
  section: { gap: space.xs },
  pill: {
    position: 'absolute',
    right: space.lg,
    opacity: 0.92,
    backgroundColor: t.colors.secondaryContainer,
    borderRadius: shape.full,
    paddingHorizontal: space.lg,
    height: 40,
    justifyContent: 'center',
  },
}));

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function LayoutPrefsSheet(p: LayoutPrefsSheetProps): ReactNode {
  const s = useStyles();
  const [prefs, update] = useWriterPrefs();
  const order = prefs.toolbarOrder;
  const move = (id: ToolId, d: -1 | 1): void => {
    const i = order.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update({ toolbarOrder: next });
  };
  const toggleTool = (id: ToolId, on: boolean): void =>
    update({
      hiddenTools: on ? prefs.hiddenTools.filter((t) => t !== id) : [...prefs.hiddenTools, id],
    });
  const size = prefs.fontSize;
  const lh = prefs.lineHeight;

  return (
    <BottomSheet
      visible={p.visible}
      title="Editor layout"
      onClose={p.onClose}
      testID="layout-sheet"
    >
      <View style={s.row}>
        <AppText style={s.grow}>Focus mode</AppText>
        <Switch
          value={p.focusMode}
          onValueChange={p.onFocusMode}
          accessibilityLabel="Focus mode"
          testID="focus-mode-switch"
        />
      </View>
      <View style={s.row}>
        <AppText style={s.grow}>Metrics ribbon</AppText>
        <Switch
          value={prefs.showMetricsRibbon}
          onValueChange={(v) => update({ showMetricsRibbon: v })}
          accessibilityLabel="Metrics ribbon"
          testID="ribbon-switch"
        />
      </View>
      <View style={s.section}>
        <AppText variant="titleSmall">Text size</AppText>
        <View style={s.row}>
          <AppText style={s.grow}>Font size {size}</AppText>
          <IconButton
            icon="remove"
            accessibilityLabel="Smaller text"
            disabled={size <= FONT_SIZE_RANGE.min}
            onPress={() => update({ fontSize: size - 1 })}
            testID="font-smaller"
          />
          <IconButton
            icon="add"
            accessibilityLabel="Larger text"
            disabled={size >= FONT_SIZE_RANGE.max}
            onPress={() => update({ fontSize: size + 1 })}
            testID="font-larger"
          />
        </View>
        <View style={s.row}>
          <AppText style={s.grow}>Line height {lh.toFixed(1)}</AppText>
          <IconButton
            icon="remove"
            accessibilityLabel="Tighter lines"
            disabled={lh <= LINE_HEIGHT_RANGE.min}
            onPress={() =>
              update({ lineHeight: round1(Math.max(LINE_HEIGHT_RANGE.min, lh - 0.1)) })
            }
            testID="lh-smaller"
          />
          <IconButton
            icon="add"
            accessibilityLabel="Looser lines"
            disabled={lh >= LINE_HEIGHT_RANGE.max}
            onPress={() =>
              update({ lineHeight: round1(Math.min(LINE_HEIGHT_RANGE.max, lh + 0.1)) })
            }
            testID="lh-larger"
          />
        </View>
      </View>
      <View style={s.section}>
        <AppText variant="titleSmall">Toolbar buttons</AppText>
        {order.map((id) => (
          <View key={id} style={s.row}>
            <AppText style={s.grow}>{toolLabel(id)}</AppText>
            <IconButton
              icon="arrow-upward"
              size={32}
              accessibilityLabel={`Move ${toolLabel(id)} up`}
              onPress={() => move(id, -1)}
            />
            <IconButton
              icon="arrow-downward"
              size={32}
              accessibilityLabel={`Move ${toolLabel(id)} down`}
              onPress={() => move(id, 1)}
            />
            <Switch
              value={!prefs.hiddenTools.includes(id)}
              onValueChange={(v) => toggleTool(id, v)}
              accessibilityLabel={toolLabel(id)}
              testID={`tool-switch-${id}`}
            />
          </View>
        ))}
      </View>
      <Button
        label="Appearance & fonts"
        icon="palette"
        variant="tonal"
        onPress={p.onOpenAppearance}
        testID="open-appearance"
      />
    </BottomSheet>
  );
}

/** Small floating pill (bottom-right, clear of the prose) that leaves focus mode. */
export function FocusExitPill({ onExit }: { onExit(): void }): ReactNode {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Exit focus mode"
      onPress={onExit}
      style={[s.pill, { bottom: Math.max(insets.bottom, space.md) + space.md }]}
      testID="focus-exit"
    >
      <AppText variant="labelLarge" color="onSecondaryContainer">
        Exit focus
      </AppText>
    </Pressable>
  );
}
