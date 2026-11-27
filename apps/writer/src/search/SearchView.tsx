// Search tab (root pager page 2): instant full-text search across every chapter, note and folder on this phone.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { useRepoQuery } from '../store/context.tsx';
import { isRedacted } from '../store/unlock-session.ts';
import { buildSearchIndex, search, type SearchIndex, type SearchScope } from './search-index.ts';
import { openResult } from './open-result.ts';
import { SearchResultRow } from './SearchResultRow.tsx';
import { loadSearchSources } from './search-sources.ts';
import { rankerQuery, useFtsHits } from './use-fts-hits.ts';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { ScreenOptions } from '../ui/ScreenOptions.tsx';
import { EmptyState, Page } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { UnderlineTabs, type TabOption } from '../ui/UnderlineTabs.tsx';

export function SearchView(): ReactNode {
  const { t, locale } = useI18n();
  const scopes: readonly TabOption<SearchScope>[] = [
    { value: 'all', label: t('kinds.all'), testID: 'scope-all' },
    { value: 'chapters', label: t('search.scope.chapters'), testID: 'scope-chapters' },
    { value: 'notes', label: t('tab.notes'), testID: 'scope-notes' },
  ];
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
      setIndex(
        buildSearchIndex(src, {
          locale,
          isLocked: (id) => isRedacted(id, src.meta.get(id)),
        }),
      );
    });
    return () => handle.cancel();
  }, [sources.data, locale]);
  const hits = useFtsHits(query);
  const results = useMemo(
    () =>
      index && hits && query.trim()
        ? search(index, rankerQuery(query), { scope, limit: 200 })
            .filter((r) => hits.has(r.id))
            .slice(0, 50)
        : [],
    [index, hits, query, scope],
  );
  const searching = query.trim().length > 0;

  return (
    <Page>
      <ScreenOptions options={{ title: '', headerRight: undefined }} />
      <Txt variant="display" accessibilityRole="header" style={{ paddingTop: space.xs }}>
        {t('tab.search')}
      </Txt>
      <View>
        <Field
          value={text}
          onChangeText={setText}
          placeholder={t('search.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('tab.search')}
          testID="search-field"
        />
        {text ? (
          <View style={{ position: 'absolute', right: 0, top: 0 }}>
            <IconBtn
              icon="x"
              size={18}
              accessibilityLabel={t('search.clear')}
              onPress={() => setText('')}
              testID="search-clear"
            />
          </View>
        ) : null}
      </View>
      <UnderlineTabs<SearchScope>
        options={scopes}
        value={scope}
        onChange={setScope}
        accessibilityLabel={t('search.scopeA11y')}
        testID="search-scope"
      />
      {!searching ? (
        <EmptyState icon="search" title={t('search.empty.title')} body={t('search.empty.body')} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('search.noResults.title')}
          body={t('search.noResults.body', { query: query.trim() })}
        />
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
