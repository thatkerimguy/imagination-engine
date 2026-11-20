// Every screen path in one place (Expo Router file routes under src/app/).
const q = (params: Record<string, string | undefined>): string => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  return s.toString();
};

export const routes = {
  shelf: '/',
  newNovel: '/new-novel',
  appSettings: '/settings',
  outline: (novelId: string) => `/novel/${novelId}`,
  novelSettings: (novelId: string) => `/novel/${novelId}/settings`,
  chapter: (novelId: string, seasonId: string, chapterId: string) =>
    `/novel/${novelId}/chapter/${seasonId}/${chapterId}`,
  preview: (novelId: string, seasonId: string, chapterId: string, blockId?: string) =>
    `/preview?${q({ novel: novelId, season: seasonId, chapter: chapterId, block: blockId })}`,
} as const;
