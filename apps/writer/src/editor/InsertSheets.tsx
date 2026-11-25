import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { gimmickColor, gimmickGlyph } from './gimmick-look.ts';

/** Lists only the modules the novel has enabled. */
export function GimmickPicker(p: {
  visible: boolean;
  modules: readonly WriterModule[];
  onPick(module: WriterModule): void;
  onClose(): void;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <Sheet visible={p.visible} title="Add a gimmick" onClose={p.onClose} testID="gimmick-picker">
      {p.modules.length === 0 ? (
        <Txt variant="body" color="inkSecondary">
          No gimmicks are enabled for this novel. Turn them on in Novel Settings, then come back.
        </Txt>
      ) : (
        p.modules.map((m) => (
          <Press
            key={m.meta.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.meta.name}. ${m.meta.description}`}
            onPress={() => p.onPick(m)}
            testID={`pick-${m.meta.id}`}
            style={[styles.item, { backgroundColor: colors.surfaceTint }]}
          >
            <View style={[styles.bar, { backgroundColor: gimmickColor(m.meta, colors) }]} />
            <Glyph name={gimmickGlyph(m.meta.id)} size={18} color={gimmickColor(m.meta, colors)} />
            <View style={styles.text}>
              <Txt variant="bodyStrong">{m.meta.name}</Txt>
              <Txt variant="meta" color="inkSecondary">
                {m.meta.description}
              </Txt>
            </View>
          </Press>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  text: { flex: 1, gap: 2 },
});
