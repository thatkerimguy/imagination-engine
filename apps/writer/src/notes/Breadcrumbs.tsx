// `Notes / Worldbuilding / Harbour` — every crumb but the last is tappable.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { folderHref, routes } from '../routes.ts';
import type { FolderRecord } from '../store/folders.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { hitSlopFor, MIN_TOUCH } from '../ui/a11y.ts';

export function Breadcrumbs({ crumbs }: { crumbs: readonly FolderRecord[] }): ReactNode {
  const go = (i: number): void => {
    const f = crumbs[i];
    if (!f) router.replace(routes.notes);
    else router.replace(folderHref(f.id, crumbs[i - 1]?.id ?? null));
  };
  const trail = [{ id: 'root', title: 'Notes' }, ...crumbs];
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
      testID="breadcrumbs"
    >
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {last ? (
              <Txt variant="meta" numberOfLines={1} style={{ maxWidth: 200 }}>
                {c.title}
              </Txt>
            ) : (
              <Press
                wash={null}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${c.title}`}
                onPress={() => go(i)}
                hitSlop={hitSlopFor(MIN_TOUCH, 32)}
                style={{ minHeight: 32, justifyContent: 'center' }}
                testID={`crumb-${c.id}`}
              >
                <Txt variant="meta" color="inkSecondary" numberOfLines={1}>
                  {c.title}
                </Txt>
              </Press>
            )}
            {last ? null : (
              <Txt variant="meta" color="inkMuted">
                {'  /  '}
              </Txt>
            )}
          </View>
        );
      })}
    </View>
  );
}
