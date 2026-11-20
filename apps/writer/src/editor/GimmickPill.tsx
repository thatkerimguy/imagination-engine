import type { ReactNode } from 'react';
import { View } from 'react-native';
import { getWriterModule } from '../modules/registry.ts';
import { AppText } from '../ui/AppText.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { IconBadge, StatusBadge } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { StatePressable } from '../ui/StateLayer.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import type { ModuleBlockT } from './block-types.ts';

const useStyles = makeStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    padding: space.md,
    borderRadius: shape.large,
    overflow: 'hidden',
    backgroundColor: t.m3.surfaceContainer,
  },
  unknown: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  side: { alignItems: 'flex-end', gap: space.xs },
}));

/** Removes a leading emoji that duplicates the module icon already shown in the badge. */
function stripIcon(title: string, icon: string): string {
  return title.startsWith(icon) ? title.slice(icon.length).trim() : title;
}

/** Compact summary card; everything shown comes from the module's own `summarize()`. */
export function GimmickPill(p: {
  block: ModuleBlockT;
  enabled: boolean;
  onOpen(): void;
}): ReactNode {
  const s = useStyles();
  const { m3 } = useTheme();
  const module = getWriterModule(p.block.moduleId);
  if (!module) {
    return (
      <View style={[s.card, s.unknown]} testID={`pill-${p.block.id}`}>
        <AppText variant="titleMedium" color="onSurfaceVariant">
          Unknown gimmick {p.block.moduleId}
        </AppText>
      </View>
    );
  }
  const card = module.summarize(p.block.props);
  const title = stripIcon(card.title, module.meta.icon);
  return (
    <StatePressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${card.subtitle}`}
      layerColor={m3.onSurface}
      onPress={() => {
        tapFeedback();
        p.onOpen();
      }}
      testID={`pill-${p.block.id}`}
      style={s.card}
    >
      <IconBadge glyph={module.meta.icon} />
      <View style={s.text}>
        <AppText variant="titleMedium" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="bodySmall" color="onSurfaceVariant" numberOfLines={2}>
          {card.subtitle}
        </AppText>
      </View>
      <View style={s.side}>
        {p.enabled ? (
          card.badge ? (
            <StatusBadge label={card.badge} tone="primary" />
          ) : null
        ) : (
          <StatusBadge label="Not enabled" tone="error" />
        )}
        {p.block.beatStop ? <StatusBadge icon="pause" label="Beat" tone="tertiary" /> : null}
      </View>
    </StatePressable>
  );
}
