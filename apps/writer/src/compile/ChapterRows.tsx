// The reorderable, include/exclude chapter list: hairline rows under group (season) labels.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import type { CompileRow } from './use-compiler.ts';

export function ChapterRows(p: {
  rows: readonly CompileRow[];
  onToggle(id: string): void;
  onMove(id: string, delta: -1 | 1): void;
}): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
  const included = p.rows.filter((r) => r.included).length;
  return (
    <View>
      <SectionLabel
        trailing={
          <Txt variant="meta" color="inkMuted">
            {t('compile.ofCount', { n: included, total: p.rows.length })}
          </Txt>
        }
      >
        {t('compile.contents')}
      </SectionLabel>
      {p.rows.length === 0 ? (
        <Txt variant="body" color="inkSecondary">
          {t('compile.nothing')}
        </Txt>
      ) : null}
      {p.rows.map((r, i) => {
        const prev = p.rows[i - 1];
        return (
          <View key={r.id}>
            {r.group && r.group !== prev?.group ? (
              <Txt variant="overline" color="inkMuted" style={styles.group}>
                {r.group}
              </Txt>
            ) : null}
            <View
              testID={`compile-chapter-${r.id}`}
              style={[styles.row, { borderBottomColor: colors.hairline }]}
            >
              <Press
                accessibilityRole="checkbox"
                accessibilityLabel={t('compile.include', { title: r.title })}
                accessibilityState={{ checked: r.included }}
                onPress={() => p.onToggle(r.id)}
                style={styles.main}
                testID={`compile-chapter-${r.id}-toggle`}
              >
                <Glyph
                  name={r.included ? 'check-square' : 'square'}
                  size={20}
                  color={r.included ? 'accent' : 'inkMuted'}
                />
                <Txt
                  variant="body"
                  color={r.included ? 'ink' : 'inkMuted'}
                  numberOfLines={1}
                  style={styles.title}
                >
                  {r.title}
                </Txt>
              </Press>
              <IconBtn
                icon="chevron-up"
                accessibilityLabel={t('compile.moveUp', { title: r.title })}
                box={36}
                size={18}
                disabled={i === 0}
                onPress={() => p.onMove(r.id, -1)}
              />
              <IconBtn
                icon="chevron-down"
                accessibilityLabel={t('compile.moveDown', { title: r.title })}
                box={36}
                size={18}
                disabled={i === p.rows.length - 1}
                onPress={() => p.onMove(r.id, 1)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingTop: space.sm, paddingBottom: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  title: { flex: 1 },
});
