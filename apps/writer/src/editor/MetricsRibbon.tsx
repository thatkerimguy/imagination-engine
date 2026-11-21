// Hairline typographic live-metrics strip (label over value, no boxes), the picker sheet and a
// throttle hook.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { METRICS, type DocumentMetrics } from '../analysis/metrics.ts';
import { METRIC_IDS, type MetricId } from '../store/writer-prefs.ts';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space, TOUCH } from '../ui/tokens.ts';
import { makeStyles, useWriterPrefs } from '../ui/theme.tsx';
import { tabular } from '../ui/type.ts';

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

export interface MetricsRibbonProps {
  metrics: DocumentMetrics;
  visible: MetricId[];
  collapsed: boolean;
  onToggleCollapsed(): void;
  onOpenAnalysis(): void;
  onCustomize(): void;
}

const useStyles = makeStyles((t) => ({
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.canvas,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
    paddingHorizontal: space.xxs,
  },
  // The six default metrics fit a 390pt phone at rest; extra room is shared evenly, and longer
  // custom sets scroll with 20pt clearance before the separator.
  strip: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xs,
    paddingRight: 20,
  },
  col: { minHeight: 36, justifyContent: 'center' },
  label: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  value: { fontSize: 13, lineHeight: 17, fontWeight: '500', ...tabular },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH },
  grow: { flex: 1 },
  sep: { width: 1, height: 20, backgroundColor: t.colors.hairline },
}));

export function MetricsRibbon(p: MetricsRibbonProps): ReactNode {
  const s = useStyles();
  return (
    <View style={s.bar} testID="metrics-ribbon">
      <IconBtn
        icon={p.collapsed ? 'chevron-down' : 'chevron-up'}
        box={32}
        size={16}
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
              style={s.col}
              testID={`metric-${id}`}
            >
              <Txt variant="overline" color="inkMuted" style={s.label}>
                {METRICS[id].short}
              </Txt>
              <Txt color="ink" style={s.value}>
                {METRICS[id].format(p.metrics[id])}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={s.sep} />
      <IconBtn
        icon="filter"
        box={32}
        size={16}
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
    <Sheet visible={p.visible} title="Metrics" onClose={p.onClose} testID="metric-picker">
      <View>
        {sheetOrder(vis).map((id) => {
          const on = vis.includes(id);
          return (
            <View key={id} style={s.row}>
              <Txt style={s.grow}>{METRICS[id].label}</Txt>
              {on ? (
                <>
                  <IconBtn
                    icon="arrow-up"
                    box={32}
                    size={16}
                    accessibilityLabel={`Move ${METRICS[id].label} up`}
                    onPress={() => move(id, -1)}
                  />
                  <IconBtn
                    icon="arrow-down"
                    box={32}
                    size={16}
                    accessibilityLabel={`Move ${METRICS[id].label} down`}
                    onPress={() => move(id, 1)}
                  />
                </>
              ) : null}
              <Toggle
                value={on}
                onValueChange={(v) => toggle(id, v)}
                accessibilityLabel={METRICS[id].label}
                testID={`metric-toggle-${id}`}
              />
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
