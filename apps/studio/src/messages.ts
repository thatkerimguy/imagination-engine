import { defineCatalogs } from '@ie/i18n';
import { projectMessages } from './messages-project.ts';
import { soundMessages } from './messages-sound.ts';
import { stageMessages } from './messages-stage.ts';
import { writeMessages } from './messages-write.ts';

/** The shell: workspaces, palette, settings and diagnostics. */
const shellMessages = defineCatalogs({
  en: {
    'app.name': 'Studio',
    'app.untitled': 'Untitled novel',
    'nav.label': 'Workspaces',
    'view.write': 'Write',
    'view.flow': 'Flow',
    'view.logic': 'Logic',
    'view.sound': 'Sound',
    'view.stage': 'Stage',
    'view.data': 'Data',
    'view.play': 'Play',
    'view.settings': 'Settings',
    'view.diagnostics': 'Diagnostics',
    'view.more': 'More',
    'desc.write':
      'Write your story like a document. Narration, dialogue, choices and actions are blocks.',
    'desc.flow': 'See every passage and branch as a map, and play from any point.',
    'desc.logic': 'Rules and routines made from sentence blocks: When, If, Do.',
    'desc.sound': 'Music library, beat analysis, sound effects and character voices.',
    'desc.stage': 'Kinetic typography, effects, the sequencer and the material graph.',
    'desc.data': 'Characters, items, skills, enemies and quests.',
    'desc.play': 'Preview your novel exactly as readers will see it.',
    phase: 'Arrives in phase {n}',
    'palette.open': 'Command palette',
    'palette.placeholder': 'Type a command…',
    'palette.empty': 'No matching commands',
    'cmd.goto': 'Go to {view}',
    'cmd.theme': 'Theme: {theme}',
    'cmd.language': 'Language: {language}',
    'cmd.hud': 'Show or hide the performance overlay',
    'settings.intro': 'These settings apply to this device only.',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.system': 'System',
    'settings.theme.paper': 'Paper',
    'settings.theme.night': 'Night',
    'settings.hud': 'Performance overlay',
    'settings.on': 'On',
    'settings.off': 'Off',
    'diagnostics.intro': 'What this device and browser can do. Useful when testing on the phone.',
    'diagnostics.collecting': 'Checking this device…',
    'diagnostics.copy': 'Copy report',
    'diagnostics.copied': 'Copied',
    'diagnostics.refresh': 'Check again',
    close: 'Close',
  },
  tr: {
    'app.name': 'Stüdyo',
    'app.untitled': 'Adsız roman',
    'nav.label': 'Çalışma alanları',
    'view.write': 'Yaz',
    'view.flow': 'Akış',
    'view.logic': 'Mantık',
    'view.sound': 'Ses',
    'view.stage': 'Sahne',
    'view.data': 'Veri',
    'view.play': 'Oynat',
    'view.settings': 'Ayarlar',
    'view.diagnostics': 'Tanılama',
    'view.more': 'Diğer',
    'desc.write':
      'Hikâyeni bir belge gibi yaz. Anlatım, diyalog, seçimler ve eylemler birer bloktur.',
    'desc.flow': 'Tüm pasajları ve dalları bir harita olarak gör, istediğin noktadan oynat.',
    'desc.logic': 'Cümle bloklarından kurallar ve rutinler: Olduğunda, Eğer, Yap.',
    'desc.sound': 'Müzik kitaplığı, ritim analizi, ses efektleri ve karakter sesleri.',
    'desc.stage': 'Kinetik tipografi, efektler, zaman çizelgesi ve materyal grafiği.',
    'desc.data': 'Karakterler, eşyalar, yetenekler, düşmanlar ve görevler.',
    'desc.play': 'Romanını okuyucuların göreceği şekilde önizle.',
    phase: 'Aşama {n} ile geliyor',
    'palette.open': 'Komut paleti',
    'palette.placeholder': 'Bir komut yazın…',
    'palette.empty': 'Eşleşen komut yok',
    'cmd.goto': '{view} görünümüne git',
    'cmd.theme': 'Tema: {theme}',
    'cmd.language': 'Dil: {language}',
    'cmd.hud': 'Performans göstergesini aç veya kapat',
    'settings.intro': 'Bu ayarlar yalnızca bu cihaz için geçerlidir.',
    'settings.language': 'Dil',
    'settings.theme': 'Tema',
    'settings.theme.system': 'Sistem',
    'settings.theme.paper': 'Kâğıt',
    'settings.theme.night': 'Gece',
    'settings.hud': 'Performans göstergesi',
    'settings.on': 'Açık',
    'settings.off': 'Kapalı',
    'diagnostics.intro':
      'Bu cihazın ve tarayıcının neler yapabildiği. Telefonda test ederken işe yarar.',
    'diagnostics.collecting': 'Cihaz kontrol ediliyor…',
    'diagnostics.copy': 'Raporu kopyala',
    'diagnostics.copied': 'Kopyalandı',
    'diagnostics.refresh': 'Yeniden kontrol et',
    close: 'Kapat',
  },
});

/** Each catalog checks its own en/tr keys; together they are the Studio's whole vocabulary. */
export const messages = {
  en: {
    ...shellMessages.en,
    ...writeMessages.en,
    ...projectMessages.en,
    ...soundMessages.en,
    ...stageMessages.en,
  },
  tr: {
    ...shellMessages.tr,
    ...writeMessages.tr,
    ...projectMessages.tr,
    ...soundMessages.tr,
    ...stageMessages.tr,
  },
};

export type MessageKey = keyof typeof messages.en;

/** A new novel's title, in both languages. */
export const UNTITLED = { en: messages.en['app.untitled'], tr: messages.tr['app.untitled'] };
