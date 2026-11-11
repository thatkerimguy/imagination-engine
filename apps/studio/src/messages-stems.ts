import { defineCatalogs } from '@ie/i18n';

/** Stem separation (ADR 0028). */
export const stemsMessages = defineCatalogs({
  en: {
    'stems.title': 'Drum hits (stem separation)',
    'stems.hint':
      'Splits each song to hear its drums on their own and saves where every hit lands. About {size} MB, and a few minutes a song on a desktop with a good graphics card. The results travel with the novel.',
    'stems.desktopOnly': 'This needs a desktop computer. Phones use the hits a desktop found.',
    'stems.count': 'Songs without drum hits yet: {count}',
    'stems.findAll': 'Find drum hits',
    'stems.done': 'Every analysed song has its drum hits.',
    'stems.working': 'Separating “{name}”… {percent}%',
    'stems.failed': 'Couldn’t separate “{name}”.',
  },
  tr: {
    'stems.title': 'Davul vuruşları (kanal ayırma)',
    'stems.hint':
      'Her şarkıyı ayırıp davulları tek başına dinler ve her vuruşun yerini kaydeder. Yaklaşık {size} MB; iyi bir ekran kartı olan masaüstü bilgisayarda şarkı başına birkaç dakika sürer. Sonuçlar romanla birlikte taşınır.',
    'stems.desktopOnly':
      'Bunun için masaüstü bilgisayar gerekir. Telefonlar masaüstünün bulduğu vuruşları kullanır.',
    'stems.count': 'Davul vuruşları henüz bulunmamış şarkı: {count}',
    'stems.findAll': 'Davul vuruşlarını bul',
    'stems.done': 'Çözümlenen her şarkının davul vuruşları hazır.',
    'stems.working': '“{name}” ayrılıyor… %{percent}',
    'stems.failed': '“{name}” ayrılamadı.',
  },
});
