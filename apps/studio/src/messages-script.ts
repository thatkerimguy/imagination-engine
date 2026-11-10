import { defineCatalogs } from '@ie/i18n';

/** Script view: the open passage as plain text (PLAN §3.3). */
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
  },
});
