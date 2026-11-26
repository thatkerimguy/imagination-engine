// `<Stack.Screen options>` that only applies while its page is the visible one. The root tab pager
// hosts Library, Notes and Search inside one route, so each page's header actions must hand over
// the shared StackTopBar as the pager settles. Outside a pager every page counts as active.
import { Stack } from 'expo-router';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';

export const PageActiveContext = createContext(true);

export const usePageActive = (): boolean => useContext(PageActiveContext);

type Options = ComponentProps<typeof Stack.Screen>['options'];

export function ScreenOptions({ options }: { options: Options }): ReactNode {
  return usePageActive() ? <Stack.Screen options={options} /> : null;
}
