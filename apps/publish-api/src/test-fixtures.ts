export const novel = (seasons: string[] = ['s1']) => ({
  schemaVersion: 1,
  id: 'my-novel',
  title: 'My Novel',
  author: 'A',
  sectionLabel: 'Season',
  theme: {},
  enabledModules: [],
  seasons,
});
export const season = (id: string) => ({ id, title: `Season ${id}`, chapters: [] });
export const chapter = (id: string, status: string, seasonId = 's1') => ({
  id,
  seasonId,
  title: id,
  status,
  blocks: [{ id: '01HZZZZZZZZZZZZZZZZZZZZZ01', kind: 'prose', text: 'Hello' }],
});
export const book = (chapters: unknown[], cover?: unknown) => ({
  novel: novel(),
  seasons: [{ season: season('s1'), chapters }],
  ...(cover ? { cover } : {}),
});
