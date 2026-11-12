import { defineCatalogs } from '@ie/i18n';

/** Script view (PLAN §3.3) and device sync (ADR 0024). */
export const scriptMessages = defineCatalogs({
  en: {
    'write.script': 'Script',
    'script.label': 'Script of {name} in {language}',
    'script.apply': 'Apply',
    'script.revert': 'Undo changes',
    'script.dirty': 'Not applied yet. Ctrl+Enter applies.',
    'script.applied': 'Applied.',
    'script.created': 'New passages: {names}.',
    'script.missing': 'Left out {count} kept lines that matched no block here.',
    'script.help': 'How to write',
    'script.help.text': 'A line is narration.',
    'script.help.dialogue': 'Mira: words  is a dialogue line, when Mira is a character.',
    'script.help.choice':
      '* option -> Passage  is a choice option; options in a row make one choice.',
    'script.help.jump': '-> Passage  jumps there. A passage that doesn’t exist yet is made.',
    'script.help.section': '=== Name  starts another passage, so a whole chapter can be pasted.',
    'script.help.other':
      '// note,  @end,  @pause 2.  A line like @fight #b_x keeps a block the script can’t show: leave it, or move it to another place.',
    'script.help.escape': 'Start a line with \\ to keep it plain narration.',
    'sync.title': 'Device sync',
    'sync.intro':
      'Keeps the open novel the same on your phone and computer through your private Studio site. Changes made on both are merged.',
    'sync.now': 'Sync now',
    'sync.off': 'Off on this device.',
    'sync.ready': 'On. Not synced yet.',
    'sync.syncing': 'Syncing…',
    'sync.done': 'Synced at {time}.',
    'sync.missingSongs':
      '{count, plural, one {# song in this story is} other {# songs in this story are}} still only on the device that imported them. Turn sync on there and open the story once.',
    'sync.doneConflicts':
      'Synced at {time}. {count, plural, one {# value was} other {# values were}} changed on both devices; this device’s version was kept.',
    'sync.unavailable':
      'No sync store here. It works on the hosted Studio and on this computer’s dev server.',
    'sync.error': 'Sync failed. It will try again.',
    'sync.elsewhere': 'On other devices',
    'sync.open': 'Open here',
  },
  tr: {
    'write.script': 'Senaryo',
    'script.label': '{name} senaryosu, {language}',
    'script.apply': 'Uygula',
    'script.revert': 'Değişiklikleri geri al',
    'script.dirty': 'Henüz uygulanmadı. Ctrl+Enter uygular.',
    'script.applied': 'Uygulandı.',
    'script.created': 'Yeni pasajlar: {names}.',
    'script.missing': 'Buradaki hiçbir bloğa uymayan {count} korunan satır çıkarıldı.',
    'script.help': 'Nasıl yazılır',
    'script.help.text': 'Her satır bir anlatımdır.',
    'script.help.dialogue': 'Mira: sözler  bir konuşma satırıdır (Mira bir karakterse).',
    'script.help.choice':
      '* seçenek -> Pasaj  bir seçenektir; art arda seçenekler tek bir seçim olur.',
    'script.help.jump': '-> Pasaj  oraya atlar. Henüz olmayan bir pasaj oluşturulur.',
    'script.help.section':
      '=== Ad  başka bir pasaja geçer; böylece bütün bir bölüm yapıştırılabilir.',
    'script.help.other':
      '// not,  @end,  @pause 2.  @fight #b_x gibi bir satır senaryonun gösteremediği bir bloğu korur: olduğu gibi bırak ya da başka bir yere taşı.',
    'script.help.escape': 'Düz anlatım olarak kalması için satırı \\ ile başlat.',
    'sync.title': 'Cihaz eşitleme',
    'sync.intro':
      'Açık romanı özel Stüdyo siten aracılığıyla telefonunda ve bilgisayarında aynı tutar. İki yerde yapılan değişiklikler birleştirilir.',
    'sync.now': 'Şimdi eşitle',
    'sync.off': 'Bu cihazda kapalı.',
    'sync.ready': 'Açık. Henüz eşitlenmedi.',
    'sync.syncing': 'Eşitleniyor…',
    'sync.done': '{time} itibarıyla eşitlendi.',
    'sync.missingSongs':
      'Bu hikâyedeki {count} şarkı hâlâ yalnızca onları içe aktaran cihazda. Orada eşitlemeyi açıp hikâyeyi bir kez açın.',
    'sync.doneConflicts':
      '{time} itibarıyla eşitlendi. {count} değer iki cihazda da değişmişti; bu cihazdaki hâli korundu.',
    'sync.unavailable':
      'Burada eşitleme deposu yok. Barındırılan Stüdyo’da ve bu bilgisayarın geliştirme sunucusunda çalışır.',
    'sync.error': 'Eşitleme başarısız oldu. Yeniden denenecek.',
    'sync.elsewhere': 'Diğer cihazlarda',
    'sync.open': 'Burada aç',
  },
});
