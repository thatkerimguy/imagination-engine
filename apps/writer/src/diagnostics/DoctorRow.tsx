// One Document Doctor finding: severity dot, title, muted detail, mono key and a Repair action.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Dot } from '../ui/Page.tsx';
import { space } from '../ui/tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';
import { mono } from '../ui/type.ts';
import type { Issue } from './doctor.ts';

export function DoctorRow(p: {
  issue: Issue;
  index: number;
  onRepair(issue: Issue): void;
}): ReactNode {
  const { colors } = useTheme();
  const s = useStyles();
  const { issue } = p;
  const tone =
    issue.severity === 'error'
      ? colors.danger
      : issue.severity === 'warning'
        ? colors.warm
        : colors.inkMuted;
  return (
    <View style={s.row} testID={`doctor-issue-${p.index}`}>
      <View style={s.dot}>
        <Dot color={tone} size={8} />
      </View>
      <View style={s.text}>
        <Txt variant="bodyStrong">{issue.title}</Txt>
        <Txt variant="meta" color="inkSecondary">
          {issue.detail}
        </Txt>
        <Txt style={s.key} color="inkMuted" numberOfLines={1}>
          {issue.key}
        </Txt>
      </View>
      {issue.repair ? (
        <ActionButton
          variant="ghost"
          quiet
          compact
          label="Repair"
          onPress={() => p.onRepair(issue)}
          testID={`doctor-repair-${p.index}`}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
  },
  dot: { paddingTop: 7 },
  text: { flex: 1, gap: 2 },
  key: { fontFamily: mono, fontSize: 11, lineHeight: 15 },
}));
