// Editor layout preferences: focus mode, ribbon, margins, quick typography and toolbar buttons.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  type MarginPreset,
  type ToolId,
} from '../store/writer-prefs.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Stepper } from '../ui/Stepper.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space, TOUCH, withAlpha } from '../ui/tokens.ts';
import { makeStyles, useTheme, useWriterPrefs } from '../ui/theme.tsx';
import { toolLabel } from './FormattingToolbar.tsx';

export interface LayoutPrefsSheetProps {
  visible: boolean;
  focusMode: boolean;
  onFocusMode(on: boolean): void;
  onClose(): void;
  onOpenAppearance(): void;
}

const MARGINS: readonly { value: MarginPreset; label: string }[] = [
  { value: 'compact', label: 'Tight' },
  { value: 'comfortable', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
];

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH },
  grow: { flex: 1 },
  group: { gap: space.xxs },
}));

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

  return (
    <Sheet visible={p.visible} title="Editor layout" onClose={p.onClose} testID="layout-sheet">
      <View style={s.group}>
        <View style={s.row}>
          <Txt style={s.grow}>Focus mode</Txt>
          <Toggle
            value={p.focusMode}
            onValueChange={p.onFocusMode}
            accessibilityLabel="Focus mode"
            testID="focus-mode-switch"
          />
        </View>
        <View style={s.row}>
          <Txt style={s.grow}>Metrics ribbon</Txt>
          <Toggle
            value={prefs.showMetricsRibbon}
            onValueChange={(v) => update({ showMetricsRibbon: v })}
            accessibilityLabel="Metrics ribbon"
            testID="ribbon-switch"
          />
        </View>
      </View>
      <View style={s.group}>
        <SectionLabel>Text</SectionLabel>
        <View style={s.row}>
          <Txt style={s.grow}>Font size</Txt>
          <Stepper
            compact
            label="font size"
            value={prefs.fontSize}
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            step={1}
            onChange={(fontSize) => update({ fontSize })}
            testID="font-size-input"
          />
        </View>
        <View style={s.row}>
          <Txt style={s.grow}>Line height</Txt>
          <Stepper
            compact
            label="line height"
            value={prefs.lineHeight}
            min={LINE_HEIGHT_RANGE.min}
            max={LINE_HEIGHT_RANGE.max}
            step={0.1}
            onChange={(lineHeight) => update({ lineHeight })}
            testID="line-height-input"
          />
        </View>
        <SegmentControl
          options={MARGINS}
          value={prefs.marginPreset}
          onChange={(marginPreset) => update({ marginPreset })}
          accessibilityLabel="Margins"
          testID="margin-segments"
        />
      </View>
      <View style={s.group}>
        <SectionLabel>Toolbar buttons</SectionLabel>
        {order.map((id) => (
          <View key={id} style={s.row}>
            <Txt style={s.grow}>{toolLabel(id)}</Txt>
            <IconBtn
              icon="arrow-up"
              box={32}
              size={16}
              accessibilityLabel={`Move ${toolLabel(id)} up`}
              onPress={() => move(id, -1)}
            />
            <IconBtn
              icon="arrow-down"
              box={32}
              size={16}
              accessibilityLabel={`Move ${toolLabel(id)} down`}
              onPress={() => move(id, 1)}
            />
            <Toggle
              value={!prefs.hiddenTools.includes(id)}
              onValueChange={(v) => toggleTool(id, v)}
              accessibilityLabel={toolLabel(id)}
              testID={`tool-switch-${id}`}
            />
          </View>
        ))}
      </View>
      <ActionButton
        label="Appearance & Fonts"
        icon="sliders"
        variant="secondary"
        onPress={p.onOpenAppearance}
        testID="open-appearance"
      />
    </Sheet>
  );
}

/** Small translucent `Exit` pill (top-right, below the status bar) that leaves focus mode. */
export function FocusExitPill({ onExit }: { onExit(): void }): ReactNode {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel="Exit focus mode"
      onPress={onExit}
      hitSlop={8}
      wash={null}
      style={[
        styles.pill,
        {
          top: insets.top + space.xs,
          backgroundColor: withAlpha(colors.surfaceElevated, 0.82),
          borderColor: colors.hairline,
        },
      ]}
      testID="focus-exit"
    >
      <Txt variant="label" color="inkSecondary">
        Exit
      </Txt>
    </Press>
  );
}

/** Height the exit pill occupies below the safe area; the focus-mode page pads past it. */
export const FOCUS_EXIT_CLEARANCE = 32 + space.xs * 2;

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: space.md,
    height: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
