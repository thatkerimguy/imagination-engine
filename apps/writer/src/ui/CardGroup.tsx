// Grouped inset card: `surface` fill, hairline border, rounded + clipped, rows full-bleed so a
// pressed row's wash / ripple fills edge to edge and clips to the card's corners. Dividers are
// inset hairlines. Rows inside should pass `last` to ListRow (the card draws its own dividers).
// ListRow reads `CardInsetContext` to pad its own content; other children pad themselves.
import { Children, createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { CARD_RADIUS, clipped } from './press-shape.ts';
import { space } from './tokens.ts';
import { useTheme } from './theme.tsx';

const CardInsetContext = createContext(false);

/** True inside a CardGroup: rows pad their own content (the card is full-bleed). */
export function useCardInset(): boolean {
  return useContext(CardInsetContext);
}

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
    <CardInsetContext.Provider value>
      <View
        testID={testID}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            elevation: 0,
          },
          clipped(CARD_RADIUS),
        ]}
      >
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: space.md,
                  backgroundColor: colors.hairline,
                }}
              />
            ) : null}
            {row}
          </View>
        ))}
      </View>
    </CardInsetContext.Provider>
  );
}
