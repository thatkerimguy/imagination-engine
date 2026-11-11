import { defineCatalogs } from '@ie/i18n';

/** Writing flow: the block picker and the passage's word count. */
export const writingMessages = defineCatalogs({
  en: {
    'picker.search': 'Find a block',
    'picker.none': 'No block matches.',
    'picker.group.write': 'Writing',
    'picker.group.choices': 'Choices and logic',
    'picker.group.flow': 'Flow',
    'picker.group.game': 'Game',
    'picker.group.sound': 'Sound',
    'picker.group.stage': 'Stage and pictures',
    'passage.words': 'Words: {count} · about {minutes} min to read',
    'passage.wordsHint':
      'Words in this passage in the writing language, its choices and branches included.',
    'block.upKeys': 'Alt + ↑',
    'block.downKeys': 'Alt + ↓',
  },
  tr: {
    'picker.search': 'Blok bul',
    'picker.none': 'Eşleşen blok yok.',
    'picker.group.write': 'Yazı',
    'picker.group.choices': 'Seçenekler ve mantık',
    'picker.group.flow': 'Akış',
    'picker.group.game': 'Oyun',
    'picker.group.sound': 'Ses',
    'picker.group.stage': 'Sahne ve resimler',
    'passage.words': 'Kelime: {count} · yaklaşık {minutes} dk okuma',
    'passage.wordsHint': 'Bu pasajdaki kelimeler, yazı dilinde; seçenekler ve dallar dahil.',
    'block.upKeys': 'Alt + ↑',
    'block.downKeys': 'Alt + ↓',
  },
});
