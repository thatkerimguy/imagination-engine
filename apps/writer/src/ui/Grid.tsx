// Responsive column grid for the Library and Notes lists: 1 column renders the children untouched
// (the exact phone layout); 2-3 columns wrap them into equal-width cells with a gutter.
import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from './tokens.ts';

export function Grid({
  columns,
  children,
  testID,
}: {
  columns: number;
  children: ReactNode;
  testID?: string;
}): ReactNode {
  if (columns <= 1) return <View testID={testID}>{children}</View>;
  const width = `${100 / columns}%` as const;
  return (
    <View style={styles.grid} testID={testID}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={[styles.cell, { width }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm },
  cell: { paddingHorizontal: space.sm },
});
