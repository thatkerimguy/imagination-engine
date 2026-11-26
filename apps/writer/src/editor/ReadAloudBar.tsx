// Compact Folio read-aloud bar: play/pause, previous / next block, speed chip, close.
import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles } from '../ui/theme.tsx';
import { radius, space } from '../ui/tokens.ts';
import { nextSpeed, speedLabel } from './read-aloud.ts';
import { useReadAloud } from './use-read-aloud.ts';

export interface ReadAloudBarProps {
  blocks: Block[];
  /** Index (into `blocks`) of the block being read, so the editor can scroll to it. */
  onActiveBlock?(index: number): void;
  onClose(): void;
}

export function ReadAloudBar({ blocks, onActiveBlock, onClose }: ReadAloudBarProps): ReactNode {
  const s = useStyles();
  const { state, available, segments, controller } = useReadAloud(blocks, onActiveBlock);
  const close = (): void => {
    controller.stop();
    onClose();
  };
  const closeBtn = (
    <IconBtn
      icon="x"
      accessibilityLabel="Close read aloud"
      onPress={close}
      testID="read-aloud-close"
    />
  );
  if (!available || segments.length === 0) {
    return (
      <View style={s.bar} testID="read-aloud-bar">
        <Txt variant="meta" color="inkSecondary" style={s.msg}>
          {available
            ? 'Nothing to read in this chapter'
            : "Read aloud isn't available on this device"}
        </Txt>
        {closeBtn}
      </View>
    );
  }
  const playing = state.status === 'playing';
  const toggle = (): void =>
    playing
      ? controller.pause()
      : state.status === 'paused'
        ? controller.resume()
        : controller.play();
  return (
    <View style={s.bar} testID="read-aloud-bar">
      <IconBtn
        icon={playing ? 'pause' : 'play'}
        accessibilityLabel={playing ? 'Pause reading' : 'Read aloud'}
        color="accent"
        onPress={toggle}
        testID="read-aloud-play"
      />
      <IconBtn
        icon="skip-back"
        accessibilityLabel="Previous block"
        onPress={controller.prev}
        disabled={state.index <= 0}
        testID="read-aloud-prev"
      />
      <IconBtn
        icon="skip-forward"
        accessibilityLabel="Next block"
        onPress={controller.next}
        disabled={state.index >= segments.length - 1}
        testID="read-aloud-next"
      />
      <Txt variant="meta" color="inkSecondary" style={s.msg}>
        {`${state.index + 1} / ${segments.length}`}
      </Txt>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`Reading speed ${speedLabel(state.speed)}`}
        onPress={() => controller.setSpeed(nextSpeed(state.speed))}
        hitSlop={{ top: 8, bottom: 8 }}
        style={s.chip}
        testID="read-aloud-speed"
      >
        <Txt variant="label" color="accent">
          {speedLabel(state.speed)}
        </Txt>
      </Press>
      {closeBtn}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.xs,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.hairline,
  },
  msg: { flex: 1, paddingHorizontal: space.xs },
  chip: {
    minWidth: 52,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: t.colors.surfaceTint,
  },
}));
