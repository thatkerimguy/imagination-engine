// "Promote to Novel Chapter": pick a novel, then a season; the note becomes its last chapter.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRepoQuery } from '../store/context.tsx';
import { ListRow } from '../ui/Page.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';

export interface PromoteSheetProps {
  visible: boolean;
  noteTitle: string;
  onPick(novelId: string, seasonId: string): void;
  onClose(): void;
}

export function PromoteSheet(p: PromoteSheetProps): ReactNode {
  const [novelId, setNovelId] = useState<string | null>(null);
  useEffect(() => {
    if (!p.visible) setNovelId(null);
  }, [p.visible]);
  const novels = useRepoQuery('promote-novels', (r) => r.listNovels());
  const seasons = useRepoQuery(`promote-seasons:${novelId ?? ''}`, async (r) =>
    novelId ? r.listSeasons(novelId) : [],
  );
  const novel = novels.data?.find((n) => n.id === novelId);
  return (
    <Sheet
      visible={p.visible}
      title={novel ? novel.title : 'Promote to Novel Chapter'}
      subtitle={novel ? 'Choose a season' : p.noteTitle}
      onClose={p.onClose}
      testID="promote-sheet"
    >
      {novels.data?.length === 0 ? (
        <Txt color="inkSecondary">Create a novel first, then promote notes into it.</Txt>
      ) : null}
      <View>
        {novel
          ? seasons.data?.map((s, i, all) => (
              <ListRow
                key={s.id}
                title={s.title}
                last={i === all.length - 1}
                onPress={() => p.onPick(novel.id, s.id)}
                testID={`promote-season-${s.id}`}
              />
            ))
          : novels.data?.map((n, i, all) => (
              <ListRow
                key={n.id}
                title={n.title}
                subtitle={`${n.chapterCount} chapters`}
                icon="book"
                last={i === all.length - 1}
                onPress={() => setNovelId(n.id)}
                testID={`promote-novel-${n.id}`}
              />
            ))}
      </View>
    </Sheet>
  );
}
