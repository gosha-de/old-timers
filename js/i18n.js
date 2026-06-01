// Tiny i18n layer. Strings are either plain text or functions of params.
// Language is persisted in localStorage; default follows the browser, falling back to EN.

// Russian count form: [1, 2–4, 5–0] (e.g. карта / карты / карт).
const ruPlural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const DICT = {
  en: {
    tagline: 'Hear a song. Guess where it fits on your timeline.',
    musicFrom: 'Music from',
    poolRU: 'Russia',
    poolINT: 'International',
    poolBOTH: 'Both',
    players: 'Players',
    cardsToWin: 'Cards to win:',
    start: 'Start game',
    poolinfo: ({ ru, int }) => `${ru} Russian + ${int} international tracks loaded`,
    player: ({ n }) => `Player ${n}`,
    turnOf: ({ name }) => `${name}'s turn`,
    soloTitle: 'Your timeline',
    cardsToWinSub: ({ n }) => `${n} cards to win`,
    cardsCount: ({ n }) => `${n} card${n === 1 ? '' : 's'}`,
    mysteryQ: 'What year is this track from?',
    play: '▶ Play',
    pause: '❚❚ Pause',
    replay: '↻ Replay',
    quit: 'Quit game',
    correct: '✓ Correct!',
    wrong: '✗ Wrong spot',
    next: 'Next →',
    winSolo: ({ n }) => `You placed ${n} card${n === 1 ? '' : 's'}!`,
    winTie: ({ n }) => `It's a tie at ${n} card${n === 1 ? '' : 's'}!`,
    win: ({ name, n }) => `${name} wins with ${n} card${n === 1 ? '' : 's'}!`,
    playAgain: 'Play again',
  },
  ru: {
    tagline: 'Угадывайте, в каком году вышел трек',
    musicFrom: 'Музыка',
    poolRU: 'Русская',
    poolINT: 'Зарубежная',
    poolBOTH: 'Любая',
    players: 'Игроки',
    cardsToWin: 'Карточек до победы:',
    start: 'Играть',
    poolinfo: ({ ru, int }) => `${ru} русских + ${int} зарубежных треков`,
    player: ({ n }) => `Игрок ${n}`,
    turnOf: ({ name }) => `Ходит ${name}`,
    soloTitle: 'Ваша лента',
    cardsToWinSub: ({ n }) => `${n} ${ruPlural(n, ['карточка', 'карточки', 'карточек'])} до победы`,
    cardsCount: ({ n }) => `${n} ${ruPlural(n, ['карточка', 'карточки', 'карточек'])}`,
    mysteryQ: 'В каком году вышел этот трек?',
    play: '▶ Слушать',
    pause: '❚❚ Пауза',
    replay: '↻ Заново',
    quit: 'Выйти',
    correct: '✓ Верно!',
    wrong: '✗ Мимо!',
    next: 'Дальше →',
    winSolo: ({ n }) => `Вы собрали ${n} ${ruPlural(n, ['карточку', 'карточки', 'карточек'])}!`,
    winTie: ({ n }) => `Ничья! У всех по ${n} ${ruPlural(n, ['карточке', 'карточки', 'карточек'])}.`,
    win: ({ name, n }) => `Победил ${name}! ${n} ${ruPlural(n, ['карточка', 'карточки', 'карточек'])}.`,
    playAgain: 'Ещё раз',
  },
};

export const LANGS = ['ru', 'en'];

// Safe storage access (absent in Node; can throw in Safari private mode).
let store = null;
try { store = globalThis.localStorage; } catch { /* unavailable */ }
const navLang = (globalThis.navigator?.language || '').toLowerCase();

let lang = store?.getItem('lang') || (navLang.startsWith('ru') ? 'ru' : 'en');

export const getLang = () => lang;
export const setLang = (l) => {
  lang = LANGS.includes(l) ? l : 'en';
  try { store?.setItem('lang', lang); } catch { /* ignore */ }
};

export function t(key, params) {
  const v = DICT[lang][key];
  return typeof v === 'function' ? v(params || {}) : v;
}
