// Gimmick cue strip: an editorial stage direction in the prose flow. A 3px layer-coloured bar,
// a soft wash, a Feather glyph, a one-line title with a right-aligned caps tag, and the muted
// module summary. The "Beat stop" indicator lives here (once) for gimmick blocks.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { getWriterModule } from '../modules/registry.ts';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import type { ModuleBlockT } from './block-types.ts';
import { gimmickColor, gimmickGlyph } from './gimmick-look.ts';

/** Removes a leading emoji that duplicates the module glyph. */
function stripIcon(title: string, icon: string): string {
  return title.startsWith(icon) ? title.slice(icon.length).trim() : title;
}

export function GimmickPill(p: {
  block: ModuleBlockT;
  enabled: boolean;
  onOpen(): void;
}): ReactNode {
  const { colors } = useTheme();
  const module = getWriterModule(p.block.moduleId);
  if (!module) {
    return (
      <View
        style={[styles.strip, { backgroundColor: colors.surface }]}
        testID={`pill-${p.block.id}`}
      >
        <Txt variant="label" color="inkMuted">
          Unknown gimmick {p.block.moduleId}
        </Txt>
      </View>
    );
  }
  const card = module.summarize(p.block.props);
  const title = stripIcon(card.title, module.meta.icon);
  const tint = gimmickColor(module.meta, colors);
  const tag = p.enabled ? card.badge : 'Not enabled';
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${card.subtitle}`}
      onPress={() => {
        tapFeedback();
        p.onOpen();
      }}
      testID={`pill-${p.block.id}`}
      wash={colors.accentSoft}
      style={[styles.strip, { backgroundColor: colors.surfaceTint }]}
    >
      <View style={[styles.bar, { backgroundColor: tint }]} />
      <View style={styles.glyph}>
        <Glyph name={gimmickGlyph(module.meta.id)} size={18} color={tint} />
      </View>
      <View style={styles.text}>
        <View style={styles.head}>
          <Txt variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title}
          </Txt>
          {tag ? (
            <Txt
              variant="caption"
              color={p.enabled ? 'inkSecondary' : 'danger'}
              style={styles.tag}
              numberOfLines={1}
            >
              {tag.toUpperCase()}
            </Txt>
          ) : null}
        </View>
        <Txt variant="meta" color="inkSecondary" numberOfLines={2}>
          {card.subtitle}
        </Txt>
        {p.block.beatStop ? (
          <View style={styles.beat}>
            <Glyph name="pause" size={11} color="inkMuted" />
            <Txt variant="caption" color="inkMuted">
              Beat stop
            </Txt>
          </View>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    overflow: 'hidden',
    minHeight: MIN_TOUCH,
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  glyph: { paddingTop: 1 },
  text: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  tag: { letterSpacing: 0.8 },
  beat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
});
