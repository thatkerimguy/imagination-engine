// Grouped inset card: `surface` fill, hairline border, rows separated by inset hairlines.
// Rows inside should pass `last` to ListRow (the card draws its own dividers).
import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { radius, space } from './tokens.ts';
import { useTheme } from './theme.tsx';

export function CardGroup({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}): ReactNode {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.hairline,
        overflow: 'hidden',
        elevation: 0,
        paddingHorizontal: space.md,
      }}
    >
      {rows.map((row, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: colors.hairline }} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}
