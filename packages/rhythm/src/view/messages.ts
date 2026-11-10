import { defineCatalogs } from '@ie/i18n';

/** Words the fight screen shows, in both languages. The enemy's own name comes from the story. */
export const fightMessages = defineCatalogs({
  en: {
    'fight.label': 'Fight',
    'fight.help':
      'Tap on the beat to strike and parry; swipe to dodge. Keys: F or J to tap, D or K to dodge.',
    'fight.ready': 'Ready',
    'fight.defend': 'Defend',
    'fight.strike': 'Strike',
    'fight.free': 'Strike on the beat',
    'fight.perfect': 'Perfect',
    'fight.great': 'Great',
    'fight.good': 'Good',
    'fight.miss': 'Miss',
    'fight.combo': '{n} combo',
    'fight.enemyHp': 'Enemy strength',
    'fight.playerHp': 'Your strength',
    'fight.victory': 'Victory',
    'fight.defeat': 'Defeat',
    'fight.score': 'Score {n}',
    'fight.continue': 'Continue',
    'fight.phase': '{name} grows desperate',
  },
  tr: {
    'fight.label': 'Dövüş',
    'fight.help':
      'Vurmak ve savuşturmak için ritimde dokunun; kaçmak için kaydırın. Tuşlar: dokunmak için F veya J, kaçmak için D veya K.',
    'fight.ready': 'Hazır',
    'fight.defend': 'Savun',
    'fight.strike': 'Vur',
    'fight.free': 'Ritimde vur',
    'fight.perfect': 'Kusursuz',
    'fight.great': 'Harika',
    'fight.good': 'İyi',
    'fight.miss': 'Kaçtı',
    'fight.combo': '{n} kombo',
    'fight.enemyHp': 'Rakibin gücü',
    'fight.playerHp': 'Senin gücün',
    'fight.victory': 'Zafer',
    'fight.defeat': 'Yenilgi',
    'fight.score': 'Puan {n}',
    'fight.continue': 'Devam',
    'fight.phase': '{name} çaresizleşiyor',
  },
});

export type FightKey = keyof typeof fightMessages.en;
