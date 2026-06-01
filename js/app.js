// Old-Timers — Hitster-style music timeline game (single-device hot-seat MVP).
// All state lives in this one browser tab; no backend.

import { buildDeck, isCorrect } from './engine.js';
import { t, getLang, setLang } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---- i18n ---------------------------------------------------------------
// Apply translations to all static [data-i18n] nodes + a few dynamic bits.
function applyI18n() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('#quit').setAttribute('aria-label', t('quit'));
  if (DATA.counts) $('#poolinfo').textContent = t('poolinfo', { ru: DATA.counts.RU, int: DATA.counts.INT });
}

function renderLangButtons() {
  $$('#lang-picker button').forEach((b) => b.classList.toggle('active', b.dataset.lang === getLang()));
}

$$('#lang-picker button').forEach((b) =>
  b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    applyI18n();
    renderLangButtons();
  }),
);

// ---- data ---------------------------------------------------------------
let DATA = { pools: { RU: [], INT: [] } };

async function loadData() {
  const res = await fetch('data/songs.json');
  DATA = await res.json();
  DATA.counts ??= { RU: DATA.pools.RU.length, INT: DATA.pools.INT.length };
  applyI18n();          // fills in the now-available track counts
  setRandomBackground();
}

// Resize an iTunes artwork URL (stored at 100x100) to NxN — the dimension segment is editable.
const artAt = (url, size) => (url ? url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`) : '');

// Blurred random album cover behind the start screen.
function setRandomBackground() {
  const all = [...(DATA.pools?.RU ?? []), ...(DATA.pools?.INT ?? [])].filter((s) => s.artwork);
  if (!all.length) return;
  const big = artAt(all[Math.floor(Math.random() * all.length)].artwork, 600);
  $('#setup').style.setProperty('--bg-img', `url("${big}")`);
}

// ---- screens ------------------------------------------------------------
const show = (id) => {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
};

// ---- setup choices ------------------------------------------------------
let chosen = { pool: 'BOTH', players: 1, target: 7 };

function wireChoiceGroup(containerSel, key, parse = (v) => v) {
  $$(`${containerSel} .chip`).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$(`${containerSel} .chip`).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      chosen[key] = parse(btn.dataset[key]);
    });
  });
}
wireChoiceGroup('#pool-choices', 'pool');
wireChoiceGroup('#player-choices', 'players', Number);

$('#target').addEventListener('input', (e) => {
  chosen.target = Number(e.target.value);
  $('#target-label').textContent = e.target.value;
});

// ---- game state ---------------------------------------------------------
let G = null;
const audio = $('#player');

// Tracks already shown/heard this session, so games don't repeat them.
const seen = new Set();
const keyOf = (s) => `${s.artist}|${s.title}`;
const markSeen = (s) => seen.add(keyOf(s));
const MIN_FRESH = 16; // when fewer unheard tracks remain than this, start the pool over

function freshDeck(pool) {
  const full = buildDeck(DATA.pools, pool); // shuffled full pool
  const fresh = full.filter((s) => !seen.has(keyOf(s)));
  if (fresh.length >= MIN_FRESH) return fresh;
  seen.clear(); // pool exhausted of unheard tracks → reset and reuse everything
  return full;
}

function startGame() {
  const deck = freshDeck(chosen.pool);
  const players = Array.from({ length: chosen.players }, (_, i) => {
    const starter = deck.pop();        // free starter card, already revealed
    markSeen(starter);
    return { name: t('player', { n: i + 1 }), timeline: [starter] };
  });
  G = { deck, players, cur: 0, target: chosen.target, card: null };
  show('game');
  nextTurn();
}

function nextTurn() {
  if (!G.deck.length) return endGame();
  G.card = G.deck.pop();
  markSeen(G.card);
  audio.src = G.card.previewUrl;
  audio.load();
  renderTurn();
}

// ---- rendering ----------------------------------------------------------
function player() { return G.players[G.cur]; }

function renderTurn() {
  $('#turn-banner').textContent = G.players.length > 1 ? t('turnOf', { name: player().name }) : t('soloTitle');
  $('#turn-sub').textContent = t('cardsToWinSub', { n: G.target });
  renderBoards();
  // reset the play button for the new turn
  $('#play').textContent = t('play');
}

// Render every player's timeline. Only the current player's slots are clickable;
// the rest are shown but dimmed and disabled.
function renderBoards() {
  const wrap = $('#boards');
  wrap.innerHTML = '';
  let activeBoard = null;

  G.players.forEach((p, i) => {
    const active = i === G.cur;
    const board = document.createElement('div');
    board.className = 'player-board' + (active ? ' active' : '');

    if (G.players.length > 1) {
      const head = document.createElement('div');
      head.className = 'player-head';
      const n = p.timeline.length;
      head.innerHTML =
        `<span class="pname">${escapeHtml(p.name)}</span>` +
        `<span class="psub">${escapeHtml(t('cardsCount', { n }))}</span>`;
      board.appendChild(head);
    }

    const row = document.createElement('div');
    row.className = 'timeline';
    const tl = p.timeline; // kept sorted ascending by year
    for (let k = 0; k <= tl.length; k++) {
      // slots (tap targets) only on the active board; others just show their cards
      if (active) {
        const slot = document.createElement('button');
        slot.className = 'slot';
        slot.textContent = '+';
        slot.addEventListener('click', () => placeAt(k));
        row.appendChild(slot);
      }
      if (k < tl.length) row.appendChild(cardEl(tl[k]));
    }
    board.appendChild(row);
    wrap.appendChild(board);
    if (active) activeBoard = board;
  });

  // keep the player whose turn it is in view
  if (activeBoard && G.players.length > 1) {
    activeBoard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function cardEl(song, flash = false) {
  const d = document.createElement('div');
  d.className = 'card' + (flash ? ' flash-good' : '');
  d.innerHTML =
    `<div class="yr">${song.year}</div>` +
    `<div class="ti">${escapeHtml(song.title)}</div>` +
    `<div class="ar">${escapeHtml(song.artist)}</div>`;
  return d;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- audio --------------------------------------------------------------
$('#play').addEventListener('click', () => {
  if (audio.ended) { audio.currentTime = 0; audio.play(); }
  else if (audio.paused) audio.play();
  else audio.pause();
});
audio.addEventListener('play', () => { $('#play').textContent = t('pause'); });
audio.addEventListener('pause', () => { if (!audio.ended) $('#play').textContent = t('play'); });
audio.addEventListener('ended', () => { $('#play').textContent = t('replay'); });

// ---- placement / reveal -------------------------------------------------
function placeAt(k) {
  const tl = player().timeline;
  const correct = isCorrect(tl, G.card.year, k);

  audio.pause();
  if (correct) tl.splice(k, 0, G.card);

  // reveal panel
  const cls = correct ? 'good' : 'bad';
  const v = $('#reveal-verdict');
  v.textContent = correct ? t('correct') : t('wrong');
  v.className = 'verdict ' + cls;
  const yr = $('#reveal-year');
  yr.textContent = G.card.year;
  yr.className = 'reveal-year ' + cls;
  const img = $('#reveal-art');
  const cover = artAt(G.card.artwork, 300);
  if (cover) { img.src = cover; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
  $('#reveal-title').textContent = G.card.title;
  $('#reveal-artist').textContent = G.card.artist;
  $('#reveal').dataset.correct = correct ? '1' : '0';
  $('#reveal').classList.add('show');
}

$('#next').addEventListener('click', () => {
  $('#reveal').classList.remove('show');
  const wasCorrect = $('#reveal').dataset.correct === '1';
  if (wasCorrect && player().timeline.length >= G.target) return endGame();
  G.cur = (G.cur + 1) % G.players.length;
  nextTurn();
});

// ---- end ----------------------------------------------------------------
function endGame() {
  audio.pause();
  const ranked = [...G.players].sort((a, b) => b.timeline.length - a.timeline.length);
  const top = ranked[0];
  const tie = ranked.filter((p) => p.timeline.length === top.timeline.length);
  const n = top.timeline.length;
  $('#winner').textContent =
    G.players.length === 1 ? t('winSolo', { n })
      : tie.length > 1 ? t('winTie', { n })
        : t('win', { name: top.name, n });
  $('#final-scores').innerHTML = ranked
    .map((p) => `<span>${escapeHtml(p.name)}: ${p.timeline.length}</span>`)
    .join('');
  show('gameover');
}

// ---- buttons ------------------------------------------------------------
$('#start').addEventListener('click', startGame);
// show the reset link only when some songs have actually been heard
const updateResetButton = () => { $('#reset-played').hidden = seen.size === 0; };

const goHome = () => { audio.pause(); setRandomBackground(); updateResetButton(); show('setup'); };
$('#again').addEventListener('click', goHome);
$('#quit').addEventListener('click', goHome);
$('#home').addEventListener('click', goHome);

// forget the played-song history so previously-heard tracks can come up again
$('#reset-played').addEventListener('click', () => {
  seen.clear();
  const btn = $('#reset-played');
  btn.textContent = t('resetDone');
  btn.classList.add('done');
  setTimeout(() => {
    btn.textContent = t('resetPlayed');
    btn.classList.remove('done');
    btn.hidden = true; // nothing left to reset
  }, 1500);
});

// ---- go -----------------------------------------------------------------
applyI18n();
renderLangButtons();
updateResetButton();
loadData().catch((e) => { $('#poolinfo').textContent = 'Failed to load songs.json — run `npm run bake`.'; console.error(e); });
