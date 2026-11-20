// 38dp live-metrics strip plus the picker sheet and a throttle hook.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { METRICS, type DocumentMetrics } from '../analysis/metrics.ts';
import { METRIC_IDS, type MetricId } from '../store/writer-prefs.ts';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { Switch } from '../ui/Switch.tsx';
import { makeStyles, useWriterPrefs } from '../ui/theme.tsx';

export interface MetricsRibbonProps {
  metrics: DocumentMetrics;
  visible: MetricId[];
  collapsed: boolean;
  onToggleCollapsed(): void;
  onOpenAnalysis(): void;
  onCustomize(): void;
}

/** Returns `value`, updated at most once per `ms` (trailing edge always lands). */
export function useThrottledValue<T>(value: T, ms = 250): T {
  const [out, setOut] = useState(value);
  const lastRun = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, lastRun.current + ms - Date.now());
    const id = setTimeout(() => {
      lastRun.current = Date.now();
      setOut(value);
    }, wait);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
}

const useStyles = makeStyles((t) => ({
  bar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surfaceContainerLow,
  },
  strip: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    paddingHorizontal: space.sm,
    height: 28,
    borderRadius: shape.small,
    backgroundColor: t.colors.surfaceContainerHigh,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  grow: { flex: 1 },
}));

export function MetricsRibbon(p: MetricsRibbonProps): ReactNode {
  const s = useStyles();
  return (
    <View style={s.bar} testID="metrics-ribbon">
      <IconButton
        icon={p.collapsed ? 'expand-more' : 'expand-less'}
        size={32}
        accessibilityLabel={p.collapsed ? 'Show metrics' : 'Hide metrics'}
        onPress={p.onToggleCollapsed}
        testID="metrics-collapse"
      />
      {p.collapsed ? (
        <View style={s.grow} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.strip}
          style={s.grow}
        >
          {p.visible.map((id) => (
            <Pressable
              key={id}
              onPress={p.onOpenAnalysis}
              onLongPress={p.onCustomize}
              accessibilityRole="button"
              accessibilityLabel={`${METRICS[id].label} ${METRICS[id].format(p.metrics[id])}`}
              style={s.pill}
              testID={`metric-${id}`}
            >
              <AppText variant="labelLarge">{METRICS[id].format(p.metrics[id])}</AppText>
              <AppText variant="labelSmall" color="onSurfaceVariant">
                {METRICS[id].short}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <IconButton
        icon="tune"
        size={32}
        accessibilityLabel="Customize metrics"
        onPress={p.onCustomize}
        testID="metrics-customize"
      />
    </View>
  );
}

/** Visible metrics in order first, then the rest. */
const sheetOrder = (visible: readonly MetricId[]): MetricId[] => [
  ...visible,
  ...METRIC_IDS.filter((id) => !visible.includes(id)),
];

export function MetricPickerSheet(p: { visible: boolean; onClose(): void }): ReactNode {
  const s = useStyles();
  const [prefs, update] = useWriterPrefs();
  const vis = prefs.visibleMetrics;
  const toggle = (id: MetricId, on: boolean): void =>
    update({ visibleMetrics: on ? [...vis, id] : vis.filter((m) => m !== id) });
  const move = (id: MetricId, d: -1 | 1): void => {
    const i = vis.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= vis.length) return;
    const next = [...vis];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update({ visibleMetrics: next });
  };
  return (
    <BottomSheet visible={p.visible} title="Metrics" onClose={p.onClose} testID="metric-picker">
      {sheetOrder(vis).map((id) => {
        const on = vis.includes(id);
        return (
          <View key={id} style={s.row}>
            <AppText style={s.grow}>{METRICS[id].label}</AppText>
            {on ? (
              <>
                <IconButton
                  icon="arrow-upward"
                  size={32}
                  accessibilityLabel={`Move ${METRICS[id].label} up`}
                  onPress={() => move(id, -1)}
                />
                <IconButton
                  icon="arrow-downward"
                  size={32}
                  accessibilityLabel={`Move ${METRICS[id].label} down`}
                  onPress={() => move(id, 1)}
                />
              </>
            ) : null}
            <Switch
              value={on}
              onValueChange={(v) => toggle(id, v)}
              accessibilityLabel={METRICS[id].label}
              testID={`metric-toggle-${id}`}
            />
          </View>
        );
      })}
    </BottomSheet>
  );
}
