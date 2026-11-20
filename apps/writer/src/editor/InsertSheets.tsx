import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';
import { IconBadge, Muted } from '../ui/layout.tsx';
import { shape, space, TOUCH } from '../ui/m3-tokens.ts';
import { StatePressable } from '../ui/StateLayer.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { INSERT_CHOICES, type InsertChoice } from './InsertBar.tsx';

const useStyles = makeStyles(() => ({
  list: { gap: space.sm },
  item: {
    minHeight: TOUCH + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: shape.large,
    overflow: 'hidden',
  },
  text: { flex: 1, gap: 2 },
}));

/** "Insert below": the same insert choices, as a sheet. */
export function InsertChoiceSheet(p: {
  visible: boolean;
  onPick(choice: InsertChoice): void;
  onClose(): void;
}): ReactNode {
  const s = useStyles();
  return (
    <BottomSheet visible={p.visible} title="Insert below" onClose={p.onClose}>
      <View style={s.list}>
        {INSERT_CHOICES.map((c) => (
          <Button
            key={c.choice}
            variant="tonal"
            icon={c.icon}
            label={c.label}
            onPress={() => p.onPick(c.choice)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

/** Lists only the modules the novel has enabled. */
export function GimmickPicker(p: {
  visible: boolean;
  modules: readonly WriterModule[];
  onPick(module: WriterModule): void;
  onClose(): void;
}): ReactNode {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet
      visible={p.visible}
      title="Add a gimmick"
      onClose={p.onClose}
      testID="gimmick-picker"
    >
      {p.modules.length === 0 ? (
        <Muted>
          No gimmicks are enabled for this novel. Turn them on in Novel Settings, then come back.
        </Muted>
      ) : (
        p.modules.map((m) => (
          <StatePressable
            key={m.meta.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.meta.name}. ${m.meta.description}`}
            layerColor={colors.onSurface}
            onPress={() => p.onPick(m)}
            testID={`pick-${m.meta.id}`}
            style={s.item}
          >
            <IconBadge glyph={m.meta.icon} />
            <View style={s.text}>
              <AppText variant="titleMedium">{m.meta.name}</AppText>
              <AppText variant="bodySmall" color="onSurfaceVariant">
                {m.meta.description}
              </AppText>
            </View>
          </StatePressable>
        ))
      )}
    </BottomSheet>
  );
}
