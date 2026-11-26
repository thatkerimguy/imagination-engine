// Search tab (root pager page 2): instant full-text search across every chapter, note and folder on this phone.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { useRepoQuery } from '../store/context.tsx';
import { isRedacted } from '../store/unlock-session.ts';
import { buildSearchIndex, search, type SearchIndex, type SearchScope } from './search-index.ts';
import { openResult } from './open-result.ts';
import { SearchResultRow } from './SearchResultRow.tsx';
import { loadSearchSources } from './search-sources.ts';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { ScreenOptions } from '../ui/ScreenOptions.tsx';
import { EmptyState, Page } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { UnderlineTabs, type TabOption } from '../ui/UnderlineTabs.tsx';

const SCOPES: readonly TabOption<SearchScope>[] = [
  { value: 'all', label: 'All', testID: 'scope-all' },
  { value: 'chapters', label: 'Chapters', testID: 'scope-chapters' },
  { value: 'notes', label: 'Notes', testID: 'scope-notes' },
];

export function SearchView(): ReactNode {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const sources = useRepoQuery('search-sources', loadSearchSources);

  useEffect(() => {
    const id = setTimeout(() => setQuery(text), 120);
    return () => clearTimeout(id);
  }, [text]);

  // Build after the tab-switch animation so switching to Search stays smooth.
  const [index, setIndex] = useState<SearchIndex | null>(null);
  useEffect(() => {
    const src = sources.data;
    if (!src) return;
    const handle = runAfterInteractions(() => {
      setIndex(buildSearchIndex(src, { isLocked: (id) => isRedacted(id, src.meta.get(id)) }));
    });
    return () => handle.cancel();
  }, [sources.data]);
  const results = useMemo(
    () => (index && query.trim() ? search(index, query, { scope, limit: 50 }) : []),
    [index, query, scope],
  );
  const searching = query.trim().length > 0;

  return (
    <Page>
      <ScreenOptions options={{ title: '', headerRight: undefined }} />
      <Txt variant="display" accessibilityRole="header" style={{ paddingTop: space.xs }}>
        Search
      </Txt>
      <View>
        <Field
          value={text}
          onChangeText={setText}
          placeholder="Search chapters and notes"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search"
          testID="search-field"
        />
        {text ? (
          <View style={{ position: 'absolute', right: 0, top: 0 }}>
            <IconBtn
              icon="x"
              size={18}
              accessibilityLabel="Clear search"
              onPress={() => setText('')}
              testID="search-clear"
            />
          </View>
        ) : null}
      </View>
      <UnderlineTabs<SearchScope>
        options={SCOPES}
        value={scope}
        onChange={setScope}
        accessibilityLabel="Search scope"
        testID="search-scope"
      />
      {!searching ? (
        <EmptyState
          icon="search"
          title="Search everything"
          body="Find a word or phrase in any chapter, note or folder."
        />
      ) : results.length === 0 ? (
        <EmptyState icon="search" title="No results" body={`Nothing matches “${query.trim()}”.`} />
      ) : (
        <View>
          {results.map((r, i) => (
            <SearchResultRow
              key={`${r.kind}:${r.id}:${i}`}
              result={r}
              onOpen={() => openResult(r)}
              last={i === results.length - 1}
              testID={`search-result-${i}`}
            />
          ))}
        </View>
      )}
    </Page>
  );
}
